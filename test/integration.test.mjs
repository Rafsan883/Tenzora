import test from 'node:test';
import assert from 'node:assert/strict';
import { readEventStream } from '../src/utils/eventStream.js';
import { animeIdentity, matchesAnime } from '../src/utils/animeIdentity.js';
import { validateMediaURL, mediaProxy, rewriteM3U8, readPlaylist } from '../../Anivexa-API/core/media-proxy.js';
import { get, set, configureCache } from '../../Anivexa-API/core/smartcache.js';
import { toWebVTT } from '../../Anivexa-API/core/subtitles.js';
import { verifyTurnstile } from '../backend-core/src/middleware/turnstileMiddleware.js';
import { withRequestBudget, providerFetch, withDeadline } from '../../Anivexa-API/core/network.js';
import { readPlaylist as readBackendPlaylist, validateMediaURL as validateBackendURL } from '../backend-core/src/utils/mediaProxy.js';

test('SSE handles split Unicode frames and final completion', async () => {
  const encoded = new TextEncoder().encode('data: {"status":"browsing"}\n\ndata: {"status":"done","success":true,"aiMessage":"こんにちは"}\n\n');
  const body = new ReadableStream({ start(controller) { for (let i = 0; i < encoded.length; i += 3) controller.enqueue(encoded.slice(i, i + 3)); controller.close(); } });
  const events = [];
  await readEventStream(new Response(body), event => events.push(event));
  assert.equal(events[1].aiMessage, 'こんにちは');
});
test('SSE propagates server errors and premature stream termination', async () => {
  await assert.rejects(readEventStream(new Response('data: {"status":"error","message":"Quota exhausted"}\n\n'), () => {}), /Quota exhausted/);
  await assert.rejects(readEventStream(new Response('data: {"status":"browsing"}\n\n'), () => {}), /ended before/);
  await assert.rejects(readEventStream(Response.json({ message: 'Sign in first' }, { status: 401 }), () => {}), /Sign in first/);
});
test('watchlist identity does not confuse equal MAL and AniList numbers', () => {
  const identity = animeIdentity({ id: 20, isMAL: true });
  assert.equal(matchesAnime({ animeId: '20', idMal: 30 }, identity), false);
  assert.equal(matchesAnime({ animeId: '1735', idMal: 20 }, identity), true);
});
test('memory cache honors expiry and disabled mode', async () => {
  configureCache({ CACHE_ENABLED: 'true' });
  set('regression:cache', { ok: true }, 20);
  assert.deepEqual(get('regression:cache').data, { ok: true });
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(get('regression:cache'), null);
  configureCache({ CACHE_ENABLED: 'false' });
  set('regression:disabled', {}, 1000);
  assert.equal(get('regression:disabled'), null);
  configureCache({ CACHE_ENABLED: 'true' });
});
test('proxy rejects private addresses, credentials, and disallowed redirect hosts', async t => {
  for (const url of ['http://127.0.0.1/a', 'http://2130706433/a', 'http://[::1]/a', 'http://[::ffff:7f00:1]/a', 'http://169.254.169.254/a', 'http://localhost/a', 'file:///etc/passwd', 'https://user:pass@public.example/a']) assert.throws(() => validateMediaURL(url));
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1/private' } }));
  await assert.rejects(mediaProxy(new Request('https://api.example/api/proxy?url=https://cdn.example/video.m3u8')), /public/);
});
test('HLS rewrites segments, encryption keys, subtitles, and final redirect base', async t => {
  const playlist = '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n#EXT-X-MEDIA:TYPE=SUBTITLES,URI="sub/en.m3u8"\n../video/segment.ts\n';
  t.mock.method(globalThis, 'fetch', async () => {
    const response = new Response(playlist, { headers: { 'Content-Type': 'application/vnd.apple.mpegurl', 'Content-Length': '10', 'Content-Encoding': 'gzip' } });
    Object.defineProperty(response, 'url', { value: 'https://cdn.example/redirected/master.m3u8' });
    return response;
  });
  const result = await mediaProxy(new Request('https://api.example/api/proxy?url=https://cdn.example/original.m3u8'));
  const text = await result.text();
  assert.ok(text.includes(encodeURIComponent('https://cdn.example/redirected/key.bin')));
  assert.ok(text.includes(encodeURIComponent('https://cdn.example/video/segment.ts')));
  assert.equal(result.headers.get('content-length'), null);
  assert.equal(result.headers.get('content-encoding'), null);
  assert.ok(rewriteM3U8(playlist, 'https://cdn.example/a/master.m3u8', '/proxy').includes('URI="/proxy?'));
});
test('binary proxy preserves Range and rejects executable responses', async t => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.headers.get('range'), 'bytes=0-2');
    return new Response(new Uint8Array([1, 2, 3]), { status: 206, headers: { 'Content-Type': 'video/mp4', 'Content-Range': 'bytes 0-2/10', 'Content-Length': '3' } });
  });
  const request = new Request('https://api.example/api/proxy?url=https://cdn.example/video.mp4', { headers: { Range: 'bytes=0-2' } });
  const result = await mediaProxy(request);
  assert.equal(result.status, 206);
  assert.equal(result.headers.get('content-range'), 'bytes 0-2/10');
  assert.equal((await result.arrayBuffer()).byteLength, 3);
  t.mock.method(globalThis, 'fetch', async () => new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } }));
  assert.equal((await mediaProxy(request)).status, 502);
});
test('playlist reads are bounded before buffering an oversized body', async () => {
  for (const read of [readPlaylist, readBackendPlaylist]) {
    await assert.rejects(read(new Response('x'.repeat(100)), 50), /too large/);
  }
  for (const url of ['http://127.0.0.1/a', 'http://[::ffff:7f00:1]/a', 'http://169.254.169.254/a']) assert.throws(() => validateBackendURL(url));
});
test('ASS and SRT subtitles become playable WebVTT, with commas and Unicode preserved', () => {
  const ass = '[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.25,0:00:03.50,Default,,0,0,0,,{\\i1}Hello, world\\Nこんにちは';
  const result = toWebVTT(ass);
  assert.ok(result.includes('00:00:01.250 --> 00:00:03.500'));
  assert.ok(result.includes('Hello, world\nこんにちは'));
  assert.ok(toWebVTT('1\n00:00:01,250 --> 00:00:02,500\nCaption').startsWith('WEBVTT\n'));
  assert.throws(() => toWebVTT('<html>Error</html>'), /Unsupported/);
});
test('Turnstile requires a valid provider verification when configured', async t => {
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; } };
  let next = false;
  await verifyTurnstile({ env: { TURNSTILE_SECRET_KEY: 'test-only' }, body: {} }, response, () => { next = true; });
  assert.equal(response.statusCode, 400);
  assert.equal(next, false);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ success: true }));
  await verifyTurnstile({ env: { TURNSTILE_SECRET_KEY: 'test-only' }, body: { turnstileToken: 'proof' }, ip: '127.0.0.1' }, response, () => { next = true; });
  assert.equal(next, true);
});
test('provider requests have isolated budgets and deadlines cancel upstream work', async t => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (String(_url).includes('slow')) return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true }));
    return Response.json({ ok: true });
  });
  await withRequestBudget(async () => {
    await providerFetch('https://public.example/one');
    await assert.rejects(providerFetch('https://public.example/two'), /budget exhausted/);
  }, 1);
  await withRequestBudget(() => providerFetch('https://public.example/independent'), 1);
  await assert.rejects(withDeadline(() => providerFetch('https://public.example/slow'), 10), /timed out|Aborted/);
});
