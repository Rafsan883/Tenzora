import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../../Anivexa-API/index.js';
import reanime from '../../Anivexa-API/providers/reanime.js';
import anikoto from '../../Anivexa-API/providers/anikoto.js';
import allmanga from '../../Anivexa-API/providers/allmanga.js';
import animegg from '../../Anivexa-API/providers/animegg.js';
import anineko from '../../Anivexa-API/providers/anineko.js';
import dhive from '../../Anivexa-API/providers/2dhive.js';
import animenosub from '../../Anivexa-API/providers/animenosub.js';
import anizone from '../../Anivexa-API/providers/anizone.js';
import anibd from '../../Anivexa-API/providers/anibd.js';
import anidbapp from '../../Anivexa-API/providers/anidbapp.js';
import kaa from '../../Anivexa-API/providers/kickassanime.js';
import animedunya from '../../Anivexa-API/providers/animedunya.js';
import worker from '../cf-worker/src/index.js';
import { getMedia, forgetMedia } from '../../Anivexa-API/core/anilist.js';

const providers = { reanime, anikoto, allmanga, animegg, anineko, '2dhive': dhive, animenosub, anizone, anibd, anidbapp, kaa, animedunya };
test('all twelve prefixed watch routes dispatch to their provider with real request origin', async t => {
  for (const [name, provider] of Object.entries(providers)) {
    t.mock.method(provider, 'fetch', async request => Response.json({ origin: new URL(request.url).origin, path: new URL(request.url).pathname }));
    const response = await app.fetch(new Request(`https://api.example/watch/${name}/777/sub/${name}-1`), {});
    assert.equal(response.status, 200, name);
    const body = await response.json();
    assert.equal(body.origin, 'https://api.example');
    assert.equal(body.path, name === 'reanime' ? '/watch/777/sub/1' : `/watch/${name}/777/sub/${name}-1`);
  }
});
test('unified watch preserves stream referer and subtitles', async t => {
  t.mock.method(reanime, 'fetch', async () => Response.json({ stream_url: 'https://cdn.example/main.m3u8', streams: [{ url: 'https://cdn.example/alternate.m3u8', type: 'hls', referer: 'https://player.example/' }], subtitles: [{ url: 'https://cdn.example/sub_eng.ass' }] }));
  const response = await app.fetch(new Request('https://api.example/api/watch/778/sub/1'), {});
  assert.equal(response.status, 200);
  const data = (await response.json()).ep_1;
  assert.equal(data.streams[1].referer, 'https://player.example/');
  assert.equal(data.subtitles[0].lang, 'English');
});
test('HLS resolver tries another provider after first provider returns 403', async t => {
  t.mock.method(reanime, 'fetch', async () => Response.json({ stream_url: 'https://cdn.example/blocked.m3u8' }));
  t.mock.method(anikoto, 'fetch', async () => Response.json({ streams: [{ url: 'https://cdn.example/playable.m3u8', type: 'hls', referer: 'https://player.example/' }] }));
  t.mock.method(globalThis, 'fetch', async url => String(url).includes('blocked') ? new Response('blocked', { status: 403 }) : new Response('#EXTM3U\n#EXTINF:5,\nsegment.ts\n'));
  const response = await app.fetch(new Request('https://api.example/api/hls/779/sub/1'), {});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('X-Provider'), 'anikoto');
  assert.ok((await response.text()).includes(encodeURIComponent('https://cdn.example/segment.ts')));
});
test('Worker cache distinguishes GraphQL variables and only reuses exact payloads', async t => {
  const entries = new Map(), tasks = [];
  const previous = globalThis.caches;
  globalThis.caches = { default: {
    async match(key) { return entries.get(key.url || String(key))?.clone(); },
    async put(key, response) { entries.set(key.url || String(key), response.clone()); },
  } };
  t.after(() => { if (previous === undefined) delete globalThis.caches; else globalThis.caches = previous; });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => { calls++; return Response.json({ data: { Media: JSON.parse(options.body).variables } }); });
  const context = { waitUntil(promise) { tasks.push(promise); } };
  const send = async id => {
    const response = await worker.fetch(new Request('https://site.example/api/anilist/proxy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'query ($id: Int) { Media(id: $id) { id } }', variables: { id } }) }), {}, context);
    await Promise.all(tasks);
    return response.json();
  };
  assert.equal((await send(1)).data.Media.id, 1);
  assert.equal((await send(2)).data.Media.id, 2);
  assert.equal((await send(1)).data.Media.id, 1);
  assert.equal(calls, 2);
});
test('Worker scheduler records upstream failures', async t => {
  const errors = [];
  t.mock.method(globalThis, 'fetch', async () => new Response('unavailable', { status: 503 }));
  t.mock.method(console, 'error', (...args) => errors.push(args));
  await worker.scheduled({ cron: '*/30 * * * *' }, { RENDER_BACKEND_URL: 'https://backend.example', CRON_SECRET: 'test-only' });
  assert.ok(errors.some(args => args.some(value => String(value).includes('503'))));
});
test('available AniList metadata retains MAL mapping when Jikan and ARM are offline', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (!String(url).includes('graphql.anilist.co')) throw new Error('Secondary metadata provider offline');
    assert.ok(JSON.parse(options.body).query.includes('idMal'));
    return Response.json({ data: { Media: { id: 998877, idMal: 20, title: { romaji: 'Test' }, status: 'FINISHED' } } });
  });
  const media = await getMedia(998877);
  assert.equal(media.id, 998877);
  assert.equal(media.idMal, 20);
  forgetMedia(998877);
  const latest = await getMedia(998877);
  assert.notEqual(latest, media, 'Invalidating metadata must not reuse a completed in-flight promise.');
});
