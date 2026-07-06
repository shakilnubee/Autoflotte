-- ============================================================
--  Garantit que l'écriture de la CONSO (total_conso) fonctionne
--  depuis le site (import Total Fleet), sans passer par un script.
--  Idempotent — à exécuter UNE fois dans Supabase -> SQL Editor -> Run.
-- ============================================================

-- 1) Colonnes HT / TVA (au cas où elles manqueraient) — l'app les envoie.
alter table public.total_conso add column if not exists total_ht  numeric;
alter table public.total_conso add column if not exists total_tva numeric;

-- 2) Droits + RLS : l'utilisateur connecté peut lire ET écrire les lignes
--    de SA société (l'admin voit/écrit tout). Même règle que les autres tables.
grant all on public.total_conso to authenticated;
alter table public.total_conso enable row level security;

drop policy if exists tenant_total_conso on public.total_conso;
create policy tenant_total_conso on public.total_conso
  for all to authenticated
  using      (fp_is_admin() or coalesce(societe, 'PXP') = fp_societe())
  with check (fp_is_admin() or coalesce(societe, 'PXP') = fp_societe());

-- 3) Vérif rapide : doit renvoyer une ligne (la policy est bien en place)
select schemaname, tablename, policyname, cmd
from pg_policies
where tablename = 'total_conso';
