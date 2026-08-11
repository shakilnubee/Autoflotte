---
description: Rebuild Tailwind + bump du ?v= partout (cache-busting), sans committer
---

Objectif : appliquer les deux règles récurrentes du CLAUDE.md (rebuild Tailwind + cache-busting) en une seule commande. NE PAS committer ni pusher (ça, c'est /deploy).

Fais dans l'ordre :

1. **Rebuild Tailwind** (obligatoire dès qu'une classe Tailwind a changé dans le HTML/JS) :
   ```
   npx tailwindcss@3.4.17 -c tailwind.config.js -i assets/css/_tw-input.css -o assets/css/tailwind.css --minify
   ```

2. **Bump du `?v=` partout** : la version est UNIFORME sur tout le site (format `?v=AAAAMMJJx`, ex. `?v=20260709a`).
   - Trouve la version actuelle : `grep -rho '?v=[0-9]\{8\}[a-z]' --include=*.html . | sort -u`
   - Calcule la nouvelle : date du jour (voir la date courante) + suffixe `a`. Si on est déjà le même jour avec un `a`, passe à `b`, puis `c`, etc.
   - Remplace l'ancienne par la nouvelle dans TOUS les `.html` (racine + `pages/`) :
     ```
     grep -rl '?v=<ANCIENNE>' --include=*.html . | xargs sed -i 's/?v=<ANCIENNE>/?v=<NOUVELLE>/g'
     ```

3. **Vérifie** : `grep -rho '?v=[0-9]\{8\}[a-z]' --include=*.html . | sort -u` ne doit renvoyer QU'UNE seule version (la nouvelle). Affiche le résultat à l'utilisateur.

Rappelle à l'utilisateur qu'un seul Ctrl+Maj+R suffira après le déploiement.
