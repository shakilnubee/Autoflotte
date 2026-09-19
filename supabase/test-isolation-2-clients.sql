-- ============================================================================
--  TEST D'ISOLATION ENTRE 2 CLIENTS (CLIENT_A vs CLIENT_B)
--  Prouve qu'un client ne peut PAS voir les données d'un autre — au niveau BASE (RLS).
--  À lancer : Supabase → SQL Editor → Run. Rien à installer.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- PARTIE 1 — INSPECTION (lecture seule, zéro risque) :
--   chaque table de données a-t-elle la RLS activée + une policy d'isolation ?
-- ────────────────────────────────────────────────────────────────
select
  t.tablename,
  t.rowsecurity                                   as rls_activee,
  count(p.policyname)                              as nb_policies,
  string_agg(p.policyname, ', ')                   as policies
from pg_tables t
left join pg_policies p on p.schemaname = t.schemaname and p.tablename = t.tablename
where t.schemaname = 'public'
  and t.tablename in ('vehicules','amendes','factures','conducteurs','documents','emprunts',
                      'total_conso','total_conso_tx','ulys_conso','driver_absences',
                      'controle_findings','app_settings','app_settings_history',
                      'qr_scans','km_qr','km_requests','edl_signatures','declarations_conducteur',
                      'push_subscriptions','scans','profiles')
group by t.tablename, t.rowsecurity
order by rls_activee, t.tablename;
--  → rls_activee doit être TRUE partout, et nb_policies ≥ 1.


-- ────────────────────────────────────────────────────────────────
-- PARTIE 2 — TEST NÉGATIF A vs B (transaction ANNULÉE : ne conserve RIEN).
--   Crée 2 clients fictifs (sociétés ISOTEST_A / ISOTEST_B) + 1 véhicule chacun,
--   se met « dans la peau » de chacun, et vérifie qu'aucun ne voit l'autre.
-- ────────────────────────────────────────────────────────────────
begin;
do $$
declare
  uidA uuid := gen_random_uuid();
  uidB uuid := gen_random_uuid();
  a_own int; a_other int; a_total int;
  b_own int; b_other int; b_total int;
begin
  -- Setup (en tant que propriétaire) : 2 comptes, 2 profils clients, 2 véhicules.
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', uidA, 'authenticated', 'authenticated', 'isoA@test.invalid', 'x', now(), now(), now()),
         ('00000000-0000-0000-0000-000000000000', uidB, 'authenticated', 'authenticated', 'isoB@test.invalid', 'x', now(), now(), now());
  insert into public.profiles (id, email, societe, is_admin)
  values (uidA, 'isoA@test.invalid', 'ISOTEST_A', false),
         (uidB, 'isoB@test.invalid', 'ISOTEST_B', false);
  insert into public.vehicules (immat, societe) values ('ISO-A-001', 'ISOTEST_A'), ('ISO-B-001', 'ISOTEST_B');

  -- « Dans la peau » de CLIENT_A (utilisateur authentifié, société ISOTEST_A)
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uidA, 'role', 'authenticated')::text, true);
  select count(*) into a_own   from public.vehicules where societe = 'ISOTEST_A';
  select count(*) into a_other from public.vehicules where societe = 'ISOTEST_B';   -- tentative de voir B
  select count(*) into a_total from public.vehicules;

  -- « Dans la peau » de CLIENT_B
  perform set_config('request.jwt.claims', json_build_object('sub', uidB, 'role', 'authenticated')::text, true);
  select count(*) into b_own   from public.vehicules where societe = 'ISOTEST_B';
  select count(*) into b_other from public.vehicules where societe = 'ISOTEST_A';   -- tentative de voir A
  select count(*) into b_total from public.vehicules;

  perform set_config('role', 'postgres', true);  -- on redevient propriétaire

  raise notice '--- RÉSULTATS ISOLATION ---';
  raise notice 'CLIENT_A voit SES véhicules   : % (attendu 1) %', a_own,  case when a_own=1 then 'OK' else 'PROBLÈME' end;
  raise notice 'CLIENT_A voit ceux de B       : % (attendu 0) %', a_other, case when a_other=0 then 'OK' else 'FUITE !' end;
  raise notice 'CLIENT_A total visible        : % (attendu 1) %', a_total, case when a_total=1 then 'OK' else 'FUITE !' end;
  raise notice 'CLIENT_B voit SES véhicules   : % (attendu 1) %', b_own,  case when b_own=1 then 'OK' else 'PROBLÈME' end;
  raise notice 'CLIENT_B voit ceux de A       : % (attendu 0) %', b_other, case when b_other=0 then 'OK' else 'FUITE !' end;
  raise notice 'CLIENT_B total visible        : % (attendu 1) %', b_total, case when b_total=1 then 'OK' else 'FUITE !' end;
  if a_own=1 and b_own=1 and a_other=0 and b_other=0 and a_total=1 and b_total=1 then
    raise notice '>>> ISOLATION : ✅ PASS — aucun client ne voit les données de l''autre.';
  else
    raise warning '>>> ISOLATION : ❌ ÉCHEC — la RLS laisse passer des données inter-clients !';
  end if;
end $$;
rollback;   -- ⚠️ ANNULE TOUT : les comptes/véhicules de test n'existent plus. Aucune trace.
