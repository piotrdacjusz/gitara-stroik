// Service worker: aplikacja działa bez zasięgu i daje się zainstalować na Androidzie.
// Strategia: odpowiadaj z pamięci od razu, w tle pobierz świeższą wersję na następny raz.
const CACHE = 'stroik-v1';
const PLIKI = ['./', './index.html', './core.js', './akordy.js', './manifest.webmanifest',
  './ikona.svg', './apple-touch-icon.png', './ikona-192.png', './ikona-512.png',
  './ikona-maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PLIKI)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((klucze) => Promise.all(klucze.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(caches.match(e.request).then((zPamieci) => {
    const zSieci = fetch(e.request).then((odp) => {
      if (odp.ok) caches.open(CACHE).then((c) => c.put(e.request, odp.clone()));
      return odp;
    }).catch(() => zPamieci);
    return zPamieci || zSieci;
  }));
});
