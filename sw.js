/* Parc Pilot — Service Worker
   Deux stratégies, choisies selon le type de requête :
   • ASSETS STATIQUES same-origin (JS/CSS/icônes, tous versionnés par ?v=AAAAMMJJx) → CACHE-FIRST.
     Comme l'URL change à chaque déploiement (bump du ?v=), le cache est toujours frais après
     une mise à jour → navigations répétées SANS aller-retour réseau (chargement quasi instantané).
   • NAVIGATIONS HTML → NETWORK-FIRST (en ligne = toujours la version fraîche ; le cache ne
     sert qu'en secours hors-ligne). Évite toute « page périmée ».
   On NE touche PAS aux autres origines (Supabase, Google Fonts, CDN) : réseau direct. */
const CACHE = 'parcpilot-v20260707b';

self.addEventListener('install', () => { self.skipWaiting(); });

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isHtml(req) {
  return req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return; // Supabase / CDN / fonts : réseau direct

  if (isHtml(req)) {
    // NETWORK-FIRST : fraîcheur d'abord, cache en secours hors-ligne
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./dashboard.html')))
    );
    return;
  }

  // CACHE-FIRST pour les assets (versionnés) : instantané en visite répétée
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});
