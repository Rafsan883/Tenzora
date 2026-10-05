import { Agent } from 'undici';
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

const blocked = new BlockList();
for (const [ip, bits] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3]]) blocked.addSubnet(ip, bits);
for (const [ip, bits] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['2001:db8::', 32], ['2002::', 16]]) blocked.addSubnet(ip, bits, 'ipv6');

export function validateMediaURL(value) {
  const url = new URL(value);
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80', '443'].includes(url.port)) || host === 'localhost' || /\.(localhost|local|internal|lan)\.?$/.test(host) || (!isIP(host) && !host.includes('.')) || (isIP(host) && blocked.check(host, isIP(host) === 6 ? 'ipv6' : 'ipv4'))) throw new Error('Only public HTTP(S) media URLs are allowed');
  const allow = (process.env.PROXY_ALLOWED_HOSTS || '').split(',').map(x => x.trim()).filter(Boolean);
  if (allow.length && !allow.some(x => x.startsWith('*.') ? host.endsWith(x.slice(1)) : host === x)) throw new Error('Media host is not allowed');
  return url;
}

const dispatcher = new Agent({ connect: { lookup(host, options, callback) {
  lookup(host, { all: true }).then(addresses => {
    if (!addresses.length || addresses.some(a => blocked.check(a.address, a.family === 6 ? 'ipv6' : 'ipv4'))) return callback(new Error('Private network addresses are blocked'));
    const matching = options.family ? addresses.filter(a => a.family === options.family) : addresses;
    if (!matching.length) return callback(new Error('No public address available'));
    if (options.all) callback(null, matching);
    else callback(null, matching[0].address, matching[0].family);
  }).catch(callback);
} } });

export async function fetchMedia(value, headers) {
  let url = validateMediaURL(value);
  for (let hop = 0; hop <= 5; hop++) {
    const response = await fetch(url, { headers, dispatcher, redirect: 'manual', signal: AbortSignal.timeout(30000) });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location) throw new Error('Invalid upstream redirect');
    url = validateMediaURL(new URL(location, url).href);
  }
  throw new Error('Too many redirects');
}

export function rewriteM3U8(text, base, proxy, referer) {
  const wrap = uri => `${proxy}?url=${encodeURIComponent(new URL(uri, base).href)}&referer=${encodeURIComponent(referer)}`;
  return text.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (trimmed.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (_match, uri) => `URI="${wrap(uri)}"`);
    return wrap(trimmed);
  }).join('\n');
}

export async function readPlaylist(response, maxBytes = 2 * 1024 * 1024) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Empty upstream playlist');
  const decoder = new TextDecoder();
  let text = '', bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error('Upstream playlist is too large');
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
