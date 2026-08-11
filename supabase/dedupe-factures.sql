-- ============================================================
--  Nettoyage des factures EN DOUBLE (même numéro de facture)
--  Supabase → SQL Editor → coller → Run.
--  Lance d'abord le 1) pour VOIR, puis le 2) pour SUPPRIMER.
-- ============================================================

-- 1) APERÇU — quels numéros sont en double (et combien de fois)
select numero_facture, societe, count(*) as nb,
       array_agg(id order by id) as ids,
       sum(montant_ttc) as montant_compte_en_double
from public.factures
where numero_facture is not null and numero_facture <> ''
group by numero_facture, societe
having count(*) > 1
order by nb desc, numero_facture;

-- 2) SUPPRESSION — garde 1 seule facture par (numéro + société),
--    supprime les autres (on conserve l'id le plus petit).
delete from public.factures f
where f.numero_facture is not null and f.numero_facture <> ''
  and f.id <> (
    select min(g.id)
    from public.factures g
    where g.numero_facture = f.numero_facture
      and g.societe is not distinct from f.societe
  );

-- 3) VÉRIFICATION — ne doit plus rien renvoyer
select numero_facture, societe, count(*)
from public.factures
where numero_facture is not null and numero_facture <> ''
group by numero_facture, societe
having count(*) > 1;
