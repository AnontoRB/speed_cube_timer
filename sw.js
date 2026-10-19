// Caches the app so it works offline after the first visit.
const C = 'cubetimer-v1';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'algs.js', 'pkg/cubetimer.js', 'pkg/cubetimer_bg.wasm'];
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => Promise.all(FILES.map(f => c.add(f).catch(() => {}))))));
self.addEventListener('fetch', e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
