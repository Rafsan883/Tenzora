import axios from 'axios';
import { getBrowseAnime } from './api';
import { buildCharacterSlug, normalizeAnime } from '../../seoCatalogModel.mjs';

function slugSearchText(slug) {
  let decoded = String(slug || '');
  try { decoded = decodeURIComponent(decoded); } catch { /* keep bounded raw text */ }
  return decoded
    .replace(/--[a-z0-9]{8}$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function providerIdentity(entry) {
  const anilist = entry?.providerIds?.anilist || entry?.anilistId;
  const mal = entry?.providerIds?.mal || entry?.idMal;
  return {
    animeId: anilist || mal || null,
    isMal: !anilist && Boolean(mal),
  };
}

export async function resolveAnimeSlug(slug, signal) {
  if (!slug || String(slug).length > 120) return null;

  if (/^\d{1,12}$/.test(String(slug))) {
    return {
      providerIds: { anilist: String(slug), mal: null },
      animeId: String(slug),
      isMal: false,
    };
  }

  try {
    const { data } = await axios.get(`/api/seo/catalog/resolve/${encodeURIComponent(slug)}`, {
      signal,
      timeout: 6000,
    });
    if (data?.entry) return { ...data.entry, ...providerIdentity(data.entry) };
  } catch {
    // Local Vite and older deployments may not expose the catalog endpoint.
    // Resolve through the existing metadata path without changing the UI.
  }

  try {
    const result = await getBrowseAnime({ search: slugSearchText(slug), page: 1, perPage: 10 }, signal);
    const media = result?.media?.[0];
    const normalized = normalizeAnime(media);
    return normalized ? { ...normalized, ...providerIdentity(normalized) } : null;
  } catch {
    return null;
  }
}

export async function resolveAnimeProvider(provider, id, signal) {
  const normalizedProvider = String(provider || '').toLowerCase();
  const normalizedId = String(id || '');
  if (!['anilist', 'mal'].includes(normalizedProvider) || !/^\d{1,12}$/.test(normalizedId)) return null;

  try {
    const { data } = await axios.get(`/api/seo/catalog/provider/${normalizedProvider}/${encodeURIComponent(normalizedId)}`, {
      signal,
      timeout: 6000,
    });
    if (data?.entry) return { ...data.entry, ...providerIdentity(data.entry) };
  } catch {
    // Legacy watch routes remain playable when the SEO catalog is unavailable.
  }
  return null;
}

export async function resolveSearchQuery(query, signal) {
  if (!query || String(query).length > 256) return null;
  try {
    const { data } = await axios.get('/api/seo/catalog/search', {
      params: { q: query },
      signal,
      timeout: 6000,
    });
    const result = data?.results?.[0];
    if (!result) return null;
    if (result.matchType === 'character' && result.matchedCharacter) {
      return {
        ...result,
        route: `/character/${result.matchedCharacter.slug || buildCharacterSlug(result.matchedCharacter.names?.[0] || query, result.matchedCharacter.id || '')}`,
      };
    }
    const episode = result.intent?.episode;
    return {
      ...result,
      route: episode ? `/anime/${result.slug}/episode/${episode}` : `/anime/${result.slug}`,
    };
  } catch {
    return null;
  }
}

export async function resolveCharacterSlug(slug, signal) {
  if (!slug || String(slug).length > 120) return null;
  if (/^\d{1,12}$/.test(String(slug))) return { id: String(slug), slug };
  try {
    const { data } = await axios.get('/api/seo/catalog/search', {
      params: { q: slugSearchText(slug) },
      signal,
      timeout: 6000,
    });
    const result = data?.results?.find(item => item.matchType === 'character' && item.matchedCharacter);
    if (!result?.matchedCharacter) return null;
    return { ...result.matchedCharacter, anime: result };
  } catch {
    return null;
  }
}
