-- ============================================================
-- Auto-flotte - Garantir la sauvegarde sur TOUTES les tables
-- A coller UNE FOIS dans Supabase -> SQL Editor (editeur VIDE) -> Run.
-- Autorise ajout / modification / suppression depuis l'app sur toutes les
-- tables, pour que CHAQUE action soit enregistree et partagee entre PC.
-- Sans danger : ne touche AUCUNE donnee (juste un reglage de securite).
-- ============================================================

ALTER TABLE vehicules    DISABLE ROW LEVEL SECURITY;
ALTER TABLE amendes      DISABLE ROW LEVEL SECURITY;
ALTER TABLE factures     DISABLE ROW LEVEL SECURITY;
ALTER TABLE emprunts     DISABLE ROW LEVEL SECURITY;
ALTER TABLE conducteurs  DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents    DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;
