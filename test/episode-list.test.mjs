import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEpisodeNumbers } from '../src/hooks/useEpisodeList.js';

test('airing anime uses its declared episode count when no next episode exists', () => {
  const episodes = buildEpisodeNumbers({
    anime: { status: 'RELEASING', episodes: 1122, nextAiringEpisode: null },
  });

  assert.equal(episodes.length, 1122);
  assert.deepEqual(episodes.slice(-3), [1120, 1121, 1122]);
});

test('catalog and provider episode metadata contribute to the full list', () => {
  const episodes = buildEpisodeNumbers({
    anime: { status: 'RELEASING', episodes: null },
    episodeMetadata: [{ number: 1 }, { number: 8 }],
    malEpisodes: [{ mal_id: 12 }],
    tmdbEpisodes: { '15': { title: 'Episode 15' } },
  });

  assert.equal(episodes.length, 15);
  assert.equal(episodes[7], 8);
  assert.equal(episodes[14], 15);
});

test('episode arrays and streaming titles are not interpreted as a numeric count', () => {
  assert.deepEqual(buildEpisodeNumbers({ anime: { status: 'FINISHED', episodes: [{ number: 1 }, { number: 2 }, { number: 3 }] } }), [1, 2, 3]);
  const episodes = buildEpisodeNumbers({ anime: { status: 'RELEASING', streamingEpisodes: [{ title: 'Episode 101 - Adventure' }, { title: 'Episode 102 - Return' }] } });
  assert.equal(episodes.length, 102);
  assert.equal(episodes.at(-1), 102);
});

test('known airing schedules and future metadata do not expose unaired episodes', () => {
  const episodes = buildEpisodeNumbers({
    anime: { status: 'RELEASING', episodes: 24, nextAiringEpisode: { episode: 6 } },
    tmdbEpisodes: { '5': { airdate: '2020-01-01' }, '6': { airdate: '2999-01-01' }, '24': { airdate: '2999-12-31' } },
  });
  assert.deepEqual(episodes, [1, 2, 3, 4, 5]);
});

test('finished series, movies, and numeric string counts retain their full ranges', () => {
  assert.equal(buildEpisodeNumbers({ anime: { status: 'FINISHED', episodes: '64' } }).length, 64);
  assert.deepEqual(buildEpisodeNumbers({ anime: { format: 'MOVIE', status: 'FINISHED', episodes: 1 } }), [1]);
});
