-- ============================================================
--  Parc Pilot — Formulaire ACHETEUR (offres d'achat d'un véhicule)  ·  table offres_achat
-- ============================================================
--  Quand un véhicule est à vendre, le gestionnaire envoie à l'acheteur intéressé un LIEN public
--  (offre-achat.html?t=<token>) où celui-ci remplit ses coordonnées (particulier OU société —
--  exactement les champs de la déclaration de cession / Cerfa). À l'envoi :
--    • le gestionnaire reçoit une ALERTE (push + e-mail + alerte in-app) ;
--    • la demande est rangée dans Contrats → Archive (consultable, triable).
--
--  Comme pour la signature d'état des lieux (edl_signatures) : l'acheteur n'a PAS de compte,
--  la sécurité = le TOKEN secret du lien. L'Edge Function offre-achat (service_role) résout le
--  token et enregistre la demande ; les comptes connectés lisent les demandes de LEUR société.
--
--  Deux types de lignes dans cette table :
--    • statut='lien'    → 1 ligne par véhicule : définit le token du lien (pas encore de données acheteur) ;
--    • statut='recu'    → 1 ligne par formulaire REMPLI (les coordonnées de l'acheteur). Ensuite le
--                         gestionnaire peut la passer en 'archive' depuis Contrats → Archive.
--
--  À exécuter dans Supabase → SQL Editor → coller → Run.
-- ============================================================

create table if not exists public.offres_achat (
  id             text primary key,             -- id de ligne
  token          text,                         -- jeton secret du lien (commun au véhicule : lien + demandes reçues)
  vehicule_id    text,
  plaque         text,
  marque         text,
  modele         text,
  prix           numeric,                      -- prix visé (instantané au moment du lien)
  societe        text,
  type_acheteur  text,                         -- 'particulier' | 'societe' (null pour la ligne 'lien')
  acheteur       jsonb,                        -- toutes les coordonnées saisies (nom, adresse, SIREN, représentant…)
  notes          text,                         -- note interne du gestionnaire (facultatif)
  statut         text default 'lien',          -- 'lien' | 'recu' | 'archive'
  ip             text,
  received_at    timestamptz,                  -- quand le formulaire a été rempli
  created_at     timestamptz default now()
);

create index if not exists offres_achat_societe_idx  on public.offres_achat (societe);
create index if not exists offres_achat_vehicule_idx on public.offres_achat (vehicule_id);
create index if not exists offres_achat_token_idx     on public.offres_achat (token);
create index if not exists offres_achat_statut_idx    on public.offres_achat (statut);

-- RLS : isolation par société (lecture/suivi par les comptes connectés). L'Edge Function
-- (service_role) contourne la RLS pour résoudre le token et enregistrer les demandes publiques.
alter table public.offres_achat enable row level security;
drop policy if exists "tenant_offres_achat" on public.offres_achat;
create policy "tenant_offres_achat" on public.offres_achat for all to authenticated
  using ( public.fp_is_admin() or coalesce(societe,'PXP') = public.fp_societe() )
  with check ( public.fp_is_admin() or coalesce(societe,'PXP') = public.fp_societe() );

-- Recharge le cache de schéma PostgREST (sinon les nouvelles colonnes ne sont pas vues tout de suite).
notify pgrst, 'reload schema';

select tablename, policyname from pg_policies
  where schemaname = 'public' and tablename = 'offres_achat';
