import { OFFICIAL_GENRES, GENRE_MAP } from "../constants/genres";

// Keeps the parser's URL-facing state separate from the API's AniList variables.
export function searchStateToBrowseVariables(state, { defaultPerPage = 30 } = {}) {
  const filters = state?.filters || {};
  const text = state?.text || "";
  const formats = filters.format || [];
  const genres = filters.genre || [];
  const variables = {
    page: Number(filters.page) || 1,
    perPage: text ? 50 : defaultPerPage,
    sort: text ? undefined : [filters.sort || "START_DATE_DESC"],
  };

  if (text) variables.search = text;
  if (formats.length) variables.format_in = formats;
  if (genres.length) {
    const genreIn = [];
    const tagIn = [];
    genres.forEach((genre) => {
      const mapped = Object.prototype.hasOwnProperty.call(GENRE_MAP, genre) ? GENRE_MAP[genre] : genre;
      if (OFFICIAL_GENRES.includes(mapped)) genreIn.push(mapped);
      else tagIn.push(mapped);
    });
    if (genreIn.length) variables.genre_in = genreIn;
    if (tagIn.length) variables.tag_in = tagIn;
    variables.genres = genres;
  }

  if (filters.status) variables.status = filters.status;
  if (filters.year) variables.seasonYear = parseInt(filters.year, 10);
  if (filters.season) variables.season = filters.season;
  if (filters.country?.length === 1) variables.country = filters.country[0];
  if (filters.rating) variables.averageScore_greater = parseInt(filters.rating, 10);
  if (filters.language?.length) variables.language = filters.language;
  if (filters.isAdult === "true" || filters.isAdult === true) variables.isAdult = true;

  return variables;
}
