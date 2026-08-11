-- ============================================================================
-- PROSPECTS — formulaire "intéressé" de la page de connexion → onglet JIS
-- ----------------------------------------------------------------------------
-- À COLLER UNE SEULE FOIS dans Supabase → SQL Editor → Run.
-- (Mise en place backend one-shot, comme les Edge Functions / policies RLS.)
-- Après ça, TOUT se passe dans le site : le visiteur remplit le formulaire,
-- le prospect apparaît dans JIS → Prospects, avec une alerte (badge).
-- ============================================================================

create table if not exists public.prospects (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nom        text,
  email      text,
  tel        text,
  societe    text,
  message    text,
  statut     text not null default 'nouveau'   -- 'nouveau' | 'traite'
);

alter table public.prospects enable row level security;

-- 1) Un VISITEUR non connecté (rôle anon) peut UNIQUEMENT déposer sa demande (insert).
--    Il ne peut RIEN lire (aucune policy select pour anon) → pas de fuite de données.
drop policy if exists prospects_insert_anon on public.prospects;
create policy prospects_insert_anon
  on public.prospects for insert to anon
  with check (true);

-- 2) Seul le PROPRIÉTAIRE JIS (toi) peut lire / modifier / supprimer les prospects.
--    (mêmes e-mails que FP.JIS_OWNERS dans assets/js/app.js)
drop policy if exists prospects_select_owner on public.prospects;
create policy prospects_select_owner
  on public.prospects for select to authenticated
  using ( lower(auth.jwt() ->> 'email') in ('shakil.nubee@projectxparis.fr','jis.nubee@gmail.com') );

drop policy if exists prospects_update_owner on public.prospects;
create policy prospects_update_owner
  on public.prospects for update to authenticated
  using ( lower(auth.jwt() ->> 'email') in ('shakil.nubee@projectxparis.fr','jis.nubee@gmail.com') );

drop policy if exists prospects_delete_owner on public.prospects;
create policy prospects_delete_owner
  on public.prospects for delete to authenticated
  using ( lower(auth.jwt() ->> 'email') in ('shakil.nubee@projectxparis.fr','jis.nubee@gmail.com') );
