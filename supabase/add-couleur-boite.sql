-- ============================================================
-- Ajout des colonnes "couleur" et "boite" (boîte de vitesses) à la table vehicules.
-- À exécuter UNE FOIS dans Supabase → SQL Editor. Idempotent, sans risque.
-- Tant que ces colonnes n'existent pas, l'app garde les valeurs en LOCAL (override)
-- et les synchronise automatiquement une fois les colonnes créées.
-- ============================================================
alter table public.vehicules add column if not exists couleur text;
alter table public.vehicules add column if not exists boite   text;   -- 'Manuelle' | 'Automatique'
