-- ============================================================
--  Parc Pilot — 3 niveaux d'accès : CEO · ADMIN · GESTIONNAIRE
-- ============================================================
--  À exécuter UNE fois dans Supabase → SQL Editor → coller → Run.
--  Sans danger : ne verrouille personne (tous les comptes actuels restent
--  ce qu'ils sont). Ajoute juste la notion de « rôle » à la table profiles.
--
--  Modèle de droits (le rôle + la société FONT AUTORITÉ ici, dans profiles —
--  l'utilisateur ne peut PAS les changer lui-même : c'est le vrai verrou) :
--    • CEO           : profiles.is_admin = true              → toutes les sociétés, tout.
--    • ADMIN (client): is_admin=false, role='admin',  societe='X' → SA société : tout + config + comptes.
--    • GESTIONNAIRE  : is_admin=false, role='gestionnaire', societe='X' → SA société : données oui,
--                       config société / comptes NON.
-- ============================================================

-- 1) Colonne 'role' sur profiles ('admin' par défaut => aucun compte existant ne perd de droits)
alter table public.profiles add column if not exists role text not null default 'admin';

-- 2) Fonction : rôle EFFECTIF du compte connecté (lu depuis profiles, SECURITY DEFINER =
--    ne boucle pas sur la RLS). Renvoie 'ceo' | 'admin' | 'gestionnaire'.
create or replace function public.fp_role() returns text
  language sql security definer stable set search_path = public as
$$
  select case
           when coalesce((select is_admin from public.profiles where id = auth.uid()), false) then 'ceo'
           when (select role from public.profiles where id = auth.uid()) = 'gestionnaire' then 'gestionnaire'
           else 'admin'
         end
$$;

-- 3) IMPORTANT — anti-escalade : profiles n'a QUE la policy de lecture de soi
--    (profiles_self_read). Aucune policy d'écriture => un utilisateur ne peut PAS
--    modifier son propre rôle / sa société / is_admin. Seule la fonction serveur
--    manage-users (clé service_role, côté serveur) écrit dans profiles.
--    (Rien à faire ici : on VÉRIFIE juste qu'aucune policy d'écriture n'existe.)
select policyname, cmd from pg_policies
  where schemaname='public' and tablename='profiles';   -- doit ne montrer QUE profiles_self_read (SELECT)

-- 4) Vérif : lister les comptes, leur société et leur rôle effectif
select p.email,
       case when p.is_admin then 'CEO'
            when p.role='gestionnaire' then 'Gestionnaire'
            else 'Admin' end as acces,
       coalesce(p.societe,'(toutes)') as societe
  from public.profiles p
  order by p.is_admin desc, p.societe, p.role;


-- ============================================================
--  (OPTIONNEL) Durcissement : empêcher AUSSI un gestionnaire d'écrire la config
--  société (table app_settings) même en contournant l'interface.
--  ⚠️ Effet de bord : les préférences d'affichage d'un gestionnaire (largeur de
--  colonnes, alertes masquées, statuts sinistres stockés dans les réglages) ne se
--  synchroniseront plus entre postes pour LUI (elles restent locales à son navigateur).
--  Les DONNÉES (véhicules, amendes…) ne sont PAS concernées. À activer seulement si
--  tu veux le mur « dur » sur la config. Décommente le bloc puis Run.
-- ------------------------------------------------------------
-- alter table public.app_settings enable row level security;
-- drop policy if exists "tenant_app_settings" on public.app_settings;
-- drop policy if exists "app_settings_read"   on public.app_settings;
-- drop policy if exists "app_settings_write"  on public.app_settings;
-- create policy "app_settings_read" on public.app_settings for select to authenticated
--   using ( public.fp_is_admin() or id = public.fp_societe() );
-- create policy "app_settings_write" on public.app_settings for all to authenticated
--   using      ( public.fp_is_admin() or (id = public.fp_societe() and public.fp_role() <> 'gestionnaire') )
--   with check ( public.fp_is_admin() or (id = public.fp_societe() and public.fp_role() <> 'gestionnaire') );
