-- ============================================================
--  SUIVI CONSOMMATION TOTALENERGIES — par conducteur / véhicule
--  Table dédiée `total_conso` (séparée des factures → ne fausse
--  jamais les totaux comptables). Puis import du détail de mai 2026.
--
--  À exécuter UNE fois dans Supabase → SQL Editor → Run.
--  (Les mois suivants : juste un nouvel INSERT, la table existe déjà.)
-- ============================================================

-- 1) Création de la table (si elle n'existe pas)
create table if not exists public.total_conso (
  id             text primary key,
  mois           text not null,          -- 'YYYY-MM'
  carte          text,                   -- n° carte carburant
  conducteur     text,                   -- nom du porteur (si connu)
  plaque         text,                   -- plaque (si identifiée)
  type_vehicule  text,
  carburant_ttc  numeric default 0,
  litres         numeric default 0,
  boutique_ttc   numeric default 0,      -- alimentation, boissons, sandwich…
  lavage_ttc     numeric default 0,
  peage_ttc      numeric default 0,      -- péages + parkings
  total_ttc      numeric default 0,
  societe        text default 'PXP'
);

-- 2) Sécurité (RLS) : même règle que les autres tables
--    (admin voit tout ; un client ne voit que sa société)
alter table public.total_conso enable row level security;
grant all on public.total_conso to authenticated;
drop policy if exists tenant_total_conso on public.total_conso;
create policy tenant_total_conso on public.total_conso
  for all to authenticated
  using (fp_is_admin() or coalesce(societe,'PXP') = fp_societe())
  with check (fp_is_admin() or coalesce(societe,'PXP') = fp_societe());

-- 3) Import du détail MAI 2026 (idempotent : id = mois + carte)
insert into public.total_conso
  (id, mois, carte, conducteur, plaque, type_vehicule,
   carburant_ttc, litres, boutique_ttc, lavage_ttc, peage_ttc, total_ttc, societe)
values
  ('2026-05-9573', '2026-05', '9573', 'THOMAS HOCQUET', null, '02', 624.75, 309.30, 115.24, 10.90, 0,    750.89, 'PXP'),
  ('2026-05-0041', '2026-05', '0041', 'SHAO HUI',       null, '04', 684.82, 344.08, 0,      0,     0,    684.82, 'PXP'),
  ('2026-05-0100', '2026-05', '0100', 'RAPHAEL',  'FF-777-XK', '02', 589.47, 296.22, 0,      0,     0,    589.47, 'PXP'),
  ('2026-05-9571', '2026-05', '9571', 'BRAM',           null, '02', 297.41, 113.41, 0,      0,     0,    297.41, 'PXP'),
  ('2026-05-9574', '2026-05', '9574', 'CONU',           null, '02', 278.39, 132.05, 0,      0,     0,    278.39, 'PXP'),
  ('2026-05-2895', '2026-05', '2895', 'ROMUALD',        null, '04', 180.22,  90.57, 49.20,  0,     0,    229.42, 'PXP'),
  ('2026-05-9572', '2026-05', '9572', 'PAULINE',        null, '02', 100.65,  49.83, 22.87, 15.70,  0,    139.22, 'PXP'),
  ('2026-05-0006', '2026-05', '0006', 'CHARLES',        null, '02', 110.00,  55.28, 0,      0,     0,    110.00, 'PXP'),
  ('2026-05-0511', '2026-05', '0511', 'NAWELLE',        null, '04',  95.66,  48.07, 0,      0,     0,     95.66, 'PXP'),
  ('2026-05-2023', '2026-05', '2023', 'Sergio PEREIRA', 'GP-333-QJ', '02',  42.01,  21.11, 0,      0,     0,     42.01, 'PXP'),
  ('2026-05-0011', '2026-05', '00011', null,     'GE-349-FZ', '03',   0,       0,    0,      0,    5.30,    5.30, 'PXP'),
  ('2026-05-FRAIS','2026-05', null, 'Frais de gestion TotalEnergies', null, null, 0, 0, 0, 0, 0, 58.04, 'PXP')
on conflict (id) do nothing;

-- 4) Contrôle : doit afficher 12 lignes, total = 3280.63
select count(*) as nb, round(sum(total_ttc),2) as total_ttc
from public.total_conso where mois = '2026-05';
