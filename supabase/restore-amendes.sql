-- ============================================================
--  RESTAURATION des amendes depuis l'instantané data.js
--  Supabase -> SQL Editor -> coller -> RUN.
--  SANS RISQUE : ON CONFLICT (id) DO NOTHING -> ne recrée que
--  les amendes manquantes, ne touche pas à celles déjà présentes.
-- ============================================================

insert into public.amendes (id, date, annee, prenom, numero_avis, motif, montant, retrait_points, statut, commentaire, points, avis_url, justif_url, archived, numero_telepaiement, cle, societe, majoree, montant_majore, date_majoration, numero_avis_majore) values
  ('AM-0001', '2026-01-03', '2026', 'Maxime', '6132700593', 'Circulation non autorisé', 90, false, 'payée', 'Payée le 13/01/2026', 0, NULL, NULL, true, '3336 1327 0059 31', '69', 'PXP', false, NULL, NULL, NULL),
  ('AM-0002', '2025-12-04', '2026', 'Guerric', '332 242834', 'Excès de vitesse', 0, false, 'payée', 'Désignation allemagne 14/01', 0, NULL, NULL, true, NULL, NULL, 'PXP', false, NULL, NULL, NULL),
  ('AM-0003', '2026-01-07', '2026', 'Daniel', '3892170338', 'Excès de vitesse', 90, false, 'payée', 'Désignation faite le 25/02', 0, NULL, NULL, true, '3333 8921 7033 81', '19', 'PXP', false, NULL, NULL, NULL),
  ('AM-0004', '2026-01-07', '2026', 'Jocelyn', '384889398', 'Excès de vitesse', 45, false, 'payée', 'Désignation 15/01', 0, NULL, NULL, true, NULL, NULL, 'PXP', false, NULL, NULL, NULL),
  ('AM-0005', '2026-01-09', '2026', 'Nicolas', '6692802240', 'Stationnement', 35, false, 'payée', 'Payée le 20/01/2026', 0, NULL, NULL, true, '3336 6928 0224 01', '53', 'PXP', false, NULL, NULL, NULL),
  ('AM-0006', '2026-01-15', '2026', 'Jimmy', '26 2 009 242 076', 'Stationnement', 157.2, false, 'payée', 'Payée le 19/01/2026', 0, NULL, NULL, true, NULL, NULL, 'PXP', false, NULL, NULL, NULL),
  ('AM-0007', '2026-01-16', '2026', 'Romuald', '6692936259', 'Stationnement', 135, false, 'payée', 'Payée le 29/01/2026
Payé 29/01', 0, NULL, NULL, true, '3336 6929 3625 91', '91', 'PXP', false, NULL, NULL, NULL),
  ('AM-0008', '2026-01-15', '2026', 'Jimmy', '3837812358', 'Excès de vitesse', 90, false, 'payée', 'Payée le 21/01/2026', 0, NULL, NULL, true, '3333 8378 1235 81', '71', 'PXP', false, NULL, NULL, NULL),
  ('AM-0009', '2026-01-22', '2026', 'Nicolas', '3840344537', 'Excès de vitesse', 45, true, 'payée', 'Désignation le 05/02', 1, NULL, NULL, true, '3333 8403 4453 71', '11', 'PXP', false, NULL, NULL, NULL),
  ('AM-0010', '2026-01-21', '2026', 'Nicolas', '3842341547', 'Excès de vitesse', 45, false, 'payée', 'Payée le 04/02/2026', 0, NULL, NULL, true, '3333 8423 4154 71', '42', 'PXP', false, NULL, NULL, NULL),
  ('AM-0011', '2026-01-27', '2026', 'Shakil', '6004250636', 'Usage téléphone', 90, true, 'payée', 'Désignation 10/02', 3, NULL, NULL, true, '3336 0042 5063 61', '10', 'PXP', false, NULL, NULL, NULL),
  ('AM-0012', '2026-01-19', '2026', 'Mona', '32100-101048533', 'Stationnement', 47, false, 'payée', 'Payée le 04/02/2026
Payé 04/02', 0, NULL, NULL, true, NULL, NULL, 'PXP', false, NULL, NULL, NULL),
  ('AM-0013', '2026-01-29', '2026', 'Youssouf', '3803279517', 'Excès de vitesse', 90, true, 'payée', 'Désignation 11/02', 1, NULL, NULL, true, '3333 8032 7951 71', '03', 'PXP', false, NULL, NULL, NULL),
  ('AM-0014', '2026-01-31', '2026', 'Lucie', '6014792686', 'Stationnement', 35, false, 'payée', 'Payée le 11/02/2026
Payée 11/02', 0, NULL, NULL, true, '3336 0147 9268 61', '37', 'PXP', false, NULL, NULL, NULL),
  ('AM-0015', '2026-01-31', '2026', 'Maxime', '6682391248', 'Stationnement', 35, false, 'payée', 'Payée le 11/02/2026
Payée 11/02', 0, NULL, NULL, true, NULL, NULL, 'PXP', false, NULL, NULL, NULL),
  ('AM-0016', '2026-02-02', '2026', 'Guangyue', '6622963234', 'Stationnement', 135, false, 'payée', 'Payée le 10/02/2026
Payé 10/02', 0, NULL, NULL, true, '3336 6229 6323 41', '02', 'PXP', false, NULL, NULL, NULL),
  ('AM-0017', '2026-02-11', '2026', 'Enguerrand', '26 1 036 349 012 19', 'Stationnement', 50, false, 'payée', 'Payé', 0, NULL, NULL, true, NULL, NULL, 'PXP', false, NULL, NULL, NULL),
  ('AM-0018', '2026-02-10', '2026', 'Sofiane', '6102938587', 'Usage téléphone', 90, true, 'payée', 'Désignation faite le 18/02', 3, NULL, NULL, true, '3336 1029 3858 71', '65', 'PXP', false, NULL, NULL, NULL),
  ('AM-0019', '2026-02-09', '2026', 'Jimmy', '26 2 031 573 084 17', 'Stationnement', 105, false, 'payée', 'Payée le 18/02/2026
Payée 18/02', 0, NULL, NULL, true, NULL, NULL, 'PXP', false, NULL, NULL, NULL),
  ('AM-0020', '2026-02-06', '2026', 'Nawelle', '6652844219', 'Stationnement', 35, false, 'payée', 'Payée le 20/02/2026
Payée 20/02', 0, NULL, NULL, true, '3336 6528 4421 91', '91', 'PXP', false, NULL, NULL, NULL),
  ('AM-0021', '2026-02-18', '2026', 'Léopold', '26 1 043 609 214 62', 'Stationnement', 50, false, 'payée', 'Preuve par mail', 0, NULL, NULL, true, '26 1 043 609 214', '62', 'PXP', false, NULL, NULL, NULL),
  ('AM-0022', '2026-02-18', '2026', 'Léopold', '26 1 043 308 058 91', 'Stationnement', 52.5, false, 'payée', 'Payée le 26/02/2026', 0, NULL, NULL, true, '26 1 043 308 058', '91', 'PXP', false, NULL, NULL, NULL),
  ('AM-0023', '2026-02-11', '2026', 'Johanna', '3818602487', 'Excès de vitesse', 45, false, 'payée', 'Payée le 27/02/2026
Payée 27/02', 0, NULL, NULL, true, '3333 8186 0248 71', '64', 'PXP', false, NULL, NULL, NULL),
  ('AM-0024', '2026-02-17', '2026', 'Farah', '6014845681', 'Stationnement', 35, false, 'payée', 'Payée le 26/02/2026
Payé 26/02', 0, NULL, NULL, true, '3336 0148 4568 11', '76', 'PXP', false, NULL, NULL, NULL),
  ('AM-0025', '2026-02-21', '2026', 'Jimmy', '6094341645', 'voie de Bus', 90, false, 'payée', 'Payée le 26/02/2026
Payé 26/02', 0, NULL, NULL, true, '3336 0943 4164 51', '96', 'PXP', false, NULL, NULL, NULL),
  ('AM-0026', '2025-12-04', '2026', 'Guerric', '825209926', 'Excès de vitesse', 0, false, 'payée', 'Désignation allemagne le 02/03', 0, NULL, NULL, true, NULL, NULL, 'PXP', false, NULL, NULL, NULL),
  ('AM-0027', '2026-02-25', '2026', 'Ahmed', '6660133357', 'Stationnement', 35, false, 'payée', 'Payée le 23/03/2026
Payée 23/03', 0, NULL, NULL, true, '3336 6601 3335 71', '45', 'PXP', false, NULL, NULL, NULL),
  ('AM-0028', '2026-03-05', '2026', 'Akram', '3894277867', 'Excès de vitesse', 45, false, 'payée', 'Payée le 10/03/2026', 0, NULL, NULL, true, '3333 8942 7786 71', '22', 'PXP', false, NULL, NULL, NULL),
  ('AM-0029', '2026-03-02', '2026', 'Léopold', '26 1 061 336 209 16', 'Stationnement', 50, false, 'payée', 'Preuve par mail', 0, NULL, NULL, true, '26 1 061 336 209', '16', 'PXP', false, NULL, NULL, NULL),
  ('AM-0030', '2026-03-03', '2026', 'Léopold', '26 1 062 308 399 72', 'Stationnement', 75, false, 'payée', 'Preuve par mail', 0, NULL, NULL, true, '26 1 062 308 399', '72', 'PXP', false, NULL, NULL, NULL),
  ('AM-0031', '2026-03-03', '2026', 'Yannis', '26 1 062 308 189 56', 'Stationnement', 35, false, 'payée', 'Payée le 17/03/2026', 0, NULL, NULL, true, '26 1 062 308 189', '56', 'PXP', false, NULL, NULL, NULL),
  ('AM-0032', '2026-02-26', '2026', 'Guerric', '26 1 057 013 067 91', 'Stationnement', 25, false, 'payée', 'Payée le 28/03/2026', 0, NULL, NULL, true, NULL, NULL, 'PXP', false, NULL, NULL, NULL),
  ('AM-0033', '2026-03-10', '2026', 'Charles', '3805097877', 'Excès de vitesse', 45, true, 'payée', 'Désignation le 17/03', 1, NULL, NULL, true, '3333 8050 9787 71', '80', 'PXP', false, NULL, NULL, NULL),
  ('AM-0034', '2026-03-17', '2026', 'Guerric', '26 1 064 012 002 20', 'Stationnement', 17, false, 'payée', 'Payée le 28/03/2026', 0, NULL, NULL, true, '26 1 064 012 002', '20', 'PXP', false, NULL, NULL, NULL),
  ('AM-0035', '2026-03-14', '2026', 'Lucie', '6600392349', 'voie de Bus', 90, false, 'payée', 'Payée le 26/03/2026
Payée 26/03', 0, NULL, NULL, true, '3336 6003 9234 91', '64', 'PXP', false, NULL, NULL, NULL),
  ('AM-0036', '2026-03-17', '2026', 'Charles', '26 1 064 012 001 19', 'Stationnement', 17, false, 'payée', 'Payée le 21/03/2026
Payée 21/03', 0, NULL, NULL, true, '26 1 064 012 001', '19', 'PXP', false, NULL, NULL, NULL),
  ('AM-0037', '2026-03-11', '2026', 'Pauline', 'NA.98.C3.675252/2026', 'Excès de vitesse', 63.67, false, 'payée', 'Désignation le 30/03', 0, NULL, NULL, true, NULL, NULL, 'PXP', false, NULL, NULL, NULL),
  ('AM-0038', '2026-03-24', '2026', 'Ahmed', '6172038507', 'Excès de vitesse', 90, true, 'payée', 'Désignation 26/03', 2, NULL, NULL, true, '3336 1720 3850 71', '74', 'PXP', false, NULL, NULL, NULL),
  ('AM-0039', '2026-03-10', '2026', 'Bram', 'LE.94.LF.409245/2026', 'Excès de vitesse', 53, false, 'payée', 'Payée le 01/04/2026', 0, NULL, NULL, true, NULL, NULL, 'PXP', false, NULL, NULL, NULL),
  ('AM-0040', '2026-03-31', '2026', 'Enguerrand', '26 2 082 547 120 68', 'Stationnement', 50, false, 'payée', 'Payée le 13/04/2026', 0, NULL, NULL, true, NULL, NULL, 'PXP', false, NULL, NULL, NULL),
  ('AM-0041', '2026-04-01', '2026', 'Farah', '6094572690', 'Stationnement', 35, false, 'payée', 'Payée le 10/04/2026', 0, NULL, NULL, true, '3336 0945 7269 01', '06', 'PXP', false, NULL, NULL, NULL),
  ('AM-0042', '2026-04-01', '2026', 'Farah', '6034777696', 'Stationnement', 35, false, 'payée', 'Payée le 10/04/2026', 0, NULL, NULL, true, '3336 0347 7769 61', '67', 'PXP', false, NULL, NULL, NULL),
  ('AM-0043', '2026-04-01', '2026', 'Farah', '6034479696', 'Stationnement', 35, false, 'payée', 'Payée le 10/04/2026', 0, NULL, NULL, true, '3336 0344 7969 61', '04', 'PXP', false, NULL, NULL, NULL),
  ('AM-0044', '2026-04-03', '2026', 'Maxime', '26 3 087 032 044 59', 'Stationnement', 65, false, 'payée', 'Payée le 12/04/2026', 0, NULL, NULL, true, NULL, NULL, 'PXP', false, NULL, NULL, NULL),
  ('AM-0045', '2026-04-10', '2026', 'Frédéric', '3886029777', 'Excès de vitesse', 45, true, 'payée', 'Payée le 11/02/2026
Désignation le 17/04', 1, NULL, NULL, true, '3333 8860 2977 71', '65', 'PXP', false, NULL, NULL, NULL),
  ('AM-0046', '2026-04-14', '2026', 'Jimmy', '6620601717', 'voie de Bus', 90, false, 'payée', 'Payée le 23/04/2026
Payée 23/04', 0, NULL, NULL, true, '3336 6206 0171 71', '64', 'PXP', false, NULL, NULL, NULL),
  ('AM-0047', '2026-04-20', '2026', 'Akram', '26 1 100 633 721 12', 'Stationnement', 17, false, 'payée', 'Payée le 29/04/2026
Payée 29/04', 0, NULL, NULL, true, NULL, NULL, 'PXP', false, NULL, NULL, NULL),
  ('AM-0048', '2026-04-20', '2026', 'BYD', '26 1 099 411 229 14', 'Stationnement', 150, false, 'payée', 'https://mail.google.com/mail/u/0/#inbox/FMfcgzQfCDKvzdHJXtlDqWxmFCHwLgbb', 0, NULL, NULL, true, '26 1 099 411 229', '14', 'PXP', false, NULL, NULL, NULL),
  ('AM-0049', '2026-04-21', '2026', 'BYD', '26 1 101 521 071 09', 'Stationnement', 150, false, 'payée', 'https://mail.google.com/mail/u/0/#inbox/FMfcgzQfCDKvzdHJXtlDqWxmFCHwLgbb', 0, NULL, NULL, true, '26 1 101 521 071', '09', 'PXP', false, NULL, NULL, NULL),
  ('AM-0050', '2026-04-22', '2026', 'BYD', '26 1 104 431 123 61', 'Stationnement', 150, false, 'payée', 'https://mail.google.com/mail/u/0/#inbox/FMfcgzQfCDKvzdHJXtlDqWxmFCHwLgbb', 0, NULL, NULL, true, '26 1 104 431 123', '61', 'PXP', false, NULL, NULL, NULL),
  ('AM-0051', '2026-04-22', '2026', 'BYD', '26 1 104 521 469 03', 'Stationnement', 150, false, 'payée', 'https://mail.google.com/mail/u/0/#inbox/FMfcgzQfCDKvzdHJXtlDqWxmFCHwLgbb', 0, NULL, NULL, true, '26 1 104 521 469', '03', 'PXP', false, NULL, NULL, NULL),
  ('AM-0052', '2026-04-20', '2026', 'Maxime', '26 2 099 086 260 29', 'Stationnement', 225, false, 'payée', 'Payée le 05/05/2026
Payée 05/05', 0, NULL, NULL, true, NULL, NULL, 'PXP', false, NULL, NULL, NULL),
  ('AM-0053', '2026-04-14', '2026', 'Daniel', '6600025763', 'Stationnement', 35, false, 'payée', 'Payée le 13/05/2026
Payée 13/05', 0, NULL, NULL, true, '3336 6000 2576 31', '28', 'PXP', false, NULL, NULL, NULL),
  ('AM-0054', '2026-04-23', '2026', 'Guerric', '26 1 106 014 029 48', 'Stationnement', 25, false, 'payée', 'Payée le 29/04/2026
Payée 29/04', 0, NULL, NULL, true, NULL, NULL, 'PXP', false, NULL, NULL, NULL),
  ('AM-0055', '2026-04-29', '2026', 'Jimmy', '6192527515', 'voie de Bus', 90, false, 'payée', 'Payée le 11/05/2026
Payée 11/05', 0, NULL, NULL, true, '3336 1925 2751 51', '61', 'PXP', false, NULL, NULL, NULL),
  ('AM-0056', '2026-04-28', '2026', 'Frédéric', '3886029777', 'Excès de vitesse', 45, false, 'payée', 'Payée le 11/02/2026
Payée 11/02', 0, NULL, NULL, true, '3333 8860 2977 71', '65', 'PXP', false, NULL, NULL, NULL),
  ('AM-0057', '2026-05-13', '2026', 'Jimmy', '26 1 125 086 136 41', 'Stationnement', 35, false, 'payée', 'Payée le 19/05/2026', 0, NULL, NULL, true, NULL, NULL, 'PXP', false, NULL, NULL, NULL),
  ('AM-0058', '2026-05-19', '2026', 'Ahmed', '26 1 126 079 125 01', 'Stationnement', 25, false, 'payée', 'Mail 19/05', 0, NULL, 'https://tzjuptlzoywjeigmyfuj.supabase.co/storage/v1/object/public/scans/justificatifs/1780655353749-2q24qv.pdf', true, NULL, NULL, 'PXP', false, NULL, NULL, NULL),
  ('AM-0059', '2026-05-19', '2026', 'Mégane', '26 2 129 090 123 46', 'Stationnement', 50, false, 'payée', 'Payée le 05/06/2026
Mail 19/05', 0, NULL, 'https://tzjuptlzoywjeigmyfuj.supabase.co/storage/v1/object/public/scans/justificatifs/1780688843875-8mfezu.jpg', true, NULL, NULL, 'PXP', false, NULL, NULL, NULL),
  ('AM-0060', '2026-03-25', '2026', 'Ahmed', '6014315617', 'Inobservation', 90, true, 'désignée', 'Mail 26/05', 4, NULL, NULL, NULL, NULL, NULL, 'PXP', false, NULL, NULL, NULL),
  ('AM-0061', '2026-05-20', '2026', 'Maxime', '6690208054', 'voie de Bus', 90, false, 'payée', 'Payée le 05/06/2026
Mail 28/05', 0, NULL, 'https://tzjuptlzoywjeigmyfuj.supabase.co/storage/v1/object/public/scans/justificatifs/1780993583481-wm5etd.jpg', true, '3336 6902 0805 41', '67', 'PXP', false, NULL, NULL, NULL),
  ('AM-0062', '2026-05-20', '2026', 'Ahmed', '6024329152', 'Stationnement', 135, false, 'à payer', 'Mail 28/05', 0, NULL, NULL, false, '3336 0243 2915 21', '20', 'PXP', false, NULL, NULL, NULL),
  ('AM-0063', '2026-05-26', '2026', 'Ahmed', '6610639027', 'Stationnement', 35, false, 'à payer', 'Mail 02/06', 0, NULL, NULL, NULL, '3336 6106 3902 71', '21', 'PXP', false, NULL, NULL, NULL),
  ('AM-0064', '2026-06-02', '2026', 'Maxime', '3884898637', 'Excès de vitesse', 90, true, 'à payer', NULL, 1, 'https://tzjuptlzoywjeigmyfuj.supabase.co/storage/v1/object/public/scans/avis/1780931751230-cuul5m.pdf', NULL, NULL, '33338848986371', '29', 'PXP', false, NULL, NULL, NULL),
  ('AM-0065', '2026-05-30', '2026', 'Nicolas', '3881060617', 'Excès de vitesse', 45, false, 'payée', 'Payée le 08/06/2026', 0, 'https://tzjuptlzoywjeigmyfuj.supabase.co/storage/v1/object/public/scans/avis/1780931848739-k6j0tm.pdf', 'https://tzjuptlzoywjeigmyfuj.supabase.co/storage/v1/object/public/scans/justificatifs/1780997276310-c6sjcc.pdf', true, '33338810606171', '13', 'PXP', false, NULL, NULL, NULL),
  ('AM-0066', '2026-06-04', '2026', 'Romuald', '9010751082', 'Excès de vitesse', 50, false, 'payée', 'Payée le 07 juin 2026
Amende espagnole (étrangère) — pas de retrait de points en France', 0, NULL, 'https://tzjuptlzoywjeigmyfuj.supabase.co/storage/v1/object/public/scans/justificatifs/1781009620981-xppi50.jpg', NULL, NULL, NULL, 'PXP', false, NULL, NULL, NULL)
on conflict (id) do nothing;

-- Vérif : nombre d'amendes après restauration
select count(*) as total_amendes, count(*) filter (where annee = '2026') as amendes_2026 from public.amendes;