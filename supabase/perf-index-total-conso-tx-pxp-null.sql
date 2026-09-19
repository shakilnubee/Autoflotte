-- ⚡ PERFORMANCE — Contrôle / PXP (Parc Pilot)  ·  OPTIONNEL, NON DESTRUCTIF
-- ---------------------------------------------------------------------------
-- Contexte : pour la société PXP, la lecture des consos filtre par
--   `societe IS NULL OR societe = 'PXP'` (les lignes historiques sans étiquette
--   comptent comme PXP). Un OR avec « IS NULL » peut empêcher PostgreSQL d'utiliser
--   l'index composite (societe, date_tx) → repli sur un parcours complet (seq-scan)
--   du count de la sonde de fraîcheur, latence qui EMPIRE quand la table grossit.
--
-- Ce fichier ajoute un INDEX PARTIEL sur les lignes `societe IS NULL` (branche PXP
-- historique), pour que la sonde reste indexée. C'est UNIQUEMENT un index :
--   • aucune donnée modifiée / supprimée / normalisée (0 risque de perte) ;
--   • réversible (DROP INDEX) ; opération one-shot.
--
-- ⚠️ NON URGENT : à lancer seulement si tu constates que la page Contrôle redevient
--    lente à mesure que total_conso_tx grossit. Aujourd'hui la table est petite,
--    donc l'effet est négligeable. On NE normalise PAS `societe NULL → 'PXP'` ici :
--    ce serait une migration de DONNÉES (à décider explicitement, jamais en auto).
--
-- À lancer UNE FOIS : Supabase → SQL Editor → coller → Run (quelques secondes).

-- Index partiel : lignes PXP historiques (sans étiquette société), triées par date.
create index if not exists idx_total_conso_tx_null_date
  on public.total_conso_tx (date_tx)
  where societe is null;

-- (Rappel : l'index principal (societe, date_tx) est déjà créé par
--  supabase/perf-index-total-conso-tx.sql — celui-ci le COMPLÈTE pour la branche NULL.)

-- ---------------------------------------------------------------------------
-- ROLLBACK (si besoin) :
-- drop index if exists public.idx_total_conso_tx_null_date;
