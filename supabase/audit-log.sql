-- ============================================================
--  Journal d'audit PARTAGÉ (historique des modifications)
--  Aujourd'hui le journal (Paramètres → Journal des modifications)
--  est stocké dans le navigateur → propre à chaque PC. Cette table
--  le rend PARTAGÉ entre tous les postes, isolé par société, et
--  inviolable (pas de modification, suppression réservée aux admins).
--
--  Prérequis : les fonctions fp_is_admin() / fp_societe() existent déjà
--  (créées par multi-societe-rls.sql).
--
--  À lancer dans Supabase → SQL Editor → Run.
-- ============================================================

create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  ts         timestamptz not null default now(),
  user_email text,
  action     text,          -- ajout / modification / suppression / ajout ou mise à jour
  entity     text,          -- table concernée (vehicules, amendes, factures…)
  rec_id     text,          -- id de l'enregistrement
  label      text,          -- description lisible (immat, prénom, fournisseur…)
  champs     text,          -- champs modifiés (pour une modification)
  societe    text not null default coalesce(public.fp_societe(), 'PXP')
);

create index if not exists audit_log_soc_ts on public.audit_log (societe, ts desc);

alter table public.audit_log enable row level security;

-- Lecture : admin → tout ; sinon → uniquement sa société.
drop policy if exists "audit_read" on public.audit_log;
create policy "audit_read" on public.audit_log for select to authenticated
  using ( public.fp_is_admin() or coalesce(societe,'PXP') = public.fp_societe() );

-- Insertion : chacun journalise dans le périmètre de sa société (admin = tout).
drop policy if exists "audit_insert" on public.audit_log;
create policy "audit_insert" on public.audit_log for insert to authenticated
  with check ( public.fp_is_admin() or coalesce(societe,'PXP') = public.fp_societe() );

-- Suppression : réservée aux ADMINS/CEO (un gestionnaire ne peut pas effacer l'historique).
--  (Pas de policy UPDATE → les entrées sont inviolables.)
drop policy if exists "audit_delete" on public.audit_log;
create policy "audit_delete" on public.audit_log for delete to authenticated
  using ( public.fp_is_admin() );

-- Vérification
select count(*) as entrees from public.audit_log;
