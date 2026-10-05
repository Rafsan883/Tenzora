import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { adapterGetAnimeDetails } from '../src/services/animeAdapter.js';

test('Worker metadata loads details while the browser AniList request hangs, and cancels the loser', async t => {
  let cancelled = false;
  t.mock.method(axios, 'post', (_url, _body, options) => new Promise((_, reject) => {
    options.signal.addEventListener('abort', () => { cancelled = true; reject(new axios.CanceledError('cancelled')); }, { once: true });
  }));
  t.mock.method(axios, 'get', async (url, options) => {
    assert.equal(url, 'https://api.example/metadata/204011');
    assert.equal(options.params.source, 'anilist');
    return { data: { id: 204011, anilistId: 204011, idMal: 63098, title: { english: 'Psyren' }, coverImage: { large: 'https://images.example/psyren.jpg' }, _metadataSource: 'anizip' } };
  });
  const cached = [];
  const media = await adapterGetAnimeDetails(204011, false, { metadataApiBase: 'https://api.example/', cacheSet: (...args) => cached.push(args) });
  assert.equal(media.title.english, 'Psyren');
  assert.equal(media.id, 204011);
  assert.equal(media.idMal, 63098);
  assert.equal(cancelled, true);
  assert.equal(cached[0][0], 'adapter_204011_false');
});

test('fast rich AniList details win before any Worker request starts', async t => {
  t.mock.method(axios, 'post', async () => ({ data: { data: { Media: { id: 666010, title: { english: 'Rich Details' }, description: 'Complete synopsis' } } } }));
  t.mock.method(axios, 'get', () => assert.fail('The delayed Worker request must be cancelled'));
  const media = await adapterGetAnimeDetails(666010, false, { metadataApiBase: 'https://api.example' });
  assert.equal(media.description, 'Complete synopsis');
});

test('MAL detail routes preserve their namespace while keeping the canonical AniList mapping', async t => {
  t.mock.method(axios, 'post', async () => ({ data: { errors: [{ message: 'Blocked' }] } }));
  t.mock.method(axios, 'get', async (url, options) => {
    assert.equal(url, 'https://api.example/metadata/63098');
    assert.equal(options.params.source, 'mal');
    return { data: { id: 204011, anilistId: 204011, idMal: 63098, title: { english: 'Psyren' } } };
  });
  const media = await adapterGetAnimeDetails(63098, true, { metadataApiBase: 'https://api.example' });
  assert.equal(media.id, 63098);
  assert.equal(media.idMal, 63098);
  assert.equal(media.anilistId, 204011);
  assert.equal(media.isMAL, true);
});

test('rich direct MAL results keep the AniList mapping without a Python proxy lookup', async t => {
  t.mock.method(axios, 'post', async (_url, body) => {
    assert.equal(body.variables.idMal, 63099);
    return { data: { data: { Media: { id: 204099, idMal: 63099, title: { english: 'Mapped Anime' } } } } };
  });
  t.mock.method(axios, 'get', () => assert.fail('The direct mapping already contains the canonical AniList ID'));
  const media = await adapterGetAnimeDetails(63099, true, { metadataApiBase: 'https://api.example' });
  assert.equal(media.id, 63099);
  assert.equal(media.idMal, 63099);
  assert.equal(media.anilistId, 204099);
  assert.equal(media.isMAL, true);
});

test('a wrong-ID Worker response is rejected and the existing Jikan fallback remains usable', async t => {
  t.mock.method(axios, 'post', async () => ({ data: { errors: [{ message: 'Blocked' }] } }));
  t.mock.method(axios, 'get', async url => {
    if (url === 'https://api.example/metadata/666020') return { data: { id: 999999, title: { english: 'Wrong Anime' } } };
    if (url.startsWith('https://api.ani.zip/')) return { data: { mappings: { mal_id: 666021 } } };
    assert.equal(url, 'https://api.jikan.moe/v4/anime/666021/full');
    return { data: { data: { mal_id: 666021, title: 'Correct Anime', status: 'Finished Airing', images: {} } } };
  });
  const media = await adapterGetAnimeDetails(666020, false, { metadataApiBase: 'https://api.example' });
  assert.equal(media.title.english, 'Correct Anime');
  assert.equal(media.id, 666020);
  assert.equal(media.idMal, 666021);
});
