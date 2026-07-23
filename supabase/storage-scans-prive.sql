-- ============================================================
--  Sécurité / RGPD : rendre le bucket "scans" PRIVÉ
--  (permis, cartes grises, constats… ne doivent plus être
--   accessibles par une simple URL publique).
--
--  Le site continue de fonctionner : app.js sert désormais TOUS
--  les documents (liens ET images/iframes) via des liens SIGNÉS
--  temporaires, réservés aux utilisateurs CONNECTÉS.
--
--  À lancer dans Supabase → SQL Editor → Run.
-- ============================================================

-- 1) Bucket privé (les URL ".../object/public/scans/..." ne servent plus les fichiers)
update storage.buckets set public = false where id = 'scans';

-- 2) Politiques d'accès : seuls les utilisateurs CONNECTÉS peuvent lire / déposer / modifier /
--    supprimer les fichiers du bucket "scans". (La lecture "authenticated" est ce qui permet à
--    createSignedUrl de fonctionner côté site.)
drop policy if exists "scans_auth_read"   on storage.objects;
drop policy if exists "scans_auth_insert" on storage.objects;
drop policy if exists "scans_auth_update" on storage.objects;
drop policy if exists "scans_auth_delete" on storage.objects;

create policy "scans_auth_read" on storage.objects
  for select to authenticated using (bucket_id = 'scans');

create policy "scans_auth_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'scans');

create policy "scans_auth_update" on storage.objects
  for update to authenticated using (bucket_id = 'scans') with check (bucket_id = 'scans');

create policy "scans_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'scans');

-- 3) Vérification : le bucket doit être privé
select id, public from storage.buckets where id = 'scans';
