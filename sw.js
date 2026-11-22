/* Service worker: network-first (ទំព័រថ្មីជានិច្ច) → ប្រើ cache ពេលគ្មានអ៊ីនធឺណិត */
const CACHE = 'kpl-v3';   /* v3: ទំព័រ html ត្រូវសួរ server ជានិច្ច (no-cache) មិនយក HTTP cache ចាស់ */
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;          // Supabase / CDN មិនប៉ះពាល់
  const key = u.origin + u.pathname;                 // មិនរាប់ ?theme=… ដើម្បី cache មិនប៉ោង
  /* ទំព័រ html: បង្ខំឱ្យសួរ server ម្ដងទៀត (304 បើមិនប្ដូរ) — កុំឱ្យ HTTP cache របស់ browser ផ្ដល់ទំព័រចាស់ */
  const isDoc = r.mode === 'navigate' || r.destination === 'document' || r.destination === 'iframe' || /\.html?$/.test(u.pathname) || /\/$/.test(u.pathname);
  const req = isDoc ? new Request(r, { cache: 'no-cache' }) : r;
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then(ch => ch.put(key, c)); }
      return res;
    }).catch(() => caches.match(key).then(m => m || (isDoc ? caches.match('index.html') : undefined)).then(m => m || Response.error()))
  );
});

/* ── Web Push: ជូនដំណឹងសារ ទោះបិទ browser ── */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'សារថ្មី', {
    body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png',
    tag: d.tag || 'chat', renotify: true, data: { url: d.url || './#chat' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './#chat', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) {
      if (c.url.startsWith(self.registration.scope)) { c.postMessage({ type: /#teacher/.test(url) ? 'GOTO_TEACHER' : 'GOTO_CHAT' }); return c.focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
