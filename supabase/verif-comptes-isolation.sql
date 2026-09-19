-- ============================================================
--  VÉRIF ISOLATION DES COMPTES (à lancer avant d'ajouter un nouveau client)
--
--  ⚠️ Une ancienne migration a mis is_admin=true pour TOUS les comptes existants à un moment.
--  Un compte CLIENT resté is_admin=true = CEO de fait → il voit TOUTES les sociétés (contourne
--  toute l'isolation). Il ne doit y avoir qu'UN SEUL compte is_admin=true : le TIEN (CEO).
--
--  À lancer : Supabase → SQL Editor → Run. Lecture seule (le UPDATE est commenté).
-- ============================================================

-- 1) Voir tous les comptes, leur rôle et leur société :
select p.id, u.email, p.is_admin, p.role, p.societe
from public.profiles p
left join auth.users u on u.id = p.id
order by p.is_admin desc nulls last, p.societe;

--  → Attendu : is_admin = true UNIQUEMENT pour ton compte CEO. Tous les autres = false + une société.

-- 2) CORRIGER un compte client qui serait resté is_admin=true (remplace l'id et la société) :
-- update public.profiles set is_admin = false, role = 'admin', societe = '<SOCIETE_DU_CLIENT>'
-- where id = '<id_du_compte_client>';

--  (Rappel : la gestion des comptes se fait normalement dans l'app → Paramètres → « Utilisateurs & accès ».
--   Ce SQL n'est qu'un contrôle de sécurité ponctuel.)
