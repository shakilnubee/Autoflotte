-- ============================================================
--  Parc Pilot — Collecte du kilométrage par e-mail  ·  table km_requests
-- ============================================================
--  Principe : l'admin/gestionnaire envoie au chauffeur un e-mail contenant un
--  LIEN PERSONNEL (token secret). Le chauffeur clique → mini-formulaire (km.html)
--  → il saisit son km → l'Edge Function `km-collect` (clé service_role, côté
--  serveur) enregistre le relevé et met à jour la fiche véhicule.
--
--  Le token est la CLÉ D'ACCÈS (non devinable) : la page km.html est publique
--  (le chauffeur n'a pas de compte Parc Pilot).
--
--  À exécuter dans Supabase → SQL Editor → coller → Run.
-- ============================================================

create table if not exists public.km_requests (
  id          uuid primary key default gen_random_uuid(),
  token       text unique not null,          -- clé secrète du lien
  vehicule_id text,                           -- id de la fiche véhicule (référence libre)
  plaque      text,
  societe     text,
  chauffeur   text,
  email       text,                           -- destinataire de la demande
  km_avant    integer,                        -- km connu au moment de l'envoi (repère)
  km_recu     integer,                        -- km saisi par le chauffeur
  created_at  timestamptz default now(),
  sent_at     timestamptz,                    -- date d'envoi de l'e-mail
  expires_at  timestamptz,                    -- au-delà, le lien ne fonctionne plus
  used_at     timestamptz                     -- date de saisie (NULL = pas encore répondu)
);

create index if not exists km_requests_societe_idx  on public.km_requests (societe);
create index if not exists km_requests_vehicule_idx on public.km_requests (vehicule_id);
create index if not exists km_requests_token_idx    on public.km_requests (token);

-- RLS : même isolation par société que les autres tables.
--   Les comptes connectés (admin/gestionnaire) créent/lisent les demandes de LEUR société.
--   L'Edge Function `km-collect` utilise la clé service_role → elle contourne la RLS
--   (c'est elle, et elle seule, qui valide le token et écrit le km reçu).
alter table public.km_requests enable row level security;
drop policy if exists "tenant_km_requests" on public.km_requests;
create policy "tenant_km_requests" on public.km_requests for all to authenticated
  using ( public.fp_is_admin() or coalesce(societe,'PXP') = public.fp_societe() )
  with check ( public.fp_is_admin() or coalesce(societe,'PXP') = public.fp_societe() );

-- Vérification
select tablename, policyname from pg_policies
  where schemaname = 'public' and tablename = 'km_requests';
