-- ============================================================
-- Auto-flotte - Autoriser les ecritures sur conducteurs & documents
-- A coller UNE FOIS dans Supabase -> SQL Editor (editeur VIDE) -> Run.
-- Sans danger : ne touche AUCUNE donnee, change juste un reglage de securite
-- (aligne ces 2 tables sur les autres pour que les ajouts se partagent entre PC).
-- ============================================================

ALTER TABLE conducteurs DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents   DISABLE ROW LEVEL SECURITY;
