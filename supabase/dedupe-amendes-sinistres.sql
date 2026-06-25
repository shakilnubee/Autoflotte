-- ============================================================
--  Nettoyage des doublons : AMENDES + SINISTRES
--  Supabase → SQL Editor. Lance le 1) (aperçu) puis le 2) (suppression).
-- ============================================================

-- ===== AMENDES (doublons = même n° d'avis dans la même société) =====
-- 1) Aperçu
select numero_avis, societe, count(*) as nb, array_agg(id order by id) as ids
from public.amendes
where numero_avis is not null and numero_avis <> ''
group by numero_avis, societe
having count(*) > 1
order by nb desc, numero_avis;

-- 2) Suppression (garde l'id le plus petit par n° d'avis + société)
delete from public.amendes a
where a.numero_avis is not null and a.numero_avis <> ''
  and a.id <> (
    select min(b.id) from public.amendes b
    where b.numero_avis = a.numero_avis
      and b.societe is not distinct from a.societe
  );

-- ===== SINISTRES & FACTURES : même PIÈCE JOINTE (file_id) = vrai doublon =====
-- (Sûr : on ne supprime que des lignes pointant EXACTEMENT vers le même fichier.
--  Les sinistres « devis + facture » d'un même incident ont des fichiers différents
--  → ils ne sont PAS touchés.)
-- 1) Aperçu
select file_id, count(*) as nb, array_agg(id order by id) as ids
from public.factures
where file_id is not null and file_id <> ''
group by file_id
having count(*) > 1
order by nb desc;

-- 2) Suppression (garde l'id le plus petit par fichier)
delete from public.factures f
where f.file_id is not null and f.file_id <> ''
  and f.id <> (
    select min(g.id) from public.factures g
    where g.file_id = f.file_id
  );

-- ===== Vérifications (ne doivent plus rien renvoyer) =====
select numero_avis, count(*) from public.amendes
where numero_avis is not null and numero_avis <> ''
group by numero_avis, societe having count(*) > 1;

select file_id, count(*) from public.factures
where file_id is not null and file_id <> ''
group by file_id having count(*) > 1;
