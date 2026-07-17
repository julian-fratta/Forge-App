const CACHE = 'forge-shell-v2';
// Stable, rarely-changing assets — safe to serve cache-first for speed.
const STATIC_ASSETS = [
  'manifest.json',
  'icons/icon-32.png',
  'icons/icon-180.png',
  'icons/icon-512.png',
  'icons/forge-logo-gold.png'
];
// The HTML shell is served network-first (see fetch handler) so app updates
// always show when online; this cached copy is only the offline fallback.
const HTML_SHELL = ['./', 'index.html'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([...STATIC_ASSETS, ...HTML_SHELL])));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // let Firebase/Sheets/fonts pass straight through

  const isHtml = event.request.mode === 'navigate' ||
    url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
  const isStatic = STATIC_ASSETS.some(f => url.pathname.endsWith(f));

  if (isHtml) {
    // Network-first: fresh HTML when online, cached copy only if offline.
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('index.html'))
    );
  } else if (isStatic) {
    // Cache-first for stable assets.
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
  }
});
