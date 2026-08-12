-- =====================================================================================
--  Vérification : colonnes `autonomie` / `version` en DOUBLON de `note_pneus` / `type_pneus`
--  Contexte : l'appli LIT l'autonomie dans la colonne `note_pneus` (mapping note_pneus↔autonomie)
--  et la version dans `type_pneus` (↔version). Si la table `vehicules` contient EN PLUS de vraies
--  colonnes `autonomie`/`version` (schéma historique), la lecture pourrait afficher une valeur
--  périmée/vide au lieu de `note_pneus`/`type_pneus`. Ce script vérifie, préserve, puis nettoie.
--  À exécuter dans Supabase → SQL Editor.
-- =====================================================================================

-- ─────────────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 1 — DIAGNOSTIC (LECTURE SEULE, aucun risque). Lance CECI en premier.
-- Renvoie les colonnes réellement présentes parmi les 4.
--   • Si tu vois SEULEMENT `note_pneus` et `type_pneus` → RIEN à faire, il n'y a pas de doublon. STOP.
--   • Si tu vois AUSSI `autonomie` et/ou `version` → il y a un doublon, passe à l'étape 2.
-- ─────────────────────────────────────────────────────────────────────────────────────
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'vehicules'
  AND column_name IN ('autonomie', 'version', 'note_pneus', 'type_pneus')
ORDER BY column_name;


-- ─────────────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 2 — CAS CONFIRMÉ (diagnostic du 2026-08-12) : SEULE `autonomie` (type text) est en
-- doublon ; `version` n'existe pas. Toutes les colonnes sont en `text` → aucun cast nécessaire.
--
-- Sûr, sans perte : on récupère l'autonomie orpheline (uniquement dans la colonne en doublon)
-- vers note_pneus (la source lue par l'appli), PUIS on supprime la colonne en doublon.
-- ─────────────────────────────────────────────────────────────────────────────────────

-- (Optionnel) Combien de lignes seraient récupérées ? 0 = rien d'orphelin, suppression transparente.
--   SELECT count(*) FROM vehicules
--   WHERE (note_pneus IS NULL OR note_pneus = '') AND autonomie IS NOT NULL AND autonomie <> '';

-- 2a) Sauvegarde ZÉRO perte (ne touche note_pneus que s'il est vide) :
UPDATE vehicules
SET note_pneus = autonomie
WHERE (note_pneus IS NULL OR note_pneus = '')
  AND autonomie IS NOT NULL AND autonomie <> '';

-- 2b) Suppression de la colonne en doublon (l'appli ne la lit pas — elle lit note_pneus) :
ALTER TABLE vehicules DROP COLUMN IF EXISTS autonomie;
