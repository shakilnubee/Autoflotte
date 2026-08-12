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
-- ÉTAPE 2 — À N'EXÉCUTER QUE si l'étape 1 a montré `autonomie` et/ou `version`.
-- ⚠️ Colle-moi d'abord le résultat de l'étape 1 : selon le TYPE des colonnes (text / int),
--    l'affectation ci-dessous peut nécessiter un cast `::text`. Je te donnerai la version exacte.
--
-- Principe (SÛR, sans perte) : on privilégie note_pneus/type_pneus (la source lue par l'appli).
-- On recopie autonomie→note_pneus et version→type_pneus UNIQUEMENT là où la cible est vide,
-- pour récupérer d'éventuelles données orphelines, PUIS on supprime les colonnes en doublon.
--
--   -- 2a) Sauvegarde des données orphelines (cible vide) :
--   UPDATE vehicules SET note_pneus = autonomie
--     WHERE (note_pneus IS NULL OR note_pneus::text = '')
--       AND autonomie IS NOT NULL AND autonomie::text <> '';
--   UPDATE vehicules SET type_pneus = version
--     WHERE (type_pneus IS NULL OR type_pneus::text = '')
--       AND version IS NOT NULL AND version::text <> '';
--
--   -- 2b) Suppression des colonnes en doublon (l'appli ne les lit pas) :
--   ALTER TABLE vehicules DROP COLUMN IF EXISTS autonomie;
--   ALTER TABLE vehicules DROP COLUMN IF EXISTS version;
-- ─────────────────────────────────────────────────────────────────────────────────────
