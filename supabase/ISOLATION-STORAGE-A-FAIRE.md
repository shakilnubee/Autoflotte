# 🔴 À FAIRE AVANT D'AJOUTER UN 2ᵉ CLIENT — Cloisonner le stockage de fichiers par société

## Le problème (trouvé par l'audit d'isolation)
Le bucket Supabase Storage `scans` (qui contient **cartes grises, permis, avis d'amende, constats,
photos d'état des lieux, contrats PDF…**) a des règles **non isolées par société** :

```sql
-- supabase/storage-scans-prive.sql (état actuel)
scans_auth_read   → for select to authenticated using (bucket_id = 'scans')
scans_auth_delete → for delete to authenticated using (bucket_id = 'scans')
```

→ **N'importe quel compte connecté (de n'importe quelle société) peut LIRE et SUPPRIMER n'importe quel
fichier**, y compris ceux d'un autre client (PII sensible + risque de suppression cross-société).

L'isolation s'arrête aujourd'hui aux **tables** (RLS OK) ; elle ne couvre **pas** les fichiers du stockage.

## Pourquoi ce n'est pas encore exploitable (mais à régler vite)
Il faut un **2ᵉ compte client connecté** pour exploiter la faille. Tant qu'il n'y a que le compte CEO,
personne d'autre ne peut lire/supprimer. **C'est DORMANT — mais à corriger AVANT d'onboarder un client.**

## Mitigation déjà en place (déployée)
- `contrats.html` : la récupération de PDF orphelins (qui **listait** le dossier partagé) est désormais
  **réservée au CEO** → un compte client ne liste plus les fichiers des autres.

## Le vrai correctif (à faire ensemble, avec test — PAS en aveugle)
⚠️ Une mauvaise règle de storage peut **bloquer l'accès à TOUS les fichiers** (documents, e-mails, EDL).
On le fait donc **par étapes testées**, idéalement juste avant le 1ᵉʳ vrai client :

1. **Préfixer les nouveaux chemins par la société** : tout upload va dans `<societe>/dossier/fichier`
   au lieu de `dossier/fichier` (modifier les points d'upload : app.js `uploadScan`/EDL, km-collect, etc.).
2. **Policies storage scopées** :
   ```sql
   drop policy if exists scans_auth_read   on storage.objects;
   drop policy if exists scans_auth_delete on storage.objects;
   create policy scans_soc_read on storage.objects for select to authenticated
     using (bucket_id='scans' and (public.fp_is_admin() or (storage.foldername(name))[1] = public.fp_societe()));
   create policy scans_soc_write on storage.objects for insert to authenticated
     with check (bucket_id='scans' and (public.fp_is_admin() or (storage.foldername(name))[1] = public.fp_societe()));
   create policy scans_soc_delete on storage.objects for delete to authenticated
     using (bucket_id='scans' and (public.fp_is_admin() or (storage.foldername(name))[1] = public.fp_societe()));
   ```
3. **Migrer les fichiers existants** (PXP) vers le préfixe `PXP/…` et mettre à jour les liens en base
   (`documents.url`, etc.), OU les laisser accessibles au CEO seulement (ils sont tous à PXP = toi = CEO).
4. **Tester** : un compte client de la société de test ne doit lire QUE ses fichiers ; le CEO voit tout ;
   les documents existants restent accessibles.

## Résumé
- ✅ Fait : listage cross-société réservé au CEO (mitigation).
- 🔴 À faire avec moi, avant le 2ᵉ client : préfixe société + policies storage + migration + test.
