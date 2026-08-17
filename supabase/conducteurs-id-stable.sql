-- ============================================================
--  Parc Pilot — conducteurs : identifiant technique STABLE (uuid)
-- ============================================================
--  CONTEXTE
--  La table `conducteurs` est identifiée par `key` (dérivé du prénom, ou
--  « prénom-nom » en cas d'homonyme). L'app gère déjà les homonymes
--  (FP.conducteurs.create/find : bascule sur « prénom-nom » si un même prénom
--  existe avec un nom différent, et match sur le nom complet d'abord). Le risque
--  résiduel : `key` est lié à l'identité affichée → renommer une personne peut,
--  à terme, désynchroniser des liens qui pointent sur l'ancienne `key`.
--
--  CE QUE FAIT CE SCRIPT (100 % ADDITIF, NON BLOQUANT)
--  Ajoute une colonne `id uuid` unique, remplie automatiquement, à `conducteurs`.
--  `key` RESTE la clé primaire et l'app continue de fonctionner EXACTEMENT comme
--  avant (elle upserte toujours par `key`). `id` est un socle : un identifiant qui
--  ne bouge JAMAIS même si le nom change.
--
--  ⚠️ RIEN NE CHANGE POUR L'APPLICATION tant que le code n'utilise pas `id`.
--     C'est la phase 1 (préparation). NE bascule PAS les jointures ici.
--
--  PHASE 2 (côté code, plus tard, PAS dans ce script) : faire pointer
--     progressivement les liens (conso par carte/badge, réglages par conducteur,
--     historique d'affectation) sur `id` plutôt que sur `key`, puis désindexer.
--     Migration lourde et coordonnée — voir supabase/MIGRATIONS-EN-ATTENTE.md.
--
--  À exécuter dans Supabase → SQL Editor → coller → Run. Sans danger (additif).
-- ============================================================

-- 0) gen_random_uuid() (présent par défaut sur Supabase ; on s'en assure).
create extension if not exists pgcrypto;

-- 1) Colonne id + valeur par défaut pour les NOUVELLES lignes (idempotent).
alter table public.conducteurs add column if not exists id uuid default gen_random_uuid();

-- 2) Backfill des lignes existantes qui n'ont pas encore d'id.
update public.conducteurs set id = gen_random_uuid() where id is null;

-- 3) Rendre la colonne obligatoire + unique (sans toucher à la clé primaire `key`).
alter table public.conducteurs alter column id set not null;
create unique index if not exists conducteurs_id_key on public.conducteurs (id);

-- 4) Vérif : chaque conducteur a un id unique (doit renvoyer 0 doublon).
select count(*) as total, count(distinct id) as ids_uniques from public.conducteurs;


-- ============================================================
--  ROLLBACK (retirer l'id technique) — si besoin
-- ============================================================
-- drop index if exists public.conducteurs_id_key;
-- alter table public.conducteurs drop column if exists id;
