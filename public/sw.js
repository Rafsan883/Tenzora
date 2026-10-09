const DYNAMIC_PATHS = [
  '/api/', '/auth', '/watchlist', '/progress', '/settings', '/notifications',
  '/users', '/ai', '/community', '/contact', '/reports', '/support',
  '/sitemap', '/robots.txt', '/anime/', '/character/', '/watch/',
];

function isDynamicRequest(request) {
  const url = new URL(request.url);
  return request.mode === 'navigate'
    || DYNAMIC_PATHS.some(path => url.pathname === path || url.pathname.startsWith(path));
}

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith((async () => {
    try {
      return await fetch(event.request);
    } catch (error) {
      if (isDynamicRequest(event.request)) {
        return new Response('Offline', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=UTF-8' },
        });
      }

      const cached = await caches.match(event.request);
      if (cached) return cached;
      throw error;
    }
  })());
});
