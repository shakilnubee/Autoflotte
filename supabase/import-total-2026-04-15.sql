-- ============================================================
--  IMPORT FACTURES TOTALENERGIES FLEET — Relevé du 15/04/2026
-- ============================================================
--  Relevé n° 76076102 — arrêté 15/04/2026 (échéance 25/04/2026) — Total 2 513,13 €
--
--  ⚠️ On N'IMPORTE PAS le relevé récapitulatif (76076102) : il ne fait
--     qu'additionner les factures par pays. On importe UNIQUEMENT les
--     factures détaillées (France, Pays-Bas).
--
--  Vérification : 2213.97 + 299.16 = 2513.13 ✔ (= total du relevé)
--
--  Ids alignés sur l'import auto de l'appli (TF-<n° de pièce>) : si tu
--  redéposes ce relevé via le bouton « Importer un relevé Total », l'appli
--  reconnaîtra ces factures comme déjà présentes → aucun doublon.
--
--  Idempotent : ON CONFLICT DO NOTHING → relançable sans créer de doublon.
--  Exécution : Supabase → SQL Editor → colle ce script → Run.
-- ============================================================

insert into public.factures
  (id, date, vehicule_immat, fournisseur, numero_facture, description, type, montant_ht, montant_tva, montant_ttc, societe)
values
  ('TF-F6B74064', '2026-04-15', null, 'TotalEnergies', 'F6B74064',
   'Carburant & services flotte — France — relevé 15/04/2026', 'carburant', 1851.80, 362.17, 2213.97, 'PXP'),

  ('TF-G6Q00872', '2026-04-15', null, 'TotalEnergies', 'G6Q00872',
   'Carburant & services flotte — Pays-Bas — relevé 15/04/2026', 'carburant', 247.23, 51.93, 299.16, 'PXP')
on conflict (id) do nothing;

-- Contrôle après import (doit afficher 2 lignes, total 2513.13) :
select numero_facture, description, montant_ttc
from public.factures
where id in ('TF-F6B74064','TF-G6Q00872')
order by id;
