// Offline support. `npm run build` replaces __BUILD_ID__ with a hash of the files, so each deployment gets its own cache
// and old caches are deleted on activate. Strategy: network first (new deployments show immediately), cache as the offline fallback.
const BUILD = '__BUILD_ID__';
const CACHE = 'crustica-reply-' + (BUILD.startsWith('__') ? 'dev' : BUILD);
const SHELL = [
  './', './index.html', './style.css', './manifest.json',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
  './js/app.js', './js/ui.js', './js/data.js', './js/config.js', './js/store.js', './js/icons.js', './js/components.js',
  './js/engine.js', './js/replyEngine.js', './js/brand.js',
  './js/views/home.js', './js/views/saved.js', './js/views/history.js', './js/views/settings.js',
];

self.addEventListener('install', (e) => {
  // add files one by one so a single missing file cannot block the whole install
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('crustica-reply-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then((r) => {
      if (r.ok && r.type === 'basic') { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request).then((hit) => hit || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined))),
  );
});
