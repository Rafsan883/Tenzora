const FILTER_KEYS = new Set([
  "format", "status", "sort", "year", "season", "genre", "exclude",
  "country", "rating", "language", "onList", "isAdult", "page",
]);

const ALIASES = new Map([
  ["dub", ["format", "DUB"]],
  ["sub", ["format", "SUB"]],
  ["movie", ["format", "MOVIE"]],
  ["movies", ["format", "MOVIE"]],
  ["tv", ["format", "TV"]],
  ["series", ["format", "TV"]],
  ["airing", ["status", "RELEASING"]],
  ["ongoing", ["status", "RELEASING"]],
  ["finished", ["status", "FINISHED"]],
]);

const MULTI_VALUE_KEYS = new Set(["format", "country", "language"]);
const COMMA_VALUE_KEYS = new Set(["genre", "exclude"]);

function cleanText(value) {
  return [...String(value ?? "")].map((character) => {
    const code = character.charCodeAt(0);
    return (code < 32 || code === 127) ? " " : character;
  }).join("").replace(/\s+/g, " ").trim();
}

function addFilter(filters, key, value) {
  if (!FILTER_KEYS.has(key) || !value) return false;
  const normalized = cleanText(value);
  if (!normalized) return false;
  if (MULTI_VALUE_KEYS.has(key)) {
    if (!Array.isArray(filters[key])) filters[key] = [];
    if (!filters[key].includes(normalized)) filters[key].push(normalized);
  } else if (COMMA_VALUE_KEYS.has(key)) {
    const values = normalized.split(",").map(cleanText).filter(Boolean);
    filters[key] = [...new Set([...(filters[key] || []), ...values])];
  } else {
    filters[key] = normalized;
  }
  return true;
}

function tokenize(input) {
  const tokens = [];
  const pattern = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|(\S+)/g;
  let match;
  while ((match = pattern.exec(input))) {
    tokens.push(match[1] ?? match[2] ?? match[3]);
  }
  return tokens;
}

export function parseSearchQuery(input = "") {
  const raw = input instanceof URLSearchParams ? input.toString() : String(input ?? "");
  const source = raw.startsWith("?") ? raw.slice(1) : raw;
  const filters = {};
  const textTerms = [];
  const invalidFilters = [];

  if (source.includes("=") && !/\s/.test(source)) {
    const params = new URLSearchParams(source);
    for (const [key, value] of params) {
      if (key === "search") textTerms.push(cleanText(value));
      else if (!addFilter(filters, key, value)) invalidFilters.push(key);
    }
  } else {
    for (const token of tokenize(source)) {
      const separator = token.indexOf(":");
      if (separator > 0) {
        const key = token.slice(0, separator).toLowerCase();
        const value = token.slice(separator + 1);
        if (!addFilter(filters, key, value)) invalidFilters.push(key);
      } else {
        const alias = ALIASES.get(token.toLowerCase());
        if (alias) addFilter(filters, alias[0], alias[1]);
        else textTerms.push(cleanText(token));
      }
    }
  }

  return {
    text: cleanText(textTerms.join(" ")),
    filters,
    invalidFilters: [...new Set(invalidFilters)],
  };
}

export function serializeSearchQuery(query = {}) {
  const params = new URLSearchParams();
  const text = cleanText(query.text);
  if (text) params.set("search", text);

  const filters = query.filters || {};
  for (const key of [...FILTER_KEYS].sort()) {
    const value = filters[key];
    if (COMMA_VALUE_KEYS.has(key) && value) {
      const values = Array.isArray(value) ? value : String(value).split(",");
      const normalized = [...new Set(values.map(cleanText).filter(Boolean))].sort().join(",");
      if (normalized) params.set(key, normalized);
    } else if (Array.isArray(value)) {
      [...new Set(value.map(cleanText).filter(Boolean))].sort().forEach((item) => params.append(key, item));
    } else if (value !== undefined && value !== null && cleanText(value)) {
      params.set(key, cleanText(value));
    }
  }
  return params.toString();
}

export function parseAndSerializeSearchQuery(input = "") {
  const parsed = parseSearchQuery(input);
  return { ...parsed, queryString: serializeSearchQuery(parsed) };
}

// The browse parser above remains URL/filter-compatible. This export powers
// canonical anime/episode/character resolution without changing browse state.
export const parseSearchIntent = parseCatalogSearchIntent;
import { parseSearchIntent as parseCatalogSearchIntent } from "../../seoCatalogModel.mjs";
