import { normalizeAnime, isUsefulEpisode } from '../seoCatalogModel.mjs';

const CATALOG_API_URL = (process.env.SEO_CATALOG_API_URL || 'https://anixo-wckh.onrender.com').replace(/\/$/u, '');
const SOURCE_API_URL = (process.env.PRIMARY_ANIME_API_URL || CATALOG_API_URL).replace(/\/$/u, '');
const INTERNAL_SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET || '';
const ANILIST_URL = 'https://graphql.anilist.co';
const ANIZIP_URL = 'https://api.ani.zip/mappings';
const defaultSearches = ['Solo Leveling', 'One Piece', 'Attack on Titan', 'Death Note'];

function parseArguments(argv) {
  const options = { positional: [], auto: false, manual: false, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--auto') {
      options.auto = true;
    } else if (argument === '--manual') {
      options.manual = true;
    } else if (argument === '--dry-run') {
      options.dryRun = true;
    } else if (argument === '--help' || argument === '-h') {
      options.help = true;
    } else if (/^--(?:limit|offset)=/u.test(argument)) {
      const [key, ...value] = argument.slice(2).split('=');
      options[key] = value.join('=');
    } else if (argument === '--limit' || argument === '--offset') {
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
  node scripts/populate-catalog.mjs --auto --limit 100 --offset 100 --dry-run
  node scripts/populate-catalog.mjs "One Piece" "Bleach"

Modes:
  --auto       Discover unique anime IDs/titles from the primary backend database.
  --manual     Use positional searches or CATALOG_SEARCHES instead of database discovery.
  --limit N    Process at most N anime in this batch (maximum 1000, default 1000).
  --offset N   Skip the first N discovered anime for the next batch.
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
const useDatabaseDiscovery = !cli.manual && (cli.auto || cli.positional.length === 0);
const batchLimit = positiveInteger(cli.limit ?? process.env.CATALOG_LIMIT, 1000, 1000) || 1000;
const batchOffset = positiveInteger(cli.offset ?? process.env.CATALOG_OFFSET, 0);

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
        characters(perPage: 30, sort: [ROLE, RELEVANCE]) {
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
      characters(perPage: 30, sort: [ROLE, RELEVANCE]) {
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
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(options.timeout || 20000),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Non-JSON response from ${new URL(url).origin}`);
  }
  if (!response.ok) {
    const detail = data?.message || data?.error;
    throw new Error(`${response.status} from ${new URL(url).origin}${detail ? `: ${detail}` : ''}`);
  }
  return data;
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

async function discoverAnime(offset, limit) {
  const url = new URL(`${SOURCE_API_URL}/api/seo/catalog/source/anime`);
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('limit', String(limit));
  const data = await fetchJson(url, {
    headers: { Accept: 'application/json', 'x-seo-catalog-secret': INTERNAL_SERVICE_SECRET },
    timeout: 30000,
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
  const response = await fetch(`${CATALOG_API_URL}/api/seo/catalog/upsert`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-seo-catalog-secret': INTERNAL_SERVICE_SECRET,
    },
    body,
    signal: AbortSignal.timeout(60000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.entry) {
    throw new Error(`${response.status} from catalog API${data?.message ? `: ${data.message}` : ''}`);
  }
  return data;
}

if (!INTERNAL_SERVICE_SECRET) {
  console.error('Missing INTERNAL_SERVICE_SECRET. Export the same value used by Render and Cloudflare Worker first.');
  process.exit(1);
}

const targets = useDatabaseDiscovery
  ? await discoverAnime(batchOffset, batchLimit)
  : (manualSearches.length ? manualSearches : defaultSearches).slice(batchOffset, batchOffset + batchLimit);
let failures = 0;

for (const target of targets) {
  const label = typeof target === 'string'
    ? target
    : target.title || target.anilistId || target.malId || 'unknown anime';
  try {
    const media = await findAnime(target);
    const episodes = await enrichEpisodes(media.id);
    const payload = minimalCatalogPayload(media, episodes);
    const payloadBytes = Buffer.byteLength(JSON.stringify(payload));
    const usefulEpisodes = payload.episodes.filter(episode => isUsefulEpisode(episode)).length;

    if (cli.dryRun) {
      console.log(`[dry-run] ${payload.titles.canonical} (${payloadBytes} bytes, ${payload.episodes.length} episodes, ${payload.characters.length} characters)`);
      continue;
    }

    const result = await upsert(payload);
    console.log(`✓ ${result.entry.titles.canonical} → ${result.entry.canonicalUrl} (${usefulEpisodes} useful episodes, ${payloadBytes} bytes, changed=${result.changed})`);
  } catch (error) {
    failures += 1;
    console.error(`✗ ${label}: ${error.message}`);
  }
}

if (!cli.dryRun) {
  try {
    const version = await fetchJson(`${CATALOG_API_URL}/api/seo/catalog/version`);
    console.log(`Catalog revision: ${version.revision}; sitemap pages: ${version.pages}`);
  } catch (error) {
    failures += 1;
    console.error(`Could not read catalog revision: ${error.message}`);
  }
}

if (failures) process.exitCode = 1;
