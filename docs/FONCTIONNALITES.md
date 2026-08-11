# INVENTAIRE EXHAUSTIF — Parc Pilot (fondé sur le code réel)

> **Référence unique** pour ne JAMAIS reproposer une fonctionnalité déjà présente.
> À consulter AVANT toute proposition de nouvelle feature. Chaque item cite le fichier source.
> Basé sur : `dashboard.html`, `pages/*.html`, `assets/js/app.js`, `assets/js/supabase-client.js`, `pages/manuel.html`.
> Dernière compilation : 2026-08-02.

---

## 1. Tableau de bord — `dashboard.html`

- **6 KPI principaux** : Véhicules, Conducteurs, Amendes à payer, Coûts du mois, Alertes, Km cumulés.
- **Bouton « Voir les indicateurs détaillés »** (`#toggle-details`) : dévoile des indicateurs secondaires.
- **Scanner un document universel** (`#btn-scan-doc`) : scan photo/PDF avec IA (`FP.scanIA` + `FP.detectDoc`) qui **classe automatiquement** le document et le range au bon endroit. Types détectés : facture, amende/PV, carte grise, contrôle technique, assurance, sinistre, carte d'identité, permis, autre. Modale multi-docs, « Scanner d'autres » (`#scan-again`), « Enregistrer N document(s) » (`#scan-save-all`).
- **Mettre à jour le km en lot** (modale « Mettre à jour le kilométrage », `#sc-kmlot-save`) + **Km par photo du compteur** (OCR, `#sc-kmphoto-btn`).
- **Marquer un véhicule immobilisé / Lever l'immobilisation** (toggle « Immobiliser »/« Lever »).
- **Raccourcis personnalisables** (`#sc-btn` « Raccourcis », modale « Choisir mes raccourcis »).
- **Onboarding « Premiers pas »** (`#onb-hide`) + **pop « nouveauté »** (upsell `#fp-upsell-x`).
- **Sélecteur de société** (`#soc-btn`) : bascule PXP / autres / « Toutes les sociétés » ; **Ajouter une société** (`#soc-add`).
- **Réorganiser / masquer les blocs du dashboard** (drag, « Voir »/masquer par bloc, « Tout réafficher »).
- **Graphiques & widgets** : Coûts mensuels (€), Véhicules par groupe, **🏆 Podium conducteurs — amendes** (`#dash-podium-toggle`), **🗓️ À traiter cette semaine**, **🩺 Santé de la flotte** (score, `FP.santeVehicule`), **🔑 Véhicules empruntés en ce moment**, **🚦 Trafic Île-de-France**.

---

## 2. Véhicules — `pages/vehicules.html`

- **Onglets de groupes** : Tous, Siège, Commerciaux, Gov, International, À vendre, Retail, Dépôt, Salarié, Vendus, Actifs (renommables/masquables).
- **Éditeur de colonnes** : afficher/masquer/réordonner (`#hidden-cols-btn`, drag & drop, `FP.makeColumnEditor`).
- **Nouveau véhicule** (`#btn-new`) — saisie manuelle avec anti-doublon.
- **📸 Importer une ou plusieurs cartes grises** (`#btn-completer-cg`) : OCR par lot → remplit CO₂, puissance fiscale, carburant, 1re immat, prochain CT, masse, VIN. **Créer les véhicules en lot** (`#cg-batch-create`).
- **Importer (Excel)**.
- **⚖️ Comparer deux véhicules** (`#btn-compare`, modale, coûts/€km/TVS/leasing côte à côte).
- **⭐ Épingler en favori**.
- **Sélection multiple / bulk** (`FP.bulkSelect`) : Exporter (`#bulk-export`), Fiche PDF (`#bulk-fiche`), Supprimer (`#bulk-delete`), Désélectionner (`#bulk-clear`).
- **Fiche véhicule (drawer)** — sections : instruments (jauges km), **TVS** (`FP.tvsDetail`), **Stationnement Paris** (`parkingParis()` — Gratuit / Payant / À vérifier / Gratuit sous réserve de démarche, jamais présumé), **Suivi leasing** + **Restitution** + **Fiche restitution**, **État des lieux** (photos : `#edl-cam`, `#edl-pick`, `#insp-save`), **Documents** (`#doc-add`), **Notes / journal** (`#veh-note-add`), **Coût au km**, **Infos techniques** (VIN copiable…).
- **Boutons fiche** : Modifier (`#drawer-edit`), PDF (`#drawer-pdf`), QR (`#drawer-qr`), **QR sinistre** (`#drawer-qr-sin`), Vente/dossier acheteur (`#drawer-vente`), Imprimer (`#fiche-print`), Télécharger PDF (`#fiche-pdf`).
- **QR code véhicule** → `carte.html` (`#qr-print`, `#qr-download`).
- **Enlever le chauffeur** (`#btn-clear-chauffeur`).
- **Télécharger la fiche de groupe** (`#btn-fiche-groupe`).
- **Bouton reset filtres** (`FP.filterResetButton`).

---

## 3. Amendes — `pages/amendes.html`

- **KPI** : Total amendes, montant minoré, Montant réellement payé, À payer.
- **Onglets** : Toutes, À payer, Payées, Désignées.
- **Nouvelle amende** (`#btn-new`) + **Scan IA d'un avis** (extrait les **3 montants** minoré/forfaitaire/majoré séparément + dates limites — `FP.SCAN_PROMPT`, jamais le majoré par défaut).
- **Fiche amende (drawer)** : Marquer payée (`#drawer-pay`) / bulk (`#am-bulk-pay`/`#am-bulk-unpay`), **Désigner** (`#drawer-designer`) + **Désigner sur ANTAI** (`#am-antai-designer`), Contester (`#drawer-conteste`), Relancer (`#drawer-relance`), **💳 Payer en ligne**, **⏰ Payer avant… (échéance)**, **📞 Contacter le conducteur**, Joindre justificatif (`#justif-btn`), Ajouter document (`#piece-add`).
- **E-mails automatiques** : Demande de désignation, Demande de paiement + file d'attente.
- **Relevé PDF** individuel (`#am-fiche-btn`) et en lot (`#am-bulk-fiche`).
- **Podium / récap par conducteur** (`#podium-toggle`).
- **Voir toutes les années** (`#btn-voir-tout`), Réinitialiser filtres, Supprimer en lot (`#am-bulk-delete`).

---

## 4. Factures — `pages/factures.html`

- **Onglets** : Factures, **Total Fleet · carburant & péages**, **Ulys · péages**, Fournisseurs, Documents · archives.
- **Importer une facture** (`#btn-import-facture`) : OCR (HT/TVA/TTC/n°/KM/fournisseur), **contrôle HT+TVA=TTC**, anti-doublon (`FP.dupe`). Lecture spéciale **Ulys/VINCI** par position (`ulysPdfToText`).
- **Importer un document** (`#doc-import-btn`).
- **Import Total Fleet** et **Import Ulys** (détail par n° de badge).
- **Vue dossiers Drive à 3 niveaux** (pays → plaque → année).
- **Sélection multiple / supprimer en lot**.
- **Exclusions** hors coût d'exploitation (`FP.coutFactureExploit`).
- **TVA récupérable par période** (`#cp-export`).
- **Fournisseurs** : Renommer, regrouper. Filtre par mois.

---

## 5. Entretiens — `pages/entretiens.html`

- Liste des interventions (filtres Tous / Entretien / Réparation).
- **Annuaire de garages / prestataires** : Ajouter, Modifier, Supprimer, Contacter (`FP.getPrestataires`).

---

## 6. Contrats — `pages/contrats.html`

- **Loueurs** : Ajouter, multi-loueurs (`FP.loueurOf`), lier véhicules.
- **Leasing (BPCE)** : Ajouter contrat, **Forfait km & dépassement**, avenants, loyers dans le temps (`FP.leasingLoyerAt`), **Importer les loyers exacts (facture)**, Retrouver les PDF, ↺ Contrat d'origine. Fiche restitution.
- **Assurance** : Modifier, **Ajouter une prime**, Appliquer à la flotte, Exporter/Importer l'état de parc, €/km, ignorer un véhicule. Compteur Véhicules assurés.

---

## 7. Sinistres — `pages/sinistres.html`

- **KPI** : Total, Coût total, **Reste à charge** (`FP.resteChargeSinistre`), Véhicules concernés, Responsables ; filtres par période.
- **Déclarer un sinistre** (`#sin-declare-btn`) avec tiers, barre d'étapes.
- **📸 Scanner le courrier de l'assureur (IA)**, **Lire le constat (IA)**.
- **Statut de remboursement** : En attente / Réglés ; alertes (attente, relance assureur > 3 semaines).
- **3 canaux de déclaration** dont **QR « Déclarer un sinistre »**.
- Annuaire garages (Google Maps), Vue dossiers Drive, Courrier assureur auto, Relevé PDF.

---

## 8. Conducteurs — `pages/conducteurs.html`

- **3 vues** : Liste, Cartes, Groupes.
- **Nouveau conducteur** (`#btn-new`) ; création partout via `FP.conducteurPicker`.
- **Fiche conducteur (drawer)** : Modifier, adresse en cases, **Permis** (téléverser, Relire OCR, expiration), **points de permis** (12 − retraits), **nb amendes**, **nb accidents**, **Coût total généré**, **Documents perso** (carte identité, titre séjour, RIB, mutuelle, visite médicale), PDF fiche.
- **Relire les permis en lot** (`#btn-reread-all`).
- **Sortie des effectifs (départ)** vs **Supprimer (erreur)** ; Réintégrer ; Renommer ; **RGPD — purge auto**. Bulk supprimer.

---

## 9. Statistiques — `pages/statistiques.html`

- **KPI coûts** : Coût d'usage, Achat, Total TVS, Coût/km, Top dépense, mois vs mois.
- **Classement coût au km** (toutes années).
- **Sinistres / accidents** : Nb, Coût, Conducteurs concernés.
- **Bilan CO₂ / RSE** (15 000 km/an) : CO₂ annuel, g/km moyen, flotte électrifiée ; ignorer/réafficher.
- **Conformité réglementaire** (CT + assurance).
- **Graphiques** : Comparaison des dépenses (**mois vs mois choisis**), Dépenses mensuelles 12 mois, Répartition par type, Top 10 fournisseurs, Coût par société, Coût flotte par période, Coût total par véhicule.
- **Rapport de direction** (`#btn-rapport-dir`, `FP.rapportDirection`) et **Rapport RSE** (`#btn-rapport-rse`) — one-pagers PDF.

---

## 10. Budget — `pages/budget.html`

- **Sélecteur d'année**.
- **Prévu vs réel par poste** (KPI Prévu / Réel / Écart).
- **Prévision de trésorerie — 12 prochains mois**.
- **🎯 Objectifs** (`#bud-obj-card`) : cible **€/km** (`#obj-eurkm`), **plafond amendes/an** (`#obj-plafamendes`, jauge), **coût/véhicule/mois** (`#obj-coutvehmois`) — vert si tenu, rouge si dépassé.

---

## 11. Alertes & renouvellements — `pages/notifications.html`

- **3 onglets** : 🔔 Alertes, 🔄 Renouvellements, 📝 À compléter.
- **Ignorer / masquer une alerte** (`FP.alertes.masquer`) + Tout réafficher.
- **Télécharger l'échéancier (PDF)**.
- **« À compléter »** : liste TOUTES les infos manquantes, cliquables ; **Remplir en rafale** ; Compléter depuis les cartes grises.

### Catégories d'alertes générées par `FP.buildAlertes`
- **Contrôle technique** (dépassé / <30j / <60j / à venir ; ignore CT étrangers).
- **Anti-pollution** (utilitaires/camions diesel).
- **Relevé km** (rappel périodique).
- **Amendes à payer** (nombre + total dû).
- **Amendes payées sans justificatif**.
- **Amendes bientôt majorées / probablement majorées**.
- **Amende payée en double**.
- **Permis** (expiré / <60j / <120j).
- **Pièce d'identité** (identité, titre séjour, RIB, mutuelle, visite médicale).
- **Révision constructeur** (aucune date + km ≥ intervalle / dépassée km ou jours / à prévoir — `FP.revisionInfo`, intervalles configurables).
- **Leasing — dépassement km projeté** (`FP.leasingInfo`).
- **Leasing — fin de contrat approchant** (`leasingFinMois`).
- **Immobilisation** (> X jours, `immobiliseJours`).
- **Carburant — conso anormale** (`consoSeuilPct`).
- **Carte carburant** & **Badge télépéage** (expiration).
- **Sinistres en attente** ; **Sinistres sans réponse assureur** (> 3 semaines).
- **Budget entretien dépassé**.

### Renouvellements (`FP.buildEcheances`) — timeline datée
CT, Anti-pollution, Fin leasing, Permis, Pièces d'identité. Aussi en **Calendrier** (`pages/calendrier.html`) et **Documents à renouveler** (`pages/renouvellements.html`).

---

## 12. Autres onglets

- **À vendre** (`pages/a-vendre.html`) : estimation, prix de vente, dossier de vente PDF.
- **Emprunts** (`pages/emprunts.html`) : Nouvel emprunt, **Réserver**, **Valider le retour**, retard.
- **Tâches** (`pages/taches.html`) : Nouvelle tâche (intitulé + véhicule + échéance) ; filtres.

---

## 13. Paramètres — `pages/parametres.html`

Onglets : Compte, Société, Groupes, Notifications, Données, Journal, Affichage.
- **Compte** : avatar, mot de passe, déconnexion.
- **Utilisateurs & accès** (CEO/Admin) : Créer/modifier/supprimer/réinitialiser un compte + rôle + société (fonction serveur `manage-users`).
- **Nouvelle société**, Supprimer une société, logo, couleur.
- **Groupes / Affichage** : renommer/réordonner groupes, nav.
- **Notifications — seuils réglables** (ctJours, revKm/revMois/revAlerteKm/revAlerteJours, releveKmJours, leasingFinMois, immobiliseJours, consoSeuilPct…).
- **Mode sombre** et **densité**.
- **Données/Sync** : push/pull réglages, Tester connexion, Export/Import JSON, **Sauvegarde complète**, Tout réinitialiser.
- **Journal** d'activité (`FP.audit`).
- **Import de données** (Analyser / Importer).

---

## 14. Pages système & annexes

- **espace-salarie.html** (dormant, sécurité serveur à construire), **ecran.html** (mode TV/kiosque), **facturation.html** (abonnement Parc Pilot), **aide.html**, **manuel.html** (manuel détaillé + glossaire `s-calculs`), **guide.html** (guide rapide).
- **Marketing** : index, login, brochure, prix, argumentaire, devis, contrat / contrat-modele, kit-commercial, demo, script-demo, carte (QR), avis, prospects (CRM), carte-visite, logos, 404.

---

## 15. Fonctions globales injectées sur toutes les pages (app.js)

Recherche globale (`FP.injectGlobalSearch` + `FP.searchAll` + `FP.smartAnswers`), bouton « + » flottant (`FP.injectQuickAdd`), bouton Retour (`FP.injectBackButton`), Tour guidé (`FP.injectTour`), astuces (`FP.featureTip`), bouton manuel (`FP.injectManualButton`), Data I/O (`FP.injectDataIO`), avatar/logout, Undo/Redo Ctrl+Z/Y (`FP.history`), toast/dialog/confirm (`FP.toast`/`dialog`/`confirm`/`undoToast`), vue mobile cartes (`FP.mobileCardify`), transition SPA (`FP.warp`), édition inline double-clic.

---

## 16. Helpers `FP.*` — source unique de vérité (réutiliser, jamais réimplémenter)

- **Formatage** : `FP.euro`, `FP.euroPrecis`, `FP.num`, `FP.date`, `FP.dateNum`, `FP.esc` (anti-XSS), `FP.normImmat`, `FP.normPrenom`, `FP.parseMontant`, `FP.joursRestants`, `FP.copy`.
- **Rôles** : `FP.role`, `FP.isCEO`, `FP.isAdmin`, `FP.isGestionnaire`, `FP.canManageSociete`, `FP.canManageUsers`.
- **Config/sociétés** : `FP.settings`, `FP.notifCfg`, `FP.activeSociete`, `FP.getSocietes`, `FP.persist`.
- **Véhicules** : `FP.estVendu`, `FP.horsFlotte`, `FP.kmActuel`, `FP.santeVehicule`, `FP.decoteVehicule`, `FP.tvsDetail`, `FP.applyFactureToVehicule`, `FP.recomputeVehiculeFromFactures`.
- **Révisions** : `FP.revisionInfo`, `FP.revisionIntervalle`, `FP.REVISION_INTERVALS`.
- **Leasing** : `FP.leasingContrat`, `FP.leasingInfo`, `FP.leasingLoyerCourant`, `FP.loueurOf`.
- **Coûts/TVS/assurance** : `FP.tvsDetail`, `FP.coutParPeriode`, `FP.coutMois`, `FP.coutFactureExploit`, `FP.dedupeFactures`, `FP.assuranceLabel`, `FP.primeVeh`.
- **Amendes** : `FP.montantDu`, `FP.estAPayer`, `FP.estPayee`, `FP.anneeAmende`, `FP.getAmendeMontantPaye`.
- **Factures** : `FP.estEntretien`, `FP.estUlys`, `FP.estTotalFleet`, `FP.estCarburantPeage`, `FP.getPrestataires`.
- **Sinistres** : `FP.coutSinistre`, `FP.resteChargeSinistre`, `FP.constatPrompt`, `FP.courrierAssureurPrompt`.
- **Emprunts** : `FP.empEnCours`, `FP.empEnRetard`.
- **Conducteurs** : `FP.conducteurs` (create/find), `FP.conducteurPicker`, `FP.conducteurContact`, `FP.contactChips`.
- **Alertes/rapports** : `FP.buildAlertes`, `FP.buildEcheances`, `FP.alertes`, `FP.rapportDirection`, `FP.rapportRSE`.
- **Scan/OCR/anti-doublon** : `FP.scanIA`, `FP.detectDoc`, `FP.SCAN_PROMPT`, `FP.CG_SCAN_PROMPT`, `FP.dupe` (confirmAdd/find), `FP.ocr`.
- **UI** : `FP.searchSelect`, `FP.filterResetButton`, `FP.bulkSelect`, `FP.makeColumnEditor`, `FP.makeExportMenu`/`csv`/`xlsx`, `FP.fiche`, `FP.lienVehicule`/`lienConducteur`, `FP.mobileCardify`, `FP.audit`, `FP.exportBackup`.
- **Backend** : `FP.supabase`, `FP.db` (CRUD + mapping snake↔camel), `FP.auth`, `FP.sendEmail`.

---

### Règles anti-régression déjà codées
- Une seule source de vérité par concept (helpers `FP.*`).
- Anti-doublon obligatoire via `FP.dupe`.
- Sélecteurs véhicule/conducteur via `FP.searchSelect` / `FP.conducteurPicker` ; filtres via `FP.filterResetButton`.
- Données utilisateur/OCR échappées via `FP.esc`.
- Stationnement Paris : jamais présumé.
- Amendes : 3 montants distincts, jamais le majoré par défaut.
</content>
</invoke>
