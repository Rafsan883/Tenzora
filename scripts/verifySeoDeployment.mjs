import assert from 'node:assert/strict';

const base = (process.env.SEO_VERIFY_BASE_URL || 'https://tenzora.top').replace(/\/$/u, '');
const optionalRoutes = [process.env.SEO_VERIFY_ANIME_PATH, process.env.SEO_VERIFY_EPISODE_PATH].filter(Boolean);
const routes = ['/', '/robots.txt', '/sitemap.xml', ...optionalRoutes];

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
  }
  if (route.startsWith('/anime/') || route.startsWith('/character/')) {
    assert.match(body, /rel=["']canonical["']/u);
    assert.match(body, /application\/ld\+json/u);
    assert.match(body, /TenZora/u);
  }
  console.log(`${route}: ${response.status} ${response.headers.get('content-type') || 'unknown content type'}`);
}
