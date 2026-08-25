-- ============================================================
--  Parc Pilot — Signature électronique INTÉGRÉE (sans prestataire)  ·  table edl_signatures
-- ============================================================
--  Parc Pilot demande une signature à l'employé (et au signataire société) : chacun reçoit un
--  e-mail avec un LIEN vers une page publique (signer.html) où il DESSINE sa signature. Quand
--  tout le monde a signé, le PDF signé est reconstruit et rangé dans les Documents du véhicule.
--
--  Chaque demande a un TOKEN secret non devinable (dans le lien) — c'est la sécurité (l'employé
--  n'a pas de compte Parc Pilot), comme pour le QR/relevé km. L'Edge Function edl-sign
--  (service_role) résout le token et enregistre les signatures ; les comptes connectés lisent
--  les demandes de LEUR société (suivi).
--
--  À exécuter dans Supabase → SQL Editor → coller → Run.
-- ============================================================

create table if not exists public.edl_signatures (
  token          text primary key,            -- jeton secret (dans le lien de signature)
  vehicule_id    text,
  plaque         text,
  societe        text,
  employe        text,
  modele         text,
  date           text,
  sens           text,                         -- 'remise' | 'restitution'
  pdf_url        text,                         -- PDF NON signé (à faire signer)
  signed_pdf_url text,                         -- PDF final signé (rempli une fois tout signé)
  field_employe  jsonb,                        -- position du champ signature employé {page,x,y,width,height}
  field_societe  jsonb,                        -- position du champ signature société
  signataires    jsonb default '[]'::jsonb,    -- [{role,nom,email,signed,signedAt,ip,sigUrl}]
  statut         text default 'en_attente',    -- 'en_attente' | 'signe'
  created_at     timestamptz default now()
);

create index if not exists edl_signatures_societe_idx  on public.edl_signatures (societe);
create index if not exists edl_signatures_vehicule_idx on public.edl_signatures (vehicule_id);

-- RLS : isolation par société (lecture/suivi par les comptes connectés). L'Edge Function
-- (service_role) contourne la RLS pour résoudre le token et enregistrer les signatures publiques.
alter table public.edl_signatures enable row level security;
drop policy if exists "tenant_edl_signatures" on public.edl_signatures;
create policy "tenant_edl_signatures" on public.edl_signatures for all to authenticated
  using ( public.fp_is_admin() or coalesce(societe,'PXP') = public.fp_societe() )
  with check ( public.fp_is_admin() or coalesce(societe,'PXP') = public.fp_societe() );

select tablename, policyname from pg_policies
  where schemaname = 'public' and tablename = 'edl_signatures';
