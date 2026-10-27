/* Service worker: network-first (ទំព័រថ្មីជានិច្ច) → ប្រើ cache ពេលគ្មានអ៊ីនធឺណិត */
const CACHE = 'kpl-v1';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;          // Supabase / CDN មិនប៉ះពាល់
  e.respondWith(
    fetch(r).then(res => {
      if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then(ch => ch.put(r, c)); }
      return res;
    }).catch(() => caches.match(r).then(m => m || caches.match('index.html')))
  );
});
