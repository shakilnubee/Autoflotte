-- ============================================================
--  Avis de contravention partageables par e-mail (bucket privé)
--  Le bucket "scans" est PRIVÉ. Mais l'avis de contravention est
--  envoyé PAR E-MAIL au conducteur, qui n'est PAS connecté :
--  la page avis.html doit pouvoir générer un lien SIGNÉ pour lui.
--
--  On autorise donc la LECTURE (createSignedUrl) du SEUL sous-dossier
--  "avis/" au rôle anonyme. Les permis, cartes grises et pièces
--  d'identité (autres sous-dossiers) restent totalement privés.
--  Le rôle anon ne peut PAS lister les fichiers : il faut connaître
--  le nom exact (le n° d'avis) pour obtenir un lien.
--
--  À lancer dans Supabase → SQL Editor → Run.
-- ============================================================

drop policy if exists "scans_anon_read_avis" on storage.objects;
create policy "scans_anon_read_avis" on storage.objects
  for select to anon
  using ( bucket_id = 'scans' and (storage.foldername(name))[1] = 'avis' );

-- Vérification : la policy doit apparaître
select policyname, roles, cmd
  from pg_policies
 where tablename = 'objects' and policyname = 'scans_anon_read_avis';
