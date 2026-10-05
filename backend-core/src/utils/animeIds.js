import axios from 'axios';

const cache = new Map();
const validId = value => /^\d+$/.test(String(value)) && Number(value) > 0 && Number(value) <= 2147483647;

export async function resolveAnimeIds(items, target = 'ANILIST') {
  const result = items.map(item => ({ ...item }));
  const pending = [];
  for (let index = 0; index < result.length; index++) {
    const item = result[index];
    if (!validId(item.animeId)) throw Object.assign(new Error('Import contains missing or invalid anime IDs. Use a JSON/XML backup or a text export that includes IDs.'), { status: 400 });
    const source = item.idSource || 'ANILIST';
    if (!['MAL', 'ANILIST'].includes(source)) throw Object.assign(new Error('Unknown anime ID source'), { status: 400 });
    if (source === target) continue;
    if (target === 'MAL' && validId(item.idMal)) { item.animeId = String(item.idMal); continue; }
    const key = `${source}:${item.animeId}`;
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      item.idMal = cached.media.idMal;
      item.animeId = String(target === 'MAL' ? cached.media.idMal : cached.media.id);
      continue;
    }
    pending.push({ index, key, source, id: Number(item.animeId) });
  }
  for (let start = 0; start < pending.length; start += 25) {
    const batch = pending.slice(start, start + 25);
    const query = `query { ${batch.map((entry, index) => `m${index}: Media(${entry.source === 'MAL' ? 'idMal' : 'id'}: ${entry.id}, type: ANIME) { id idMal }`).join(' ')} }`;
    const response = await axios.post('https://graphql.anilist.co', { query }, { timeout: 15000 });
    for (let index = 0; index < batch.length; index++) {
      const media = response.data?.data?.[`m${index}`];
      const mapped = target === 'MAL' ? media?.idMal : media?.id;
      if (!validId(mapped)) throw Object.assign(new Error(`Could not map ${batch[index].source} anime ID ${batch[index].id}. No watchlist changes were saved.`), { status: 422 });
      cache.set(batch[index].key, { media, expiresAt: Date.now() + 86400000 });
      if (cache.size > 1000) cache.delete(cache.keys().next().value);
      result[batch[index].index].animeId = String(mapped);
      result[batch[index].index].idMal = media.idMal;
    }
  }
  return result.map(item => ({ ...item, animeId: String(item.animeId), idSource: target }));
}
