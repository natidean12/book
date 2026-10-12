// Service worker: deixa o app abrir offline. Rede primeiro; se falhar, usa a cópia guardada.
const CACHE = 'cosmic-bloom-v1';
const SHELL = ['./', 'index.html', 'css/style.css', 'manifest.json', 'js/app.js', 'js/store.js', 'js/ui.js', 'js/theme.js', 'js/covers.js', 'js/bookkit.js', 'js/config.js',
  'js/views/home.js', 'js/views/livros.js', 'js/views/metas.js', 'js/views/meses.js', 'js/views/agenda.js', 'js/views/favoritos.js', 'js/views/bingo.js', 'js/views/cores.js', 'js/views/az.js', 'js/views/roleta.js', 'js/views/ajustes.js'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return; // dados sempre da rede
  e.respondWith(fetch(req).then((res) => {
    if (res.ok && (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com|cdnjs|jsdelivr/.test(url.hostname))) {
      const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  }).catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
