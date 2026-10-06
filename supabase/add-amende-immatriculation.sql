-- Parc Pilot — ajoute la colonne `immatriculation` à la table `amendes`.
-- Contexte : le code enregistre la plaque de la voiture verbalisée (lue sur l'avis) dans
-- amendes.immatriculation (cf. FP.amendePlaque), mais la colonne n'avait jamais été créée →
-- PostgREST renvoyait « Could not find the 'immatriculation' column of 'amendes' in the schema
-- cache » et l'amende N'ÉTAIT PAS enregistrée (surtout via scan, qui remplit la plaque).
-- À exécuter UNE fois dans Supabase → SQL Editor. Sans effet si la colonne existe déjà.
alter table public.amendes add column if not exists immatriculation text;
-- Recharge le cache de schéma de PostgREST (pour que la colonne soit visible tout de suite).
notify pgrst, 'reload schema';
