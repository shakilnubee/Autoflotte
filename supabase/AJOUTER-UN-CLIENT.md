# Ajouter un client (nouvelle société) — Parc Pilot

Chaque client a **sa propre société** : il ne voit et ne gère QUE ses données.
Toi (admin) tu continues de tout voir via le sélecteur de société.

## 1. Créer le compte de connexion du client
Supabase → **Authentication** → **Add user** :
- Email du client + un mot de passe (tu peux cocher **Auto Confirm User**).
- Clique **Create user**.

## 2. Rattacher ce compte à sa société
Supabase → **SQL Editor**, colle ceci en remplaçant l'email et le nom de société :

```sql
insert into public.profiles (id, email, societe, is_admin)
select id, email, 'NOM_DE_LA_SOCIETE', false
from auth.users
where email = 'client@exemple.com'
on conflict (id) do update
  set societe = excluded.societe, is_admin = false;
```

- `'NOM_DE_LA_SOCIETE'` = le nom exact de la société (ex. `'Transports Durand'`).
- `is_admin = false` → le client est **verrouillé** sur cette société.

## 3. (Optionnel) Pré-remplir sa flotte toi-même
Dans l'app (toi, admin) : sélecteur de société en haut → **Ajouter une société**
(même nom qu'à l'étape 2) → bascule dessus → ajoute ses véhicules/conducteurs.
Tout ce que tu saisis pendant que cette société est sélectionnée est étiqueté à elle.

## 4. C'est prêt
Le client se connecte (login habituel) avec son email/mot de passe :
- il ne voit **que** sa société (le sélecteur de société est masqué),
- il peut **gérer** sa flotte (ajouter/modifier véhicules, amendes, conducteurs, scanner…),
- la **base elle-même** l'empêche de voir/toucher une autre société (sécurité réelle, pas juste l'affichage).

## Rendre un compte « admin » (voit tout)
```sql
update public.profiles set is_admin = true, societe = null
where email = 'ton-email@exemple.com';
```

## Lister les comptes et leur société
```sql
select email, societe, is_admin from public.profiles order by is_admin desc, societe;
```
