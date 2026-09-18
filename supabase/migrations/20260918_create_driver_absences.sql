-- ============================================================
--  driver_absences — CONGÉS / ABSENCES par conducteur, en TABLE DÉDIÉE (1 congé = 1 ligne)
--
--  Étape « sortir les congés d'app_settings » (roadmap). Isolation par société via RLS (identique
--  aux autres tables). Un bug ne peut plus toucher qu'UNE ligne au lieu de tout le bloc JSON.
--
--  ⚠️ TRANSITION SÛRE : côté app, les congés restent AUSSI écrits dans app_settings.condConges
--  (miroir + repli) et la LECTURE se fait encore depuis là pour l'instant → aucune régression.
--  Cette table est remplie/maintenue en parallèle ; le basculement des lectures se fera plus tard,
--  testé sur un environnement DEV. Cette table ne PERD jamais rien (mirroir de la source actuelle).
--
--  À lancer UNE FOIS : Supabase → SQL Editor → coller → Run. Idempotent.
-- ============================================================

create table if not exists public.driver_absences (
  id         bigint generated always as identity primary key,
  societe    text not null,                 -- isolation par société (= app_settings.id)
  cond_key   text not null,                 -- clé du conducteur (FP c.key ; format libre)
  debut      date not null,
  fin        date not null,
  motif      text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz                    -- soft-delete (réservé usage futur ; l'app remplace par clé pour l'instant)
);
create index if not exists driver_absences_soc_key_idx on public.driver_absences (societe, cond_key);

grant all on public.driver_absences to authenticated;
alter table public.driver_absences enable row level security;

drop policy if exists tenant_driver_absences on public.driver_absences;
create policy tenant_driver_absences on public.driver_absences
  for all to authenticated
  using      (fp_is_admin() or coalesce(societe, 'PXP') = fp_societe())
  with check  (fp_is_admin() or coalesce(societe, 'PXP') = fp_societe());

-- Vérif : doit lister la policy
select tablename, policyname, cmd from pg_policies where tablename = 'driver_absences';
