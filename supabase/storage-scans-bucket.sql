-- ============================================================
--  STOCKAGE DES PDF (bucket « scans ») — lecture publique + écriture pour les comptes connectés.
--  Sert à STOCKER puis RÉAFFICHER les PDF (factures Total, avis d'amende, scans…).
--  Symptôme si non fait : « Aucun PDF stocké » dans le drawer, ou erreur à l'import.
--
--  À lancer UNE FOIS dans Supabase → SQL Editor → Run. Idempotent.
-- ============================================================

-- 1) Le bucket existe et est PUBLIC (lecture directe des PDF par URL).
insert into storage.buckets (id, name, public)
values ('scans', 'scans', true)
on conflict (id) do update set public = true;

-- 2) Politiques d'accès sur les fichiers du bucket « scans ».
--    Lecture : tout le monde (bucket public). Écriture / remplacement : comptes CONNECTÉS.
drop policy if exists "scans_read"   on storage.objects;
drop policy if exists "scans_insert" on storage.objects;
drop policy if exists "scans_update" on storage.objects;

create policy "scans_read"   on storage.objects
  for select using (bucket_id = 'scans');

create policy "scans_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'scans');

create policy "scans_update" on storage.objects
  for update to authenticated using (bucket_id = 'scans') with check (bucket_id = 'scans');

-- Vérif : doit renvoyer 3 lignes (scans_read / scans_insert / scans_update)
select policyname, cmd from pg_policies
where schemaname = 'storage' and tablename = 'objects' and policyname like 'scans_%';
