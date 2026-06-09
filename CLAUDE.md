# Parc Pilot — Contexte projet

## C'est quoi ce projet ?

**Parc Pilot** est un SaaS de gestion de flotte automobile, développé pour TJMAX (avec aussi des véhicules BPCE en leasing et PROJECT X PARIS RETAIL).

- **Propriétaire** : Shakil Nubeebaccus
- **Stack** : HTML/CSS/JS statique + Tailwind précompilé en local (`assets/css/tailwind.css`, voir Conventions)
- **Backend** : Supabase (PostgreSQL + Auth)
- **Hosting** : ✅ **GitHub Pages** (auto-déploiement depuis la branche `main`) → **https://shakilnubee.github.io/Autoflotte/**
  - ⚠️ Netlify (auto-flotte.netlify.app) = EN PAUSE (quota dépassé) — ne plus utiliser. Vercel (autoflotte.vercel.app) = version périmée — ne plus utiliser.
  - **Règle** : chaque modif de code DOIT être mergée + poussée sur `main` (GitHub Pages publie tout seul en ~1-2 min). Toujours VÉRIFIER après push que le site live reflète bien le changement.
  - Les **données** (Supabase) sont en temps réel sur tous les postes, sans déploiement.
- **Repo** : https://github.com/shakilnubee/Autoflotte  (public, branche `main`)
- **Langue UI** : Français

## Fichier source Drive (référence unique)

⚠️ Pour toute synchro flotte/conducteurs/amendes, utiliser **TOUJOURS et UNIQUEMENT** ce
fichier Google Sheets (demande explicite de l'utilisateur) :
- **ID** : `1OytuLYw0T8-0Hebsu0L6N8sgk1pC6SfKp3n7l1i0fkU`
- Onglet véhicules en haut (col `CONDUCTEUR | N° de plaque | Type`), puis sections amendes.
- Ne jamais utiliser les anciennes copies (« pour Claude », « Copie de Voiture + Contravention », etc.).
- ⚠️ **RÈGLE « mettre à jour »** (consigne explicite) : quand l'utilisateur dit « mets à jour »,
  ne prendre QUE **l'onglet `véhicules`** et **l'onglet `2026`** (amendes 2026). Ignorer tous les
  autres onglets/sections (emprunts, anciennes amendes, etc.).
- ⚠️ **Source FACTURES** (consigne explicite) : dossier Drive `111YMFZL-daGrBSIQcdfPmvOouDltbg0v`,
  organisé par pays → sous-dossier par véhicule (plaque) → PDF. Prendre **FRANCE, ITALIE,
  ALLEMAGNE, Pays-Bas** uniquement. **EXCLURE** les sous-dossiers `01. Autres` et `OUT`.
  Lier chaque PDF à la table `factures` par `file_id` ; « nouvelles » = `file_id` absent de la base.
- ⚠️ **Stockage autonomie/version** : côté DB, l'autonomie est dans la colonne `note_pneus`
  (mapping `note_pneus`↔`autonomie`) et la version dans `type_pneus` (↔`version`). Écrire
  l'autonomie dans `note_pneus`, PAS dans la colonne `autonomie` (ignorée par l'app).

## Structure du projet

```
fleet-app/
├── index.html              # Page d'accueil (redirige vers dashboard)
├── dashboard.html          # Tableau de bord principal
├── login.html              # Authentification Supabase
├── assets/
│   ├── css/styles.css      # Styles globaux + variables CSS
│   └── js/
│       ├── app.js          # FP helpers (settings, history, column editor, search, logout)
│       ├── data.js         # FP_DATA = { vehicules, amendes, factures } (~263KB)
│       └── supabase-client.js  # Client Supabase + FP.db + FP.auth
└── pages/
    ├── vehicules.html
    ├── amendes.html
    ├── factures.html
    ├── entretiens.html
    ├── contrats.html
    ├── statistiques.html
    ├── conducteurs.html
    ├── sinistres.html
    ├── a-vendre.html
    └── parametres.html
```

## Données

- **52 véhicules** (TJMAX, BPCE leasing, PROJECT X PARIS RETAIL)
- **60 amendes 2026** (les 2025 ont été supprimées sur demande)
- **384 factures**
- Groupes véhicules : Siège, Commerciaux, Gov, International (clé interne `pool`), À vendre, Retail, Dépôt, Non classé

## Supabase

- **URL** : `https://tzjuptlzoywjeigmyfuj.supabase.co`
- **Clé publique** (safe à exposer côté client) : `sb_publishable_KC3TZ1zda-ja-0wkyjHUlg_aKohD6tq`
- ⚠️ **JAMAIS** mettre la clé `sb_secret_...` dans le code client
- Tables : `vehicules`, `amendes`, `factures` (mapping snake_case ↔ camelCase géré dans `FP.db`)
- Auth : email/password, avec checkbox "Se souvenir de moi" (localStorage flag + sessionStorage marker)

## Conventions importantes

0. ⚠️ **MULTI-SOCIÉTÉS — règle clé** : toute modification du LOGICIEL (UI, boutons, features, mises en page) doit être **GLOBALE** : elle s'applique à **toutes les sociétés déjà créées ET futures**. Le code (HTML/JS/CSS) est partagé par toutes les sociétés (filtrage par `societe` côté données uniquement). Ne JAMAIS coder une fonctionnalité ou un libellé spécifique à une seule société — sinon l'utilisateur se perd entre les sociétés. (Les *données* — véhicules/amendes — restent, elles, propres à chaque société.)

0bis. ⚠️ **Notifications / alertes** : dès qu'une alerte regroupe **plusieurs éléments**, proposer une **liste dépliable** (`<details>`) avec chaque élément cliquable vers sa fiche — jamais une simple redirection vers une page générique. (Champ `vehicules`/`items` sur l'alerte, rendu en `<details>` dans `notifications.html`.)

1. **Tailwind précompilé** — pour éviter le délai du CDN à chaque page, Tailwind est compilé en local dans `assets/css/tailwind.css` (les pages le chargent via `<link>`, plus de `cdn.tailwindcss.com`). ⚠️ Après toute modif de classes Tailwind dans le HTML/JS, REBUILD : `npx tailwindcss@3.4.17 -c tailwind.config.js -i assets/css/_tw-input.css -o assets/css/tailwind.css --minify` (sinon les nouvelles classes ne seront pas stylées). Les pages `brochure.html` et `logos.html` (autonomes) restent sur le CDN.
2. **Auth guard** synchrone dans le `<head>` de chaque page protégée (11 pages)
3. **Personnalisation** : tout est éditable en double-cliquant (titres, sous-titres, colonnes, onglets sidebar)
4. **Drag & drop** : colonnes et lignes réorganisables avec HTML5 Drag API
5. **Undo/Redo** : Ctrl+Z / Ctrl+Y via `FP.history`
6. **Localisation** : tout en français, formats `FP.euro()`, `FP.date()`, `FP.num()`
7. **Pas de sticky columns** (testé puis retiré sur demande utilisateur)

## Workflow Git

```powershell
git pull              # Au début de chaque session (récupère les modifs des autres PC)
# ... tu modifies ...
git add .
git commit -m "ton message"
git push              # Netlify redéploie automatiquement
```

## Tâches en attente

- [ ] Brancher Netlify à GitHub pour auto-déploiement (Site settings → Build & deploy → Link to GitHub)
- [ ] Créer compte utilisateur Supabase (Auth → Add user → Auto Confirm User)
- [ ] Activer RLS (Row Level Security) sur les tables Supabase
- [ ] Phase 3 : activer les écritures Supabase pour les mutations (drawer, bulk actions)
- [ ] Phase 4 : page "Espace salarié"
- [ ] Acheter domaine personnalisé (.fr ou .com) via OVH/Gandi

## Pour Claude (nouvelle session)

Si tu reprends ce projet :
- L'utilisateur parle **français**, garde un ton direct et simple (il n'est pas dev)
- Il bosse sous **Windows / PowerShell 5.1** (pas Python, pas Node installés)
- Préfère les solutions **sans terminal** quand possible (UI Supabase, UI Netlify, UI GitHub)
- Avant de modifier `data.js` : c'est un gros fichier, utilise Edit avec contexte précis
- Pour toute modif déployée : `git add` → `git commit` → `git push` (Netlify redéploie tout seul)
