-- ============================================================
--  CACHE SERVEUR DES « TROUVAILLES » DU CONTRÔLE (Option C)
--
--  But : la page Contrôle (pages/controle.html) affiche INSTANTANÉMENT le
--  résultat déjà calculé (stocké ici, une ligne par société) au lieu de tout
--  recalculer dans le navigateur à chaque visite. Le calcul (buildFindings)
--  reste la MÊME logique unique côté client ; on ne fait que PARTAGER son
--  résultat entre appareils + éviter de re-télécharger toutes les dépenses
--  quand rien n'a changé (comparaison de signatures).
--
--  ⚠️ NE TOUCHE À AUCUNE DONNÉE EXISTANTE. C'est un simple cache recalculable :
--     si cette table est vidée, la page recalcule et la re-remplit toute seule.
--
--  À lancer UNE FOIS : Supabase → SQL Editor → coller → Run. Idempotent.
-- ============================================================

create table if not exists public.controle_findings (
  societe    text primary key,          -- une ligne par société (clé = société active ; '__all__' pour la vue CEO globale)
  sig        text,                       -- signature LOGIQUE + DONNÉES du dernier calcul (invalide le cache si une règle ou une donnée change)
  probe_sig  text,                       -- signature LÉGÈRE (comptes/derniers relevés agrégés) : sait, SANS tout télécharger, si le résultat est encore à jour
  findings   jsonb,                      -- le résultat prêt (liste des trouvailles, champs utiles à l'affichage)
  updated_at timestamptz default now()
);

-- Droits + RLS : chacun lit/écrit UNIQUEMENT la ligne de SA société (l'admin/CEO voit tout).
-- MÊME règle que public.total_conso_tx (isolation multi-sociétés).
grant all on public.controle_findings to authenticated;
alter table public.controle_findings enable row level security;

drop policy if exists tenant_controle_findings on public.controle_findings;
create policy tenant_controle_findings on public.controle_findings
  for all to authenticated
  using      (fp_is_admin() or coalesce(societe, 'PXP') = fp_societe())
  with check (fp_is_admin() or coalesce(societe, 'PXP') = fp_societe());

-- Vérif : doit renvoyer une ligne (la policy créée)
select schemaname, tablename, policyname, cmd
from pg_policies
where tablename = 'controle_findings';
