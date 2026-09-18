-- ============================================================
--  REMÉDIATION ISOLATION (à lancer UNE FOIS en prod) — PRIORITÉ
--
--  L'ancien script de dédoublonnage (dedupe-amendes-sinistres.sql) créait des COPIES intégrales
--  `amendes_backup` / `factures_backup` dans le schéma public SANS row level security. Si elles
--  existent encore, n'importe quel compte connecté (de n'importe quelle société) peut les lire via
--  l'API REST → fuite de TOUTES les amendes/factures (toutes sociétés). On corrige ça ici.
--
--  Deux options : (A) les PROTÉGER (RLS sans policy = plus aucun accès client), ou (B) les SUPPRIMER
--  (recommandé si tu n'as pas de restauration en cours). Fais l'une OU l'autre.
-- ============================================================

-- (A) PROTÉGER — inoffensif, à lancer dans tous les cas :
alter table if exists public.amendes_backup  enable row level security;
alter table if exists public.factures_backup enable row level security;

-- (B) SUPPRIMER si tu n'en as pas besoin (recommandé) — décommente les 2 lignes :
-- drop table if exists public.amendes_backup;
-- drop table if exists public.factures_backup;

-- Vérif : après (A) rowsecurity doit être true ; après (B) les lignes disparaissent.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename in ('amendes_backup', 'factures_backup');
