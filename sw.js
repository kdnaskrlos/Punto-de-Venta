// Permite instalar la app y abrirla sin internet. Las ventas las guarda Firebase (con su propia caché).
const CACHE = 'pos-v1.43';
const LIBS = 'libs-v1'; // Firebase y la fuente: archivos con versión fija
const FOTOS = 'fotos-v1';
const SHELL = ['./', './index.html', './config.js', './manifest.webmanifest', './icono-192.png', './icono-512.png', './logo-carrito.png',
  './css/tokens.css', './css/base.css', './css/componentes.css',
  './js/principal.js', './js/app.js', './js/ui.js', './js/version.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))));
});
self.addEventListener('message', e => { if (e.data === 'activar') self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => ![CACHE, LIBS, FOTOS].includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  if ((u.hostname === 'www.gstatic.com' && u.pathname.startsWith('/firebasejs/')) || u.hostname.startsWith('fonts.g')) {
    e.respondWith(caches.open(LIBS).then(c => c.match(r).then(hit => hit || fetch(r).then(res => { if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res; }))));
    return;
  }
  // Datos (.json): primero la red, si falla la última copia
  if (u.pathname.endsWith('.json')) {
    e.respondWith(fetch(r).then(res => { if (res.ok) caches.open(CACHE).then(c => c.put(r, res.clone())); return res; }).catch(() => caches.match(r, { ignoreSearch: true })));
    return;
  }
  if (u.origin !== location.origin) return;
  if (u.pathname.includes('/fotos/')) {
    e.respondWith(caches.open(FOTOS).then(c => c.match(r).then(hit => hit || fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; }))));
    return;
  }
  const nav = r.mode === 'navigate';
  e.respondWith(caches.open(CACHE).then(c => c.match(nav ? './index.html' : r, { ignoreSearch: nav }).then(hit => {
    const red = fetch(r, { cache: 'no-cache' }).then(res => { if (res.ok && !nav) c.put(r, res.clone()); return res; });
    if (hit) { e.waitUntil(red.catch(() => {})); return hit; }
    return red.catch(() => caches.match('./index.html'));
  })));
});
