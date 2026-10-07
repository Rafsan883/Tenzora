import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../cf-worker/src/index.js';

test('edge sitemap uses catalog revisions and production-only canonical URLs', async t => {
  const entries = new Map();
  const previousCaches = globalThis.caches;
  globalThis.caches = {
    default: {
      async match(key) { return entries.get(key.url || String(key))?.clone(); },
      async put(key, response) { entries.set(key.url || String(key), response.clone()); },
    },
  };
  t.after(() => {
    if (previousCaches === undefined) delete globalThis.caches;
    else globalThis.caches = previousCaches;
  });

  t.mock.method(globalThis, 'fetch', async url => {
    const target = String(url);
    if (target.endsWith('/api/seo/catalog/version')) return Response.json({ success: true, revision: 7 });
    if (target.includes('/api/seo/catalog/sitemap?')) {
      return Response.json({ success: true, entries: [{
        canonicalId: 'anime-edge-fixture',
        slug: 'edge-fixture--abc12345',
        titles: { canonical: 'Edge Fixture' },
        indexable: true,
        description: 'A sufficiently detailed fixture synopsis for sitemap eligibility and freshness testing.',
        updatedAt: '2026-10-07T00:00:00.000Z',
        episodes: [{ number: 1, title: 'The Edge Fixture', uniqueMetadata: true, available: true, updatedAt: '2026-10-07T00:00:00.000Z' }],
      }] });
    }
    throw new Error(`Unexpected edge request: ${target}`);
  });

  const tasks = [];
  const response = await worker.fetch(
    new Request('https://tenzora.top/sitemap.xml'),
    { SEO_CATALOG_API_URL: 'https://backend.example' },
    { waitUntil(promise) { tasks.push(promise); } },
  );
  await Promise.all(tasks);
  const body = await response.text();

  const recentTasks = [];
  const recentResponse = await worker.fetch(
    new Request('https://tenzora.top/sitemap-recent.xml'),
    { SEO_CATALOG_API_URL: 'https://backend.example' },
    { waitUntil(promise) { recentTasks.push(promise); } },
  );
  await Promise.all(recentTasks);
  const recentBody = await recentResponse.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/xml/);
  assert.match(body, /https:\/\/tenzora\.top\/sitemap-anime-1\.xml/);
  assert.match(body, /https:\/\/tenzora\.top\/sitemap-recent\.xml/);
  assert.match(recentBody, /https:\/\/tenzora\.top\/anime\/edge-fixture--abc12345/);
  assert.match(recentBody, /https:\/\/tenzora\.top\/anime\/edge-fixture--abc12345\/episode\/1/);
  assert.doesNotMatch(`${body}${recentBody}`, /pages\.dev|anixo\.buzz|watch\//);
});

test('edge worker sends public pages and assets to the configured frontend origin', async t => {
  let requestedUrl;
  t.mock.method(globalThis, 'fetch', async url => {
    requestedUrl = String(url);
    return new Response('frontend-origin');
  });

  const response = await worker.fetch(
    new Request('https://tenzora.top/home?source=test'),
    { FRONTEND_URL: 'https://frontend.example' },
    { waitUntil() {} },
  );

  assert.equal(response.status, 200);
  assert.equal(requestedUrl, 'https://frontend.example/home?source=test');
  assert.equal(await response.text(), 'frontend-origin');
});

test('edge provider proxy retries transient failures with bounded upstream handling', async t => {
  const previousCaches = globalThis.caches;
  const entries = new Map();
  globalThis.caches = {
    default: {
      async match(key) { return entries.get(key.url || String(key))?.clone(); },
      async put(key, response) { entries.set(key.url || String(key), response.clone()); },
    },
  };
  t.after(() => {
    if (previousCaches === undefined) delete globalThis.caches;
    else globalThis.caches = previousCaches;
  });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    if (String(url).startsWith('https://api.jikan.moe/')) {
      calls += 1;
      if (calls === 1) return new Response('temporary failure', { status: 503 });
      return Response.json({ data: { mal_id: 1 } });
    }
    throw new Error(`Unexpected provider request: ${url}`);
  });
  const response = await worker.fetch(
    new Request('https://tenzora.top/api/jikan/proxy?path=/v4/anime/1'),
    {},
    { waitUntil() {} },
  );
  assert.equal(response.status, 200);
  assert.equal(calls, 2);
  assert.equal((await response.json()).data.mal_id, 1);
});
