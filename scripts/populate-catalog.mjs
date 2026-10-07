import { normalizeAnime, isUsefulEpisode } from '../seoCatalogModel.mjs';

const CATALOG_API_URL = (process.env.SEO_CATALOG_API_URL || 'https://anixo-wckh.onrender.com').replace(/\/$/u, '');
const INTERNAL_SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET || '';
const ANILIST_URL = 'https://graphql.anilist.co';
const ANIZIP_URL = 'https://api.ani.zip/mappings';
const defaultSearches = ['Solo Leveling', 'One Piece', 'Attack on Titan'];
const searches = process.argv.slice(2).filter(Boolean);

const ANILIST_QUERY = `
  query ($search: String!) {
    Page(page: 1, perPage: 1) {
      media(type: ANIME, search: $search, sort: POPULARITY_DESC, isAdult: false) {
        id
        idMal
        title { canonical: userPreferred english romaji native userPreferred }
        synonyms
        description(asHtml: false)
        coverImage { extraLarge large }
        bannerImage
        format
        season
        seasonYear
        episodes
        duration
        status
        genres
        averageScore
        popularity
        startDate { year month day }
        characters(perPage: 30, sort: [ROLE, RELEVANCE]) {
          edges {
            role
            node {
              id
              name { full native userPreferred }
              image { large }
            }
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
    throw new Error(`${response.status} from ${new URL(url).origin}`);
  }
  return data;
}

async function findAnime(search) {
  const data = await fetchJson(ANILIST_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: ANILIST_QUERY, variables: { search } }),
  });
  if (data?.errors?.length) throw new Error(`AniList rejected "${search}"`);
  const media = data?.data?.Page?.media?.[0];
  if (!media) throw new Error(`No AniList result for "${search}"`);
  return media;
}

function episodeListFromAniZip(payload) {
  const source = payload?.episodes;
  if (!source) return [];
  const entries = Array.isArray(source)
    ? source.map((episode, index) => [episode?.number || index + 1, episode])
    : Object.entries(source);

  return entries.map(([number, episode]) => ({
    number,
    title: episode?.title || episode?.name,
    description: episode?.description || episode?.overview || episode?.synopsis,
    thumbnail: episode?.thumbnail || episode?.image,
    duration: episode?.duration || episode?.length,
    airDate: episode?.airDate || episode?.airdate || episode?.air_date,
    available: episode?.available !== false,
    updatedAt: new Date().toISOString(),
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

async function upsert(entry) {
  const response = await fetch(`${CATALOG_API_URL}/api/seo/catalog/upsert`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-seo-catalog-secret': INTERNAL_SERVICE_SECRET,
    },
    body: JSON.stringify(entry),
    signal: AbortSignal.timeout(20000),
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

const targets = searches.length ? searches : defaultSearches;
let failures = 0;

for (const search of targets) {
  try {
    const media = await findAnime(search);
    const episodes = await enrichEpisodes(media.id);
    const normalized = normalizeAnime({ ...media, episodeList: episodes });
    const result = await upsert(normalized);
    const usefulEpisodes = result.entry.episodes?.filter(episode => isUsefulEpisode(episode)).length || 0;
    console.log(`✓ ${result.entry.titles.canonical} → ${result.entry.canonicalUrl} (${usefulEpisodes} useful episodes, changed=${result.changed})`);
  } catch (error) {
    failures += 1;
    console.error(`✗ ${search}: ${error.message}`);
  }
}

try {
  const version = await fetchJson(`${CATALOG_API_URL}/api/seo/catalog/version`);
  console.log(`Catalog revision: ${version.revision}; sitemap pages: ${version.pages}`);
} catch (error) {
  failures += 1;
  console.error(`Could not read catalog revision: ${error.message}`);
}

if (failures) process.exitCode = 1;
