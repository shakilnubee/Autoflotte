-- ============================================================================
-- Auto-flotte — tables supplémentaires pour tout persister dans Supabase
-- ----------------------------------------------------------------------------
-- À exécuter UNE FOIS dans Supabase :
--   1. Ouvre https://supabase.com/dashboard → ton projet
--   2. Menu de gauche : "SQL Editor" → "New query"
--   3. Colle TOUT ce fichier puis clique "Run"
--
-- Ces tables stockent ce qui n'était jusqu'ici qu'en local (navigateur) :
--   • documents   : les liens de documents par véhicule (carte grise, assurance, etc.)
--   • conducteurs : les conducteurs ajoutés à la main + contact + permis + masquage
--   • app_settings: la personnalisation partagée (groupes, ordre des onglets, colonnes…)
-- ============================================================================

-- 1) Documents liés à un véhicule -------------------------------------------
create table if not exists public.documents (
  id          text primary key,
  vehicule_id text,
  type        text,
  label       text,
  url         text,
  drive_id    text,
  created_at  timestamptz default now()
);

-- 2) Conducteurs (ajoutés manuellement, contact, permis, masquage) ----------
-- clé = prénom normalisé (sans accents, minuscule), cohérent avec l'app
create table if not exists public.conducteurs (
  key             text primary key,
  name            text,
  tel             text,
  email           text,
  note            text,
  permis_url      text,
  permis_file_id  text,
  masque          boolean default false,
  manuel          boolean default false,
  created_at      timestamptz default now()
);

-- 3) Paramètres partagés (un seul enregistrement, en JSON) ------------------
create table if not exists public.app_settings (
  id          text primary key default 'global',
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz default now()
);

-- Droits d'accès pour la clé publique (anon) et les utilisateurs connectés ---
-- (cohérent avec les tables existantes vehicules / amendes / factures)
grant all on public.documents    to anon, authenticated;
grant all on public.conducteurs  to anon, authenticated;
grant all on public.app_settings to anon, authenticated;

-- NB : RLS reste désactivé (comme les autres tables actuellement). Quand tu
-- activeras l'authentification, pense à activer RLS + des règles d'accès.
