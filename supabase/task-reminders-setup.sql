-- ============================================================================
--  Parc Pilot — RAPPELS PUSH des TÂCHES : table anti-doublon + tâche planifiée
--
--  À EXÉCUTER UNE SEULE FOIS dans Supabase → SQL Editor (copier-coller → Run).
--  Prérequis déjà en place pour d'autres fonctions (rien de nouveau à créer) :
--    • Secrets VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT  (push, déjà là pour km-collect)
--    • Secret KM_RELANCE_SECRET  (réutilisé ici comme x-cron-secret → PAS besoin d'un nouveau secret)
--      Si tu préfères un secret dédié, crée TASK_REMINDERS_SECRET et mets-le ci-dessous à la place.
--
--  ⚠️ NE COMMITTE JAMAIS le secret réel (le dépôt est PUBLIC). Le fichier versionné garde le
--     placeholder ; la vraie valeur ne vit que dans Supabase.
-- ============================================================================

-- 1) Table d'anti-doublon : une ligne par notification déjà envoyée (clé unique). Empêche
--    d'envoyer deux fois le même rappel, même si le cron tourne souvent / rattrape un retard.
create table if not exists public.push_log (
  dedup_key   text primary key,         -- ex. 'digest:PXP:2026-10-14' ou 'lead:T3f9a1:2026-10-14T09:30:3'
  societe     text,
  created_at  timestamptz default now()
);
create index if not exists push_log_created_idx on public.push_log (created_at);

-- RLS : écrite UNIQUEMENT par l'Edge Function (service_role, qui contourne la RLS). Aucune
-- policy pour les comptes `authenticated` → le client ne peut ni lire ni écrire cette table
-- technique (ce n'est pas une donnée métier).
alter table public.push_log enable row level security;

-- 2) Extensions (planificateur + appels HTTP sortants) — idempotent.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 3) (Re)création propre de la tâche planifiée (idempotent).
select cron.unschedule('task-reminders')
  where exists (select 1 from cron.job where jobname = 'task-reminders');

-- Toutes les 30 minutes : assez fin pour un rappel « quelques heures avant » un rendez-vous, et
-- pour envoyer le résumé du jour peu après l'heure réglée (défaut 08:00 Paris). La fonction gère
-- elle-même l'anti-doublon → aucun risque de notification en double.
select cron.schedule(
  'task-reminders',
  '*/30 * * * *',
  $$
  select net.http_post(
    url     := 'https://tzjuptlzoywjeigmyfuj.supabase.co/functions/v1/task-reminders',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'x-cron-secret', '<<KM_RELANCE_SECRET>>'
               ),
    body    := jsonb_build_object('dryRun', false)
  );
  $$
);

-- Vérifications utiles :
--   select jobname, schedule, active from cron.job where jobname = 'task-reminders';
--   select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname='task-reminders') order by start_time desc limit 5;
--
-- Test à blanc (n'envoie rien, liste ce qui PARTIRAIT) : appelle la fonction avec l'en-tête
--   x-cron-secret et body {"dryRun": true}.
