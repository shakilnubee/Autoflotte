# Brancher la lecture IA (Haiku) — guide pas à pas

Objectif : quand tu déposes une facture (ou un document) dans l'app, c'est **Claude Haiku**
qui la lit (comme moi dans le chat) et remplit les champs tout seul. Le code est déjà en
place : il ne reste que **5 étapes côté Anthropic + Supabase** (≈ 15 min, sans terminal).

> Tant que ces étapes ne sont pas faites, l'app continue d'utiliser le lecteur local
> (gratuit) — donc rien n'est cassé. Une fois branché, Haiku passe en priorité automatiquement.

---

## 1) Créer un compte API Anthropic + mettre du crédit
1. Va sur **https://console.anthropic.com** → crée un compte (ou connecte-toi).
2. **Billing** → ajoute un moyen de paiement et mets **5 €/$** de crédit (largement suffisant).
   - ⚠️ C'est un compte **séparé** de ton abonnement Claude. Ça ne touche pas à Opus.
3. **API Keys** → **Create Key** → copie la clé (commence par `sk-ant-...`).
   - ⚠️ **Ne la colle JAMAIS dans le code du site.** Elle va uniquement dans Supabase (étape 3).

## 2) Créer la fonction « scan-doc » dans Supabase
1. Supabase → ton projet → menu **Edge Functions** → **Create a new function**.
2. Nom exact : **`scan-doc`**.
3. Ouvre le fichier du repo **`supabase/functions/scan-doc/index.ts`**, copie TOUT,
   colle-le dans l'éditeur Supabase (remplace le code d'exemple).
4. Clique **Deploy**.

## 3) Donner la clé secrète à la fonction
1. Edge Functions → **Secrets** (ou Project Settings → Edge Functions → Secrets).
2. **Add new secret** :
   - Name : `ANTHROPIC_API_KEY`
   - Value : ta clé `sk-ant-...` de l'étape 1.
3. Save. (La clé reste côté serveur, jamais visible dans le navigateur.)

## 4) Autoriser l'appel depuis le site (si besoin)
- Par défaut la fonction exige un utilisateur connecté — c'est parfait, l'app envoie
  automatiquement le jeton de connexion.
- Si Supabase te propose une option « **Verify JWT** », laisse-la **activée** (sécurité).

## 5) Tester
1. Sur le site : **Ctrl+Maj+R** sur la page Factures.
2. Clique **Importer une facture** → **Lire le PDF** → choisis une facture.
3. Tu dois voir « **✓ Lecture IA — N champ(s)** » et les champs remplis (fournisseur compris).

---

## Combien ça coûte ?
- ~**0,004 € par facture** lue. 1 000 factures ≈ ~4,50 €. Les 5 € de crédit durent très longtemps.
- Pas de quota de documents : paiement à l'usage.

## En cas de souci
- Si l'IA échoue (pas de crédit, fonction non déployée, coupure réseau), l'app **retombe
  automatiquement** sur le lecteur local — tu peux toujours saisir à la main.
- Vérifie dans Supabase → Edge Functions → **Logs** de `scan-doc` s'il y a une erreur
  (ex. « ANTHROPIC_API_KEY manquante » = secret pas défini ; « crédit insuffisant » = recharge).
