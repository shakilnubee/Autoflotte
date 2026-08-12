-- ============================================================
--  Parc Pilot — PORTAIL CONDUCTEUR (via le QR véhicule)  ·  table declarations_conducteur
-- ============================================================
--  Le conducteur scanne le QR de sa voiture (page v.html) → menu. Depuis « Déclarer un
--  sinistre / problème » il remplit un formulaire (date, lieu, description, tiers, photos).
--  L'envoi crée une ligne ici. Ces demandes s'affichent EN TÊTE de l'onglet Sinistres, et
--  une alerte prévient le gestionnaire à chaque nouvelle demande.
--
--  Écriture = Edge Function km-collect (service_role, scopée par le TOKEN du véhicule) ; le
--  conducteur n'a pas de compte. Lecture = comptes de la MÊME société (RLS tenant, comme le
--  reste de la plateforme).
--
--  À exécuter dans Supabase → SQL Editor → coller → Run (une seule fois).
-- ============================================================

create table if not exists public.declarations_conducteur (
  id            text primary key,
  vehicule_id   text,
  plaque        text,
  societe       text,
  type          text,                       -- 'sinistre' | 'probleme'
  date_incident text,                        -- date/heure saisie par le conducteur (texte libre court)
  lieu          text,
  description   text,
  tiers         text,                        -- tiers impliqué (plaque, assureur, nom)
  blesses       text,                        -- 'oui' | 'non' | précisions
  photos        jsonb default '[]'::jsonb,   -- URLs des photos (bucket scans)
  statut        text default 'nouveau',      -- 'nouveau' | 'traite'
  sinistre_id   text,                        -- rempli si le gestionnaire en a fait un vrai sinistre
  created_at    timestamptz default now()
);

create index if not exists decl_cond_societe_idx on public.declarations_conducteur (societe);
create index if not exists decl_cond_statut_idx  on public.declarations_conducteur (statut);
create index if not exists decl_cond_vehicule_idx on public.declarations_conducteur (vehicule_id);

-- RLS : même isolation par société que le reste (lecture/maj par les comptes de la société ;
-- l'Edge Function service_role contourne la RLS pour insérer la déclaration du conducteur).
alter table public.declarations_conducteur enable row level security;
drop policy if exists "tenant_declarations_conducteur" on public.declarations_conducteur;
create policy "tenant_declarations_conducteur" on public.declarations_conducteur for all to authenticated
  using ( public.fp_is_admin() or coalesce(societe,'PXP') = public.fp_societe() )
  with check ( public.fp_is_admin() or coalesce(societe,'PXP') = public.fp_societe() );

select tablename, policyname from pg_policies
  where schemaname = 'public' and tablename = 'declarations_conducteur';
