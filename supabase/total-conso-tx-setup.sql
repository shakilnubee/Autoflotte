-- ============================================================
--  DÉTAIL TRANSACTION PAR TRANSACTION des factures Total Fleet
--  (une ligne = un achat : carburant, repas, lavage, péage, "autre" comme
--   une bonbonne de gaz…). Sert à détecter les abus au JOUR et à l'ARTICLE.
--
--  À lancer UNE FOIS dans Supabase → SQL Editor → Run. Idempotent.
--  Ensuite : ré-importer les relevés Total (le détail se remplit tout seul).
-- ============================================================

create table if not exists public.total_conso_tx (
  id           text primary key,           -- <facnum>-<index> (stable → ré-import = pas de doublon)
  societe      text,
  mois         text,                        -- 'AAAA-MM'
  date_tx      date,                        -- date de l'achat
  carte        text,
  conducteur   text,
  plaque       text,
  produit      text,                        -- libellé Total (ex. « Bouteille Gaz », « Sandwich »)
  categorie    text,                        -- carburant | repas | lavage | parking | autre
  montant_ttc  numeric,
  facnum       text,                        -- n° de la facture d'origine (pour rouvrir le PDF)
  created_at   timestamptz default now()
);

create index if not exists total_conso_tx_mois_idx on public.total_conso_tx (mois);
create index if not exists total_conso_tx_facnum_idx on public.total_conso_tx (facnum);

-- Droits + RLS : chacun lit/écrit les lignes de SA société (l'admin voit tout).
-- MÊME règle que public.total_conso.
grant all on public.total_conso_tx to authenticated;
alter table public.total_conso_tx enable row level security;

drop policy if exists tenant_total_conso_tx on public.total_conso_tx;
create policy tenant_total_conso_tx on public.total_conso_tx
  for all to authenticated
  using      (fp_is_admin() or coalesce(societe, 'PXP') = fp_societe())
  with check (fp_is_admin() or coalesce(societe, 'PXP') = fp_societe());

-- Vérif : doit renvoyer une ligne
select schemaname, tablename, policyname, cmd
from pg_policies
where tablename = 'total_conso_tx';
