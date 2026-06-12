-- ============================================================
--  Parc Pilot — Activation de la sécurité (RLS) sur Supabase
-- ============================================================
--  But : interdire toute lecture/écriture des données SANS être connecté.
--  Aujourd'hui la clé publique permet à n'importe qui de lire/modifier la base ;
--  après ce script, seuls les utilisateurs CONNECTÉS (Auth) y ont accès.
--
--  ⚠️ À exécuter dans Supabase → SQL Editor → coller → "Run".
--  L'application continue de fonctionner normalement (elle est déjà derrière le login).
--
--  Note : ceci ne sépare PAS encore les données société par société (tout
--  utilisateur connecté voit toutes les sociétés). C'est une étape suivante,
--  mais ce script bouche déjà le trou le plus important (accès public).
-- ============================================================

-- 1) Activer la RLS sur toutes les tables
alter table public.vehicules    enable row level security;
alter table public.amendes      enable row level security;
alter table public.factures     enable row level security;
alter table public.conducteurs  enable row level security;
alter table public.documents    enable row level security;
alter table public.emprunts     enable row level security;
alter table public.app_settings enable row level security;

-- 2) Autoriser TOUT (lecture + écriture) pour les utilisateurs CONNECTÉS uniquement.
--    (on supprime d'abord une éventuelle policy du même nom pour pouvoir relancer le script)
do $$
declare t text;
begin
  foreach t in array array['vehicules','amendes','factures','conducteurs','documents','emprunts','app_settings']
  loop
    execute format('drop policy if exists "auth_all_%1$s" on public.%1$s;', t);
    execute format('create policy "auth_all_%1$s" on public.%1$s for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- ✅ Terminé. Teste ensuite l'application (connecté) : tout doit charger et s'enregistrer.


-- ============================================================
--  ROLLBACK (à exécuter SEULEMENT si quelque chose ne marche plus)
--  → ré-ouvre l'accès comme avant.
-- ============================================================
-- alter table public.vehicules    disable row level security;
-- alter table public.amendes      disable row level security;
-- alter table public.factures     disable row level security;
-- alter table public.conducteurs  disable row level security;
-- alter table public.documents    disable row level security;
-- alter table public.emprunts     disable row level security;
-- alter table public.app_settings disable row level security;
