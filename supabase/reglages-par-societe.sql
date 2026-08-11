-- ============================================================
--  Parc Pilot — Réglages (apparence) PAR SOCIÉTÉ
-- ============================================================
--  Avant : une seule ligne app_settings 'global' partagée par toutes les sociétés.
--  Après : une ligne par société (id = nom de la société). Admin voit tout ;
--          un client ne lit/écrit QUE les réglages de SA société.
--
--  ⚠️ À exécuter dans Supabase → SQL Editor → Run. Sans danger : ta config PXP
--     existante est recopiée vers la ligne 'PXP'.
-- ============================================================

-- 1) Recopier les réglages PXP existants ('global') vers la ligne 'PXP'
insert into public.app_settings (id, data)
select 'PXP', data from public.app_settings where id = 'global'
on conflict (id) do nothing;

-- 2) Isoler app_settings par société (chaque société sa config ; l'admin voit tout)
alter table public.app_settings enable row level security;
drop policy if exists "auth_all_app_settings" on public.app_settings;
drop policy if exists "tenant_app_settings"   on public.app_settings;
create policy "tenant_app_settings" on public.app_settings for all to authenticated
  using      ( public.fp_is_admin() or id = public.fp_societe() )
  with check ( public.fp_is_admin() or id = public.fp_societe() );

-- Vérif : doit lister tenant_app_settings
select tablename, policyname from pg_policies where schemaname = 'public' and tablename = 'app_settings';


-- ============================================================
--  ROLLBACK (revenir à des réglages partagés) — si besoin
-- ============================================================
-- drop policy if exists "tenant_app_settings" on public.app_settings;
-- create policy "auth_all_app_settings" on public.app_settings for all to authenticated using (true) with check (true);
