import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAnimeSlug,
  buildCharacterSlug,
  normalizeAnime,
  normalizeSearchText,
  parseSearchIntent,
} from '../seoCatalogModel.mjs';

test('normalized catalog identity and slug remain provider-independent', () => {
  const anilist = normalizeAnime({
    id: 998877,
    title: { english: 'Catalog Regression', romaji: 'Catalog Regression', native: 'カタログ回帰' },
    format: 'TV',
    seasonYear: 2026,
    description: 'A stable fixture.',
    episodes: 12,
  });
  const mal = normalizeAnime({
    id: 123456,
    idMal: 123456,
    isMAL: true,
    title: { english: 'Catalog Regression', romaji: 'Catalog Regression', native: 'カタログ回帰' },
    format: 'TV',
    seasonYear: 2026,
    description: 'A stable fixture.',
    episodes: 12,
  });

  assert.equal(anilist.canonicalId, mal.canonicalId);
  assert.equal(anilist.slug, mal.slug);
  assert.equal(anilist.providerIds.anilist, '998877');
  assert.equal(mal.providerIds.mal, '123456');
  assert.equal(buildAnimeSlug(anilist.titles.canonical, anilist.canonicalId), anilist.slug);
});

test('search normalization preserves multilingual scripts and removes punctuation variance', () => {
  assert.equal(normalizeSearchText('  One—Piece!  '), 'one piece');
  assert.equal(normalizeSearchText('नारुतो—शिप्पूडेन'), 'नारुतो शिप्पूडेन');
  assert.equal(normalizeSearchText('  ناروتو  '), 'ناروتو');
  assert.equal(normalizeSearchText('বাংলা: অ্যানিমে'), 'বাংলা অ্যানিমে');
});

test('episode normalization marks only useful metadata as indexable material', () => {
  const anime = normalizeAnime({
    id: 1,
    title: { english: 'Episode Fixture' },
    format: 'TV',
    episodeList: [
      { number: 1, title: 'A useful title', description: 'A useful synopsis' },
      { number: 2 },
    ],
  });

  assert.equal(anime.episodes.length, 2);
  assert.equal(anime.episodes[0].uniqueMetadata, true);
  assert.equal(anime.episodes[1].uniqueMetadata, false);
});

test('episode localized objects become usable strings instead of object coercion', () => {
  const anime = normalizeAnime({
    id: 1,
    title: { english: 'Localized Episode Fixture' },
    episodeList: [{
      number: 1,
      title: { en: 'The Beginning', ja: '始まり' },
      description: { en: 'A localized episode synopsis.' },
      thumbnail: { original: 'https://images.example/episode-1.jpg' },
    }],
  });

  assert.equal(anime.episodes[0].title, 'The Beginning');
  assert.equal(anime.episodes[0].description, 'A localized episode synopsis.');
  assert.equal(anime.episodes[0].thumbnail, 'https://images.example/episode-1.jpg');
  assert.notEqual(anime.episodes[0].title, '[object Object]');
});

test('character normalization always supplies a canonical slug', () => {
  const anime = normalizeAnime({
    id: 1,
    title: { english: 'Character Fixture' },
    characters: [{ id: 1001, name: { full: 'Monkey D. Luffy' } }],
  });

  assert.equal(anime.characters[0].slug, 'monkey-d-luffy--9vj0if00');
});

test('search intent resolves episode and season suffix variants without losing multilingual titles', () => {
  const cases = [
    ['One Piece episode 1179', 'one piece', 1179, null],
    ['Naruto Shippuden 220', 'naruto shippuden', 220, null],
    ['Jujutsu Kaisen S3 E10 dub', 'jujutsu kaisen', 10, 3],
    ['進撃の巨人 3rd season ep 5', '進撃の巨人', 5, 3],
    ['বাংলা এনিমে e07 sub', 'বাংলা এনিমে', 7, null],
    ['ناروتو موسم 2', 'ناروتو', null, 2],
  ];
  for (const [input, title, episode, season] of cases) {
    const parsed = parseSearchIntent(input);
    assert.equal(parsed.title, title, input);
    assert.equal(parsed.episode, episode, input);
    assert.equal(parsed.season, season, input);
  }
  assert.equal(parseSearchIntent('One Piece S3E10').episode, 10);
  assert.equal(parseSearchIntent('One Piece S3E10').season, 3);
  assert.equal(parseSearchIntent('x'.repeat(257)).rejected, true);
});

test('characters have deterministic non-provider canonical slugs', () => {
  const first = buildCharacterSlug('Monkey D. Luffy', '1001');
  const second = buildCharacterSlug('Monkey D. Luffy', '1001');
  assert.equal(first, second);
  assert.match(first, /^monkey-d-luffy--[a-z0-9]+$/);
});
