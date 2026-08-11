---
description: Rebuild + bump ?v= + commit + push sur main (déploie GitHub Pages)
argument-hint: [message de commit]
---

Déploiement complet de Parc Pilot. Message de commit fourni : "$ARGUMENTS" (s'il est vide, écris un message court et clair décrivant les modifs).

Fais dans l'ordre :

1. **Rebuild + cache-busting** : exécute d'abord toute la procédure de `/rebuild` (rebuild Tailwind si des classes ont changé, puis bump du `?v=` uniforme partout).

2. **Commit** :
   ```
   git add -A
   git commit -m "$ARGUMENTS"
   ```

3. **Push sur `main`** (GitHub Pages publie tout seul en ~1-2 min) :
   ```
   git push -u origin main
   ```
   ⚠️ Le déploiement live se fait UNIQUEMENT depuis `main` (pas Netlify, pas Vercel). Si la branche courante n'est pas `main`, PRÉVIENS l'utilisateur et demande confirmation avant de merger/pusher.

4. **Rappel final** : dis à l'utilisateur de VÉRIFIER dans 1-2 min que le site live reflète bien le changement → https://shakilnubee.github.io/Autoflotte/ (un seul Ctrl+Maj+R).
