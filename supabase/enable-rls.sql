-- ============================================================
--  Parc Pilot — Activation de la sécurité (RLS) sur Supabase  [v2 ROBUSTE]
-- ============================================================
--  But : interdire toute lecture/écriture des données SANS être connecté.
--  Cette version SUPPRIME aussi les anciennes règles « tout autoriser » qui
--  laissaient certaines tables (vehicules/amendes/factures/app_settings)
--  ouvertes au public, puis ne laisse QU'UNE règle : « connectés uniquement ».
--
--  ⚠️ À exécuter dans Supabase → SQL Editor → coller → "Run".
--  L'application continue de fonctionner (elle est déjà derrière le login).
--
--  Note : ceci ne sépare PAS encore les données société par société.
-- ============================================================

do $$
declare t text; r record;
begin
  foreach t in array array['vehicules','amendes','factures','conducteurs','documents','emprunts','app_settings']
  loop
    -- 1) activer la RLS
    execute format('alter table public.%I enable row level security;', t);
    -- 2) supprimer TOUTES les règles existantes (y compris les anciennes « tout autoriser »)
    for r in select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I;', r.policyname, t);
    end loop;
    -- 3) recréer UNE seule règle : accès complet réservé aux utilisateurs CONNECTÉS
    execute format('create policy "auth_all_%1$s" on public.%1$s for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- ✅ Terminé. Teste l'application (connecté) : tout doit charger et s'enregistrer.
-- Pour vérifier côté SQL, cette requête doit lister 7 lignes (une règle par table) :
--   select tablename, policyname, roles from pg_policies where schemaname='public' order by tablename;


-- ============================================================
--  ROLLBACK (SEULEMENT si quelque chose ne marche plus) — ré-ouvre l'accès.
-- ============================================================
-- do $$ declare t text; begin
--   foreach t in array array['vehicules','amendes','factures','conducteurs','documents','emprunts','app_settings']
--   loop execute format('alter table public.%I disable row level security;', t); end loop;
-- end $$;
