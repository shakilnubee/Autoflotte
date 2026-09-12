-- ============================================================
--  CONSO ULYS (télépéage VINCI) par conducteur / mois
--  (une ligne = total mensuel d'un conducteur : nb de trajets, km, TTC).
--  Alimentée par l'import CSV/API Ulys et l'import PDF (fleet-views.js).
--
--  ⚠️ SÉCURITÉ MULTI-SOCIÉTÉS : cette table contient des données par
--  conducteur (nom, n° de badge, plaque, montants) = PII + données client.
--  Sans RLS, un compte authentifié d'une société pourrait lire (et via
--  upsert écrire) les consos d'une AUTRE société. Le filtrage côté client
--  (fleet-views.js) N'EST PAS une frontière de sécurité.
--
--  À lancer UNE FOIS dans Supabase → SQL Editor → Run. Idempotent.
--  (Dépend des fonctions fp_is_admin() / fp_societe() déjà créées par
--   les autres scripts RLS — voir supabase/multi-societe-rls.sql.)
-- ============================================================

create table if not exists public.ulys_conso (
  id             text primary key,          -- 'ULYSC-<mois>-<slug conducteur>' (stable → ré-import sans doublon)
  societe        text,
  mois           text,                       -- 'AAAA-MM'
  conducteur     text,
  badge          text,                       -- n° de badge Ulys (rattachement fiable)
  nb_trajets     integer,
  km             numeric,
  total_ttc      numeric,
  numero_facture text,                       -- n° de la facture Ulys d'origine
  created_at     timestamptz default now()
);

create index if not exists ulys_conso_mois_idx    on public.ulys_conso (mois);
create index if not exists ulys_conso_societe_idx on public.ulys_conso (societe);

-- Droits + RLS : chacun lit/écrit les lignes de SA société (l'admin voit tout).
-- MÊME règle que public.total_conso / public.total_conso_tx.
grant all on public.ulys_conso to authenticated;
alter table public.ulys_conso enable row level security;

drop policy if exists tenant_ulys_conso on public.ulys_conso;
create policy tenant_ulys_conso on public.ulys_conso
  for all to authenticated
  using      (fp_is_admin() or coalesce(societe, 'PXP') = fp_societe())
  with check (fp_is_admin() or coalesce(societe, 'PXP') = fp_societe());

-- Vérif : doit renvoyer une ligne
select schemaname, tablename, policyname, cmd
from pg_policies
where tablename = 'ulys_conso';
