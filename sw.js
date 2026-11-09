// Network first (so updates always show), cached copy used when offline.
const C = 'cubetimer-v18';
const FILES = ['./', 'index.html', 'manifest.json', 'icon.svg', 'style.css', 'app.js', 'algs.js', 'cubes.js', 'practice.js', 'qr.js', 'bt-timer.js', 'pkg/cubetimer.js', 'pkg/cubetimer_bg.wasm'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(C).then(c => Promise.all(FILES.map(f => c.add(f).catch(() => {})))));
});

self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())
));

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  // only plain GET requests for http(s); never touch the API (login/sync data must not be cached)
  if (e.request.method !== 'GET' || !u.protocol.startsWith('http') || u.pathname.includes('/api/')) return;
  const same = u.origin === self.location.origin;
  e.respondWith(
    fetch(e.request, same ? { cache: 'no-cache' } : undefined)
      .then(r => {
        // keep only complete, successful same-site answers (partial 206 or error pages must not be stored)
        if (same && r.ok && r.status === 200) {
          const c = r.clone();
          caches.open(C).then(x => x.put(e.request, c)).catch(() => {});
        }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })
        .then(r => r || (e.request.mode === 'navigate' ? caches.match('index.html') : undefined))
        .then(r => r || Response.error()))
  );
});
