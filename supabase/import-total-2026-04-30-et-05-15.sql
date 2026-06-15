-- ============================================================
--  IMPORT FACTURES TOTALENERGIES FLEET — Relevés du 30/04 et 15/05 2026
-- ============================================================
--  Deux relevés de factures TotalEnergies :
--    • Relevé n° 76083479 — arrêté 30/04/2026 (échéance 10/05/2026) — Total 2 323,65 €
--    • Relevé n° 76094909 — arrêté 15/05/2026 (échéance 25/05/2026) — Total 2 313,27 €
--
--  ⚠️ Comme d'habitude : on N'IMPORTE PAS les relevés récapitulatifs
--     (76083479 / 76094909). Ils ne font qu'additionner les factures par
--     pays — les importer compterait DEUX FOIS. On importe UNIQUEMENT les
--     factures détaillées (France, Belgique, Pays-Bas).
--
--  Vérification des totaux :
--    Relevé 76083479 : 2048.35 + 275.30                 = 2323.65 ✔
--    Relevé 76094909 : 1879.98 + 124.98 + 308.31         = 2313.27 ✔
--
--  Idempotent : ON CONFLICT DO NOTHING → tu peux le relancer sans
--  créer de doublon (id fixes TF-2026-...).
--
--  Comment l'exécuter : Supabase → SQL Editor → colle ce script → Run.
-- ============================================================

insert into public.factures
  (id, date, vehicule_immat, fournisseur, numero_facture, description, type, montant_ht, montant_tva, montant_ttc, societe)
values
  -- ----- Relevé n° 76083479 — arrêté 30/04/2026 -----
  ('TF-2026-04-30-FR', '2026-04-30', null, 'TotalEnergies', 'F6C90899',
   'Carburant & services flotte — France — relevé 30/04/2026', 'carburant', 1709.72, 338.63, 2048.35, 'PXP'),

  ('TF-2026-04-30-NL', '2026-04-30', null, 'TotalEnergies', 'G6Q00976',
   'Carburant flotte — Pays-Bas — relevé 30/04/2026', 'carburant', 227.52, 47.78, 275.30, 'PXP'),

  -- ----- Relevé n° 76094909 — arrêté 15/05/2026 -----
  ('TF-2026-05-15-FR', '2026-05-15', null, 'TotalEnergies', 'F6E96934',
   'Carburant & services flotte — France — relevé 15/05/2026', 'carburant', 1573.57, 306.41, 1879.98, 'PXP'),

  ('TF-2026-05-15-BE', '2026-05-15', null, 'TotalEnergies', 'G6B16896',
   'Carburant flotte — Belgique — relevé 15/05/2026', 'carburant', 105.27, 19.71, 124.98, 'PXP'),

  ('TF-2026-05-15-NL', '2026-05-15', null, 'TotalEnergies', 'G6Q01190',
   'Carburant flotte — Pays-Bas — relevé 15/05/2026', 'carburant', 254.80, 53.51, 308.31, 'PXP')
on conflict (id) do nothing;

-- Contrôle après import (doit afficher 5 lignes, total 4636.92) :
select numero_facture, description, montant_ttc
from public.factures
where id in ('TF-2026-04-30-FR','TF-2026-04-30-NL','TF-2026-05-15-FR','TF-2026-05-15-BE','TF-2026-05-15-NL')
order by id;
