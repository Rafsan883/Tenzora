import assert from 'node:assert/strict';

const base = (process.env.SEO_VERIFY_BASE_URL || 'https://tenzora.top').replace(/\/$/u, '');
const optionalRoutes = [process.env.SEO_VERIFY_ANIME_PATH, process.env.SEO_VERIFY_EPISODE_PATH].filter(Boolean);
const routes = ['/', '/robots.txt', '/sitemap.xml', ...optionalRoutes];

async function verifySitemapChildren(indexBody) {
  const childRoutes = [...indexBody.matchAll(/<loc>(https:\/\/tenzora\.top\/sitemap-(?:static|recent|anime-\d+)\.xml)<\/loc>/gu)]
    .map(match => new URL(match[1]).pathname);
  assert.ok(childRoutes.length >= 1, 'sitemap.xml did not advertise any child sitemap');

  const results = await Promise.all(childRoutes.map(async route => {
    const response = await fetch(`${base}${route}`, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    const body = await response.text();
    assert.equal(response.ok, true, `${route} returned ${response.status}`);
    assert.match(response.headers.get('content-type') || '', /application\/xml/u, `${route} was not served as XML`);
    assert.match(body, /<urlset\b[^>]*xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/u, `${route} was not a sitemap URL set`);
    assert.doesNotMatch(body, /pages\.dev|anixo\.buzz/u, `${route} contains a non-production URL`);
    return route;
  }));
  return results.length;
}

for (const route of routes) {
  const response = await fetch(`${base}${route}`, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
  const body = await response.text();
  assert.equal(response.ok, true, `${route} returned ${response.status}`);
  if (route === '/') {
    assert.match(body, /TenZora/);
    assert.match(body, /https:\/\/tenzora\.top\/#organization/);
  }
  if (route === '/robots.txt') assert.match(body, /Sitemap:\s*https:\/\/tenzora\.top\/sitemap\.xml/u);
  if (route.endsWith('.xml')) {
    assert.match(body, /https:\/\/tenzora\.top/u);
    assert.doesNotMatch(body, /pages\.dev|anixo\.buzz/u);
    if (route === '/sitemap.xml') console.log(`Verified ${await verifySitemapChildren(body)} child sitemaps.`);
  }
  if (route.startsWith('/anime/') || route.startsWith('/character/')) {
    assert.match(body, /rel=["']canonical["']/u);
    assert.match(body, /application\/ld\+json/u);
    assert.match(body, /TenZora/u);
  }
  console.log(`${route}: ${response.status} ${response.headers.get('content-type') || 'unknown content type'}`);
}
