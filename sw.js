/*
  Hunter's Arsenal — Service Worker
  ---------------------------------
  Strategy: cache-first for the app shell, versioned by APP_VERSION (see js/version.js).
  Bumping APP_VERSION and pushing to GitHub Pages is all that's needed to ship an
  update: the next time a user opens (or refreshes) the app, this worker installs,
  precaches the new files under a new cache name, deletes the old cache, and takes
  control immediately — so a simple refresh is enough to get the update.
*/

importScripts('js/version.js');

const CACHE_NAME = 'harsenal-cache-v' + self.APP_VERSION;

const PRECACHE_URLS = [
  './',
  'index.html',
  'manifest.json',
  'css/styles.css',
  'js/version.js',
  'js/storage.js',
  'js/gamification.js',
  'js/effects.js',
  'js/sound.js',
  'js/systemwindow.js',
  'js/app.js',
  'assets/logo.svg',
  'assets/logo-maskable.svg',
  'assets/fonts/oswald-latin-400-normal.woff2',
  'assets/fonts/oswald-latin-500-normal.woff2',
  'assets/fonts/oswald-latin-600-normal.woff2',
  'assets/fonts/oswald-latin-700-normal.woff2',
  'assets/fonts/work-sans-latin-400-normal.woff2',
  'assets/fonts/work-sans-latin-500-normal.woff2',
  'assets/fonts/work-sans-latin-600-normal.woff2',
  'assets/fonts/jetbrains-mono-latin-400-normal.woff2',
  'assets/fonts/jetbrains-mono-latin-600-normal.woff2',
  'assets/fonts/jetbrains-mono-latin-700-normal.woff2',
  'icons/icon-32.png',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-192-maskable.png',
  'icons/icon-512.png',
  'icons/icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request)
        .then(response => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached); // offline fallback to whatever we already have

      // Cache-first for instant offline loads; refresh the cache in the background.
      return cached || networkFetch;
    })
  );
});
