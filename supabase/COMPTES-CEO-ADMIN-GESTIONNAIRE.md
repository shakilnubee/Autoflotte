# Comptes & accès — CEO · Admin · Gestionnaire (Parc Pilot)

Depuis la mise en place des 3 niveaux d'accès, **tu n'as plus besoin de passer par Supabase**
pour créer/gérer les comptes : tout se fait dans **Paramètres → onglet « Compte » → « Utilisateurs & accès »**.

## Les 3 niveaux

| Niveau | Voit | Peut faire |
|---|---|---|
| **CEO** (toi) | **Toutes** les sociétés | Tout + gérer TOUS les comptes (créer des Admin, Gestionnaires, d'autres CEO) |
| **Admin** (client, resp. flotte) | **Sa** société | Tout dans sa société + config + créer/gérer SES Gestionnaires & Admins |
| **Gestionnaire** | **Sa** société | Ajouter / modifier / **supprimer** les données. PAS la config société, PAS les comptes, PAS les Paramètres |

Le portail **salarié** (rôle « chauffeur ») reste séparé et inchangé.

## Installation (une seule fois)

1. **SQL** — Supabase → SQL Editor → colle et exécute
   [`roles-ceo-admin-gestionnaire.sql`](./roles-ceo-admin-gestionnaire.sql).
   (Ajoute la colonne `role` ; ne verrouille personne.)

2. **Fonction serveur** — Supabase → Edge Functions → *Deploy a new function* → nom **`manage-users`**
   → colle [`functions/manage-users/index.ts`](./functions/manage-users/index.ts) → Deploy.
   (Rien à configurer : `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement.)

3. C'est prêt : ouvre **Paramètres → Compte → Utilisateurs & accès**, remplis e-mail + mot de passe
   initial, choisis le niveau (et la société si CEO), clique **Créer le compte**. La personne se
   connecte ensuite normalement sur la page de connexion.

## Sécurité (comment c'est protégé)

- Le **rôle et la société** vivent dans la table `profiles`, que l'utilisateur **ne peut pas
  modifier lui-même** (RLS) → impossible de se promouvoir CEO ou de voir une autre société.
- La création/modif de comptes passe par la fonction serveur `manage-users` qui **vérifie
  d'abord** que le demandeur est CEO ou Admin, et **limite un Admin à sa propre société**
  (il ne peut pas créer de CEO, ni toucher un compte d'une autre société).
- La clé toute-puissante (`service_role`) reste **côté serveur**, jamais dans le site public.

## Rappels utiles (SQL, si besoin ponctuel)

```sql
-- Lister les comptes et leur accès
select p.email,
       case when p.is_admin then 'CEO' when p.role='gestionnaire' then 'Gestionnaire' else 'Admin' end as acces,
       coalesce(p.societe,'(toutes)') as societe
from public.profiles p order by p.is_admin desc, p.societe;

-- Faire de quelqu'un un CEO (voit tout)
update public.profiles set is_admin=true, role='admin', societe=null where email='ton-email@exemple.com';
```
