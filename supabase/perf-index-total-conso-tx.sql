-- ⚡ PERFORMANCE — Contrôle (Parc Pilot)
-- La page Contrôle lit total_conso_tx filtré par société (RLS) + date (24 derniers mois).
-- Sans index, PostgreSQL parcourt TOUTE la table à chaque ouverture → latence qui EMPIRE avec le temps.
-- Ces index rendent la lecture quasi instantanée. Opération one-shot, sûre, réversible.
--
-- À lancer UNE FOIS : Supabase → SQL Editor → coller → Run (quelques secondes).

create index if not exists idx_total_conso_tx_soc_date
  on public.total_conso_tx (societe, date_tx);

-- Repli si la colonne societe n'existe pas sur cette table (ignore l'erreur le cas échéant) :
create index if not exists idx_total_conso_tx_date
  on public.total_conso_tx (date_tx);

-- Détail Ulys (péages) : même logique, plus petit mais utile.
create index if not exists idx_ulys_conso_soc_mois
  on public.ulys_conso (societe, mois);
