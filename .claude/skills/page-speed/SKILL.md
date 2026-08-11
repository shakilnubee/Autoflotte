---
name: page-speed
description: "Audite la vitesse de Parc Pilot (parc-pilot.fr) via Google PageSpeed Insights (mobile + ordinateur), puis applique ET pousse en ligne les optimisations de performance possibles. À utiliser quand l'utilisateur veut vérifier, mesurer ou améliorer la vitesse / performance / temps de chargement du site (mots-clés : vitesse, lent, rapidité, performance, PageSpeed, Lighthouse, Core Web Vitals, site qui rame)."
---

# Page Speed — Audit + correction de la vitesse de Parc Pilot

But : mesurer la vitesse réelle du site en ligne, expliquer les résultats **en français simple**
(l'utilisateur n'est pas développeur), puis **corriger directement dans le code** ce qui peut l'être
et **déployer**. Toujours re-mesurer après pour montrer le gain.

Cible par défaut : **https://parc-pilot.fr/**. Si l'utilisateur cite une page précise
(ex. « les statistiques rament »), auditer aussi cette URL (`https://parc-pilot.fr/pages/statistiques.html`).

⚠️ Ce skill applique des changements de code qui partent en PRODUCTION. Respecter **à la lettre** les
conventions de `CLAUDE.md` (voir §4) et **ne jamais casser** une fonctionnalité existante pour gagner
quelques millisecondes.

---

## Étape 1 — Mesurer (Google PageSpeed Insights, gratuit, sans installation)

L'API PageSpeed Insights v5 fonctionne par simple appel HTTP (pas de clé requise pour un usage ponctuel).
Lancer **mobile ET ordinateur** (les scores diffèrent beaucoup) et ranger le JSON dans le scratchpad :

```bash
BASE="https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
URL="https://parc-pilot.fr/"          # ou la page ciblée par l'utilisateur
OUT="${SCRATCHPAD:-/tmp}"             # dossier scratchpad de la session
curl -s "$BASE?url=$URL&strategy=mobile&category=performance"  -o "$OUT/psi-mobile.json"
curl -s "$BASE?url=$URL&strategy=desktop&category=performance" -o "$OUT/psi-desktop.json"
```

Gestion des erreurs :
- **`"error"` avec code `429` / `RESOURCE_EXHAUSTED` / quota** : normal derrière certains proxys ou
  environnements cloud (le projet Google partagé a un quota nul). Sur un **PC normal**, l'appel anonyme
  passe. Sinon, ajouter une **clé API gratuite** : `&key=LA_CLÉ` (création en 2 min sur
  https://developers.google.com/speed/docs/insights/v5/get-started, gratuit, quota largement suffisant).
  Si l'utilisateur donne une clé, la stocker dans `PSI_KEY` et l'ajouter à chaque appel.
- **Erreur réseau ponctuelle** : attendre quelques secondes et réessayer une fois ; en dernier repli,
  essayer l'outil **WebFetch** sur la même URL d'API.
- Si aucune mesure n'est possible (pas de réseau), le dire franchement et proposer de relancer depuis
  un PC connecté — ne PAS inventer de scores.

Extraire les chiffres clés (le JSON est gros : ne PAS le dumper en entier, extraire) :

```bash
for f in psi-mobile psi-desktop; do
  echo "== $f =="
  # Score global de performance (0..1 → ×100)
  grep -oE '"id":"performance","title":"Performance","score":[0-9.]+' "$OUT/$f.json"
  # Core Web Vitals & métriques (valeurs affichées)
  grep -oE '"(largest-contentful-paint|cumulative-layout-shift|total-blocking-time|first-contentful-paint|speed-index|interactive)","title":"[^"]+","description":"[^"]*","score":[0-9.]+,"scoreDisplayMode":"[a-z]+","displayValue":"[^"]+"' "$OUT/$f.json"
done
```

Si `grep` ne sort pas proprement les métriques (structure JSON variable), lire le fichier avec l'outil
**Read** et repérer à l'œil : `categories.performance.score`, et sous `audits` les entrées
`largest-contentful-paint`, `total-blocking-time`, `cumulative-layout-shift`, `first-contentful-paint`,
`speed-index` (champ `displayValue`).

Récupérer aussi les **opportunités** (ce qui coûte du temps), triées par gain : chercher dans `audits`
les entrées de type `opportunity` avec `"score"` < 0.9, p.ex. `render-blocking-resources`,
`unused-css-rules`, `unused-javascript`, `uses-optimized-images`, `modern-image-formats`,
`uses-responsive-images`, `offscreen-images`, `uses-text-compression`, `uses-long-cache-ttl`,
`unminified-css/js`, `server-response-time`, `dom-size`, `font-display`.

## Étape 2 — Rapporter en français (avant de toucher au code)

Présenter simplement, sans jargon :
- **Score mobile** et **score ordinateur** sur 100 (🟢 ≥ 90 · 🟠 50-89 · 🔴 < 50).
- **Core Web Vitals** en clair : « temps d'affichage du gros élément (LCP) », « stabilité visuelle (CLS) »,
  « réactivité (blocage, TBT) », avec la valeur et si c'est bon/moyen/mauvais.
- **Top 3-5 choses à améliorer**, classées par gain estimé, chacune traduite en langage simple
  (ex. « images trop lourdes → 1,2 s à gagner », « du JavaScript bloque l'affichage »).

## Étape 3 — Corriger (uniquement le sûr, sans rien casser)

Pour chaque opportunité, appliquer la correction correspondante **dans ce codebase statique** :

| Diagnostic PageSpeed | Correction concrète dans Parc Pilot |
|---|---|
| Images trop lourdes / mauvais format / non redimensionnées | Recompresser, convertir en WebP quand pertinent, ajouter `width`/`height`, `loading="lazy"` sur les images hors écran (logos, photos véhicules, brochure). |
| JavaScript / CSS bloquant l'affichage | Vérifier `defer` sur les `<script>`, `preconnect`/`preload` déjà présents ; ne PAS casser l'ordre de chargement (app.js → data.js → pages). |
| CSS/JS non minifié ou inutilisé | Tailwind est **précompilé** : lancer le REBUILD (voir §4) pour purger le CSS inutilisé. |
| Cache trop court sur les assets | Le cache-busting `?v=` gère déjà la fraîcheur ; ne rien changer côté headers (GitHub Pages). |
| Compression texte manquante | Servi par GitHub Pages (gzip/br) — rien à faire côté repo, le signaler seulement. |
| DOM trop gros / polices | `font-display: swap` si police custom ; alléger un rendu seulement si sans risque fonctionnel. |

**Interdits** : ne pas retirer une fonctionnalité, un script ou une donnée pour gagner de la vitesse ;
ne pas toucher à Supabase / aux données ; ne pas modifier `CNAME`.

## Étape 4 — Respecter les règles du projet (obligatoire) puis déployer

Avant tout commit, relire `CLAUDE.md`. En particulier :
- **Rebuild Tailwind** si des classes HTML/JS ont changé :
  `npx tailwindcss@3.4.17 -c tailwind.config.js -i assets/css/_tw-input.css -o assets/css/tailwind.css --minify`
- **Bumper le `?v=` PARTOUT** (`sed` sur tous les `.html`) dès qu'on touche `app.js`/`supabase-client.js`/`data.js`/`styles.css`/`tailwind.css` — sinon le cache sert l'ancien fichier.
- **`data.js` : jamais de données personnelles** (repo public) — ne pas régénérer sans re-anonymiser.
- **Manuel** : si l'UX visible change, mettre à jour `pages/manuel.html`.
- Échapper toute donnée utilisateur via `FP.esc` (anti-XSS).

Déploiement (workflow du projet) :
1. Travailler sur la **branche désignée** de la session, jamais directement sur `main`.
2. `git add` → `commit` clair → `push -u origin <branche>` (retry backoff réseau).
3. Ouvrir une **PR** vers `main` et la merger (GitHub Pages publie en ~1-2 min).
4. ⚠️ **Ne JAMAIS résoudre un conflit avec `-X ours` / `checkout --ours`** (ça a déjà écrasé du travail) :
   résoudre les conflits ligne par ligne, ou pré-merger `origin/main` proprement avant de pousser.
5. **Vérifier en live** que `parc-pilot.fr` sert bien la nouvelle version (`curl` du `?v=`), puis
   **re-lancer l'audit (Étape 1)** et annoncer le gain (avant → après).

## Sortie attendue

Un message final en français : scores avant/après (mobile + ordi), ce qui a été corrigé, ce qui a été
laissé (et pourquoi), et le rappel « un seul Ctrl+Maj+R » côté navigateur.
