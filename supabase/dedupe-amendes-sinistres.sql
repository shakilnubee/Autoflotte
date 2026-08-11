-- ============================================================
--  Nettoyage des doublons : AMENDES + SINISTRES
--  Supabase → SQL Editor.
--  ⚠️ ORDRE OBLIGATOIRE : 0) SAUVEGARDE → 1) APERÇU (vérifier les n° et le nb) → 2) SUPPRESSION.
--  Ne JAMAIS lancer le 2) sans avoir lu le 1). En cas de souci, restaurer depuis la
--  table de sauvegarde (voir tout en bas : « RESTAURATION D'URGENCE »).
-- ============================================================

-- ===== 0) SAUVEGARDE AUTOMATIQUE (à lancer AVANT toute suppression) =====
-- Crée une copie horodatée des tables. Si une suppression se passe mal, on restaure depuis ces copies.
drop table if exists public.amendes_backup;
create table public.amendes_backup as table public.amendes;
drop table if exists public.factures_backup;
create table public.factures_backup as table public.factures;
-- Vérif : doit afficher le MÊME nombre que la table d'origine
select (select count(*) from public.amendes)  as amendes_avant,
       (select count(*) from public.amendes_backup)  as amendes_sauvegardees,
       (select count(*) from public.factures) as factures_avant,
       (select count(*) from public.factures_backup) as factures_sauvegardees;

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

-- ============================================================
--  RESTAURATION D'URGENCE (si une suppression a effacé trop de lignes)
--  Réinjecte depuis la sauvegarde du 0). ON CONFLICT = aucun doublon recréé.
-- ============================================================
-- insert into public.amendes  select * from public.amendes_backup  on conflict (id) do nothing;
-- insert into public.factures select * from public.factures_backup on conflict (id) do nothing;
