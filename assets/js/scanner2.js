/* ============================================================
   PARC PILOT — SCANNER IA v2 (3 étapes) — module autonome (chargé par pages/scanner.html)
   1) Détection du type · 2) Extraction par SCHÉMA du type · 3) Contrôle de cohérence
   Écran de validation : champs incertains surlignés, éditables, JAMAIS d'auto-enregistrement.
   S'appuie sur l'existant : FP.scanIA (Edge Function scan-doc) + FP.persist + FP.dupe.
   N'écrase RIEN des scanners actuels (facture/amende/carte grise) — il vit à côté (opt-in).
   ============================================================ */
(function () {
  const FP2 = {};
  const J = a => a.join('\n');
  const esc = s => (window.FP && FP.esc) ? FP.esc(s) : String(s == null ? '' : s);

  // ---- Règles transverses communes à toutes les extractions ----
  const BASE_RULES = J([
    "Tu lis un document de gestion de flotte automobile (peut etre incline, scanne, photo, multi-pages : redresse mentalement, lis TOUTES les pages, recto/verso, en-tetes/pieds, tableaux ligne par ligne, observations/reserves).",
    "NE JAMAIS INVENTER : champ absent -> null. Champ present mais difficile a lire -> niveau_confiance 'faible' + verification_humaine_requise true. Ne devine pas un numero, ne deduis pas une date sans preuve, ne transforme pas une donnee incertaine en certaine.",
    "Pour CHAQUE champ demande, renvoie un objet : { champ, valeur_originale, valeur_normalisee, page, libelle_document, niveau_confiance ('eleve'|'moyen'|'faible'), verification_humaine_requise (bool) }.",
    "Normalisation : dates -> valeur_normalisee au format AAAA-MM-JJ (garder l'originale). Montants -> nombre a point decimal. Kilometrages -> entier sans unite. Numeros (VIN, immat, permis, contrat, police, avis) -> ne modifie que les espaces parasites, jamais les chiffres. VIN = 17 caracteres : si different, signale l'anomalie sans corriger.",
    "Renvoie UNIQUEMENT un objet JSON valide, sans texte autour, de forme : { \"type_document\":\"\", \"sous_type\":\"\", \"langue\":\"fr\", \"qualite_document\":\"bonne|moyenne|insuffisante\", \"champs\":[ ... ], \"anomalies\":[ {type, gravite, description} ], \"champs_manquants\":[ {champ, importance} ], \"nouveau_scan_recommande\": false }."
  ]);

  // ---- Étape 1 : détection du type ----
  const DETECT_PROMPT = J([
    "Identifie le TYPE de ce document de gestion de flotte. Ne l'extrais pas encore.",
    "Renvoie UNIQUEMENT un JSON : { \"type_document\":\"<cle>\", \"sous_type\":\"\", \"nombre_pages\":0, \"nombre_documents_detectes\":1, \"qualite_document\":\"bonne|moyenne|insuffisante\", \"langue\":\"fr\", \"confiance\":\"eleve|moyen|faible\" }.",
    "Cles possibles pour type_document : certificat_immatriculation, permis_conduire, contrat_location, attestation_assurance, controle_technique, facture_entretien, avis_contravention, forfait_post_stationnement, document_inconnu.",
    "Indices : 'Certificat d'immatriculation'/champs A B C D E = certificat_immatriculation ; 'Permis de conduire'/categories B = permis_conduire ; 'Location Longue Duree'/LLD/loyer/loueur = contrat_location ; 'Attestation d'assurance'/police/garanties = attestation_assurance ; 'Controle technique'/PV/defaillances = controle_technique ; 'Avis de contravention'/'amende'/telepaiement = avis_contravention ; 'Forfait Post-Stationnement'/FPS = forfait_post_stationnement ; facture/devis d'entretien-reparation = facture_entretien."
  ]);

  // ---- Étape 2 : SCHÉMAS d'extraction par type (Phase 1 = 7 types) ----
  // key -> { label, cible (table métier), champs:[[cle,'libelle',(hint)]] }
  const SCHEMAS = {
    certificat_immatriculation: { label: "Carte grise", cible: "vehicules", champs: [
      ["immat", "Immatriculation (A)"], ["date1", "1re mise en circulation (B)"], ["titulaire", "Titulaire (C.1)"],
      ["marque", "Marque (D.1)"], ["version", "Version (D.2)"], ["modele", "Denomination commerciale (D.3)"],
      ["vin", "VIN (E)"], ["ptac", "PTAC (F.2)"], ["masse", "Masse en service (G)"], ["genre", "Genre national (J.1)"],
      ["puissanceKw", "Puissance nette (P.2)"], ["energie", "Energie (P.3)"], ["puissanceFiscale", "Puissance administrative (P.6)"],
      ["places", "Nombre de places (S.1)"], ["co2", "CO2 g/km (V.7)"], ["prochainCT", "Date prochain CT (X.1)"], ["mentionsZ", "Mentions particulieres (Z)"]
    ]},
    permis_conduire: { label: "Permis de conduire", cible: "conducteurs", champs: [
      ["nom", "Nom"], ["prenom", "Prenom"], ["dateNaissance", "Date de naissance"], ["numeroPermis", "Numero du permis"],
      ["dateDelivrance", "Date de delivrance"], ["dateExpirationTitre", "Fin de validite du titre"],
      ["categories", "Categories (liste ; NE PAS extraire le nombre de points)"], ["restrictions", "Restrictions/codes"], ["paysEmetteur", "Pays emetteur"]
    ]},
    contrat_location: { label: "Contrat LLD / location", cible: "leasing", champs: [
      ["loueur", "Loueur"], ["locataire", "Locataire"], ["numeroContrat", "N° de contrat"], ["immat", "Immatriculation"],
      ["vin", "VIN"], ["marque", "Marque"], ["modele", "Modele"], ["energie", "Energie"],
      ["loyerTTC", "Loyer mensuel TTC (par mois, services inclus)"], ["premierLoyer", "1er loyer / majore"], ["apport", "Apport / depot"],
      ["dureeMois", "Duree (mois)"], ["dateDebut", "Date de debut"], ["dateFin", "Date de fin"],
      ["kmAnnuel", "Km annuel"], ["kmTotal", "Km total autorise"], ["prixKmSupp", "Prix du km supplementaire"], ["valeurResiduelle", "Valeur residuelle / option d'achat"]
    ]},
    attestation_assurance: { label: "Assurance", cible: "documents", champs: [
      ["assureur", "Assureur"], ["souscripteur", "Souscripteur"], ["numeroPolice", "N° de police / contrat"], ["immat", "Immatriculation"],
      ["vin", "VIN"], ["dateDebut", "Debut de validite"], ["dateFin", "Fin de validite / echeance"],
      ["garanties", "Garanties"], ["franchises", "Franchises (dommages/vol/bris de glace)"], ["numeroAssistance", "N° d'assistance"]
    ]},
    controle_technique: { label: "Contrôle technique", cible: "vehicules", champs: [
      ["numeroPV", "N° de PV"], ["date", "Date du controle"], ["centre", "Centre"], ["immat", "Immatriculation"], ["vin", "VIN"],
      ["km", "Kilometrage"], ["resultat", "Resultat (favorable/defavorable majeure/defavorable critique)"],
      ["prochainCT", "Date prochain controle"], ["contrevisite", "Contre-visite obligatoire (oui/non)"], ["dateLimiteContrevisite", "Date limite contre-visite"]
    ]},
    facture_entretien: { label: "Facture / devis entretien", cible: "factures", champs: [
      ["typeDoc", "Type (devis/facture/avoir/ordre de reparation)"], ["numero", "N° de facture"], ["date", "Date d'emission"],
      ["fournisseur", "Fournisseur / garage (emetteur, PAS le client)"], ["siret", "SIRET emetteur"], ["immat", "Immatriculation"],
      ["vin", "VIN"], ["km", "Kilometrage"], ["description", "Nature de l'intervention (court)"],
      ["montantHT", "Total HT"], ["montantTVA", "TVA"], ["montantTTC", "Total TTC"], ["acompte", "Acompte"], ["resteAPayer", "Reste a payer"]
    ]},
    avis_contravention: { label: "Amende / avis", cible: "amendes", champs: [
      ["numeroAvis", "N° de l'avis"], ["numeroTelepaiement", "N° de telepaiement"], ["immat", "Immatriculation"],
      ["dateInfraction", "Date de l'infraction (constatee le)"], ["heure", "Heure"], ["lieu", "Lieu"], ["motif", "Nature de l'infraction"],
      ["montantMinore", "Montant MINORE"], ["dateLimiteMinore", "Date limite du minore"], ["montantForfaitaire", "Montant forfaitaire"],
      ["dateLimiteForfaitaire", "Date limite forfaitaire"], ["montantMajore", "Montant MAJORE"], ["dateApplicationMajore", "Date d'application de la majoration"],
      ["points", "Points retires (uniquement si ecrit, sinon null)"]
    ]},
    forfait_post_stationnement: { label: "FPS (post-stationnement)", cible: "amendes", champs: [
      ["numeroFps", "N° de FPS"], ["collectivite", "Collectivite / operateur"], ["immat", "Immatriculation"], ["date", "Date"], ["lieu", "Lieu / zone"],
      ["montantInitial", "Montant initial"], ["montantMinore", "Montant minore"], ["dateLimite", "Date limite de paiement"],
      ["montantMajore", "Montant majore eventuel"], ["recoursDateLimite", "Date limite du recours (RAPO)"]
    ]}
  };
  // Alias renvoyés parfois par la détection.
  const TYPE_ALIAS = { "carte_grise": "certificat_immatriculation", "carte-grise": "certificat_immatriculation", "amende_forfaitaire_majoree": "avis_contravention", "document_antai": "avis_contravention", "contrat_leasing": "contrat_location", "releve_information_assurance": "attestation_assurance", "devis_reparation": "facture_entretien", "facture_fournisseur": "facture_entretien" };

  function schemaFor(type) { return SCHEMAS[type] || SCHEMAS[TYPE_ALIAS[type]] || null; }
  function normType(type) { return SCHEMAS[type] ? type : (TYPE_ALIAS[type] || type); }

  function buildExtractPrompt(type) {
    const s = schemaFor(type); if (!s) return null;
    const lignes = s.champs.map(c => "- " + c[0] + " : " + c[1]);
    const extra = [];
    if (s.cible === "amendes") extra.push(
      "AMENDES : renvoie TOUJOURS les 3 montants separement (minore, forfaitaire, majore) avec leurs dates limites. NE choisis JAMAIS automatiquement le plus grand. Le montant a payer sera decide par l'application selon la date du jour.",
      "Ne confonds jamais un montant avec un n° d'avis, de telepaiement, de telephone, une annee ou un code postal (le montant est petit, en general 11 a 1500 euros)."
    );
    if (s.cible === "vehicules") extra.push("Immatriculation = plaque francaise AB-123-CD. Ne confonds pas titulaire (C.1) et conducteur habituel.");
    return J([
      "Type de document : " + s.label + ". Extrais UNIQUEMENT ces champs (dans l'ordre) :",
      J(lignes),
      extra.length ? J(extra) : "",
      "",
      BASE_RULES
    ]);
  }

  // ---- helpers de lecture des champs renvoyés ----
  function champ(model, key) { try { return (model.champs || []).find(c => c && c.champ === key) || null; } catch (e) { return null; } }
  function val(model, key) { const c = champ(model, key); return c ? (c.valeur_normalisee != null && c.valeur_normalisee !== '' ? c.valeur_normalisee : c.valeur_originale) : null; }
  function num(v) { if (v == null || v === '') return null; const n = parseFloat(String(v).replace(/[\s€]/g, '').replace(',', '.')); return isFinite(n) ? n : null; }
  function intv(v) { const n = num(v); return n == null ? null : Math.round(n); }

  // ---- Étape 3 : contrôle de cohérence (100% côté site, sans IA) ----
  function coherence(model, type) {
    const t = normType(type); const out = Array.isArray(model.anomalies) ? model.anomalies.slice() : [];
    const add = (type2, gravite, description) => out.push({ type: type2, gravite, description, verification_humaine_requise: gravite !== 'basse' });
    // VIN 17 caractères
    const vin = val(model, 'vin'); if (vin && String(vin).replace(/\s/g, '').length !== 17) add('vin_longueur', 'moyenne', `Le VIN « ${vin} » ne fait pas 17 caractères — à vérifier.`);
    // HT + TVA = TTC (tolérance 2 cts)
    if (t === 'facture_entretien') { const ht = num(val(model, 'montantHT')), tva = num(val(model, 'montantTVA')), ttc = num(val(model, 'montantTTC')); if (ht != null && tva != null && ttc != null && Math.abs(ht + tva - ttc) > 0.02) add('montants_incoherents', 'elevee', `HT (${ht}) + TVA (${tva}) ≠ TTC (${ttc}). À vérifier avant enregistrement.`); }
    // Amende : les 3 montants, jamais le majoré par défaut
    if (t === 'avis_contravention') { const mi = num(val(model, 'montantMinore')), fo = num(val(model, 'montantForfaitaire')), ma = num(val(model, 'montantMajore')); if (mi == null && fo == null) add('montant_amende_absent', 'moyenne', "Aucun montant minoré/forfaitaire lu — à saisir à la main."); if (ma != null && mi == null && fo == null) add('montant_majore_seul', 'moyenne', "Seul le montant majoré a été lu : ne jamais l'appliquer par défaut, vérifie les dates limites."); }
    // Immatriculation présente dans la flotte ? (info, pas bloquant)
    const immat = val(model, 'immat');
    if (immat && window.data && Array.isArray(data.vehicules)) { const up = String(immat).toUpperCase().replace(/\s/g, ''); const known = data.vehicules.some(v => String(v.immat || '').toUpperCase().replace(/\s/g, '') === up); if (!known && t !== 'certificat_immatriculation') add('vehicule_inconnu', 'basse', `Le véhicule ${immat} n'est pas (encore) dans la flotte.`); }
    // Dates : fin < début
    const d1 = val(model, 'dateDebut'), d2 = val(model, 'dateFin'); if (d1 && d2 && new Date(d1) > new Date(d2)) add('dates_incoherentes', 'moyenne', "La date de fin est antérieure à la date de début.");
    // CT / assurance expirés (info)
    if (t === 'attestation_assurance') { const fin = val(model, 'dateFin'); if (fin && new Date(fin) < new Date()) add('assurance_expiree', 'elevee', `L'attestation semble expirée (fin ${fin}).`); }
    model.anomalies = out; return model;
  }

  // ---- Pipeline complet ----
  FP2.run = async function (file, onStep) {
    if (!(window.FP && FP.scanIA)) throw new Error("Scanner indisponible (FP.scanIA manquant).");
    onStep && onStep('detect');
    let det = null;
    try { det = await FP.scanIA(file, 'detect', DETECT_PROMPT); } catch (e) { console.warn('[scan2 detect]', e); }
    let type = (det && (det.type_document || det.type)) || 'document_inconnu';
    type = normType(type);
    if (!schemaFor(type)) {
      // type non couvert en Phase 1 : on tente quand même une extraction "facture" générique
      type = 'facture_entretien';
    }
    onStep && onStep('extract', { type, label: (schemaFor(type) || {}).label });
    const prompt = buildExtractPrompt(type);
    // Extraction verbeuse (provenance/confiance par champ) → autoriser plus de jetons pour ne pas tronquer le JSON.
    let model = await FP.scanIA(file, type, prompt, { maxTokens: 4096 });
    if (!model || typeof model !== 'object') model = { champs: [] };
    model.type_document = type;
    model.sous_type = (det && det.sous_type) || model.sous_type || '';
    if (!model.qualite_document && det && det.qualite_document) model.qualite_document = det.qualite_document;
    onStep && onStep('coherence');
    model = coherence(model, type);
    model.cible = (schemaFor(type) || {}).cible || null;
    return model;
  };

  // ============================================================
  //  ENREGISTREMENT (après validation humaine) — route vers la bonne table
  // ============================================================
  function societe() { try { return (FP.activeSociete && FP.activeSociete()) || 'PXP'; } catch (e) { return 'PXP'; } }
  function nextVehId() { let m = 0; try { (data.vehicules || []).forEach(v => { const x = String(v.id || '').match(/(\d+)/); if (x) m = Math.max(m, +x[1]); }); } catch (e) {} return 'V-' + String(m + 1).padStart(3, '0'); }
  function findVeh(immat) { if (!immat) return null; const up = String(immat).toUpperCase().replace(/\s/g, ''); try { return (data.vehicules || []).find(v => String(v.immat || '').toUpperCase().replace(/\s/g, '') === up) || null; } catch (e) { return null; } }
  function uid(p) { return (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // Lit les valeurs éditées depuis l'UI (map champ->valeur) fusionnées avec le modèle.
  FP2.save = async function (model, edited) {
    const g = k => (edited && Object.prototype.hasOwnProperty.call(edited, k)) ? edited[k] : val(model, k);
    const t = normType(model.type_document);
    const cible = (schemaFor(t) || {}).cible;
    let target = { table: null, id: null };

    if (cible === 'vehicules') {
      const immat = (g('immat') || '').toUpperCase().trim();
      if (!immat) throw new Error("Immatriculation manquante.");
      const existing = findVeh(immat);
      // Carte grise : crée/complète le véhicule. CT : met à jour dates CT.
      const rec = existing ? { ...existing } : { id: nextVehId(), immat, statut: 'actif', groupes: ['non-classe'], societe: societe() };
      if (t === 'certificat_immatriculation') {
        if (g('marque')) rec.marque = g('marque'); if (g('modele')) rec.modele = g('modele'); if (g('version')) rec.version = g('version');
        if (g('vin')) rec.vin = g('vin'); if (num(g('co2')) != null) rec.co2 = num(g('co2'));
        if (intv(g('puissanceFiscale')) != null) rec.puissanceFiscale = intv(g('puissanceFiscale'));
        if (g('energie')) rec.carburant = g('energie'); if (g('date1')) rec.dateMiseEnCirculation = g('date1');
        if (g('prochainCT')) rec.prochainCT = g('prochainCT');
        if (intv(g('masse')) != null) { try { const s = FP.settings.get(); s.vehMasse = s.vehMasse || {}; s.vehMasse[rec.id] = intv(g('masse')); FP.settings.save(s); } catch (e) {} }
      } else if (t === 'controle_technique') {
        if (g('date')) rec.dateDernierCT = g('date'); if (g('prochainCT')) rec.prochainCT = g('prochainCT');
        if (intv(g('km')) != null) rec.km = intv(g('km'));
      }
      if (existing) { try { FP.persist.update('vehicules', rec.id, rec); } catch (e) { FP.persist.upsert('vehicules', rec); } }
      else { try { FP.persist.insert('vehicules', rec); } catch (e) {} try { if (window.data && Array.isArray(data.vehicules)) data.vehicules.push(rec); } catch (e) {} }
      target = { table: 'vehicules', id: rec.id };
    }
    else if (cible === 'factures') {
      const rec = { id: uid('F'), societe: societe(), date: g('date') || '', fournisseur: g('fournisseur') || '', numero: g('numero') || '',
        montantHT: num(g('montantHT')), montantTVA: num(g('montantTVA')), montantTTC: num(g('montantTTC')),
        vehiculeImmat: (g('immat') || '').toUpperCase(), km: intv(g('km')), description: g('description') || '', type: 'entretien' };
      try { if (FP.dupe && FP.dupe.find && FP.dupe.find('factures', rec, data.factures || [])) { /* doublon */ } } catch (e) {}
      FP.persist.insert('factures', rec); try { if (window.data && Array.isArray(data.factures)) data.factures.push(rec); } catch (e) {}
      target = { table: 'factures', id: rec.id };
    }
    else if (cible === 'amendes') {
      const mi = num(g('montantMinore')), fo = num(g('montantForfaitaire'));
      const rec = { id: uid('A'), societe: societe(), numeroAvis: g('numeroAvis') || g('numeroFps') || '',
        prenom: '', vehiculeImmat: (g('immat') || '').toUpperCase(), date: g('dateInfraction') || g('date') || '', motif: g('motif') || (t === 'forfait_post_stationnement' ? 'Stationnement (FPS)' : ''),
        montantTTC: (mi != null ? mi : (fo != null ? fo : num(g('montantInitial')))), // JAMAIS le majoré par défaut
        montantMinore: mi, montantForfaitaire: fo, montantMajore: num(g('montantMajore')),
        dateLimiteMinore: g('dateLimiteMinore') || g('dateLimite') || '', dateLimiteForfaitaire: g('dateLimiteForfaitaire') || '', statut: 'à payer' };
      FP.persist.insert('amendes', rec); try { if (window.data && Array.isArray(data.amendes)) data.amendes.push(rec); } catch (e) {}
      target = { table: 'amendes', id: rec.id };
    }
    else if (cible === 'conducteurs') {
      const nom = [g('prenom'), g('nom')].filter(Boolean).join(' ').trim() || g('nom') || '';
      if (!nom) throw new Error("Nom du conducteur manquant.");
      const rec = { id: uid('C'), key: nom.toLowerCase().replace(/\s+/g, '-'), name: nom, societe: societe(),
        permisNumero: g('numeroPermis') || '', permisExpiration: g('dateExpirationTitre') || '', permisObtention: g('dateDelivrance') || '',
        permisType: Array.isArray(g('categories')) ? g('categories').join(', ') : (g('categories') || '') };
      FP.persist.insert('conducteurs', rec);
      target = { table: 'conducteurs', id: rec.id };
    }
    else if (cible === 'leasing') {
      const rec = { conducteur: '', immat: (g('immat') || '').toUpperCase(), marque: g('marque') || '', modele: g('modele') || '',
        loueur: g('loueur') || '', loyerTTC: num(g('loyerTTC')), dureeMois: intv(g('dureeMois')), kmTotal: intv(g('kmTotal')),
        debut: g('dateDebut') || null, fin: g('dateFin') || null, offre: g('numeroContrat') || '', kmSupp: num(g('prixKmSupp')), docs: [] };
      try { const s = FP.settings.get(); const l = Array.isArray(s.localeaseContrats) ? s.localeaseContrats : []; l.push(rec); s.localeaseContrats = l; FP.settings.save(s); } catch (e) {}
      target = { table: 'leasing', id: rec.immat };
    }
    else if (cible === 'documents') {
      // Assurance → document rattaché au véhicule (si immat connue), sinon simple archive.
      const immat = (g('immat') || '').toUpperCase(); const veh = findVeh(immat);
      const rec = { id: uid('D'), societe: societe(), vehiculeId: veh ? veh.id : null, type: 'assurance',
        label: 'Attestation assurance' + (g('assureur') ? ' — ' + g('assureur') : ''), date: g('dateDebut') || '', url: model._fileUrl || null,
        note: JSON.stringify({ assureur: g('assureur'), police: g('numeroPolice'), fin: g('dateFin') }) };
      FP.persist.insert('documents', rec);
      target = { table: 'documents', id: rec.id };
    }
    else { throw new Error("Type non pris en charge pour l'enregistrement (Phase 1)."); }

    // Traçabilité : archive le scan (table 'scans') — best effort.
    try {
      const srec = { id: uid('sc'), societe: societe(), type_document: t, sous_type: model.sous_type || '', statut: 'valide',
        qualite: model.qualite_document || '', fichier_url: model._fileUrl || null,
        extraction: { champs: model.champs, anomalies: model.anomalies, champs_manquants: model.champs_manquants, edited: edited || {} },
        cible_table: target.table, cible_id: target.id };
      if (FP.persist && FP.persist.insert) FP.persist.insert('scans', srec);
    } catch (e) { console.warn('[scan2 trace]', e); }
    return target;
  };

  FP2.SCHEMAS = SCHEMAS; FP2.schemaFor = schemaFor; FP2.normType = normType; FP2.champ = champ; FP2.val = val;
  window.FP2 = FP2;
})();
