import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('homepage brand graph establishes TenZora as the site entity', async () => {
  const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(match => JSON.parse(match[1]));
  const graph = scripts.flatMap(item => item['@graph'] || [item]);
  const organization = graph.find(item => item['@type'] === 'Organization' && item['@id'] === 'https://tenzora.top/#organization');
  const brand = graph.find(item => item['@type'] === 'Brand' && item['@id'] === 'https://tenzora.top/#brand');
  const website = graph.find(item => item['@type'] === 'WebSite' && item['@id'] === 'https://tenzora.top/#website');

  assert.equal(organization.name, 'TenZora');
  assert.equal(organization.brand['@id'], 'https://tenzora.top/#brand');
  assert.equal(brand.name, 'TenZora');
  assert.equal(website.publisher['@id'], 'https://tenzora.top/#organization');
  assert.equal(website.potentialAction.target, 'https://tenzora.top/browse?search={search_term_string}');
  assert.doesNotMatch(JSON.stringify(graph), /pages\.dev|anixo\.buzz/);
});
