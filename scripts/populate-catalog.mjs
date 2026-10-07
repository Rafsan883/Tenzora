import { normalizeAnime, isUsefulEpisode } from '../seoCatalogModel.mjs';

const CATALOG_API_URL = (process.env.SEO_CATALOG_API_URL || 'https://anixo-wckh.onrender.com').replace(/\/$/u, '');
const SOURCE_API_URL = (process.env.PRIMARY_ANIME_API_URL || CATALOG_API_URL).replace(/\/$/u, '');
const INTERNAL_SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET || '';
const ANILIST_URL = 'https://graphql.anilist.co';
const ANIZIP_URL = 'https://api.ani.zip/mappings';
const defaultSearches = ['Solo Leveling', 'One Piece', 'Attack on Titan', 'Death Note'];

function parseArguments(argv) {
  const options = { positional: [], auto: false, manual: false, topRanked: false, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--auto') {
      options.auto = true;
    } else if (argument === '--manual') {
      options.manual = true;
    } else if (argument === '--top-ranked') {
      options.topRanked = true;
    } else if (argument === '--dry-run') {
      options.dryRun = true;
    } else if (argument === '--help' || argument === '-h') {
      options.help = true;
    } else if (/^--(?:limit|offset|page-size|provider-delay-ms|write-delay-ms|page-delay-ms)=/u.test(argument)) {
      const [key, ...value] = argument.slice(2).split('=');
      options[key] = value.join('=');
    } else if (['--limit', '--offset', '--page-size', '--provider-delay-ms', '--write-delay-ms', '--page-delay-ms'].includes(argument)) {
      options[argument.slice(2)] = argv[++index];
    } else if (argument.startsWith('--')) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      options.positional.push(argument);
    }
  }
  return options;
}

function positiveInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Number.parseInt(value, 10);
  if (!Number.isInteger(number) || number < 0) return fallback;
  return Math.min(number, maximum);
}

const cli = parseArguments(process.argv.slice(2));
if (cli.help) {
  console.log(`Usage:
  node scripts/populate-catalog.mjs --auto --limit 100 --offset 0
  node scripts/populate-catalog.mjs --top-ranked --limit 10000 --page-size 50
  node scripts/populate-catalog.mjs --auto --limit 100 --offset 100 --dry-run
  node scripts/populate-catalog.mjs "One Piece" "Bleach"

Modes:
  --auto       Discover unique anime IDs/titles from the primary backend database.
  --manual     Use positional searches or CATALOG_SEARCHES instead of database discovery.
  --top-ranked Fetch global AniList rankings, including TV, MOVIE, and OVA formats.
  --limit N    Process at most N anime (maximum 1000 normally, 10000 ranked).
  --offset N   Skip the first N discovered/ranked anime for resuming a batch.
  --page-size N Fetch N ranked anime per AniList page (maximum 50, default 50).
  --provider-delay-ms N  Minimum delay between AniList/AniZip requests (default 400).
  --write-delay-ms N     Minimum delay between Render catalog writes (default 500).
  --page-delay-ms N      Extra delay between ranked AniList pages (default 750).
  --dry-run    Fetch and compact payloads, but do not write to the SEO catalog.

Environment:
  PRIMARY_ANIME_API_URL  Backend URL used for database discovery; defaults to SEO_CATALOG_API_URL.
  CATALOG_SEARCHES       Backward-compatible pipe-separated manual search list.
`);
  process.exit(0);
}

const configuredSearches = (process.env.CATALOG_SEARCHES || '')
  .split('|')
  .map(search => search.trim())
  .filter(Boolean);
const manualSearches = cli.positional.length ? cli.positional : configuredSearches;
const useDatabaseDiscovery = !cli.topRanked && !cli.manual && (cli.auto || cli.positional.length === 0);
const batchLimit = positiveInteger(cli.limit ?? process.env.CATALOG_LIMIT, cli.topRanked ? 10000 : 1000, cli.topRanked ? 10000 : 1000) || (cli.topRanked ? 10000 : 1000);
const batchOffset = positiveInteger(cli.offset ?? process.env.CATALOG_OFFSET, 0);
const pageSize = positiveInteger(cli['page-size'] ?? process.env.CATALOG_PAGE_SIZE, 50, 50) || 50;
const providerDelayMs = positiveInteger(cli['provider-delay-ms'] ?? process.env.CATALOG_PROVIDER_DELAY_MS, 400);
const writeDelayMs = positiveInteger(cli['write-delay-ms'] ?? process.env.CATALOG_WRITE_DELAY_MS, 500);
const pageDelayMs = positiveInteger(cli['page-delay-ms'] ?? process.env.CATALOG_PAGE_DELAY_MS, 750);

const lastRequestAt = { provider: 0, write: 0 };

async function throttle(kind) {
  const delay = kind === 'write' ? writeDelayMs : providerDelayMs;
  const wait = lastRequestAt[kind] + delay - Date.now();
  if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
  lastRequestAt[kind] = Date.now();
}

const ANILIST_SEARCH_QUERY = `
  query ($search: String!) {
    Page(page: 1, perPage: 1) {
      media(type: ANIME, search: $search, sort: POPULARITY_DESC, isAdult: false) {
        id
        title { userPreferred english romaji native }
        description(asHtml: false)
        coverImage { extraLarge large }
        format
        season
        seasonYear
        episodes
        status
        startDate { year month day }
        characters(perPage: 6, sort: [ROLE, RELEVANCE]) {
          edges {
            node {
              id
              name { full native userPreferred }
            }
          }
        }
      }
    }
  }
`;

const ANILIST_TOP_RANKED_QUERY = `
  query ($page: Int!, $perPage: Int!) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { currentPage lastPage total hasNextPage }
      media(
        type: ANIME
        format_in: [TV, MOVIE, OVA]
        sort: [SCORE_DESC, POPULARITY_DESC]
        isAdult: false
      ) {
        id
        title { userPreferred english romaji native }
        description(asHtml: false)
        coverImage { extraLarge large }
        format
        season
        seasonYear
        episodes
        characters(perPage: 6, sort: [ROLE, RELEVANCE]) {
          edges {
            node {
              id
              name { full native userPreferred }
            }
          }
        }
      }
    }
  }
`;

const ANILIST_DETAIL_QUERY = `
  query ($id: Int, $idMal: Int) {
    Media(id: $id, idMal: $idMal, type: ANIME) {
      id
      title { userPreferred english romaji native }
      description(asHtml: false)
      coverImage { extraLarge large }
      format
      season
      seasonYear
      episodes
      status
      startDate { year month day }
      characters(perPage: 6, sort: [ROLE, RELEVANCE]) {
        edges {
          node {
            id
            name { full native userPreferred }
          }
        }
      }
    }
  }
`;

async function fetchJson(url, options = {}) {
  const {
    timeout = 20000,
    retries = 3,
    kind = 'provider',
    ...requestOptions
  } = options;
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    await throttle(kind);
    try {
      const response = await fetch(url, {
        ...requestOptions,
        signal: AbortSignal.timeout(timeout),
      });
      const text = await response.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        lastError = new Error(`Non-JSON response from ${new URL(url).origin}`);
        if (response.status < 500 && response.status !== 429) throw lastError;
      }

      if (response.ok && data !== null) return data;

      const detail = data?.message || data?.error;
      lastError = new Error(`${response.status} from ${new URL(url).origin}${detail ? `: ${detail}` : ''}`);
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === retries) throw lastError;

      const retryAfter = Number.parseInt(response.headers.get('retry-after') || '', 10);
      const backoff = Number.isFinite(retryAfter)
        ? retryAfter * 1000
        : Math.min(30000, 1000 * (2 ** attempt));
      await new Promise(resolve => setTimeout(resolve, backoff));
    } catch (error) {
      lastError = error;
      if (attempt === retries || /Non-JSON|^4\d\d/u.test(error.message || '')) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.min(30000, 1000 * (2 ** attempt))));
    }
  }

  throw lastError || new Error('Request failed');
}

async function findAnime(target) {
  const isReference = typeof target === 'object' && target !== null;
  const hasProviderId = isReference && (target.anilistId || target.malId);
  const query = hasProviderId ? ANILIST_DETAIL_QUERY : ANILIST_SEARCH_QUERY;
  const variables = hasProviderId
    ? target.anilistId ? { id: Number(target.anilistId) } : { idMal: Number(target.malId) }
    : { search: isReference ? target.title : target };
  const data = await fetchJson(ANILIST_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (data?.errors?.length) throw new Error(`AniList rejected ${isReference ? JSON.stringify(target) : `"${target}"`}`);
  const media = hasProviderId ? data?.data?.Media : data?.data?.Page?.media?.[0];
  if (!media) throw new Error(`No AniList result for ${isReference ? JSON.stringify(target) : `"${target}"`}`);
  return media;
}

async function fetchTopRankedPage(page) {
  const data = await fetchJson(ANILIST_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: ANILIST_TOP_RANKED_QUERY,
      variables: { page, perPage: pageSize },
    }),
  });
  if (data?.errors?.length) throw new Error(`AniList ranking page ${page} failed`);
  return data?.data?.Page || { media: [], pageInfo: { hasNextPage: false } };
}

async function discoverAnime(offset, limit) {
  const url = new URL(`${SOURCE_API_URL}/api/seo/catalog/source/anime`);
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('limit', String(limit));
  const data = await fetchJson(url, {
    headers: { Accept: 'application/json', 'x-seo-catalog-secret': INTERNAL_SERVICE_SECRET },
    timeout: 30000,
    kind: 'write',
  });
  console.log(`Discovered ${data.items?.length || 0} of ${data.total || 0} unique anime references (offset=${offset}, limit=${limit}).`);
  return data.items || [];
}

function episodeListFromAniZip(payload) {
  const source = payload?.episodes;
  if (!source) return [];
  const entries = Array.isArray(source)
    ? source.map((episode, index) => [episode?.number || index + 1, episode])
    : Object.entries(source);

  // Keep only fields needed by normalizeAnime. Descriptions, thumbnails,
  // durations, and provider-specific metadata are deliberately discarded
  // before the payload reaches the catalog API.
  return entries.map(([number, episode]) => ({
    number,
    title: episode?.title || episode?.name,
    airDate: episode?.airDate || episode?.airdate || episode?.air_date,
    available: episode?.available !== false,
  }));
}

async function enrichEpisodes(anilistId) {
  try {
    const payload = await fetchJson(`${ANIZIP_URL}?anilist_id=${encodeURIComponent(anilistId)}`, { timeout: 10000 });
    return episodeListFromAniZip(payload);
  } catch (error) {
    console.warn(`  Episode enrichment skipped for AniList ${anilistId}: ${error.message}`);
    return [];
  }
}

function minimalCatalogPayload(media, episodeInputs) {
  const normalized = normalizeAnime({ ...media, episodeList: episodeInputs });
  if (!normalized?.providerIds?.anilist) throw new Error('AniList identity is missing from provider response');

  const description = normalized.description?.slice(0, 600) || null;
  return {
    canonicalId: normalized.canonicalId,
    slug: normalized.slug,
    providerIds: { anilist: normalized.providerIds.anilist },
    titles: { canonical: normalized.titles.canonical },
    format: normalized.format,
    season: normalized.season,
    seasonYear: normalized.seasonYear,
    description,
    image: normalized.image,
    episodeCount: normalized.episodeCount,
    episodes: normalized.episodes.map(episode => ({
      number: episode.number,
      title: episode.title || null,
      airDate: episode.airDate || null,
      available: episode.available !== false,
    })),
    characters: normalized.characters.map(character => ({
      id: character.id,
      names: character.names.slice(0, 2),
      slug: character.slug,
    })),
    metadataState: description ? 'complete' : 'partial',
    indexable: Boolean(description),
  };
}

async function upsert(entry) {
  const body = JSON.stringify(entry);
  const data = await fetchJson(`${CATALOG_API_URL}/api/seo/catalog/upsert`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-seo-catalog-secret': INTERNAL_SERVICE_SECRET,
    },
    body,
    timeout: 60000,
    retries: 4,
    kind: 'write',
  });
  if (!data?.entry) throw new Error('Catalog API returned no entry');
  return data;
}

async function processMedia(media) {
  const episodes = await enrichEpisodes(media.id);
  const payload = minimalCatalogPayload(media, episodes);
  const payloadBytes = Buffer.byteLength(JSON.stringify(payload));
  const usefulEpisodes = payload.episodes.filter(episode => isUsefulEpisode(episode)).length;

  if (cli.dryRun) {
    console.log(`[dry-run] ${payload.titles.canonical} (${payloadBytes} bytes, ${payload.episodes.length} episodes, ${payload.characters.length} characters)`);
    return;
  }

  const result = await upsert(payload);
  console.log(`✓ ${result.entry.titles.canonical} → ${result.entry.canonicalUrl} (${usefulEpisodes} useful episodes, ${payloadBytes} bytes, changed=${result.changed})`);
}

if (!INTERNAL_SERVICE_SECRET) {
  console.error('Missing INTERNAL_SERVICE_SECRET. Export the same value used by Render and Cloudflare Worker first.');
  process.exit(1);
}

let failures = 0;

if (cli.topRanked) {
  let page = Math.floor(batchOffset / pageSize) + 1;
  let skipInPage = batchOffset % pageSize;
  let remaining = batchLimit;
  let processed = 0;
  let examined = 0;

  while (remaining > 0) {
    let pageData;
    try {
      pageData = await fetchTopRankedPage(page);
    } catch (error) {
      failures += 1;
      console.error(`✗ AniList ranking page ${page}: ${error.message}`);
      break;
    }

    const media = pageData.media || [];
    const selected = media.slice(skipInPage, skipInPage + remaining);
    for (const item of selected) {
      try {
        await processMedia(item);
        processed += 1;
      } catch (error) {
        failures += 1;
        console.error(`✗ ${item.title?.userPreferred || item.title?.english || item.id}: ${error.message}`);
      } finally {
        examined += 1;
        remaining -= 1;
      }
    }

    if (!media.length || !pageData.pageInfo?.hasNextPage || remaining <= 0) break;
    page += 1;
    skipInPage = 0;
    await new Promise(resolve => setTimeout(resolve, pageDelayMs));
  }
  console.log(`Ranked seed batch finished: ${processed}/${examined} anime processed, next offset=${batchOffset + examined}.`);
} else {
  const targets = useDatabaseDiscovery
    ? await discoverAnime(batchOffset, batchLimit)
    : (manualSearches.length ? manualSearches : defaultSearches).slice(batchOffset, batchOffset + batchLimit);

  for (const target of targets) {
    const label = typeof target === 'string'
      ? target
      : target.title || target.anilistId || target.malId || 'unknown anime';
    try {
      const media = await findAnime(target);
      await processMedia(media);
    } catch (error) {
      failures += 1;
      console.error(`✗ ${label}: ${error.message}`);
    }
  }
}

if (!cli.dryRun) {
  try {
    const version = await fetchJson(`${CATALOG_API_URL}/api/seo/catalog/version`, { kind: 'write' });
    console.log(`Catalog revision: ${version.revision}; sitemap pages: ${version.pages}`);
  } catch (error) {
    failures += 1;
    console.error(`Could not read catalog revision: ${error.message}`);
  }
}

if (failures) process.exitCode = 1;
