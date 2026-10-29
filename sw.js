/* NWA Math — service worker.

   data/data.json, data/plans.json, practice/*  network-first: a republished curriculum must show up at once,
                   but a practice link opened offline still works from cache.
   everything else stale-while-revalidate.

   Bump VERSION when the shell (index.html, app.js, style.css) changes so
   installed copies drop the old shell. */
const VERSION = 'v5';
const SHELL = `nwa-shell-${VERSION}`;
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'data/data.json', 'manifest.webmanifest',
               'icons/icon-192.png', 'icons/icon-512.png', 'vendor/qrcode.min.js', 'practice.js', 'practice/index.json',
               'vendor/katex/katex.min.css', 'vendor/katex/katex.min.js', 'vendor/katex/auto-render.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()).catch(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('nwa-shell-') && k !== SHELL).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/data/data.json') || url.pathname.endsWith('/data/plans.json') || url.pathname.includes('/practice/')) { e.respondWith(networkFirst(req)); return; }
  e.respondWith(staleWhileRevalidate(req));
});

async function networkFirst(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(req, { cache: 'no-store' });
    if (res.ok) cache.put(req.url.split('?')[0], res.clone());
    return res;
  } catch (err) {
    return (await cache.match(req.url.split('?')[0])) || new Response('{}', { status: 503 });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(req, { ignoreSearch: true });
  const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || net;
}
