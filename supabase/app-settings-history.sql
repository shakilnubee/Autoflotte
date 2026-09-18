-- ============================================================
--  HISTORIQUE SERVEUR DES RÉGLAGES (anti-perte, indépendant des appareils)
--
--  Pourquoi : les congés / assurances / leasing / loueurs… vivent dans app_settings.data (JSONB,
--  1 ligne par société). Jusqu'ici, la seule copie de secours était l'historique LOCAL de chaque
--  appareil (localStorage) → si on vide le cache de TOUS les appareils, il ne reste rien.
--
--  Ce script crée un historique CÔTÉ SERVEUR, rempli AUTOMATIQUEMENT par un TRIGGER PostgreSQL :
--  à chaque modification d'une ligne app_settings, l'ANCIENNE valeur est archivée. On peut donc
--  restaurer une version d'avant, même si aucun appareil n'a de cache. Capture TOUT changement
--  (navigateur, autre appareil…), même si le JavaScript bugue.
--
--  ⚠️ NE TOUCHE À AUCUNE DONNÉE EXISTANTE. À lancer UNE FOIS : SQL Editor → coller → Run. Idempotent.
-- ============================================================

create table if not exists public.app_settings_history (
  id         bigint generated always as identity primary key,
  societe    text not null,                 -- = app_settings.id (la société)
  data       jsonb not null,                -- l'ANCIENNE valeur des réglages (avant la modification)
  summary    text,                          -- résumé lisible : "12 congés · 5 assureurs · 57 primes · 17 leasing · 2 loueurs"
  changed_at timestamptz not null default now()
);
create index if not exists app_settings_history_soc_idx on public.app_settings_history (societe, changed_at desc);

-- Droits + RLS : chacun LIT l'historique de SA société (l'admin/CEO voit tout). MÊME règle qu'app_settings.
grant all on public.app_settings_history to authenticated;
alter table public.app_settings_history enable row level security;
drop policy if exists tenant_app_settings_history on public.app_settings_history;
create policy tenant_app_settings_history on public.app_settings_history
  for all to authenticated
  using      (fp_is_admin() or coalesce(societe, 'PXP') = fp_societe())
  with check (fp_is_admin() or coalesce(societe, 'PXP') = fp_societe());

-- Fonction d'archivage : compte quelques collections précieuses (pour le résumé lisible) puis insère
-- l'ANCIENNE valeur. SECURITY DEFINER → l'archive s'écrit toujours, quel que soit l'utilisateur.
create or replace function public.fp_snapshot_app_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n_conges   int := 0;
  n_assur    int := 0;
  n_primes   int := 0;
  n_leasing  int := 0;
  n_loueurs  int := 0;
  parts      text[] := array[]::text[];
  s          text;
begin
  if OLD.data is null or jsonb_typeof(OLD.data) <> 'object' then
    return NEW;
  end if;
  if jsonb_typeof(OLD.data->'condConges')     = 'object' then n_conges  := (select count(*) from jsonb_object_keys(OLD.data->'condConges')); end if;
  if jsonb_typeof(OLD.data->'assurancePrimes')= 'object' then n_primes  := (select count(*) from jsonb_object_keys(OLD.data->'assurancePrimes')); end if;
  if jsonb_typeof(OLD.data->'leasingContrats')= 'object' then n_leasing := (select count(*) from jsonb_object_keys(OLD.data->'leasingContrats')); end if;
  if jsonb_typeof(OLD.data->'assureurs')      = 'array'  then n_assur   := jsonb_array_length(OLD.data->'assureurs'); end if;
  if jsonb_typeof(OLD.data->'loueurs')        = 'array'  then n_loueurs := jsonb_array_length(OLD.data->'loueurs'); end if;

  if n_conges  > 0 then parts := array_append(parts, n_conges  || ' congés');    end if;
  if n_assur   > 0 then parts := array_append(parts, n_assur   || ' assureurs'); end if;
  if n_primes  > 0 then parts := array_append(parts, n_primes  || ' primes');    end if;
  if n_leasing > 0 then parts := array_append(parts, n_leasing || ' leasing');   end if;
  if n_loueurs > 0 then parts := array_append(parts, n_loueurs || ' loueurs');   end if;
  s := case when array_length(parts, 1) is null then 'réglages' else array_to_string(parts, ' · ') end;

  insert into public.app_settings_history (societe, data, summary)
  values (OLD.id, OLD.data, s);

  -- Élagage : ne garder que les 60 versions les plus récentes par société.
  delete from public.app_settings_history a
   where a.societe = OLD.id
     and a.id not in (
       select id from public.app_settings_history
        where societe = OLD.id
        order by changed_at desc
        limit 60
     );

  return NEW;
end;
$$;

drop trigger if exists trg_snapshot_app_settings on public.app_settings;
create trigger trg_snapshot_app_settings
  before update on public.app_settings
  for each row
  when (OLD.data is distinct from NEW.data)
  execute function public.fp_snapshot_app_settings();

-- Vérif : doit lister le trigger
select tgname, tgrelid::regclass as sur_table
from pg_trigger where tgname = 'trg_snapshot_app_settings';
