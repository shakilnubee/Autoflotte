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
  Les **nouvelles** factures se trouvent en général dans les sous-sous-dossiers **`2026`** de chaque véhicule.
  ⚠️ **Vérifier par le CONTENU, pas par le nom** : il faut LIRE le PDF/scan pour décider (un fichier « Scan… » peut être une vraie facture). N'importer dans `factures` QUE les **vraies factures** (fournisseur + montants), avec OCR du HT / TVA / TTC / n° de facture / KM / fournisseur / description courte.
  ⚠️ **ANTI-DOUBLONS — toute la plateforme** (consigne explicite) : à CHAQUE ajout, détecter les doublons via le helper central **`FP.dupe`** (`assets/js/app.js`). `FP.dupe.confirmAdd(table, rec, list)` = garde AVANT insertion (demande confirmation si doublon) ; `FP.dupe.find(...)` = renvoie l'existant. Règles : **factures** = même n° + même montant TTC (sinon fournisseur+TTC+date) ; **amendes** = n° d'avis + montant (sinon prénom+date+montant) ; **véhicules** = immatriculation ; **emprunts** = véhicule+emprunteur+date ; **conducteurs** = key/nom. Déjà branché : scanner (dashboard), factures, amendes, véhicules (manuel + import lot carte grise), emprunts. ⚠️ **Tout NOUVEAU point d'ajout DOIT passer par `FP.dupe`** — le site doit rester propre.
  ⚠️ **TOUTE facture — contrôle systématique** (consigne explicite) : toujours **vérifier HT / TVA / TTC** et alerter si `HT + TVA ≠ TTC` (tolérance 2 cts) — ne jamais valider des montants incohérents en silence (cf. contrôle dans `applyFactureFields`, factures.html ; le parseur privilégie déjà le triplet auto-vérifiant `deriveTotals`). Et **rapprocher les noms de conducteurs** (quand la facture en contient : flotte, péages Ulys…) de ceux **déjà enregistrés** (table `conducteurs` / mémoire projet) — **ne JAMAIS inventer un nouveau conducteur** : un nom qui ne correspond à personne = le signaler, c'est l'utilisateur qui ajoute les nouveaux.
  ⚠️ **Codes/certificats de cession** et **contrôles techniques** : NE PAS les mettre dans `factures` — les ajouter dans la **fiche véhicule → section « Documents »** (table `documents`, type `code-cession` ou `controle-technique`, `url` = lien Drive `https://drive.google.com/file/d/<id>/view`). Les autres documents (carte grise, attestation assurance, devis, photos…) sont ignorés.
- ⚠️ **Stockage autonomie/version** : côté DB, l'autonomie est dans la colonne `note_pneus`
  (mapping `note_pneus`↔`autonomie`) et la version dans `type_pneus` (↔`version`). Écrire
  l'autonomie dans `note_pneus`, PAS dans la colonne `autonomie` (ignorée par l'app).
- ⚠️ **Factures Ulys (péages VINCI) — MÉTHODE DE LECTURE À CONSERVER** (validée par l'utilisateur) :
  ces PDF ont une couche texte, mais la lecture standard (fragments collés par espaces) **mélange
  les colonnes** → montants aberrants et mauvais prénoms. Il faut **reconstruire les lignes en
  triant les fragments pdf.js par POSITION** (y décroissant puis x croissant) — cf.
  `ulysPdfToText()` dans `pages/factures.html`. Ensuite :
  - **Montants facture** : TTC = le montant imprimé avec « € » après `NET A PAYER TTC` ; TVA = 20 %
    d'une base HT présente dans le récap 1re page (couple base/TVA, base max, base+TVA ≤ TTC) ;
    HT = TTC − TVA. (NE PAS sommer tous les nombres après `NET A PAYER` → HT/TVA aberrants.)
  - **Détail par collaborateur** : ancrer sur le **N° DE BADGE** (jamais sur l'ordre des prénoms,
    colonnes inversées). Lire `Badge n° <id> <Nom>` (prénom) et
    `Total Badge <id> <n> consommation(s) <ttc> € TTC <km> km` (trajets + TTC + km), puis relier
    par le n° de badge. Le `Total Contrat` (grand total) est ignoré. Table `ulys_conso`.

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
- ⚠️ **3 NIVEAUX D'ACCÈS — CEO / ADMIN / GESTIONNAIRE** (consigne explicite) : le rôle + la société
  qui **font autorité** vivent dans la table `profiles` (`is_admin`, `role`, `societe`) — **jamais**
  dans `user_metadata` (falsifiable). `FP.role()` (app.js) renvoie `ceo` (super-admin, toutes sociétés)
  / `admin` (client, sa société : tout + config + comptes) / `gestionnaire` (sa société : ajoute/modifie/
  **supprime** les données, mais **pas** la config société ni les comptes) / `chauffeur` (portail salarié).
  Helpers : `FP.isCEO/isAdmin(=ceo||admin)/isGestionnaire/isSuperAdmin/canManageSociete/canManageUsers/roleLabel`.
  - **Gestion des comptes** = **Paramètres → Compte → « Utilisateurs & accès »** (CEO/Admin only) → appelle
    la fonction serveur **`manage-users`** (`supabase/functions/manage-users/index.ts`) qui garde la clé
    `service_role` **côté serveur** et applique la portée (CEO=tout ; Admin=sa société, pas de CEO).
    Plus besoin de Supabase pour créer/modifier/supprimer/réinitialiser un compte. Doc :
    `supabase/COMPTES-CEO-ADMIN-GESTIONNAIRE.md` ; SQL : `supabase/roles-ceo-admin-gestionnaire.sql`.
  - ⚠️ **RÈGLE** : tout nouveau bouton/écran qui touche à la **config société** doit être gardé par
    `FP.canManageSociete()`, et toute gestion de **comptes** par `FP.canManageUsers()` (+ portée serveur).

## Conventions importantes

0. ⚠️ **MULTI-SOCIÉTÉS — règle clé** : toute modification du LOGICIEL (UI, boutons, features, mises en page) doit être **GLOBALE** : elle s'applique à **toutes les sociétés déjà créées ET futures**. Le code (HTML/JS/CSS) est partagé par toutes les sociétés (filtrage par `societe` côté données uniquement). Ne JAMAIS coder une fonctionnalité ou un libellé spécifique à une seule société — sinon l'utilisateur se perd entre les sociétés. (Les *données* — véhicules/amendes — restent, elles, propres à chaque société.)
   - ⚠️ **Adresses d'envoi des mails par société** : l'expéditeur + copies des e-mails d'amende (`EXPEDITEUR` / `COPIE_MAIL` dans `pages/amendes.html`) sont aujourd'hui ceux de **PXP** (`shakil.nubeebaccus@projectxparis.fr` + `mallaury.herembert@projectxparis.fr`) — **NE PAS les changer** (ils appartiennent à PXP). Chaque structure a ses propres adresses : **à la création d'une nouvelle société, DEMANDER à l'utilisateur les adresses d'expédition/copie** et les stocker par société (ne pas réutiliser celles de PXP). Contact public (brochure) = **Shakil Nubee · jis.nubee@gmail.com** (différent des adresses pro PXP).

0bis. ⚠️ **Notifications / alertes** : dès qu'une alerte regroupe **plusieurs éléments**, proposer une **liste dépliable** (`<details>`) avec chaque élément cliquable vers sa fiche — jamais une simple redirection vers une page générique. (Champ `vehicules`/`items` sur l'alerte, rendu en `<details>` dans `notifications.html`.)

0bis-2. ⚠️ **Checklist « À compléter » — À MAINTENIR** (consigne explicite) : la page Alertes (`notifications.html`) a un onglet **« 📝 À compléter »** qui liste **TOUTES les infos manquantes** de la plateforme (véhicules, conducteurs, amendes, factures, configuration société), chaque ligne cliquable vers sa fiche. **RÈGLE** : chaque fois qu'on ajoute un **nouveau champ à remplir** ou une **nouvelle entité/fonctionnalité** avec des données à saisir, il FAUT l'ajouter à cette checklist (listes `VEH_FIELDS` / `COND_FIELDS` / `AMENDE_FIELDS` / bloc `cfg` de `renderComplet`, ou une nouvelle section). Le but : l'utilisateur voit toujours, à un seul endroit, tout ce qu'il lui reste à renseigner.

0ter. ⚠️ **PERF / « flash » des chiffres & latence — LEÇONS (ne pas refaire les erreurs)** :
  - **Cause du flash des chiffres** : chaque page peint d'abord `data.js` (instantané hors-ligne) puis se rafraîchit avec Supabase (`fp:data-ready`). Si `data.js` est **périmé**, on voit l'ancien chiffre → le nouveau.
  - ✅ **Bonne solution = garder `data.js` À JOUR** (le régénérer depuis Supabase quand les données changent beaucoup). C'est un instantané camelCase de `{vehicules, amendes, factures, conducteurs}` (mapping snake→camel identique à `FP.db`, cf. `SNAKE_TO_CAMEL_OVERRIDES`). La table **`conducteurs` DOIT y figurer** sinon le compteur conducteurs fait « 43 → 46 » (calcul en 2 temps : véhicules d'abord, puis requête live de la table conducteurs).
  - 🔒 **RGPD — `data.js` NE DOIT JAMAIS contenir de données personnelles** (le repo est **PUBLIC**) : à chaque régénération, **STRIPPER intégralement** l'identité des personnes. Concrètement (nettoyage validé) : de `conducteurs` → vider `name`, `nom`, `prenom`, `poste`, `note` et **anonymiser `key`** (`c1`,`c2`…), et **supprimer** `email`, `adresse`, `dateNaissance`, `tel`, `permisNumero`, `permisType`, `permisObtention`, `permisExpiration`, `permisUrl`, `permisFileId` (n° de permis + lien vers le scan = PII sensible) ; de `vehicules` → vider `chauffeur` et supprimer `vin` ; de `amendes` → vider `prenom` ; de `factures` → vider tout champ de nom. On ne garde que `masque`/`manuel`/`societe` côté conducteur. Ces données ne vivent QUE dans Supabase (chargées après login, protégées par RLS). `data.js` = instantané d'affichage hors-ligne (immat, marque, km, montants…), **pas un annuaire**. Vérif avant commit (doit renvoyer **0**) : `grep -oE '"(email|adresse|dateNaissance|tel|nom|prenom|name|poste|permisNumero|permisUrl|permisFileId|chauffeur|vin)":"[^"]+"' assets/js/data.js | grep -vE '":""' | wc -l`. (Script de nettoyage type : cf. historique — itère les 4 tableaux et vide/supprime ces champs.)
  - ❌ **NE PAS masquer le contenu** (opacity:0 jusqu'à `fp:data-ready`) : ça donne une **latence « page qui s'affiche puis se remet »** sur tous les onglets. On a retiré cet « antiFlashCache ». Le 1er affichage doit être direct.
  - ✅ **Cache local = TOUT (véhicules + amendes + factures), à jour à chaque `loadAll`** (`localStorage`, clé **versionnée ET par société** `fp_data_cache_v3_<societe>`, relue par `seedFromCache` AVANT le rendu). Comme `data.js` devient périmé dès qu'on ajoute des données, c'est le **cache** (rafraîchi à chaque visite) qui garantit un 1er affichage = live → flash seulement UNE fois après un changement serveur, puis stable. (On avait tenté un cache « léger » sans factures → les chiffres factures re-clignotaient ; ne PAS refaire ça. La lecture ~10 ms est négligeable ; la vraie lenteur d'avant venait de l'antiFlash, pas du cache.)
  - ⚠️ **Isolation multi-sociétés** : clés de cache **suffixées par la société** (`fp_data_cache_v3_<soc>`, `fp_cond_cache_<soc>`, `fp_emprunts_<soc>`) ; l'IIFE `filterStaticCacheBySociete` filtre `data.js` (vehicules+amendes+factures+**conducteurs**) ; `seedCondCacheFromLS` et la migration localStorage→Supabase ne s'exécutent QUE pour PXP (sinon une nouvelle société hérite des données PXP).
  - ✅ **Navigation fluide** (façon SPA, sans réécriture) : `@view-transition { navigation: auto; }` dans `styles.css` (+ `view-transition-name: fp-sidebar` pour garder la sidebar fixe) et **Speculation Rules** (prefetch des liens sidebar au survol) injectées par `app.js`. Le re-rendu sur `fp:data-ready` n'a lieu QUE si les données ont changé (signature légère dans `supabase-client.js`).
  - Si on change `data.js`/`app.js`, prévenir l'utilisateur qu'**un seul Ctrl+Maj+R** suffit puis navigation normale (sinon le re-téléchargement à chaque hard-refresh paraît lent).
  - ⚠️ **CACHE-BUSTING OBLIGATOIRE** : les pages chargent `app.js` / `supabase-client.js` / `data.js` avec un suffixe de version `?v=AAAAMMJJx` (ex. `?v=20260610a`). GitHub Pages met le JS en cache ~10 min → sans ce suffixe, après un déploiement le navigateur garde l'**ancien** JS, et surtout en **navigant d'un onglet à l'autre** chaque page recharge le JS périmé (un hard-refresh sur UNE page ne suffit pas). **À CHAQUE modif de `app.js`/`supabase-client.js`/`data.js`, BUMPER le `?v=` partout** (sed sur tous les `.html`). C'était la vraie cause du « flash qui revient malgré le fix ».

0quater. ⚠️ **RECHERCHE AU CLAVIER — RÈGLE** (consigne explicite) : **tout** choix de véhicule /
   conducteur / plaque / nom doit être **filtrable en tapant** (jamais un `<select>` déroulant nu
   qu'on doit faire défiler). Helper global **`FP.searchSelect(<select>, {placeholder})`** (app.js) :
   transforme un `<select>` en champ de recherche + liste déroulante (au style du site), en gardant
   la valeur lisible via `.value` et l'événement `change`/`input` (menu en `position:fixed` → non
   rogné par les modales). Déjà branché : tâches (véhicule), factures (di-veh + filtres), entretiens,
   sinistres. ⚠️ **Tout NOUVEAU sélecteur de véhicule/conducteur DOIT passer par `FP.searchSelect`.**

1. **Tailwind précompilé** — pour éviter le délai du CDN à chaque page, Tailwind est compilé en local dans `assets/css/tailwind.css` (les pages le chargent via `<link>`, plus de `cdn.tailwindcss.com`). ⚠️ Après toute modif de classes Tailwind dans le HTML/JS, REBUILD : `npx tailwindcss@3.4.17 -c tailwind.config.js -i assets/css/_tw-input.css -o assets/css/tailwind.css --minify` (sinon les nouvelles classes ne seront pas stylées). ⚠️ **`brochure.html` et `prix.html` utilisent désormais le Tailwind LOCAL** (ajoutés à `content` dans `tailwind.config.js`) → à inclure dans le REBUILD. Seule `logos.html` reste sur le CDN. Ces deux pages sont en **thème sombre « 21st »** via une classe `.sheet-dark` (styles inline, autonomes) ; dans `prix.html` l'**aide-mémoire interne** (`#sheet-interne`) reste volontairement CLAIR et `display:none` (jamais montré au client). Les PDF client sont dans `presentation/` (régénérables via Playwright `page.pdf()`).
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
- [x] Activer RLS (Row Level Security) sur les tables Supabase — ✅ confirmé le 2026-06-15 : `rowsecurity = true` sur les 9 tables + policies `tenant_*` (isolation par société) sur vehicules, amendes, factures, conducteurs, documents, emprunts, total_conso, app_settings + `profiles_self_read`. (Reste recommandé : test réel avec un compte client `is_admin=false`.)
- [ ] Phase 3 : activer les écritures Supabase pour les mutations (drawer, bulk actions)
- [ ] Phase 4 : page "Espace salarié"
- [ ] Acheter domaine personnalisé (.fr ou .com) via OVH/Gandi
- [ ] 📎 **Scanner par lot les cartes grises** (KONA + reste de la flotte) via Tableau de bord → « Scanner un document » → remplit auto co2 / puissance fiscale / carburant / date 1re immat / prochain CT / masse **ET le VIN** dans les fiches. **À faire par Shakil, plus tard — LUI RAPPELER s'il oublie.** (L'onglet Alertes → « À compléter » liste en direct ce qui manque encore.)
- [ ] 🎬 Enregistrer la **vidéo de démonstration** (.mp4) avec voix off — **à faire par Shakil, plus tard**. Tout est prêt : la démo auto-jouée est `demo.html`, et le **script imprimable** (mode d'emploi enregistrement écran + texte à lire) est `script-demo.html`.

## Pour Claude (nouvelle session)

Si tu reprends ce projet :
- L'utilisateur parle **français**, garde un ton direct et simple (il n'est pas dev)
- Il bosse sous **Windows / PowerShell 5.1** (pas Python, pas Node installés)
- Préfère les solutions **sans terminal** quand possible (UI Supabase, UI Netlify, UI GitHub)
- Avant de modifier `data.js` : c'est un gros fichier, utilise Edit avec contexte précis
- Pour toute modif déployée : `git add` → `git commit` → `git push` (Netlify redéploie tout seul)
