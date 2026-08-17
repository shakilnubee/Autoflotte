-- ============================================================
--  Parc Pilot — app_settings : anti « dernier qui écrit gagne »
--  (concurrence multi-admin sur la config d'une même société)
-- ============================================================
--  CONTEXTE
--  Toute la config d'une société tient dans UNE ligne app_settings (id = société,
--  data = un gros blob JSON). L'app lit le blob entier, le modifie, puis le
--  ré-écrit en entier. Si DEUX admins de la même société enregistrent presque en
--  même temps, le second écrase les changements du premier (lost update), sans
--  aucun avertissement.
--
--  CE QUE FAIT CE SCRIPT (100 % ADDITIF, NON BLOQUANT)
--  Ajoute 2 colonnes techniques à app_settings :
--    • updated_at timestamptz  — horodatage de la dernière écriture
--    • rev        bigint        — numéro de révision, +1 à chaque écriture
--  et un trigger qui les met à jour AUTOMATIQUEMENT côté base.
--
--  ⚠️ RIEN NE CHANGE POUR L'APPLICATION tant que le code n'exploite pas `rev` :
--     l'app continue d'upserter {id, data} comme avant ; `rev`/`updated_at` sont
--     gérés par la base. C'est le socle (phase 1) de la vraie protection.
--
--  PHASE 2 (côté code, plus tard, PAS dans ce script) : à l'enregistrement,
--     l'app lira `rev`, écrira avec la garde « rev = ancien_rev » ; si 0 ligne
--     touchée (quelqu'un a écrit entre-temps) → relire, re-fusionner, réessayer.
--     Voir supabase/MIGRATIONS-EN-ATTENTE.md.
--
--  À exécuter dans Supabase → SQL Editor → coller → Run. Sans danger (additif).
-- ============================================================

-- 1) Colonnes techniques (idempotent)
alter table public.app_settings add column if not exists updated_at timestamptz not null default now();
alter table public.app_settings add column if not exists rev        bigint      not null default 0;

-- 2) Trigger : à chaque UPDATE, on incrémente rev et on tamponne updated_at.
create or replace function public.app_settings_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.rev := coalesce(old.rev, 0) + 1;
  return new;
end;
$$;

drop trigger if exists trg_app_settings_touch on public.app_settings;
create trigger trg_app_settings_touch
  before update on public.app_settings
  for each row execute function public.app_settings_touch();

-- 3) Vérif : les colonnes existent et le trigger est en place.
select column_name from information_schema.columns
  where table_schema = 'public' and table_name = 'app_settings' and column_name in ('updated_at', 'rev');
select tgname from pg_trigger where tgrelid = 'public.app_settings'::regclass and not tgisinternal;


-- ============================================================
--  ROLLBACK (retirer le garde-fou) — si besoin
-- ============================================================
-- drop trigger if exists trg_app_settings_touch on public.app_settings;
-- drop function if exists public.app_settings_touch();
-- alter table public.app_settings drop column if exists rev;
-- alter table public.app_settings drop column if exists updated_at;
