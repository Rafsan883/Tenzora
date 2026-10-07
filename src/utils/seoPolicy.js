export const SEO_SITE_URL = "https://tenzora.top";

const INDEXABLE_PATHS = new Set(["/", "/home", "/browse", "/schedule", "/dmca", "/terms"]);
const PRIVATE_PREFIXES = [
  "/admin", "/chat", "/community", "/forgot-password", "/import", "/notifications",
  "/nsfw", "/profile", "/reset-password", "/settings", "/stats", "/user", "/watch2gether",
  "/watching", "/watchlist", "/staff", "/stories",
];

export function getSeoUrlPolicy(pathname = window.location.pathname, search = window.location.search) {
  const hasQuery = Boolean(search);
  const isWatch = /^\/watch\/\d+(?:\/[^/]+)?$/.test(pathname);
  const isAnime = /^\/anime\/[^/]+$/.test(pathname);
  const isAnimeEpisode = /^\/anime\/[^/]+\/episode\/\d+$/.test(pathname);
  const isCharacter = /^\/character\/[^/]+$/.test(pathname);
  const isIndexablePath = INDEXABLE_PATHS.has(pathname) || isWatch || isAnime || isAnimeEpisode || isCharacter;
  const isPrivate = PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const params = new URLSearchParams(search);
  const episodeOnly = isWatch && [...params.keys()].every(key => key === 'ep') && /^\d+$/.test(params.get('ep') || '');
  const indexable = isIndexablePath && !isPrivate && (!hasQuery || episodeOnly);

  let canonicalPath = pathname;
  // The public homepage identity is the production root. /home remains a
  // supported application route but is a duplicate from an SEO perspective.
  if (pathname === "/" || pathname === "/home") canonicalPath = "/";
  if (isWatch) canonicalPath = pathname;

  return {
    canonicalUrl: `${SEO_SITE_URL}${canonicalPath}${episodeOnly ? `?ep=${params.get('ep')}` : ''}`,
    indexable,
    noindex: !indexable,
  };
}

export function applySeoUrlPolicy() {
  const policy = getSeoUrlPolicy();
  let robots = document.querySelector('meta[name="robots"]');
  if (!robots) {
    robots = document.createElement("meta");
    robots.setAttribute("name", "robots");
    document.head.appendChild(robots);
  }
  robots.setAttribute("content", policy.noindex ? "noindex, follow" : "index, follow");

  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }
  canonical.setAttribute("href", policy.canonicalUrl);
  return policy;
}
