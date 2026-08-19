/* Loupe service worker.
   Caches the whole app on first visit so it opens offline afterwards.
   Bump CACHE when you ship a change, or phones will keep the old build. */
const CACHE = 'loupe-v33';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './banner.jpg',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())   // a missing optional asset must not block install
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Share target. Android posts the photo here when someone picks Loupe from
   the share sheet — straight out of Canon Camera Connect, SnapBridge, the
   gallery, anywhere. Stash the files in a cache and hand the page a flag. */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.pathname.endsWith('index.html')) {
    e.respondWith((async () => {
      try {
        const form = await e.request.formData();
        const files = form.getAll('photos').filter(f => f && f.size);
        const cache = await caches.open('loupe-share');
        for (const k of await cache.keys()) await cache.delete(k);
        let i = 0;
        for (const f of files) {
          await cache.put(
            new Request(`/__shared/${i++}`),
            new Response(f, { headers: {
              'Content-Type': f.type || 'image/jpeg',
              'X-Filename': encodeURIComponent(f.name || `shared-${i}.jpg`)
            }})
          );
        }
        return Response.redirect('./index.html?shared=' + files.length, 303);
      } catch (err) {
        return Response.redirect('./index.html', 303);
      }
    })());
    return;
  }

  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
