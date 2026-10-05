export function animeIdentity(anime, fallbackId) {
  const idSource = anime?.isMAL ? 'MAL' : 'ANILIST';
  return {
    animeId: String(anime?.anilistId || anime?.id || fallbackId),
    idSource: anime?.anilistId ? 'ANILIST' : idSource,
    idMal: anime?.idMal || (idSource === 'MAL' ? Number(anime?.id || fallbackId) : undefined),
  };
}

export function matchesAnime(item, identity) {
  return identity.idSource === 'MAL'
    ? Number(item.idMal) === Number(identity.animeId)
    : String(item.animeId) === identity.animeId;
}
