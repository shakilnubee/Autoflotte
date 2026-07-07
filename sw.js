/* Parc Pilot — Service Worker
   Stratégie : NETWORK-FIRST (en ligne = toujours la version fraîche ; le cache ne sert
   qu'en secours hors-ligne). On NE touche PAS aux requêtes d'une autre origine
   (Supabase, Google Fonts, CDN) : elles passent directement au réseau.
   → aucun risque de « page périmée » comme avec un cache-first. */
const CACHE = 'parcpilot-v20260707a';

self.addEventListener('install', (e) => { self.skipWaiting(); });

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return; // Supabase / CDN / fonts : réseau direct

  e.respondWith(
    fetch(req)
      .then((res) => {
        // met à jour le cache en arrière-plan (copie car un flux ne se lit qu'une fois)
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() =>
        caches.match(req).then((r) =>
          r || (req.mode === 'navigate' ? caches.match('./dashboard.html') : undefined)
        )
      )
  );
});
