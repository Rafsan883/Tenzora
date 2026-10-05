import express from 'express';
import rateLimit from 'express-rate-limit';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { validateMediaURL, fetchMedia, rewriteM3U8, readPlaylist } from '../utils/mediaProxy.js';

const router = express.Router();
const limiter = rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false });

router.get('/', limiter, async (req, res) => {
  try {
    const target = validateMediaURL(req.query.url);
    const referer = req.query.referer || `${target.origin}/`;
    const headers = { 'User-Agent': 'Mozilla/5.0', Accept: '*/*', 'Accept-Encoding': 'identity', Referer: referer, Origin: new URL(referer).origin };
    for (const name of ['range', 'if-range']) if (req.headers[name]) headers[name] = req.headers[name];
    const response = await fetchMedia(target.href, headers);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    for (const name of ['content-type', 'content-range', 'accept-ranges', 'cache-control', 'etag', 'last-modified']) if (response.headers.has(name)) res.setHeader(name, response.headers.get(name));
    const type = response.headers.get('content-type') || '';
    if (/html|javascript|json|svg/i.test(type)) {
      await response.body?.cancel();
      return res.status(502).json({ error: 'Upstream did not return media' });
    }
    if (/mpegurl/i.test(type) || new URL(response.url || target.href).pathname.endsWith('.m3u8')) {
      const text = await readPlaylist(response);
      if (!response.ok || !text.trim().startsWith('#EXTM3U') || text.length > 2 * 1024 * 1024) return res.status(502).json({ error: 'Invalid upstream playlist' });
      res.removeHeader('content-range');
      res.removeHeader('accept-ranges');
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      return res.status(response.status).send(rewriteM3U8(text, response.url || target.href, `${req.protocol}://${req.get('host')}/api/proxy`, referer));
    }
    res.status(response.status);
    if (!response.headers.has('content-encoding') && response.headers.has('content-length')) res.setHeader('content-length', response.headers.get('content-length'));
    if (!response.body) return res.end();
    await pipeline(Readable.fromWeb(response.body), res);
  } catch (error) {
    if (res.headersSent) return res.destroy(error);
    res.status(error instanceof TypeError || /allowed|blocked/.test(error.message) ? 400 : 502).json({ error: 'Media proxy request failed' });
  }
});

export default router;
