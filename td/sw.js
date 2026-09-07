/* TD — cache enough shell to launch standalone.
   Never intercept /, /index.html, or auth.js — login must be network-only. */
const CACHE = 'td-v3';
const SHELL = [
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/css/app.css?v=11',
  '/css/be-shell.css?v=3',
  '/js/app.js?v=11',
  '/js/shell-ui.js?v=2',
  '/js/unit-stats.js',
  '/js/app-nav.js',
  '/js/live-jobs.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(SHELL).catch(function () {
        return cache.addAll(['/manifest.webmanifest']);
      });
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) {
        return caches.delete(k);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/data/') === 0) return;
  if (url.pathname.indexOf('/shared/') === 0) return;

  const path = url.pathname;
  if (path === '/' || path === '/index.html' || path === '/js/auth.js') {
    return;
  }

  event.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req);
    })
  );
});
