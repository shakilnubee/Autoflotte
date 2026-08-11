-- ============================================================
--  PARC PILOT — Table « scans » (traçabilité du Scanner IA v2)
--  À COLLER dans Supabase → SQL Editor → Run (une seule fois).
--  Conserve, pour chaque document analysé : le type détecté, le JSON brut
--  d'extraction (champs + provenance + confiance), les anomalies, la qualité,
--  et ce qui a été enregistré. Isolé PAR SOCIÉTÉ (RLS), comme les autres tables.
-- ============================================================

create table if not exists public.scans (
  id           text primary key,
  societe      text not null default 'PXP',
  type_document text,
  sous_type    text,
  statut       text default 'a_valider',        -- 'a_valider' | 'valide' | 'ignore'
  qualite      text,                              -- 'bonne' | 'moyenne' | 'insuffisante'
  fichier_url  text,                              -- lien du document dans le bucket 'scans' (optionnel)
  extraction   jsonb,                             -- JSON complet (champs[], anomalies[], champs_manquants[]…)
  cible_table  text,                              -- table métier où l'élément validé a été enregistré
  cible_id     text,                              -- id de l'enregistrement créé/mis à jour
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid()
);

create index if not exists scans_societe_idx on public.scans (societe);
create index if not exists scans_created_idx on public.scans (created_at desc);

alter table public.scans enable row level security;

-- Isolation par société : réutilise les helpers déjà en place (fp_societe / fp_is_admin).
-- (Mêmes fonctions que les policies tenant_* des autres tables.)
drop policy if exists tenant_scans on public.scans;
create policy tenant_scans on public.scans
  for all
  using ( fp_is_admin() or societe = fp_societe() )
  with check ( fp_is_admin() or societe = fp_societe() );

-- Fin. (Le bucket 'scans' existe déjà pour les documents ; aucun autre changement requis.)
