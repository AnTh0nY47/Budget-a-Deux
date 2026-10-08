// Garde une copie de l'appli pour qu'elle s'ouvre vite, même avec peu de réseau.
// Les données du budget, elles, passent toujours par Firebase.
const CACHE = 'budget-v2';
const FICHIERS = ['./', './index.html', './menage.html', './firebase-config.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Pages et fichiers du site : d'abord le réseau pour avoir la dernière version, sinon la copie
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req).then(res => {
        const copie = res.clone();
        caches.open(CACHE).then(c => c.put(req, copie));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Polices et scripts Firebase : la copie tout de suite, mise à jour en arrière plan
  if (url.hostname.endsWith('gstatic.com') || url.hostname === 'fonts.googleapis.com') {
    e.respondWith(caches.open(CACHE).then(c => c.match(req).then(enCache => {
      const reseau = fetch(req).then(res => { c.put(req, res.clone()); return res; }).catch(() => enCache);
      return enCache || reseau;
    })));
  }
});
