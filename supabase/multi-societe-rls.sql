-- ============================================================
--  Parc Pilot — Séparation par société (multi-tenant)  ·  ÉTAPE 1 (base)
-- ============================================================
--  Modèle : UNE base. Admin = voit/gère TOUTES les sociétés.
--           Client = voit/gère UNIQUEMENT sa société (filtré par la base, pas juste l'affichage).
--
--  ⚠️ Sûr : ce script met TOUS les comptes ACTUELS en "admin" → l'app fonctionne
--     exactement comme avant. L'isolation s'appliquera aux futurs comptes clients
--     (créés en is_admin = false + leur société).
--
--  À exécuter dans Supabase → SQL Editor → coller → Run.
-- ============================================================

-- 1) Colonne 'societe' présente sur toutes les tables de données (sans effet si déjà là)
alter table public.vehicules   add column if not exists societe text;
alter table public.amendes     add column if not exists societe text;
alter table public.factures    add column if not exists societe text;
alter table public.conducteurs add column if not exists societe text;
alter table public.documents   add column if not exists societe text;
alter table public.emprunts    add column if not exists societe text;

-- 2) Table des profils : quel compte appartient à quelle société (ou admin)
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  societe    text,                       -- société du client (NULL pour un admin)
  is_admin   boolean not null default false,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read" on public.profiles
  for select to authenticated using (id = auth.uid());

-- 3) Fonctions d'accès (SECURITY DEFINER : lisent profiles SANS boucler sur la RLS)
create or replace function public.fp_is_admin() returns boolean
  language sql security definer stable set search_path = public as
$$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;

create or replace function public.fp_societe() returns text
  language sql security definer stable set search_path = public as
$$ select (select societe from public.profiles where id = auth.uid()) $$;

-- 4) Tous les comptes ACTUELS = admin (ne verrouille personne ; comportement identique)
insert into public.profiles (id, email, is_admin, societe)
select id, email, true, null from auth.users
on conflict (id) do update set is_admin = true;

-- 5) Politique « par société » sur les 6 tables de données
--    Admin → tout. Sinon → uniquement les lignes de SA société (les lignes sans
--    étiquette comptent comme 'PXP'). Un compte sans société ne voit rien (sûr).
do $$
declare t text;
begin
  foreach t in array array['vehicules','amendes','factures','conducteurs','documents','emprunts']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "auth_all_%1$s" on public.%1$s;', t);
    execute format('drop policy if exists "tenant_%1$s" on public.%1$s;', t);
    execute format($f$
      create policy "tenant_%1$s" on public.%1$s for all to authenticated
        using ( public.fp_is_admin() or coalesce(societe,'PXP') = public.fp_societe() )
        with check ( public.fp_is_admin() or coalesce(societe,'PXP') = public.fp_societe() );
    $f$, t);
  end loop;
end $$;

-- (app_settings reste accessible à tous les connectés : c'est de la config d'interface,
--  pas des données client. On l'affinera plus tard si besoin.)

-- 6) Vérification : doit lister tenant_* sur les 6 tables + profiles_self_read + auth_all_app_settings
select tablename, policyname from pg_policies where schemaname = 'public' order by tablename, policyname;


-- ============================================================
--  ROLLBACK (revenir à « tous les connectés voient tout ») — si besoin
-- ============================================================
-- do $$ declare t text; begin
--   foreach t in array array['vehicules','amendes','factures','conducteurs','documents','emprunts']
--   loop
--     execute format('drop policy if exists "tenant_%1$s" on public.%1$s;', t);
--     execute format('create policy "auth_all_%1$s" on public.%1$s for all to authenticated using (true) with check (true);', t);
--   end loop;
-- end $$;
