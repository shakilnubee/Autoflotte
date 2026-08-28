# Intégration API Ulys Partner (VINCI Autoroutes)

Parc Pilot peut se connecter à l'**API Ulys Partner** pour récupérer automatiquement les
badges de télépéage, les rapprocher des véhicules/conducteurs, et (paliers suivants) importer
les factures/consommations et écrire l'affectation des badges depuis PP.

## Architecture (sécurité)

L'API Ulys est **serveur-à-serveur** : le navigateur ne peut pas l'appeler (CORS + ça
exposerait la clé). Tout passe par l'**Edge Function Supabase `ulys-sync`**, qui détient le
jeton en **secret côté serveur** et ajoute les en-têtes obligatoires (`Authorization: Bearer`
+ `x-initiator`). ⚠️ **Le jeton Ulys n'est JAMAIS dans le code du site (repo public).**

## Mise en route (une seule fois)

1. **Générer le jeton Ulys** : espace abonnés Ulys → Sécurité → « accès API » → créer un accès
   (libellé + date d'expiration) → copier le jeton généré.
2. **Définir les secrets** dans Supabase → *Edge Functions → Secrets* (ou `supabase secrets set`) :
   - `ULYS_BEARER` = le jeton « accès API » ci-dessus.
   - `ULYS_INITIATOR` = le **numéro client Ulys** (ex. `8211979`) ou le code fleeter (`FLT-…`).
   - `ULYS_BASE` = *(optionnel)* URL de base. Défaut = **production**.
     - Prod : `https://ulys-api-partner.vinci-autoroutes.com`
     - Sandbox (tests) : `https://ulys-api-partner-sandbox.vinci-autoroutes.com`
3. **Déployer** : la fonction `ulys-sync` se déploie automatiquement au push sur `main`
   (GitHub Action `deploy-edge-functions.yml`). Vérifier que le secret GitHub
   `SUPABASE_ACCESS_TOKEN` est présent (déjà en place pour les autres fonctions).
4. **Tester** d'abord en **sandbox** (`ULYS_BASE` = URL sandbox), puis basculer en prod.

## Ce qui est branché (Palier 1 — lecture seule)

- Onglet **Contrôle → Ulys → panneau « Badges Ulys (API) »** :
  - bouton **Synchroniser** → récupère la liste des badges (n°, statut Actif/Inactif, immat,
    affectation, commentaire) ;
  - **rapprochement automatique** : par immatriculation (→ véhicule → conducteur) ou par le
    nom de l'affectation (jamais de conducteur inventé — sinon « à rapprocher à la main ») ;
  - **Relier** un badge à un conducteur → écrit `condBadgeUlys` (helper `FP.setCondNum`) → la
    conso se rattache ensuite automatiquement, comme aujourd'hui ;
  - **anomalies** : badge inactif encore affecté, immatriculation hors flotte, badge non renseigné.
- La liste est mise en **cache synchronisé** (`app_settings` par société) pour s'afficher sans
  rappeler l'API (quota journalier Ulys — erreur 429 si dépassé).

- **Repli historique** : pour un véhicule vendu/ancien sans chauffeur actuel, le conducteur est
  retrouvé via l'**historique d'affectation** (`FP.affectations`) → la conso lui revient.
- Le panneau est **repliable** (état mémorisé) — les mêmes infos sont dans « Cartes & badges ».
- Bouton **« Importer les factures »** : récupère les factures Ulys (dates + HT/TVA/TTC) dans la
  table `factures` (fournisseur « Ulys » → onglet Ulys), avec **anti-doublon** par n° de facture.

Aucune écriture vers Ulys à ce palier (l'import de factures reste une lecture Ulys + écriture locale).

## Endpoints API disponibles (référence, doc V1.11)

| Endpoint | Méthode | Usage |
|---|---|---|
| `/api/account/` | GET | Infos du compte (raison sociale, SIRET, EVA…) |
| `/api/contracts/getcontracts/` | GET | Contrats/abonnements |
| `/api/badges/getbadges/` | GET | Badges (+ `?contractUniqueId=` pour filtrer) |
| `/api/badges/addbadges/` | POST | Commander des badges *(palier ultérieur)* |
| `/api/badges/updatelistbadgeinfos/` | POST | Écrire immat/affectation/commentaire d'un badge *(palier ultérieur)* |
| `/api/invoices/getinvoices/` | GET | Liste des factures (HT/TVA/TTC, TLP/ELEC) *(palier 2)* |
| `/api/invoices/getinvoice/{id}` | GET | PDF de facture (zip) *(palier 2)* |
| `/api/transactions/gettransactionsbilledcsv/{id}` | GET | Détail transactions CSV (3 derniers mois) *(palier 2)* |
| `/api/elec/refill/getrefillsbilledcsv/{id}` | GET | Recharges électriques CSV *(palier 2)* |
| `/api/orderstracking/getallordertracking/` | GET | Suivi des commandes de badges *(palier ultérieur)* |

## Paliers suivants (à valider)

- **Palier 2** : import automatique des factures + détail transaction par transaction
  (remplace la lecture PDF manuelle `ulysPdfToText`), alimente `total_conso_tx` / `ulys_conso`
  → détection conso-pendant-congé & anomalies automatiques.
- **Palier 3** : écriture dans Ulys depuis PP (affecter/renommer un badge via
  `updatelistbadgeinfos`), commande de badges, suivi de livraison.

## Limites connues

- **Quota d'appels journalier** (429) → PP met en cache et ne synchronise qu'à la demande.
- **Transactions détaillées = 3 derniers mois** seulement (l'historique déjà importé reste dans PP).
- **L'« affectation » Ulys est un texte libre** (pas un identifiant salarié) → le rapprochement
  auto est fiable quand l'immatriculation est renseignée ; sinon on tombe sur le nom, et en cas
  de doute PP signale au lieu d'inventer.
