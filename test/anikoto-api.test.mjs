import test from 'node:test';
import assert from 'node:assert/strict';

const SOURCE = 'https://anikoto-frames-and-titles.pages.dev/anikoto_data.json';
const CACHE_KEY = 'tenzora:anikoto-catalog:v1';
const DATA = [
  { id: '6879', item_type: 'decoration', item_name: 'Forest Frolic', category: 'Woodland Friends', price_mana: 3594, animated_image_url: 'https://static.anipixcdn.co/shop/decorations/frame.webp' },
  { id: '7867', item_type: 'title', item_name: 'Koto Legend', category: 'Anikoto', price_mana: 4194, animated_image_url: null },
];
let moduleId = 0;
const freshService = () => import(`../src/services/anikotoApi.js?test=${++moduleId}`);

function browserStorage(t, entries = []) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map(entries);
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { sessionStorage: storage } });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else delete globalThis.window;
  });
  return { storage, values };
}

test('simultaneous consumers and repeated modal opens share one fetch', async t => {
  const { values } = browserStorage(t);
  let resolveFetch;
  const request = t.mock.method(globalThis, 'fetch', () => new Promise(resolve => { resolveFetch = resolve; }));
  const service = await freshService();
  const first = service.fetchAnikotoCatalog();
  const second = service.fetchAnikotoCatalog();
  assert.strictEqual(first, second);
  assert.equal(request.mock.callCount(), 1);
  assert.equal(request.mock.calls[0].arguments[0], SOURCE);
  assert.equal(request.mock.calls[0].arguments[1].credentials, 'omit');
  resolveFetch({ ok: true, json: async () => DATA });
  const catalog = await first;
  assert.deepEqual(catalog, { decorations: [DATA[0]], titles: [DATA[1]] });
  assert.strictEqual(await service.fetchAnikotoCatalog(), catalog);
  assert.strictEqual(service.getCachedAnikotoCatalog(), catalog);
  assert.deepEqual(JSON.parse(values.get(CACHE_KEY)), DATA);
  assert.equal(request.mock.callCount(), 1);
});

test('a reload restores sessionStorage synchronously without a network request', async t => {
  browserStorage(t, [[CACHE_KEY, JSON.stringify(DATA)]]);
  const request = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected fetch'); });
  const service = await freshService();
  const cached = service.getCachedAnikotoCatalog();
  assert.equal(cached.decorations[0].id, '6879');
  assert.equal(cached.titles[0].animated_image_url, null);
  assert.strictEqual(await service.fetchAnikotoCatalog(), cached);
  assert.equal(request.mock.callCount(), 0);
});

test('blocked storage falls back to a single in-memory request', async t => {
  browserStorage(t);
  Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('Storage blocked'); } });
  const request = t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => DATA }));
  const service = await freshService();
  const catalog = await service.fetchAnikotoCatalog();
  assert.strictEqual(await service.fetchAnikotoCatalog(), catalog);
  assert.equal(request.mock.callCount(), 1);
});

test('corrupt storage is replaced with a valid catalog', async t => {
  const { values } = browserStorage(t, [[CACHE_KEY, '{invalid JSON']]);
  const request = t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => DATA }));
  const service = await freshService();
  assert.equal(service.getCachedAnikotoCatalog(), null);
  await service.fetchAnikotoCatalog();
  assert.deepEqual(JSON.parse(values.get(CACHE_KEY)), DATA);
  assert.equal(request.mock.callCount(), 1);
});

test('HTTP and invalid-data failures are not cached and can be retried', async t => {
  const { values } = browserStorage(t);
  const responses = [
    { ok: false, status: 503 },
    { ok: true, json: async () => [{ ...DATA[0], animated_image_url: null }] },
    { ok: true, json: async () => DATA },
  ];
  const request = t.mock.method(globalThis, 'fetch', async () => responses.shift());
  const service = await freshService();
  await assert.rejects(service.fetchAnikotoCatalog(), /503/);
  await assert.rejects(service.fetchAnikotoCatalog(), /missing its image/);
  assert.equal(values.has(CACHE_KEY), false);
  assert.equal(service.getCachedAnikotoCatalog(), null);
  assert.equal((await service.fetchAnikotoCatalog()).decorations.length, 1);
  await service.fetchAnikotoCatalog();
  assert.equal(request.mock.callCount(), 3);
});
