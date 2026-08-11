# ✅ Tests à faire (checklist Shakil)

> Liste des tests que Claude a demandé de vérifier dans l'application après les
> dernières modifications. Coche au fur et à mesure. Toujours faire **F5** (ou
> Ctrl+Maj+R) sur la page concernée avant de tester, pour charger la dernière version.

---

## 1. TVS 2026 + CO₂ + puissance fiscale (page Véhicules)

- [ ] **F5** sur la page **Véhicules**.
- [ ] Cliquer sur une voiture pour ouvrir sa fiche.
- [ ] Dans la section **Technique**, vérifier la présence de :
  - [ ] **CO₂ (V.7)** en g/km
  - [ ] **Puissance fiscale (P.6)** en CV
  - [ ] **TVS 2026 détail** (ex. « CO₂ 69 € + polluants 100 € »)
- [ ] En haut, le KPI **TVS 2026** affiche le total, ou « Non soumis » (utilitaire/moto),
      ou « CO₂ manquant ».
- [ ] **Double-cliquer** sur CO₂ et sur Puissance fiscale → les valeurs sont **modifiables**
      et se sauvegardent.
- [ ] Vérifier que la TVS d'un **électrique = 0 €**.
- [ ] Vérifier qu'un **utilitaire / une moto** affiche « Non soumis ».
- [ ] (Contrôle du calcul) un véhicule à **100 g de CO₂** doit donner **213 €** de taxe CO₂.

## 2. Import de carte grise (page Véhicules → Ajouter / Modifier)

- [ ] **F5** sur la page **Véhicules**.
- [ ] Cliquer **Ajouter un véhicule** (ou modifier un véhicule existant).
- [ ] Cliquer **Importer une carte grise** → choisir une **photo nette** ou un **PDF**.
- [ ] Vérifier que le message de confirmation liste les champs lus, avec valeurs entre
      parenthèses : immatriculation, marque, modèle, VIN, 1ère immat.,
      **CO₂ (… g/km)**, **puissance fiscale (… CV)**, **carburant (…)**.
- [ ] Vérifier les valeurs lues (surtout le **CO₂**, qui pilote la TVS).
- [ ] **Enregistrer** → rouvrir la fiche → vérifier que CO₂, puissance fiscale et carburant
      sont bien remplis et que la **TVS 2026** s'est calculée automatiquement.
- [ ] Vérifier qu'une valeur **déjà saisie à la main n'est pas écrasée** par l'import.
- [ ] Tester avec une photo de travers/floue → message d'erreur clair invitant à ressaisir.

## 3. Ajout / modification d'un conducteur (page Conducteurs)

- [ ] **F5** sur la page **Conducteurs**.
- [ ] Ajouter un nouveau conducteur → vérifier qu'il apparaît bien dans la liste.
- [ ] Vérifier l'association conducteur ↔ véhicule (le bon nom remonte sur la fiche véhicule).
- [ ] Modifier un conducteur → vérifier que la modif est sauvegardée après F5.

## 4. Ajout / modification d'une amende (page Amendes)

- [ ] **F5** sur la page **Amendes**.
- [ ] Ajouter une nouvelle amende → vérifier qu'elle s'affiche dans le tableau.
- [ ] Vérifier que l'amende est bien rattachée au **bon véhicule / conducteur**.
- [ ] Vérifier les formats (date, montant en €).
- [ ] Modifier puis supprimer une amende de test → vérifier après F5.

## 5. Vérifications générales (après chaque modif déployée)

- [ ] La page se charge sans erreur (pas d'écran blanc).
- [ ] Les modifs persistent après **F5** (sauvegarde Supabase OK).
- [ ] **Ctrl+Z / Ctrl+Y** (annuler / refaire) fonctionnent.
- [ ] Pas d'erreur rouge dans la console du navigateur (F12 → Console).

---

> Pour relancer ces tests : ouvre ce fichier, ou demande à Claude
> « sors-moi la liste des tests à faire ».
