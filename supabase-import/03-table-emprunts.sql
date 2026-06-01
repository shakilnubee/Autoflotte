-- ============================================================================
-- Auto-flotte — table des emprunts de véhicules
-- À exécuter dans Supabase : SQL Editor → New query → coller → Run
-- ============================================================================
create table if not exists public.emprunts (
  id            text primary key,
  vehicule      text,          -- immatriculation du véhicule emprunté
  emprunteur    text,          -- prénom + nom de la personne
  date_emprunt  date,
  heure_emprunt text,
  date_retour   date,
  heure_retour  text,
  rendu_par     text,          -- nom de la personne qui a rendu (si différent)
  created_at    timestamptz default now()
);

grant all on public.emprunts to anon, authenticated;
