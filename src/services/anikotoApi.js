const API_URL = import.meta.env?.VITE_ANIKOTO_API || 'https://anikoto-frames-and-titles.pages.dev/anikoto_data.json';

export { API_URL as ANIKOTO_DATA_URL };

const SESSION_KEY = 'tenzora:anikoto-catalog:v1';
let catalogCache = null;
let pendingRequest = null;
let sessionCacheChecked = false;

function parseCatalog(data) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('The customization catalog is empty or invalid.');
  }

  const catalog = { decorations: [], titles: [] };
  for (const item of data) {
    if (!item || !['decoration', 'title'].includes(item.item_type)
        || typeof item.id !== 'string' || !item.id
        || typeof item.item_name !== 'string' || !item.item_name.trim()
        || typeof item.category !== 'string' || !item.category.trim()
        || !Number.isSafeInteger(item.price_mana) || item.price_mana < 0) {
      throw new Error('The customization catalog contains an invalid item.');
    }
    if (item.animated_image_url !== null) {
      let url;
      try { url = new URL(item.animated_image_url); } catch { /* Validated below. */ }
      if (!url || url.protocol !== 'https:') {
        throw new Error('The customization catalog contains an invalid image URL.');
      }
    } else if (item.item_type === 'decoration') {
      throw new Error('An avatar frame is missing its image URL.');
    }
    catalog[item.item_type === 'decoration' ? 'decorations' : 'titles'].push(item);
  }
  return catalog;
}

// Synchronous reads let a reopened modal render immediately without a spinner.
export function getCachedAnikotoCatalog() {
  if (catalogCache) return catalogCache;
  if (sessionCacheChecked || typeof window === 'undefined') return null;
  sessionCacheChecked = true;
  try {
    const stored = window.sessionStorage.getItem(SESSION_KEY);
    if (stored) catalogCache = parseCatalog(JSON.parse(stored));
  } catch {
    // Corrupt or unavailable browser storage must not prevent loading the UI.
    try { window.sessionStorage.removeItem(SESSION_KEY); } catch { /* Memory cache remains available. */ }
  }
  return catalogCache;
}

export function fetchAnikotoCatalog() {
  const cached = getCachedAnikotoCatalog();
  if (cached) return Promise.resolve(cached);
  if (pendingRequest) return pendingRequest;

  // All consumers (including React StrictMode effects) share one request.
  // Closing a modal must not abort this shared request and trigger a refetch.
  pendingRequest = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(API_URL, {
        signal: controller.signal,
        credentials: 'omit',
        mode: 'cors',
      });
      if (!response.ok) throw new Error(`Customization catalog request failed (${response.status}).`);
      const data = await response.json();
      catalogCache = parseCatalog(data);
      try {
        window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
      } catch {
        // Storage may be blocked or full; the in-memory cache still works.
      }
      return catalogCache;
    } finally {
      clearTimeout(timeout);
    }
  })().finally(() => {
    // Failed requests can be retried; successful data stays cached for the tab
    // session, including full page reloads when sessionStorage is available.
    pendingRequest = null;
  });
  return pendingRequest;
}
