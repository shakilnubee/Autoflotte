-- ============================================================
--  DURCISSEMENT SÉCURITÉ — Avis de contravention 100 % privés
--
--  ⚠️ CHANGEMENT (2026-08-03) : on RETIRE l'accès anonyme au dossier
--  "avis/" du bucket "scans".
--
--  Avant : le rôle anonyme (anon) pouvait lire (créer un lien signé)
--  n'importe quel fichier de "scans/avis/…" → l'avis de contravention
--  d'un conducteur était accessible sans être connecté (page publique
--  avis.html). C'était une fuite potentielle de PII (plaque, nom,
--  infraction).
--
--  Maintenant : l'e-mail d'amende embarque directement l'avis en
--  PIÈCE JOINTE + un lien SIGNÉ (valable 7 jours) généré côté client
--  par un utilisateur CONNECTÉ (FP.signedScanUrl). Plus aucun besoin
--  d'un accès anonyme au bucket. On supprime donc la policy.
--
--  À lancer UNE FOIS dans Supabase → SQL Editor → Run.
-- ============================================================

drop policy if exists "scans_anon_read_avis" on storage.objects;

-- Vérification : la requête ne doit renvoyer AUCUNE ligne
-- (la policy anonyme a bien disparu)
select policyname, roles, cmd
  from pg_policies
 where tablename = 'objects' and policyname = 'scans_anon_read_avis';
