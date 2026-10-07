const EVENTS = new Set(['page_view', 'search_submit', 'episode_select', 'video_progress', 'playback_error']);
const FIELDS = new Set(['path', 'route', 'episode', 'milestone', 'queryLength', 'tokenCount', 'hasEpisode', 'hasSeason', 'matchType', 'code', 'category']);

function safeValue(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.min(value, 100000));
  if (typeof value === 'string') return [...value.slice(0, 120)].filter(character => {
    const code = character.charCodeAt(0);
    return code >= 32 && code !== 127;
  }).join('');
  return undefined;
}

export function trackEvent(event, properties = {}) {
  if (typeof window === 'undefined' || !EVENTS.has(event)) return;
  const safeProperties = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!FIELDS.has(key)) continue;
    const safe = safeValue(value);
    if (safe !== undefined) safeProperties[key] = safe;
  }
  const body = JSON.stringify({ event, properties: safeProperties });
  try {
    const blob = new Blob([body], { type: 'application/json' });
    if (navigator.sendBeacon?.('/api/analytics/events', blob)) return;
  } catch { /* fall through to keepalive fetch */ }
  void fetch('/api/analytics/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
    credentials: 'same-origin',
  }).catch(() => {});
}

export function trackPageView(pathname) {
  const path = String(pathname || '').split('?')[0];
  const knownRoute = /^\/(anime|watch|character|staff|browse|schedule|home|community|chat|settings|profile|watchlist|login|terms|dmca)(?:\/|$)/u.exec(path)?.[1];
  trackEvent('page_view', { path: knownRoute ? `/${knownRoute}` : '/' });
}

export function trackSearchSubmit(query, result) {
  const text = String(query || '');
  trackEvent('search_submit', {
    queryLength: text.length,
    tokenCount: text.trim() ? text.trim().split(/\s+/u).length : 0,
    hasEpisode: Boolean(result?.intent?.episode),
    hasSeason: Boolean(result?.intent?.season),
    matchType: result?.matchType || 'browse',
  });
}
