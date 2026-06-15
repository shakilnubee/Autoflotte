-- Backfill factures TotalEnergies (Total Fleet) — déc 2025 → mai 2026
-- ON CONFLICT DO NOTHING (réexécutable sans doublon).

insert into public.factures
  (id, date, vehicule_immat, fournisseur, numero_facture, description, type, montant_ht, montant_tva, montant_ttc, societe)
values
  ('TF-F6088809', '2025-12-31', null, 'TotalEnergies', 'F6088809', 'Carburant & services flotte — France — releve 31/12/2025', 'carburant', 1532.37, 303.43, 1835.8, 'PXP'),
  ('TF-G6Q00063', '2025-12-31', null, 'TotalEnergies', 'G6Q00063', 'Carburant & services flotte — Pays-Bas — releve 31/12/2025', 'carburant', 143.5, 30.13, 173.63, 'PXP'),
  ('TF-F6208787', '2026-01-15', null, 'TotalEnergies', 'F6208787', 'Carburant & services flotte — France — releve 15/01/2026', 'carburant', 1408.03, 275.71, 1683.74, 'PXP'),
  ('TF-G6B02110', '2026-01-15', null, 'TotalEnergies', 'G6B02110', 'Carburant & services flotte — Belgique — releve 15/01/2026', 'carburant', 33.62, 7.06, 40.68, 'PXP'),
  ('TF-G6Q00168', '2026-01-15', null, 'TotalEnergies', 'G6Q00168', 'Carburant & services flotte — Pays-Bas — releve 15/01/2026', 'carburant', 192.87, 40.51, 233.38, 'PXP'),
  ('TF-F6570781', '2026-02-15', null, 'TotalEnergies', 'F6570781', 'Carburant & services flotte — France — releve 15/02/2026', 'carburant', 1758.18, 347.97, 2106.15, 'PXP'),
  ('TF-G6B06212', '2026-02-15', null, 'TotalEnergies', 'G6B06212', 'Carburant & services flotte — Belgique — releve 15/02/2026', 'carburant', 38.72, 6.95, 45.67, 'PXP'),
  ('TF-G6Q00437', '2026-02-15', null, 'TotalEnergies', 'G6Q00437', 'Carburant & services flotte — Pays-Bas — releve 15/02/2026', 'carburant', 74.59, 15.66, 90.25, 'PXP'),
  ('TF-F6633827', '2026-02-28', null, 'TotalEnergies', 'F6633827', 'Carburant & services flotte — France — releve 28/02/2026', 'carburant', 1183.5, 229.37, 1412.87, 'PXP'),
  ('TF-G6Q00475', '2026-02-28', null, 'TotalEnergies', 'G6Q00475', 'Carburant & services flotte — Pays-Bas — releve 28/02/2026', 'carburant', 222.34, 46.7, 269.04, 'PXP'),
  ('TF-F6859968', '2026-03-15', null, 'TotalEnergies', 'F6859968', 'Carburant & services flotte — France — releve 15/03/2026', 'carburant', 2464.34, 480.18, 2944.52, 'PXP'),
  ('TF-G6B09192', '2026-03-15', null, 'TotalEnergies', 'G6B09192', 'Carburant & services flotte — Belgique — releve 15/03/2026', 'carburant', 21.47, 4.51, 25.98, 'PXP'),
  ('TF-G6Q00635', '2026-03-15', null, 'TotalEnergies', 'G6Q00635', 'Carburant & services flotte — Pays-Bas — releve 15/03/2026', 'carburant', 77.38, 16.25, 93.63, 'PXP'),
  ('TF-F6984689', '2026-03-31', null, 'TotalEnergies', 'F6984689', 'Carburant & services flotte — France — releve 31/03/2026', 'carburant', 1310.34, 261.03, 1571.37, 'PXP'),
  ('TF-G6Q00726', '2026-03-31', null, 'TotalEnergies', 'G6Q00726', 'Carburant & services flotte — Pays-Bas — releve 31/03/2026', 'carburant', 237.07, 49.79, 286.86, 'PXP'),
  ('TF-F6B74064', '2026-04-15', null, 'TotalEnergies', 'F6B74064', 'Carburant & services flotte — France — releve 15/04/2026', 'carburant', 1851.8, 362.17, 2213.97, 'PXP'),
  ('TF-G6Q00872', '2026-04-15', null, 'TotalEnergies', 'G6Q00872', 'Carburant & services flotte — Pays-Bas — releve 15/04/2026', 'carburant', 247.23, 51.93, 299.16, 'PXP'),
  ('TF-F6C90899', '2026-04-30', null, 'TotalEnergies', 'F6C90899', 'Carburant & services flotte — France — releve 30/04/2026', 'carburant', 1709.72, 338.63, 2048.35, 'PXP'),
  ('TF-G6Q00976', '2026-04-30', null, 'TotalEnergies', 'G6Q00976', 'Carburant & services flotte — Pays-Bas — releve 30/04/2026', 'carburant', 227.52, 47.78, 275.3, 'PXP'),
  ('TF-F6E96934', '2026-05-15', null, 'TotalEnergies', 'F6E96934', 'Carburant & services flotte — France — releve 15/05/2026', 'carburant', 1573.57, 306.41, 1879.98, 'PXP'),
  ('TF-G6B16896', '2026-05-15', null, 'TotalEnergies', 'G6B16896', 'Carburant & services flotte — Belgique — releve 15/05/2026', 'carburant', 105.27, 19.71, 124.98, 'PXP'),
  ('TF-G6Q01190', '2026-05-15', null, 'TotalEnergies', 'G6Q01190', 'Carburant & services flotte — Pays-Bas — releve 15/05/2026', 'carburant', 254.8, 53.51, 308.31, 'PXP')
on conflict (id) do nothing;
