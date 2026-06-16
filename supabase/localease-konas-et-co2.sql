-- ============================================================
--  Localease : CO2 (pour la TVS) + création des 3 Kona
--  À lancer dans Supabase → SQL Editor → Run.
-- ============================================================

-- 1) CO2 sur les Hyundai existants qui n'en ont pas (pour que la TVS s'affiche)
update public.vehicules set co2 = 126
  where (co2 is null or co2 = 0) and upper(marque) like 'HYUNDAI%' and upper(modele) like '%TUCSON%';
update public.vehicules set co2 = 104
  where (co2 is null or co2 = 0) and upper(marque) like 'HYUNDAI%' and upper(modele) like '%KONA%';

-- 2) Créer les 3 Kona en leasing Localease (véhicules neufs : immatriculation provisoire à remplacer)
insert into public.vehicules
  (id, immat, marque, modele, chauffeur, carburant, co2, puissance_fiscale, categorie, statut, proprietaire, societe)
values
  ('V-LOC-MEGANE', 'KONA-MEGANE', 'HYUNDAI', 'KONA HYBRID 138', 'Mégane', 'Essence / Hybride', 104, 5, 'SUV', 'actif', 'LOCALEASE', 'PXP'),
  ('V-LOC-NC1',    'KONA-NC1',    'HYUNDAI', 'KONA HYBRID 138', null,     'Essence / Hybride', 104, 5, 'SUV', 'actif', 'LOCALEASE', 'PXP'),
  ('V-LOC-NC2',    'KONA-NC2',    'HYUNDAI', 'KONA HYBRID 138', null,     'Essence / Hybride', 104, 5, 'SUV', 'actif', 'LOCALEASE', 'PXP')
on conflict (id) do nothing;
