-- ============================================================
--  Parc Pilot — PORTAIL CONDUCTEUR · RÉPONSE DU GESTIONNAIRE
-- ============================================================
--  Ajoute à declarations_conducteur la possibilité, pour le gestionnaire, de laisser une
--  RÉPONSE ÉCRITE (facultative) à une déclaration / question du conducteur. Le conducteur
--  la retrouve dans « 📨 Mes signalements » (portail QR, page v.html) et la reçoit aussi
--  par e-mail quand une adresse est connue.
--
--  Additif et NON destructif (ADD COLUMN IF NOT EXISTS) — n'altère aucune donnée existante.
--  Les policies RLS restent inchangées : le gestionnaire (compte de la société) écrit la
--  réponse via le client authentifié (policy tenant « for all ») ; le conducteur la lit via
--  l'Edge Function km-collect (service_role, scopée par le token du véhicule).
--
--  À exécuter UNE SEULE FOIS dans Supabase → SQL Editor → coller → Run.
-- ============================================================

alter table public.declarations_conducteur add column if not exists reponse    text;
alter table public.declarations_conducteur add column if not exists reponse_at timestamptz;

-- Vérif rapide des colonnes présentes :
select column_name, data_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'declarations_conducteur'
  order by ordinal_position;
