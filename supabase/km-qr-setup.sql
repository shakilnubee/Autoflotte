-- ============================================================
--  Parc Pilot — QR code « relevé km » collé DANS chaque véhicule  ·  table km_qr
-- ============================================================
--  Chaque véhicule a un QR PERMANENT (à imprimer et coller dans la voiture). Le chauffeur
--  le scanne → la page km.html s'ouvre, déjà verrouillée sur SON véhicule (plaque affichée,
--  non modifiable) → il saisit UNIQUEMENT son kilométrage. Impossible de se tromper de véhicule.
--
--  Le QR encode un TOKEN permanent non devinable (≠ id « V-001 » énumérable). Cette table fait
--  la correspondance token → véhicule, lue côté serveur par l'Edge Function km-collect (service_role).
--
--  À exécuter dans Supabase → SQL Editor → coller → Run.
-- ============================================================

create table if not exists public.km_qr (
  token       text primary key,             -- jeton permanent du QR (dans l'URL)
  vehicule_id text,
  plaque      text,
  societe     text,
  created_at  timestamptz default now()
);

create index if not exists km_qr_vehicule_idx on public.km_qr (vehicule_id);
create index if not exists km_qr_societe_idx  on public.km_qr (societe);

-- Colonne « source » sur km_requests : 'qr' pour un relevé scanné, NULL/'mail' pour un lien e-mail.
-- Permet au suivi « Relevé KM » de distinguer le canal.
alter table public.km_requests add column if not exists source text;

-- RLS : même isolation par société. Les comptes connectés (admin/gestionnaire) créent/lisent
-- les QR de LEUR société ; l'Edge Function (service_role) contourne la RLS pour résoudre le token.
alter table public.km_qr enable row level security;
drop policy if exists "tenant_km_qr" on public.km_qr;
create policy "tenant_km_qr" on public.km_qr for all to authenticated
  using ( public.fp_is_admin() or coalesce(societe,'PXP') = public.fp_societe() )
  with check ( public.fp_is_admin() or coalesce(societe,'PXP') = public.fp_societe() );

select tablename, policyname from pg_policies
  where schemaname = 'public' and tablename = 'km_qr';
