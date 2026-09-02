-- ============================================================================
--  Parc Pilot — RELANCE AUTOMATIQUE des relevés km : tâche planifiée (1×/jour)
--
--  Cette tâche appelle chaque matin l'Edge Function `km-relance`, qui renvoie le
--  mail de demande de km aux chauffeurs qui n'ont pas répondu depuis X jours
--  (réglage société « Rappel relevé km » → relance après X jours, défaut 7).
--
--  ⚠️ À FAIRE UNE SEULE FOIS, dans Supabase → SQL Editor. Étapes :
--    1) Crée un secret au hasard (ex. sur https://www.random.org/strings ou
--       `openssl rand -hex 32`). Appelle-le KM_RELANCE_SECRET.
--    2) Supabase → Project Settings → Edge Functions → Secrets :
--         KM_RELANCE_SECRET = <ce même secret>
--       (RESEND_API_KEY / EMAIL_FROM sont déjà là, réutilisés tels quels.)
--    3) Remplace ci-dessous <<KM_RELANCE_SECRET>> par le MÊME secret, puis Run.
--
--  ⚠️ NE COMMITTE JAMAIS le secret réel dans le dépôt (il est PUBLIC). Le fichier
--     versionné garde le placeholder ; la vraie valeur ne vit que dans Supabase.
-- ============================================================================

-- Extensions nécessaires (planificateur + appels HTTP sortants).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- On (re)crée la tâche proprement (idempotent) : on retire l'ancienne si elle existe.
select cron.unschedule('km-relance-quotidienne')
  where exists (select 1 from cron.job where jobname = 'km-relance-quotidienne');

-- Planifie tous les jours à 08:00 UTC (~09:00/10:00 en France selon l'heure d'été).
-- Ajuste le cron si tu veux une autre heure (format : minute heure * * *).
select cron.schedule(
  'km-relance-quotidienne',
  '0 8 * * *',
  $$
  select net.http_post(
    url     := 'https://tzjuptlzoywjeigmyfuj.supabase.co/functions/v1/km-relance',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'x-cron-secret', '<<KM_RELANCE_SECRET>>'
               ),
    body    := jsonb_build_object('dryRun', false)
  );
  $$
);

-- Vérifications utiles :
--   select jobname, schedule, active from cron.job where jobname = 'km-relance-quotidienne';
--   select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname='km-relance-quotidienne') order by start_time desc limit 5;
--
-- Test à blanc (aucun mail envoyé, juste la liste de ce qui SERAIT relancé) :
--   Appelle la fonction avec l'en-tête x-cron-secret et body {"dryRun": true}.
