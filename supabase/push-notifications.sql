-- ============================================================
--  Parc Pilot — Notifications PUSH (Web Push / VAPID)  ·  table push_subscriptions
-- ============================================================
--  Chaque appareil (navigateur / téléphone / PWA installée) qui accepte les notifications
--  enregistre ici son « abonnement push » (endpoint + clés). L'Edge Function km-collect
--  (service_role) lit ces abonnements pour ENVOYER une notification au(x) gestionnaire(s)
--  de la société quand un chauffeur soumet quelque chose via son QR (relevé km, déclaration,
--  question, état des lieux…) — même appli fermée.
--
--  ⚠️ Sécurité : la clé PRIVÉE VAPID ne vit QUE dans les secrets de l'Edge Function
--  (VAPID_PRIVATE_KEY), JAMAIS dans le code client ni dans cette table. Côté client on ne
--  stocke que l'abonnement du navigateur (endpoint + p256dh + auth), qui n'est pas un secret.
--
--  À exécuter dans Supabase → SQL Editor → coller → Run.
-- ============================================================

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  societe     text,
  user_id     uuid,                 -- compte connecté qui a activé les notifs (peut être NULL)
  email       text,                 -- e-mail du compte (pour info / ciblage éventuel)
  endpoint    text not null unique, -- URL push du navigateur (unique par appareil)
  p256dh      text not null,        -- clé publique du client (chiffrement)
  auth        text not null,        -- secret d'authentification du client
  user_agent  text,                 -- pour info (quel appareil)
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists push_subscriptions_societe_idx on public.push_subscriptions (societe);
create index if not exists push_subscriptions_user_idx    on public.push_subscriptions (user_id);

-- RLS : isolation par société. Un compte connecté gère (lit/crée/supprime) les abonnements
-- de SA société ; l'Edge Function (service_role) contourne la RLS pour envoyer les push.
alter table public.push_subscriptions enable row level security;
drop policy if exists "tenant_push_subscriptions" on public.push_subscriptions;
create policy "tenant_push_subscriptions" on public.push_subscriptions for all to authenticated
  using ( public.fp_is_admin() or coalesce(societe,'PXP') = public.fp_societe() )
  with check ( public.fp_is_admin() or coalesce(societe,'PXP') = public.fp_societe() );

select tablename, policyname from pg_policies
  where schemaname = 'public' and tablename = 'push_subscriptions';
