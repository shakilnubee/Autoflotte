-- ============================================================
--  Autoriser la SUPPRESSION des fichiers du bucket "scans"
--  par les utilisateurs CONNECTÉS.
--
--  Pourquoi : le setup d'origine (storage-scans-bucket.sql) crée
--  les policies read / insert / update mais PAS delete → la
--  corbeille de « Contrats → Leasing → Retrouver les PDF » ne
--  pouvait pas supprimer physiquement un PDF (elle se contentait
--  alors de le masquer). Cette policy active la vraie suppression
--  → libère l'espace de stockage (doublons, PDF inutiles).
--
--  Portée : identique aux policies insert/update déjà en place
--  (utilisateur connecté, bucket "scans"). L'isolation des
--  données entre sociétés reste gérée au niveau des TABLES (RLS
--  tenant_*), comme aujourd'hui — le stockage n'est pas scindé
--  par société (même modèle que l'upload/màj actuels).
--
--  À lancer UNE fois : Supabase → SQL Editor → coller → Run.
--  Idempotent (drop + create) : ré-exécutable sans risque.
-- ============================================================

drop policy if exists "scans_auth_delete" on storage.objects;

create policy "scans_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'scans');

-- Vérification : la policy doit apparaître
select policyname, cmd
from pg_policies
where schemaname = 'storage' and tablename = 'objects' and policyname = 'scans_auth_delete';
