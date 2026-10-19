// Network first (so updates always show), cached copy used when offline.
const C = 'cubetimer-v2';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'algs.js', 'pkg/cubetimer.js', 'pkg/cubetimer_bg.wasm'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(C).then(c => Promise.all(FILES.map(f => c.add(f).catch(() => {})))));
});

self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())
));

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.pathname.endsWith('/api/state')) return;
  e.respondWith(
    fetch(e.request)
      .then(r => {
        const c = r.clone();
        caches.open(C).then(x => x.put(e.request, c));
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});