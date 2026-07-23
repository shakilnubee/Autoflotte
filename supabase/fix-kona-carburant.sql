-- ============================================================
--  Correction : uniformiser le carburant des 3 Hyundai KONA
--  Les KONA HYBRID 138 sont TOUS "Essence / Hybride" (+ CO2 104).
--  À lancer dans Supabase → SQL Editor → Run.
-- ============================================================

update public.vehicules
   set carburant = 'Essence / Hybride',
       co2 = coalesce(nullif(co2, 0), 104)
 where upper(marque) like 'HYUNDAI%'
   and upper(modele) like '%KONA%';

-- Vérification (doit renvoyer 3 lignes toutes en "Essence / Hybride")
select immat, modele, carburant, co2
  from public.vehicules
 where upper(marque) like 'HYUNDAI%' and upper(modele) like '%KONA%'
 order by immat;
