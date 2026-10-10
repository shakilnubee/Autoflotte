-- ============================================================================
--  Parc Pilot — IMPORT AUTOMATIQUE QUOTIDIEN des factures Ulys : tâche planifiée
--
--  Cette tâche appelle chaque matin l'Edge Function `ulys-daily`, qui :
--    1) récupère les factures Ulys (API VINCI Autoroutes) avec le jeton secret ;
--    2) insère les NOUVELLES dans la table `factures` (anti-doublon par n° de facture) ;
--    3) t'envoie un E-MAIL d'alerte s'il y a du nouveau.
--  → Plus besoin d'ouvrir l'onglet « Contrôle → Ulys » pour que les factures entrent,
--    et tu es prévenu par mail comme le fait Ulys.
--
--  ⚠️ À FAIRE UNE SEULE FOIS, dans Supabase → SQL Editor. Étapes :
--    1) Secret cron : tu peux RÉUTILISER le KM_RELANCE_SECRET que tu as déjà
--       (la fonction accepte KM_RELANCE_SECRET **ou** ULYS_DAILY_SECRET).
--       Sinon, crée ULYS_DAILY_SECRET (Supabase → Edge Functions → Secrets).
--    2) (option) Supabase → Edge Functions → Secrets :
--         ULYS_ALERT_TO = ton e-mail (ex. shakil.nubee@projectxparis.fr).
--                         Si absent, l'alerte part à l'adresse d'envoi de la société.
--       (ULYS_BEARER / ULYS_INITIATOR / RESEND_API_KEY / EMAIL_FROM sont déjà là.)
--    3) Remplace ci-dessous <<CRON_SECRET>> par le secret choisi à l'étape 1, puis Run.
--
--  ⚠️ NE COMMITTE JAMAIS le secret réel (dépôt PUBLIC). Le fichier versionné garde le
--     placeholder ; la vraie valeur ne vit que dans Supabase.
-- ============================================================================

-- Extensions nécessaires (planificateur + appels HTTP sortants).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- On (re)crée la tâche proprement (idempotent) : on retire l'ancienne si elle existe.
select cron.unschedule('ulys-import-quotidien')
  where exists (select 1 from cron.job where jobname = 'ulys-import-quotidien');

-- Planifie tous les jours à 06:30 UTC (~07:30/08:30 en France selon l'heure d'été).
-- Ajuste le cron si tu veux une autre heure (format : minute heure * * *).
select cron.schedule(
  'ulys-import-quotidien',
  '30 6 * * *',
  $$
  select net.http_post(
    url     := 'https://tzjuptlzoywjeigmyfuj.supabase.co/functions/v1/ulys-daily',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'x-cron-secret', '<<CRON_SECRET>>'
               ),
    body    := jsonb_build_object('dryRun', false)
  );
  $$
);

-- Vérifications utiles :
--   select jobname, schedule, active from cron.job where jobname = 'ulys-import-quotidien';
--   select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname='ulys-import-quotidien') order by start_time desc limit 5;
--
-- Test à blanc (rien n'est écrit ni envoyé — juste la liste de ce qui SERAIT importé) :
--   Appelle la fonction avec l'en-tête x-cron-secret et body {"dryRun": true}.
--   Ou, connecté en CEO dans l'app, laisse le JWT faire foi.
