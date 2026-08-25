-- ============================================================
--  Parc Pilot — CORRECTIF : rendre à un GESTIONNAIRE l'écriture de app_settings
--  (annule l'effet de bord du durcissement du 2026-07-30).
-- ============================================================
--  PROBLÈME (remonté en prod) : un gestionnaire recevait
--     « new row violates row-level security policy for table "app_settings" »
--  en faisant des opérations NORMALES (affecter un conducteur, marquer une
--  immobilisation, saisir un km, cocher une checklist de restitution, régler
--  le montant payé d'une amende…). Ces DONNÉES DE TRAVAIL sont stockées dans
--  app_settings (même ligne que la config société). Le durcissement bloquait
--  TOUTE écriture app_settings par un gestionnaire → il bloquait aussi ces
--  opérations légitimes, pas seulement la config.
--
--  DÉCISION : on rétablit l'écriture app_settings pour tout compte de la société
--  (gestionnaire inclus). La CONFIG SOCIÉTÉ reste réservée à l'admin AU NIVEAU
--  DE L'INTERFACE : les écrans de config sont verrouillés par FP.canManageSociete()
--  et les boutons « Enregistrer » de la config sont masqués pour un gestionnaire
--  (cf. gateParamForGestionnaire dans pages/parametres.html). C'est le même modèle
--  de protection que le reste de la plateforme (« tout se fait depuis le site »,
--  droits par rôle appliqués dans l'app).
--
--  À exécuter dans Supabase → SQL Editor → coller → Run.
-- ============================================================

alter table public.app_settings enable row level security;

-- On repart de zéro (supprime les 3 variantes possibles) puis on recrée la policy
-- permissive « par société » (lecture + écriture pour l'admin ou la société courante).
drop policy if exists "app_settings_read"   on public.app_settings;
drop policy if exists "app_settings_write"  on public.app_settings;
drop policy if exists "tenant_app_settings" on public.app_settings;

create policy "tenant_app_settings" on public.app_settings for all to authenticated
  using      ( public.fp_is_admin() or id = public.fp_societe() )
  with check ( public.fp_is_admin() or id = public.fp_societe() );

-- Vérif : doit lister une seule policy « tenant_app_settings » en cmd = ALL.
select policyname, cmd from pg_policies
  where schemaname = 'public' and tablename = 'app_settings'
  order by policyname;
