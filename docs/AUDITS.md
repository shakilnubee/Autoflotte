# Parc Pilot — Batterie d'audits (à relancer de temps en temps)

**Comment lancer :** ouvre Claude sur ce projet et dis simplement **« fais l'audit »**
(ou « lance les audits »). Claude lance les auditeurs ci-dessous **en parallèle**
(un par domaine), vérifie chaque trouvaille dans le code réel, puis corrige les
vraies et te fait un rapport priorisé. On peut aussi n'en lancer qu'un : « fais
l'audit sécurité », « audit des calculs », etc.

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

---

*Historique : batterie constituée les 2026-07-30 après plusieurs incohérences
« même concept lu/calculé différemment selon l'écran ». Voir la règle
« une seule source de vérité » dans `CLAUDE.md`.*
