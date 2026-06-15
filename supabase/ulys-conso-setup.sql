-- ============================================================
--  SUIVI PÉAGES ULYS — par conducteur (badge)
--  Table dédiée `ulys_conso` (séparée des factures → ne fausse
--  jamais les totaux comptables), même logique que `total_conso`.
--
--  À exécuter UNE fois dans Supabase → SQL Editor → Run.
--  (Les mois suivants : juste un nouvel INSERT, la table existe déjà.)
-- ============================================================

-- 1) Table
create table if not exists public.ulys_conso (
  id              text primary key,
  mois            text not null,        -- 'YYYY-MM'
  conducteur      text,                 -- porteur du badge
  nb_trajets      int default 0,
  km              numeric default 0,
  total_ttc       numeric default 0,
  numero_facture  text,
  societe         text default 'PXP'
);

-- 2) Sécurité (RLS) : même règle que les autres tables (admin voit tout ; un client ne voit que sa société)
alter table public.ulys_conso enable row level security;
grant all on public.ulys_conso to authenticated;
drop policy if exists tenant_ulys_conso on public.ulys_conso;
create policy tenant_ulys_conso on public.ulys_conso
  for all to authenticated
  using (fp_is_admin() or coalesce(societe,'PXP') = fp_societe())
  with check (fp_is_admin() or coalesce(societe,'PXP') = fp_societe());

-- 3) Détail péages par conducteur (janvier → avril 2026) — idempotent (id = mois + conducteur)
insert into public.ulys_conso (id, mois, conducteur, nb_trajets, km, total_ttc, numero_facture, societe) values
  ('ULYSC-2026-01-CHARLES', '2026-01', 'Charles', 19, 1380.2, 170.40, 'MA02722987', 'PXP'),
  ('ULYSC-2026-01-GUERRIC', '2026-01', 'Guerric', 10, 1057.0, 100.80, 'MA02722987', 'PXP'),
  ('ULYSC-2026-01-PAULINE', '2026-01', 'Pauline', 2, 321.2, 32.40, 'MA02722987', 'PXP'),
  ('ULYSC-2026-01-ROMUALD', '2026-01', 'Romuald', 14, 1435.4, 195.40, 'MA02722987', 'PXP'),
  ('ULYSC-2026-01-THOMAS', '2026-01', 'Thomas', 36, 2941.8, 359.70, 'MA02722987', 'PXP'),
  ('ULYSC-2026-02-CHARLES', '2026-02', 'Charles', 20, 1900.5, 225.30, 'MB02713520', 'PXP'),
  ('ULYSC-2026-02-GUERRIC', '2026-02', 'Guerric', 21, 1094.0, 146.60, 'MB02713520', 'PXP'),
  ('ULYSC-2026-02-PAULINE', '2026-02', 'Pauline', 8, 1019.4, 109.00, 'MB02713520', 'PXP'),
  ('ULYSC-2026-02-ROMUALD', '2026-02', 'Romuald', 16, 1216.6, 158.00, 'MB02713520', 'PXP'),
  ('ULYSC-2026-02-SERGIO', '2026-02', 'Sergio', 5, 500.7, 77.20, 'MB02713520', 'PXP'),
  ('ULYSC-2026-02-THOMAS', '2026-02', 'Thomas', 42, 2448.7, 279.70, 'MB02713520', 'PXP'),
  ('ULYSC-2026-03-AHMED', '2026-03', 'Ahmed', 4, 511.6, 54.80, 'MC02694265', 'PXP'),
  ('ULYSC-2026-03-CHARLES', '2026-03', 'Charles', 20, 1769.0, 184.10, 'MC02694265', 'PXP'),
  ('ULYSC-2026-03-EUGENIE', '2026-03', 'Eugénie', 31, 1692.6, 233.50, 'MC02694265', 'PXP'),
  ('ULYSC-2026-03-GUERRIC', '2026-03', 'Guerric', 24, 1919.9, 177.30, 'MC02694265', 'PXP'),
  ('ULYSC-2026-03-PAULINE', '2026-03', 'Pauline', 11, 966.0, 110.20, 'MC02694265', 'PXP'),
  ('ULYSC-2026-03-ROMUALD', '2026-03', 'Romuald', 22, 1763.0, 219.50, 'MC02694265', 'PXP'),
  ('ULYSC-2026-03-SAMIRA', '2026-03', 'Samira', 2, 0.0, 56.90, 'MC02694265', 'PXP'),
  ('ULYSC-2026-03-SERGIO', '2026-03', 'Sergio', 7, 136.0, 196.00, 'MC02694265', 'PXP'),
  ('ULYSC-2026-03-THOMAS', '2026-03', 'Thomas', 36, 2294.6, 268.00, 'MC02694265', 'PXP'),
  ('ULYSC-2026-04-AHMED', '2026-04', 'Ahmed', 9, 655.5, 70.50, 'MD02920111', 'PXP'),
  ('ULYSC-2026-04-CHARLES', '2026-04', 'Charles', 2, 0.0, 9.40, 'MD02920111', 'PXP'),
  ('ULYSC-2026-04-EUGENIE', '2026-04', 'Eugénie', 30, 2143.4, 272.40, 'MD02920111', 'PXP'),
  ('ULYSC-2026-04-GUERRIC', '2026-04', 'Guerric', 19, 2081.4, 204.30, 'MD02920111', 'PXP'),
  ('ULYSC-2026-04-PAULINE', '2026-04', 'Pauline', 9, 869.5, 116.20, 'MD02920111', 'PXP'),
  ('ULYSC-2026-04-ROMUALD', '2026-04', 'Romuald', 31, 2082.2, 267.90, 'MD02920111', 'PXP'),
  ('ULYSC-2026-04-SAMIRA', '2026-04', 'Samira', 2, 184.6, 23.90, 'MD02920111', 'PXP'),
  ('ULYSC-2026-04-SERGIO', '2026-04', 'Sergio', 26, 829.8, 137.90, 'MD02920111', 'PXP'),
  ('ULYSC-2026-04-THOMAS', '2026-04', 'Thomas', 20, 1708.7, 186.50, 'MD02920111', 'PXP')
on conflict (id) do nothing;
