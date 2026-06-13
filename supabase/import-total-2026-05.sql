-- ============================================================
--  IMPORT FACTURES TOTALENERGIES FLEET — Mai 2026
--  Relevé n° 76106811 (échéance 10/06/2026) — Total 3 280,63 € TTC
-- ============================================================
--  ⚠️ On importe UNIQUEMENT les 3 factures détaillées (France,
--     Allemagne, Pays-Bas). On N'IMPORTE PAS le relevé 76106811 :
--     c'est lui qui additionne les 3, l'importer compterait DEUX FOIS.
--
--  Vérification : 2862.20 + 121.02 + 297.41 = 3280.63 ✔ (= total du relevé)
--
--  Idempotent : ON CONFLICT DO NOTHING → tu peux le relancer sans
--  créer de doublon (les 3 lignes ont des id fixes TF-2026-05-XX).
--
--  Comment l'exécuter : Supabase → SQL Editor → colle ce script → Run.
-- ============================================================

insert into public.factures
  (id, date, vehicule_immat, fournisseur, numero_facture, description, type, montant_ht, montant_tva, montant_ttc, societe)
values
  ('TF-2026-05-FR', '2026-05-31', null, 'TotalEnergies', 'F6F95319',
   'Carburant & services flotte — France — mai 2026', 'carburant', 2399.38, 462.82, 2862.20, 'PXP'),

  ('TF-2026-05-DE', '2026-05-31', null, 'TotalEnergies', 'G6D06881',
   'Carburant flotte — Allemagne — mai 2026', 'carburant', 101.70, 19.32, 121.02, 'PXP'),

  ('TF-2026-05-NL', '2026-05-31', null, 'TotalEnergies', 'G6Q01347',
   'Carburant flotte — Pays-Bas — mai 2026', 'carburant', 245.80, 51.61, 297.41, 'PXP')
on conflict (id) do nothing;

-- Contrôle après import (doit afficher 3 lignes, total 3280.63) :
select numero_facture, description, montant_ttc
from public.factures
where id in ('TF-2026-05-FR','TF-2026-05-DE','TF-2026-05-NL')
order by id;
