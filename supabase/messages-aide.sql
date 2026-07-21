-- ============================================================================
-- Parc Pilot — Boîte « Aide / Poser une question »
-- Table des messages envoyés par les utilisateurs au CEO (support in-app).
-- À exécuter UNE FOIS dans Supabase → SQL Editor.
-- ============================================================================

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  societe    text,                                   -- société de l'expéditeur
  user_id    uuid not null default auth.uid(),       -- auteur (auth.users)
  email      text,                                   -- e-mail de l'auteur (affichage)
  sujet      text,
  body       text not null,                          -- la question / demande
  reponse    text,                                   -- réponse du CEO
  statut     text not null default 'ouvert',         -- ouvert | repondu | clos
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists messages_user_idx on public.messages (user_id);
create index if not exists messages_statut_idx on public.messages (statut);

alter table public.messages enable row level security;

-- Un utilisateur crée SON propre message.
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (user_id = auth.uid());

-- Lecture : l'auteur voit ses messages ; le CEO (is_admin) voit tout.
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated
  using (user_id = auth.uid() or public.fp_is_admin());

-- Réponse / statut : réservé au CEO.
drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages
  for update to authenticated
  using (public.fp_is_admin())
  with check (public.fp_is_admin());

-- Suppression : réservé au CEO.
drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages
  for delete to authenticated
  using (public.fp_is_admin());
