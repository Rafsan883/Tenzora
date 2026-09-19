export const SEO_SITE_URL = "https://tenzora.top";

const INDEXABLE_PATHS = new Set(["/", "/home", "/browse", "/schedule", "/dmca", "/terms"]);
const PRIVATE_PREFIXES = [
  "/admin", "/chat", "/community", "/forgot-password", "/import", "/notifications",
  "/nsfw", "/profile", "/reset-password", "/settings", "/stats", "/user", "/watch2gether",
  "/watching", "/watchlist", "/character", "/staff", "/stories",
];

export function getSeoUrlPolicy(pathname = window.location.pathname, search = window.location.search) {
  const hasQuery = Boolean(search);
  const isWatch = /^\/watch\/\d+(?:\/[^/]+)?$/.test(pathname);
  const isIndexablePath = INDEXABLE_PATHS.has(pathname) || isWatch;
  const isPrivate = PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const indexable = isIndexablePath && !isPrivate && !hasQuery;

  let canonicalPath = pathname;
  if (pathname === "/") canonicalPath = "/home";
  if (isWatch) canonicalPath = pathname;

  return {
    canonicalUrl: `${SEO_SITE_URL}${canonicalPath}`,
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