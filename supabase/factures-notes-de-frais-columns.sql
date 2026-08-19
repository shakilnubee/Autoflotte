-- =====================================================================================
-- factures-notes-de-frais-columns.sql
-- Ajoute 3 colonnes OPTIONNELLES à la table `factures` pour les « Notes de frais » et
-- l'import Sanef (péages flux libre) :
--   • source      : marqueur d'origine ('note-frais', 'sanef', …) — pour filtrer/regrouper.
--   • categorie   : catégorie de la dépense ('carburant','peage','lavage','parking','repas','autre').
--   • conducteur  : nom du collaborateur qui a réglé la dépense (rattachement).
--
-- 100 % ADDITIF et SANS DANGER : n'ajoute que des colonnes nullables, ne supprime/ne
-- renomme RIEN. L'appli fonctionne AVANT comme APRÈS (elle est tolérante : sans ces
-- colonnes, la facture est quand même enregistrée via FP.persistFacture, seules les
-- métadonnées source/categorie/conducteur manquent). Après ce script, tout est stocké
-- proprement et synchronisé sur tous les appareils.
--
-- Comment lancer : Supabase → SQL Editor → coller → Run. Une seule fois.
-- =====================================================================================

alter table public.factures add column if not exists source     text;
alter table public.factures add column if not exists categorie  text;
alter table public.factures add column if not exists conducteur text;

-- Index léger pour retrouver vite les notes de frais / relevés Sanef par société.
create index if not exists idx_factures_source on public.factures (societe, source);

-- ------------------------------------------------------------------------------------
-- ROLLBACK (si un jour tu veux revenir en arrière — supprime les colonnes ajoutées) :
--   drop index if exists idx_factures_source;
--   alter table public.factures drop column if exists source;
--   alter table public.factures drop column if exists categorie;
--   alter table public.factures drop column if exists conducteur;
-- ------------------------------------------------------------------------------------
