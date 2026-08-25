-- ============================================================
--  Parc Pilot — Journal des SCANS du QR véhicule  ·  table qr_scans
-- ============================================================
--  Chaque fois qu'un conducteur SCANNE le QR collé dans la voiture (ouverture du portail v.html
--  ou de la page relevé km), on enregistre ici un événement daté : quand + quel véhicule.
--  Sert à afficher « Dernier scan : … » sur la fiche véhicule (via la modale QR) et à envoyer
--  une notification push au gestionnaire.
--
--  ⚠️ Un QR n'a PAS de connexion (le conducteur n'a pas de compte) → on ne connaît PAS l'identité
--     exacte de la personne, seulement le véhicule concerné et l'heure. (RGPD : aucune PII ici.)
--
--  Anti-spam : l'Edge Function n'insère PAS un nouvel événement si le même véhicule a déjà été
--  scanné dans les 20 dernières minutes (une même personne qui navigue = un seul scan).
--
--  À exécuter dans Supabase → SQL Editor → coller → Run.
-- ============================================================

create table if not exists public.qr_scans (
  id          uuid primary key default gen_random_uuid(),
  vehicule_id text,
  plaque      text,
  societe     text,
  mode        text,                 -- 'portail' (v.html) ou 'km' (page relevé km)
  user_agent  text,                 -- pour info (type d'appareil), pas d'identité
  scanned_at  timestamptz default now()
);

create index if not exists qr_scans_vehicule_idx on public.qr_scans (vehicule_id, scanned_at desc);
create index if not exists qr_scans_societe_idx  on public.qr_scans (societe, scanned_at desc);

-- RLS : isolation par société. Les comptes connectés (admin/gestionnaire) LISENT les scans de LEUR
-- société ; l'Edge Function (service_role) INSÈRE (elle contourne la RLS).
alter table public.qr_scans enable row level security;
drop policy if exists "tenant_qr_scans" on public.qr_scans;
create policy "tenant_qr_scans" on public.qr_scans for all to authenticated
  using ( public.fp_is_admin() or coalesce(societe,'PXP') = public.fp_societe() )
  with check ( public.fp_is_admin() or coalesce(societe,'PXP') = public.fp_societe() );

select tablename, policyname from pg_policies
  where schemaname = 'public' and tablename = 'qr_scans';
