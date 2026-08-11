-- ============================================================
--  VÉRIF / NETTOYAGE ISOLATION DES RÉGLAGES (app_settings)
--  Les réglages par société (seuils d'alerte, seuils Total Fleet « tfSeuils »,
--  anomalies archivées « tfAnomOk », config société…) vivent dans app_settings,
--  une ligne par société (id = société). Si une ANCIENNE policy permissive
--  (using(true)) a survécu, PostgreSQL fait un OR des policies → les réglages
--  fuiraient d'une société à l'autre. Ce script remet un état PROPRE et unique.
--
--  À lancer UNE FOIS dans Supabase → SQL Editor → Run. Idempotent, sans risque.
-- ============================================================

alter table public.app_settings enable row level security;

-- Supprime TOUTES les policies connues (anciennes + actuelles) pour repartir propre.
drop policy if exists "auth_all_app_settings"  on public.app_settings;
drop policy if exists "tenant_app_settings"    on public.app_settings;
drop policy if exists "app_settings lecture"   on public.app_settings;
drop policy if exists "app_settings ecriture"  on public.app_settings;
drop policy if exists "app_settings"           on public.app_settings;
drop policy if exists "app_settings_read"      on public.app_settings;
drop policy if exists "app_settings_write"     on public.app_settings;

-- Recrée UNIQUEMENT les 2 bonnes policies, isolées par société.
-- Lecture : CEO/Admin (toutes sociétés) + tout compte de SA société.
create policy "app_settings_read" on public.app_settings for select to authenticated
  using ( public.fp_is_admin() or id = public.fp_societe() );

-- Écriture : CEO/Admin de la société (le gestionnaire est exclu de la config).
create policy "app_settings_write" on public.app_settings for all to authenticated
  using      ( public.fp_is_admin() or (id = public.fp_societe() and public.fp_role() <> 'gestionnaire') )
  with check ( public.fp_is_admin() or (id = public.fp_societe() and public.fp_role() <> 'gestionnaire') );

-- Vérif : doit lister EXACTEMENT 2 lignes (app_settings_read = SELECT, app_settings_write = ALL).
-- Si tu en vois une autre (surtout « using: true »), c'est elle qui cassait l'isolation.
select policyname, cmd, qual as using_expr
from pg_policies
where schemaname = 'public' and tablename = 'app_settings'
order by policyname;
