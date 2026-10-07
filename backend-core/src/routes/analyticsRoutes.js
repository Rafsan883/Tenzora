import express from 'express';
import rateLimit from 'express-rate-limit';

const router = express.Router();
const limiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });
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

router.post('/events', limiter, (req, res) => {
  const event = String(req.body?.event || '');
  if (!EVENTS.has(event)) return res.status(400).json({ success: false, message: 'Unsupported analytics event' });
  const properties = {};
  for (const [key, value] of Object.entries(req.body?.properties || {})) {
    if (!FIELDS.has(key)) continue;
    const safe = safeValue(value);
    if (safe !== undefined) properties[key] = safe;
  }
  // Deliberately do not log or persist raw request bodies, URLs, identities,
  // tokens, emails, search text, IP addresses, or user-agent strings.
  res.status(204).end();
});

export default router;
