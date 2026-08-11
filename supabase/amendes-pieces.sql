-- ============================================================
--  Parc Pilot — Amendes : pièces jointes multiples
-- ============================================================
--  Ajoute une colonne `pieces` (liste de documents) à la table amendes.
--  Chaque amende peut ainsi recevoir AUTANT de PDF/photos que nécessaire
--  (avis initial, nouvel avis après désignation, justificatifs…), en plus
--  du scan d'avis et du justificatif existants.
--
--  Format : [{ "id": "...", "label": "Avis après désignation", "url": "...", "date": "2026-07-17" }, ...]
--
--  À exécuter UNE fois dans Supabase → SQL Editor → coller → Run. Sans danger.
-- ============================================================

alter table public.amendes add column if not exists pieces jsonb not null default '[]'::jsonb;
