// Garde une copie de l'appli pour qu'elle s'ouvre vite, même avec peu de réseau.
// Les données du budget, elles, passent toujours par Firebase.
const CACHE = 'cheznous-v19';
const FICHIERS = ['./', './index.html', './calcul-budget.js', './resume.js', './reseau.js', './icons/favicon-32.png', './icons/icon-maskable-512.png', './menage.html', './courses.html', './reparations.html', './planning.js', './sauvegarde.js', './firebase-config.js', './manifest.webmanifest',
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
    // D'abord le réseau pour avoir la dernière version, mais si ça capte mal (en magasin),
    // on n'attend pas plus de 3 secondes : on prend la copie gardée sur le téléphone.
    const reseau = fetch(req, { cache: 'no-cache' }).then(res => {
      if (res && res.ok) { const copie = res.clone(); caches.open(CACHE).then(c => c.put(req, copie)); }
      return res;
    });
    e.respondWith(new Promise(resolve => {
      let fini = false;
      const copie = () => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'));
      const minuteur = setTimeout(() => copie().then(r => { if (r && !fini) { fini = true; resolve(r); } }), 3000);
      reseau.then(res => { if (!fini) { fini = true; clearTimeout(minuteur); resolve(res); } })
        .catch(() => { clearTimeout(minuteur); copie().then(r => { if (!fini) { fini = true; resolve(r || Response.error()); } }); });
    }));
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

// Rappel du soir envoyé par la tâche GitHub via Firebase Cloud Messaging
self.addEventListener('push', e => {
  let d = {};
  try { const j = e.data ? e.data.json() : {}; d = j.data || j.notification || j; } catch (err) {}
  const titre = d.title || 'Le ménage';
  e.waitUntil(self.registration.showNotification(titre, {
    body: d.body || 'Il y a des choses à faire aujourd\u2019hui.',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: d.tag || 'menage',
    data: { url: d.url || './menage.html' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const cible = new URL(e.notification.data && e.notification.data.url || './menage.html', './courses.html', './reparations.html', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(fen => {
    for (const f of fen) { if (f.url.startsWith(self.registration.scope)) { f.navigate(cible); return f.focus(); } }
    return self.clients.openWindow(cible);
  }));
});
