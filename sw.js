const CACHE = 'forge-shell-v1';
const SHELL_FILES = [
  './',
  'index.html',
  'manifest.json',
  'icons/icon-32.png',
  'icons/icon-180.png',
  'icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// Cache-first for the app shell only. Everything else (Google Sheets data via
// Apps Script, Firebase, fonts, Chart.js) passes straight through to the
// network so live data is never served stale.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isShellFile = url.origin === self.location.origin &&
    SHELL_FILES.some(f => url.pathname.endsWith(f.replace('./', '')));

  if (event.request.method === 'GET' && isShellFile) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
  }
});
