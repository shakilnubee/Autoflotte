# Parc Pilot — Batterie d'audits (à relancer de temps en temps)

**Comment lancer :** ouvre Claude sur ce projet et dis simplement **« fais l'audit »**
(ou « lance les audits »). Claude lance les auditeurs ci-dessous **en parallèle**
(un par domaine), vérifie chaque trouvaille dans le code réel, puis corrige les
vraies et te fait un rapport priorisé. On peut aussi n'en lancer qu'un : « fais
l'audit sécurité », « audit des calculs », etc.

**⚠️ MODE PROFOND — le défaut désormais (leçon du 2026-08-08).** Les auditeurs « par
domaine » (sections ci-dessous) survolent un thème sur toute la plateforme ; ils laissent
passer des bugs de **flux** très localisés (off-by-one d'un décompte, clé de dédup trop
grossière, homonyme de prénom qui envoie un mail au mauvais conducteur, export orphelin
après un refactor…). Donc « fais l'audit » lance MAINTENANT **en plus** un **agent par PAGE
et par flux** — pas seulement par thème :
- **1 agent par page applicative** (dashboard, véhicules, amendes, factures, contrôle,
  conducteurs, emprunts, sinistres, entretiens, contrats, à-vendre, statistiques, budget,
  calendrier, notifications, renouvellements, tâches, paramètres, scanner, facturation,
  prospects, espace-salarié) **+ 1 agent « helpers/`app.js`+`bareme.js` »** et **1 agent
  « Edge Functions » (`scan-doc`, `manage-users`, `send-email`)**.
- Chaque agent **trace de bout en bout** chaque **ajout / modification / suppression /
  import / export / scan / calcul** de sa page, en se mettant « dans la peau d'un client » :
  quels handlers, quel mapping `FP.db` (camel↔snake), la donnée est-elle bien persistée en
  base (pas juste en mémoire/localStorage), l'état se rafraîchit-il, `FP.dupe` est-il branché,
  `FP.esc` sur toute donnée saisie/OCR, et surtout : **la valeur testée/affichée lit-elle le
  même helper canonique que partout ailleurs** (`FP.estVendu`/`horsFlotte`, `FP.montantDu`,
  `FP.leasingContrat`, `FP.dedupeFactures`, `FP.joursRestants`…) ?
- Sortie identique : findings **vérifiés** `fichier:ligne` + gravité + **scénario concret**
  (entrées → résultat faux), **sans modifier de fichier** ; Claude corrige ensuite les vraies,
  vérifie la syntaxe, bumpe le `?v=`, et déploie.
- ⚠️ Un audit ne prouve JAMAIS l'absence de bug, et il ne voit pas le code écrit APRÈS lui :
  relancer le mode profond après tout gros lot de modifs.
- ⚠️ **Edge Functions** = seule partie qui ne se déploie pas via GitHub Pages : elle part via
  le workflow `.github/workflows/deploy-edge-functions.yml` (secret `SUPABASE_ACCESS_TOKEN`).

> Règle de sortie commune à TOUS les auditeurs : ne remonter que des failles
> **réelles et vérifiées** (lire les deux côtés du code avant d'affirmer), avec
> `fichier:ligne` + gravité, **sans modifier de fichier** — Claude corrige ensuite.

---

## 1. Sécurité & contrôle d'accès
Secrets exposés (clé `service_role`), gating de rôles CEO/Admin/Gestionnaire/
Chauffeur cohérent et non contournable, **XSS** (données saisies/OCR en `innerHTML`
sans `FP.esc`), auth guard présent, liens signés (documents privés), et surtout :
une protection qui n'est QUE côté client alors que seule la RLS protège vraiment.

## 2. Cohérence des calculs financiers
Un coût ajouté quelque part remonte-t-il dans TOUS les totaux (coût annuel Contrats,
TCO/€km/TVS Statistiques, dashboard, écran, rapport direction) ? Doubles comptages,
montant d'amende **dû** (majoré) via `FP.montantDu`, unités/périodes, /0, NaN.

## 3. Lecture de documents (OCR/IA) & anti-doublons
Jamais `Math.max` sur un montant d'amende ; majoration = seul titre « avis de
majoration » ; `montantTTC` = minoré ; contrôle HT+TVA=TTC ; `FP.dupe` branché à
tous les points d'ajout ; factures Ulys reconstruites par position.

## 4. Isolation multi-sociétés & RGPD
Clés de cache suffixées par société ; migrations/seeds réservés à PXP ; grep PII sur
`assets/js/data.js` (doit être **0**, repo public) ; aucun filtre `societe` oublié.

## 5. Bugs front / robustesse
Cache-busting `?v=` cohérent partout + `sw.js` ; liens internes ; classes Tailwind
manquantes ; null deref / TDZ ; `FP.searchSelect`/`conducteurPicker` ; code mort.
Lance aussi `node scripts/check-bugs.mjs .`.

## 6. Checklist « À compléter » vs sources réelles
Pour chaque champ de `notifications.html` (VEH_FIELDS/COND_FIELDS/AMENDE_FIELDS) :
le test « manquant » lit-il la MÊME source/helper que l'endroit qui AFFICHE la
donnée (fiche véhicule/conducteur) ? (Classe du bug « forfait leasing réclamé à tort ».)

## 7. Helpers dupliqués / divergents
Un même concept réimplémenté à la main au lieu du helper canonique : `FP.estVendu`
(pas `statut === 'vendu'`), `FP.montantDu`, `FP.leasingContrat`, `FP.normPrenom`,
`FP.coutMois`, `FP.anneeAmende`, filtre société. Signale toute divergence observable.

## 8. Valeurs incohérentes entre pages
Une même valeur affichée à 2 endroits calculée différemment (compteurs dashboard vs
pages, échéances Alertes vs Renouvellements, coût du mois dashboard/écran/rapport,
TVS/assurance/TCO, montant d'amende initial vs dû). Donne un scénario chiffré.

## 9. Perte de données / mapping base
Une saisie qui semble enregistrée mais est perdue : champ absent du mapping `toDb`
ou de la table, patch vide (« update qui réussit sans rien écrire »), erreur
d'écriture non remontée (échec silencieux), nom de colonne divergent, ou blob
`app_settings` écrasé entre postes (dernier qui écrit gagne).

## 10. Rafraîchissement d'état
Après un ajout/modif/suppression ou un changement de société : compteurs, listes,
graphes, caches se mettent-ils tous à jour, ou restent-ils périmés jusqu'à un
rechargement ? Signature `fp:data-ready` assez large ? Un élément supprimé peut-il
« revenir » (flash depuis un cache) ?

## 11. Contenu périmé / codé en dur PXP-TJMAX
Nom/valeur spécifique PXP/TJMAX/personne figé dans l'UI partagée ou une page
publique (index/brochure/prix), donc visible à tort par une autre société ou un
prospect. Distinguer les valeurs légitimes (bases PXP gardées par `soc === 'PXP'`,
contact public `jis.nubee@gmail.com`, démos fictives).

## 12. Éparpillement / regroupement (doublons de saisie & de stockage)
Une MÊME notion saisie ou stockée à plusieurs endroits, qui perd l'utilisateur ou
fait diverger les données. Chercher par domaine : **contacts/tiers** (deux annuaires
de garages `settings.prestataires` (Entretiens) vs `settings.garages` (Sinistres) ;
loueur en `settings.profil.loueurNom` vs `settings.loueurs[]` ; assureur éditable
dans Contrats ET Paramètres ; fournisseurs = texte libre re-saisi au lieu d'un
référentiel) ; **config société** éditable hors Paramètres (loueurs & primes
d'assurance dans Contrats alors que l'assureur+police sont dans Paramètres) ;
**documents/fichiers** (plusieurs portes d'entrée : scanner dashboard, « Importer un
document/facture », fiche véhicule, état des lieux — vérifier qu'elles atterrissent
dans la même table) ; **notes libres** réparties entre `settings.*` (vehNotes,
zoneNotes, inspections[].note, taches[].note) et colonnes DB (amendes.commentaire,
conducteurs.note…). Reco type : UNE source par clé, UN écran d'édition (dupliquer
l'UI en gardant la même fonction de save), référentiel commun pour les garages.
⚠️ NE PAS sortir les champs MÉTIER de leur logique (n° de police d'assurance,
`prop` du loueur qui sert à détecter le leasing) sous prétexte de regrouper.

## 13. Parcours client — actions qui ne se répercutent pas + concepts dispersés
Simuler un utilisateur qui **dépose / édite / SUPPRIME / ajoute**, domaine par domaine,
et traquer 2 classes de bug : **(1)** un même concept calculé/lu à PLUSIEURS endroits
sans helper `FP.*` commun (écrans qui divergent) ; **(2)** une action (surtout la
**suppression** et l'**édition**) qui ne se répercute pas partout (KPI, totaux, cache,
entité liée). Cinq sous-auditeurs, en parallèle :
- **13a. Factures & coûts** — coût mois/TCO/dashboard via `FP.coutMois`/`dedupeFactures` ;
  suppression/édition d'une facture qui laisse une révision/km/pneus fantôme sur le
  véhicule (symétrie `FP.applyFactureToVehicule` ↔ `FP.recomputeVehiculeFromFactures`) ;
  `FP.estEntretien` employé partout (carnet, Entretiens, Budget) ; dédup homogène.
- **13b. Amendes** — montant affiché = total via `FP.montantDu` ; statut « à payer »/
  « payée » via `FP.estAPayer`/`FP.estPayee` (jamais `statut === '…'` en dur) ; podiums
  et filtres d'année via `FP.normPrenom`/`FP.anneeAmende` ; suppression → KPI + podium.
- **13c. Véhicules** — statut via `FP.estVendu`/`FP.horsFlotte` (jamais `=== 'actif'`/
  `'vendu'` en dur) ; km affiché via `FP.kmActuel` ; leasing/TVS via les helpers ;
  **suppression → factures/amendes/emprunts orphelins** (choix : conserver l'historique
  des coûts + purger le cache société + avertir).
- **13d. Conducteurs & emprunts** — tout sélecteur de conducteur via `FP.conducteurPicker`
  (aucun `<select>`/texte libre) ; rapprochement via `FP.normPrenom`/`FP.normNomComplet` ;
  statut emprunt via `FP.empEnCours`/`empEnRetard` ; offboarding/suppression → libère les
  véhicules + purge PII ; homonymes de prénom qui fusionnent (identité prénom seul).
- **13e. Config / multi-sociétés / cache / rôles** — `FP.settings` toujours en delta-merge ;
  clés de cache suffixées par société (aucune fuite) ; tombstone société ; gardes de rôle
  **fail-closed** quand `FP.profile` non résolu ; pas de bleed PXP à la 1re peinture.

## 14. Source unique par CONCEPT (6 sous-auditeurs en parallèle)
Pour CHAQUE concept ci-dessous : le lit-on / calcule-t-on PARTOUT via le même helper
`FP.*` ? Une réimplémentation à la main (même « équivalente ») est un futur bug.
Sortie = `fichier:ligne` + snippet + helper attendu, **vérifié dans le code réel**.
- **14a. Statut véhicule** — `FP.estVendu` / `FP.horsFlotte` (jamais `statut === 'vendu'`,
  jamais un regex `/vendu/i` qui matche « **in**vendu », jamais une liste locale de statuts
  inactifs qui oublie « hors-service »).
- **14b. Amendes** — montant = `FP.montantDu` (jamais `a.montant` brut dans un total, jamais
  `Math.max`) ; statut via `FP.estAPayer`/`FP.estPayee` (jamais `=== 'payée'`/`'à payer'`) ;
  prénom via `FP.normPrenom`.
- **14c. Plaques & factures/coûts** — `FP.normImmat` (⚠️ piège : une normalisation « espaces
  seulement » `replace(/\s/g,'')` NE retire PAS les tirets → une plaque `AB-123-CD` ne
  retrouve pas sa prime/ses factures) ; dédup via `FP.dedupeFactures` ; coût via
  `FP.coutMois`/`FP.coutFactureExploit` (graphe ET KPI dédoublonnés à l'identique).
- **14d. Leasing / loueur / TVS / assurance** — `FP.leasingContrat`/`FP.leasingInfo` (jamais
  `FP.LEASING_CONTRATS[immat]` brut → fuite multi-sociétés) ; `FP.loueurOf` (pas de comparaison
  brute du champ propriétaire) ; `FP.tvsDetail` ; prime d'un véhicule **vendu** exclue partout
  (Contrats, Budget, Statistiques/TCO — même règle).
- **14e. Échéances / jours / société / checklist** — `FP.joursRestants` (minuit→minuit ; jamais
  `(new Date(x) - new Date())/86400000` qui prend l'heure courante → décalage d'un jour) ;
  couleur/urgence = `niveau` de `FP.buildEcheances` (même barème `<30`/`<60` sur toutes les pages :
  Alertes, Renouvellements, calendrier, écran) ; `FP.ctIgnored`/`FP.concerneAntiPollution`
  respectés partout (pas de « CT dépassé » sur un véhicule étranger exempté) ; checklist
  « À compléter » qui teste la MÊME source que l'écran qui affiche la donnée.
- **14f. Sinistres / conducteurs / emprunts** — statut sinistre via `FP.sinistreStatutOf`
  (résout la clé de groupe PUIS l'id de facture — sinon le statut d'un incident **regroupé** est
  invisible aux alertes) ; « reste à charge » via `FP.coutSinistre`/`FP.resteChargeSinistre`
  (0 si Remboursé/PEC, jamais le brut) ; emprunt « en retard » via `FP.empEnRetard` (règle
  > 2 jours, jamais réimplémentée) ; identité conducteur via `FP.normPrenom`.

---

*Historique : batterie constituée les 2026-07-30 après plusieurs incohérences
« même concept lu/calculé différemment selon l'écran ». Section 13 (parcours client)
ajoutée le 2026-08-01 après l'audit qui a créé les helpers `FP.applyFactureToVehicule`,
`FP.recomputeVehiculeFromFactures`, `FP.estEntretien`, `FP.estPayee`, `FP.kmActuel`,
`FP.empEnCours`, `FP.normNomComplet`. Voir la règle « une seule source de vérité » dans `CLAUDE.md`.
Section 14 (source unique par concept, 6 sous-auditeurs) ajoutée le 2026-08-04 après l'audit
qui a créé `FP.sinistreStatutOf`, `FP.empJoursDepuis` (et réécrit `FP.empEnRetard` sur la règle
« > 2 jours ») et corrigé : normalisations plaque « espaces seulement » (tirets ignorés),
graphe de coûts non dédoublonné vs KPI, prime d'assurance d'un véhicule vendu comptée dans le TCO,
statut sinistre invisible aux alertes sur un incident regroupé, fuite leasing multi-sociétés.*
