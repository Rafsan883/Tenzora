import axios from 'axios';

const ANILIST_URL = 'https://graphql.anilist.co';
const ANILIST_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': 'Tenzora/1.0 anime metadata proxy',
};

const VALID_FORMATS = new Set([
  'TV', 'TV_SHORT', 'MOVIE', 'OVA', 'ONA', 'SPECIAL', 'MUSIC', 'MANGA', 'NOVEL', 'ONE_SHOT',
]);
const VALID_SORTS = new Set([
  'SEARCH_MATCH', 'FORMAT', 'START_DATE', 'START_DATE_DESC', 'END_DATE', 'END_DATE_DESC',
  'SCORE', 'SCORE_DESC', 'POPULARITY', 'POPULARITY_DESC', 'TRENDING', 'TRENDING_DESC',
  'EPISODES', 'EPISODES_DESC', 'DURATION', 'DURATION_DESC', 'STATUS', 'STATUS_DESC',
  'UPDATED_AT', 'UPDATED_AT_DESC', 'CHAPTERS', 'CHAPTERS_DESC', 'VOLUMES', 'VOLUMES_DESC',
  'FAVOURITES', 'FAVOURITES_DESC', 'TITLE_ROMAJI', 'TITLE_ROMAJI_DESC', 'TITLE_ENGLISH',
  'TITLE_ENGLISH_DESC', 'TITLE_NATIVE', 'TITLE_NATIVE_DESC', 'ID', 'ID_DESC',
]);
const VALID_STATUSES = new Set(['FINISHED', 'RELEASING', 'NOT_YET_RELEASED', 'CANCELLED', 'HIATUS']);
const VALID_SEASONS = new Set(['WINTER', 'SPRING', 'SUMMER', 'FALL']);
const VALID_COUNTRIES = new Set(['JP', 'CN', 'KR', 'TW', 'US', 'GB', 'DE', 'FR', 'CA', 'AU', 'RU', 'ES', 'IT', 'BR', 'IN']);
const OFFICIAL_GENRES = new Set([
  'Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi', 'Fantasy', 'Horror', 'Mahou Shoujo',
  'Mecha', 'Music', 'Mystery', 'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life',
  'Sports', 'Supernatural', 'Thriller',
]);

const BROWSE_QUERY = `
  query (
    $page: Int,
    $perPage: Int,
    $search: String,
    $format_in: [MediaFormat],
    $sort: [MediaSort],
    $seasonYear: Int,
    $status: MediaStatus,
    $genre_in: [String],
    $tag_in: [String],
    $season: MediaSeason,
    $country: CountryCode,
    $averageScore_greater: Int,
    $isAdult: Boolean,
    $withDub: Boolean = false
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { total currentPage lastPage hasNextPage perPage }
      media(
        type: ANIME
        search: $search
        format_in: $format_in
        sort: $sort
        seasonYear: $seasonYear
        status: $status
        genre_in: $genre_in
        tag_in: $tag_in
        season: $season
        countryOfOrigin: $country
        averageScore_greater: $averageScore_greater
        isAdult: $isAdult
      ) {
        id
        idMal
        title { romaji english native userPreferred }
        coverImage { extraLarge large medium }
        format
        episodes
        season
        seasonYear
        genres
        tags { name }
        nextAiringEpisode { airingAt episode }
        averageScore
        status
        countryOfOrigin
        isAdult
        characters(perPage: 10) @include(if: $withDub) {
          edges { voiceActors(language: ENGLISH) { id } }
        }
      }
    }
  }
`;

const SCHEDULE_QUERY = `
  query ($page: Int!, $perPage: Int!, $airingAt_greater: Int!, $airingAt_lesser: Int!) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { total currentPage lastPage hasNextPage perPage }
      airingSchedules(
        airingAt_greater: $airingAt_greater
        airingAt_lesser: $airingAt_lesser
        sort: TIME
      ) {
        id
        airingAt
        episode
        media {
          id
          idMal
          title { romaji english native userPreferred }
          coverImage { extraLarge large medium }
          format
          episodes
          status
          popularity
          isAdult
        }
      }
    }
  }
`;

function values(value) {
  if (Array.isArray(value)) return value.flatMap(values);
  if (value === undefined || value === null || value === '') return [];
  return String(value).split(',').map(item => item.trim()).filter(Boolean);
}

function queryValues(query, ...keys) {
  return keys.flatMap(key => values(query[key] ?? query[`${key}[]`])).filter(Boolean);
}

function firstValue(query, ...keys) {
  return queryValues(query, ...keys)[0] || '';
}

function integer(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function boolean(value) {
  return value === true || value === 'true' || value === '1';
}

function normalizeBrowseVariables(query, { search, perPage = 30 } = {}) {
  const text = String(search ?? firstValue(query, 'search', 'q')).trim().slice(0, 180);
  const variables = {
    page: integer(firstValue(query, 'page'), 1, 1, 100),
    perPage: integer(firstValue(query, 'perPage', 'limit'), perPage, 1, 50),
  };

  if (text) variables.search = text;

  const formats = queryValues(query, 'format_in', 'format').filter(format => VALID_FORMATS.has(format));
  if (formats.length) variables.format_in = [...new Set(formats)];

  const explicitGenres = queryValues(query, 'genre_in', 'genre');
  const rawGenres = queryValues(query, 'genres');
  const genreIn = [...new Set(explicitGenres.filter(Boolean))];
  const tagIn = queryValues(query, 'tag_in');
  for (const genre of rawGenres) {
    if (OFFICIAL_GENRES.has(genre)) genreIn.push(genre);
    else tagIn.push(genre);
  }
  if (genreIn.length) variables.genre_in = [...new Set(genreIn)];
  if (tagIn.length) variables.tag_in = [...new Set(tagIn)];

  const sorts = queryValues(query, 'sort').filter(sort => VALID_SORTS.has(sort));
  if (sorts.length) variables.sort = [...new Set(sorts)];
  else if (!text) variables.sort = ['START_DATE_DESC'];

  const status = firstValue(query, 'status');
  if (VALID_STATUSES.has(status)) variables.status = status;

  const season = firstValue(query, 'season');
  if (VALID_SEASONS.has(season)) variables.season = season;

  const seasonYear = integer(firstValue(query, 'seasonYear', 'year'), 0, 1900, 2200);
  if (seasonYear) variables.seasonYear = seasonYear;

  const country = firstValue(query, 'country');
  if (VALID_COUNTRIES.has(country)) variables.country = country;

  const rating = integer(firstValue(query, 'averageScore_greater', 'rating'), -1, 0, 100);
  if (rating >= 0) variables.averageScore_greater = rating;

  const language = queryValues(query, 'language');
  variables.withDub = language.length === 1 && language[0] === 'DUB';

  // Keep normal browsing SFW. A deliberately explicit isAdult=true request
  // remains available for the advanced filter, while text search follows the
  // existing frontend behavior and does not add an isAdult=false constraint.
  if (boolean(firstValue(query, 'isAdult'))) variables.isAdult = true;
  else if (!text) variables.isAdult = false;

  return variables;
}

async function requestAniList(query, variables) {
  const response = await axios.post(ANILIST_URL, { query, variables }, {
    headers: ANILIST_HEADERS,
    timeout: 12000,
  });
  if (response.data?.errors?.length) {
    const error = new Error(response.data.errors.map(item => item.message).join('; '));
    error.status = 502;
    throw error;
  }
  return response.data?.data;
}

function pageResponse(page, variables) {
  return {
    success: true,
    media: Array.isArray(page?.media) ? page.media : [],
    pageInfo: page?.pageInfo || {
      total: 0,
      currentPage: variables.page,
      lastPage: variables.page,
      hasNextPage: false,
      perPage: variables.perPage,
    },
  };
}

function sendProviderError(res, error, label) {
  console.error(`[AniList] ${label} failed:`, error.message);
  return res.status(502).json({ success: false, message: `AniList ${label} is unavailable` });
}

export async function browseAnime(req, res) {
  const variables = normalizeBrowseVariables(req.query);
  try {
    const data = await requestAniList(BROWSE_QUERY, variables);
    return res.json(pageResponse(data?.Page, variables));
  } catch (error) {
    return sendProviderError(res, error, 'browse');
  }
}

export async function searchAnime(req, res) {
  const query = String(req.query.q ?? req.query.search ?? '').trim().slice(0, 180);
  if (!query) return res.json(pageResponse(null, { page: 1, perPage: 15 }));

  const variables = { page: 1, perPage: 15, search: query, isAdult: false };
  try {
    const data = await requestAniList(BROWSE_QUERY, variables);
    return res.json(pageResponse(data?.Page, variables));
  } catch (error) {
    return sendProviderError(res, error, 'search');
  }
}

function timestampSeconds(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(Math.abs(parsed) > 100000000000 ? parsed / 1000 : parsed);
}

function scheduleBounds(query) {
  let start = timestampSeconds(firstValue(query, 'startTimestamp', 'start', 'airingAt_greater'));
  let end = timestampSeconds(firstValue(query, 'endTimestamp', 'end', 'airingAt_lesser'));

  const date = firstValue(query, 'date');
  if (start === null && /^\d{4}-\d{2}-\d{2}$/u.test(date)) {
    const startDate = new Date(`${date}T00:00:00.000Z`);
    start = Math.floor(startDate.getTime() / 1000);
    end = start + 86400;
  }

  if (start === null) return null;
  if (end === null) end = start + 86400;
  if (end <= start) return null;
  return { start, end };
}

export async function animeSchedule(req, res) {
  const bounds = scheduleBounds(req.query);
  if (!bounds) return res.status(400).json({ success: false, message: 'A valid schedule start and end are required' });

  const variables = {
    page: integer(firstValue(req.query, 'page'), 1, 1, 100),
    perPage: integer(firstValue(req.query, 'perPage', 'limit'), 50, 1, 50),
    // AniList treats these bounds as exclusive. The one-second padding keeps
    // midnight releases in the requested calendar day.
    airingAt_greater: bounds.start - 1,
    airingAt_lesser: bounds.end + 1,
  };

  try {
    const data = await requestAniList(SCHEDULE_QUERY, variables);
    return res.json({
      success: true,
      entries: Array.isArray(data?.Page?.airingSchedules) ? data.Page.airingSchedules : [],
      pageInfo: data?.Page?.pageInfo || { total: 0, hasNextPage: false },
      bounds,
    });
  } catch (error) {
    return sendProviderError(res, error, 'schedule');
  }
}
