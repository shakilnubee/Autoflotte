-- ============================================================
--  Parc Pilot — Durcissement : un GESTIONNAIRE ne peut plus MODIFIER
--  la config de sa société (table app_settings), même via la console.
--  (Audit sécurité 2026-07 — finding MOYEN.)
-- ============================================================
--  À exécuter dans Supabase → SQL Editor → coller → Run.
--
--  AVANT : policy « tenant_app_settings » (for all) → tout connecté de la société
--          peut LIRE et ÉCRIRE sa config (donc un gestionnaire aussi).
--  APRÈS : LECTURE inchangée (CEO/Admin/Gestionnaire de la société lisent) ;
--          ÉCRITURE réservée à CEO + Admin (le gestionnaire ne peut plus écrire).
--
--  ⚠️ Effet de bord (négligeable si tu n'as pas de gestionnaire) : les préférences
--     d'AFFICHAGE d'un gestionnaire (largeur de colonnes, alertes masquées, statuts
--     sinistres) ne se synchroniseront plus entre ses postes. Les DONNÉES
--     (véhicules, amendes…) ne sont PAS concernées.
-- ============================================================

alter table public.app_settings enable row level security;

drop policy if exists "tenant_app_settings" on public.app_settings;
drop policy if exists "app_settings_read"   on public.app_settings;
drop policy if exists "app_settings_write"  on public.app_settings;

-- Lecture : CEO/Admin (toutes sociétés) + tout compte de SA société (gestionnaire inclus).
create policy "app_settings_read" on public.app_settings for select to authenticated
  using ( public.fp_is_admin() or id = public.fp_societe() );

-- Écriture : CEO/Admin uniquement (le gestionnaire est explicitement exclu).
create policy "app_settings_write" on public.app_settings for all to authenticated
  using      ( public.fp_is_admin() or (id = public.fp_societe() and public.fp_role() <> 'gestionnaire') )
  with check ( public.fp_is_admin() or (id = public.fp_societe() and public.fp_role() <> 'gestionnaire') );

-- Vérif : doit lister app_settings_read (SELECT) + app_settings_write (ALL)
select policyname, cmd from pg_policies
  where schemaname = 'public' and tablename = 'app_settings'
  order by policyname;


-- ============================================================
--  ROLLBACK (revenir à l'état d'avant) — si besoin
-- ============================================================
-- drop policy if exists "app_settings_read"  on public.app_settings;
-- drop policy if exists "app_settings_write" on public.app_settings;
-- create policy "tenant_app_settings" on public.app_settings for all to authenticated
--   using      ( public.fp_is_admin() or id = public.fp_societe() )
--   with check ( public.fp_is_admin() or id = public.fp_societe() );
