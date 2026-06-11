// Auto-flotte — helpers JS partagés

// Affichage instantané sans "flash" de chiffres : on ré-hydrate FP_DATA avec la
// dernière copie live mise en cache (écrite après chaque chargement Supabase),
// au lieu des données figées de data.js. Supabase rafraîchit juste après.
// (app.js s'exécute après data.js et avant que les pages lisent window.FP_DATA)
// ⚠️ La clé est VERSIONNÉE (…_v3). Un ancien cache périmé d'une session précédente
// écraserait sinon le data.js (à jour) par de vieux chiffres → re-flash. En changeant
// la clé, tout cache obsolète est ignoré et on repart du data.js frais jusqu'au 1er
// chargement Supabase (qui réécrit un cache propre).
// ⚠️ Clé de cache PAR SOCIÉTÉ : sinon le cache d'une société (ex. PXP) s'afficherait sur une
// autre (ex. « essaie B »). On suffixe par la société active (lue directement en localStorage,
// car FP.activeSociete n'est pas encore défini à ce stade).
window.FP_CACHE_KEY = 'fp_data_cache_v3_' + (function(){ try { return localStorage.getItem('fp_societe') || 'PXP'; } catch (e) { return 'PXP'; } })();
(function seedFromCache() {
  try { localStorage.removeItem('fp_data_cache'); } catch (e) {} // purge l'ancienne clé (non suffixée)
  try {
    const c = JSON.parse(localStorage.getItem(window.FP_CACHE_KEY) || 'null');
    if (c && window.FP_DATA && Array.isArray(c.amendes)) {
      if (Array.isArray(c.vehicules)) window.FP_DATA.vehicules = c.vehicules;
      if (Array.isArray(c.amendes))   window.FP_DATA.amendes   = c.amendes;
      if (Array.isArray(c.factures))  window.FP_DATA.factures  = c.factures;
    }
  } catch (e) { /* cache illisible : on garde data.js */ }
})();

const FP = {
  // Format euro — null/undefined/"" /NaN ⇒ 0 (évite d'afficher "NaN €")
  euro(n) {
    const v = Number(n);
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number.isFinite(v) ? v : 0);
  },
  euroPrecis(n) {
    const v = Number(n);
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number.isFinite(v) ? v : 0);
  },
  // Format date FR
  date(iso) {
    if (!iso || iso === '—') return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  },
  // Format date numérique JJ/MM/AAAA (sans nom de mois)
  dateNum(iso) {
    if (!iso || iso === '—') return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  },
  // Nombre formaté — null/undefined/"" /NaN ⇒ 0 (évite d'afficher "NaN")
  num(n) {
    const v = Number(n);
    return new Intl.NumberFormat('fr-FR').format(Number.isFinite(v) ? v : 0);
  },
  // Cherche un véhicule par id
  vehicule(id) {
    return (window.FP_DATA?.vehicules || []).find(v => v.id === id);
  },
  // Badge HTML selon statut véhicule
  statutBadge(statut) {
    const map = {
      'actif':       { cls: 'badge-ok',     label: 'Actif' },
      'entretien':   { cls: 'badge-warn',   label: 'En entretien' },
      'à vendre':    { cls: 'badge-warn',   label: 'À vendre' },
      'vendu':       { cls: 'badge-info',   label: 'Vendu' },
    };
    const m = map[statut] || { cls: 'badge-info', label: statut };
    return `<span class="badge ${m.cls}">${m.label}</span>`;
  },
  // Jours restants entre aujourd'hui et une date ISO
  joursRestants(iso) {
    if (!iso || iso === '—') return null;
    const d = new Date(iso);
    if (isNaN(d)) return null;
    const diff = Math.ceil((d - new Date()) / (1000*60*60*24));
    return diff;
  },
  // Calcul TVS approximatif (Taxe sur les Véhicules de Société) — démo
  tvsAnnuelle(v) {
    const d = FP.tvsDetail(v);
    return (d.applicable && d.total != null) ? d.total : 0;
  },
};

// =====================================================================
// === TVS — taxes annuelles sur l'affectation des véhicules ===========
// =====================================================================
// Remplace l'ancienne "TVS". Deux composantes :
//   1) taxe annuelle sur les émissions de CO2 (barème WLTP, marginal €/g)
//   2) taxe annuelle sur les émissions de polluants atmosphériques (selon énergie)
// ⚠️ Barème 2026 — les montants changent chaque année. Facile à mettre à jour ici.
// Ne s'applique qu'aux véhicules de tourisme (VP) : ni utilitaires, ni motos.
// Vérifié : un véhicule à 100 g CO2 (WLTP) = 213 € en 2026.
FP.TVS_ANNEE = 2026;
// Barème WLTP 2026 : tarif marginal par g/km (cumulatif par tranches)
FP.TVS_CO2_BAREME = [
  { jusqua: 4,        taux: 0 },
  { jusqua: 45,       taux: 1 },
  { jusqua: 53,       taux: 2 },
  { jusqua: 85,       taux: 3 },
  { jusqua: 105,      taux: 4 },
  { jusqua: Infinity, taux: 10 },
];
FP.tvsCo2 = (co2) => {
  let total = 0, prev = 0;
  for (const b of FP.TVS_CO2_BAREME) {
    if (co2 > prev) { total += (Math.min(co2, b.jusqua) - prev) * b.taux; prev = b.jusqua; }
    else break;
  }
  return Math.round(total);
};
// Taxe polluants atmosphériques (barème 2026) selon l'énergie / Crit'Air
//  - Électrique / hydrogène : 0 €
//  - Véhicules récents Euro 5/6 (essence, hybride, diesel) : 100 €
//  - (Véhicules les plus polluants Crit'Air 3+ : 500 € — rares, à ajuster au cas par cas)
FP.tvsPolluant = (carburant) => {
  const c = (carburant || '').toLowerCase();
  if (/lectri|hydrog/.test(c)) return 0;
  return 100;
};
// Détail TVS d'un véhicule : { applicable, raison?, co2, polluant, total, ... }
FP.tvsDetail = (v) => {
  const cat = (v.categorie || '').toLowerCase();
  const carb = v.carburant || '';
  if (/moto/.test(cat)) return { applicable: false, raison: 'Moto — non soumise' };
  if (/utilit|engin/.test(cat)) return { applicable: false, raison: 'Utilitaire — non soumis' };
  const polluant = FP.tvsPolluant(carb);
  if (/lectri|hydrog/i.test(carb)) return { applicable: true, elec: true, co2: 0, polluant: 0, total: 0 };
  const co2 = Number(v.co2);
  if (!Number.isFinite(co2) || co2 <= 0) return { applicable: true, co2Manquant: true, co2: null, polluant, total: null };
  const co2Tax = FP.tvsCo2(co2);
  return { applicable: true, co2: co2Tax, polluant, total: co2Tax + polluant };
};

// IMPORTANT — partage d'un SEUL objet FP.
// supabase-client.js (chargé AVANT app.js) a déjà posé FP.supabase / FP.db / FP.auth
// sur window.FP. Sans cette fusion, le `const FP` ci-dessus serait un objet DIFFÉRENT
// (avec les helpers mais SANS supabase/db) → les écritures en base échoueraient
// silencieusement alors que les données s'affichent quand même. On fusionne donc les deux.
if (typeof window !== 'undefined') {
  if (window.FP) Object.assign(FP, window.FP); // récupère supabase, db, auth, dbReady, _clientLoaded…
  window.FP = FP;                              // une référence unique, partagée par toutes les pages
}

// === Rôle utilisateur (gating visuel) ===
// Lu de façon synchrone depuis les métadonnées Supabase stockées dans le token.
// Rôles : 'admin' (par défaut, ex : le propriétaire) et 'gestionnaire'.
// Pour créer un gestionnaire : Supabase → Auth → Add user → User Metadata { "role": "gestionnaire" }
FP.SUPA_TOKEN_KEY = 'sb-tzjuptlzoywjeigmyfuj-auth-token';
FP.role = () => {
  try {
    const t = JSON.parse(localStorage.getItem(FP.SUPA_TOKEN_KEY) || 'null');
    const r = t && t.user && t.user.user_metadata && t.user.user_metadata.role;
    return r === 'gestionnaire' ? 'gestionnaire' : 'admin';
  } catch { return 'admin'; }
};
FP.isAdmin = () => FP.role() === 'admin';
FP.roleLabel = () => FP.isAdmin() ? 'Admin' : 'Gestionnaire';
// Personnalisation de l'apparence (renommer titres/colonnes/onglets) : autorisée admin + gestionnaire.
// Mettre `=> FP.isAdmin()` ici pour la réserver à l'admin.
FP.canPersonnaliser = () => true;
// Onglets réservés à l'admin (retirés du menu pour les autres rôles)
FP.ADMIN_ONLY_NAV = ['parametres.html'];

// === Multi-sociétés (vue admin) ===
FP.activeSociete = () => { try { return localStorage.getItem('fp_societe') || 'PXP'; } catch (e) { return 'PXP'; } };
FP.setActiveSociete = (s) => { try { localStorage.setItem('fp_societe', s || 'PXP'); } catch (e) {} };
FP.getSocietes = () => { const arr = (FP.settings.get().societes || ['PXP']).slice(); if (!arr.includes('PXP')) arr.unshift('PXP'); return arr; };
FP.addSociete = (name) => {
  name = (name || '').trim(); if (!name) return false;
  const s = FP.settings.get();
  const arr = Array.isArray(s.societes) ? s.societes.slice() : ['PXP'];
  if (!arr.includes('PXP')) arr.unshift('PXP');
  if (arr.some(x => x.toLowerCase() === name.toLowerCase())) return false;
  arr.push(name); s.societes = arr; FP.settings.save(s); return true;
};
// Le cache statique data.js ne contient que PXP : si une autre société est active,
// on le vide au démarrage (les vraies données filtrées arriveront via Supabase),
// sinon on verrait des données PXP sur une autre société.
(function filterStaticCacheBySociete() {
  try {
    const s = FP.activeSociete();
    if (s === 'PXP' || s === '__all__') return;
    const d = window.FP_DATA; if (!d) return;
    ['vehicules', 'amendes', 'factures', 'conducteurs'].forEach(k => {
      const arr = d[k]; if (!Array.isArray(arr)) return;
      for (let i = arr.length - 1; i >= 0; i--) { if (((arr[i] && arr[i].societe) || 'PXP') !== s) arr.splice(i, 1); }
    });
  } catch (e) {}
})();

// (Anciennement « antiFlashCache » : on masquait le contenu jusqu'au chargement Supabase pour
// cacher le clignotement du cache statique périmé. Désormais data.js est régénéré à jour et le
// cache local ré-hydrate FP_DATA AVANT le rendu → le 1er affichage est déjà correct. On n'a donc
// plus besoin de masquer la page : on l'affiche IMMÉDIATEMENT (zéro latence à chaque onglet).
// La mise à jour live (fp:data-ready) se fait ensuite en place, sans masquage.)

// === Navigation quasi-instantanée : préchargement des onglets (Speculation Rules) ===
// Au survol d'un lien de la barre latérale, le navigateur précharge la page cible → le clic
// affiche la page quasi instantanément. Combiné aux View Transitions (CSS), on obtient la
// fluidité d'une "application" sans réécrire le site. Feature-detecté → aucun effet si non supporté.
(function navSpeculation() {
  try {
    if (!HTMLScriptElement.supports || !HTMLScriptElement.supports('speculationrules')) return;
    const add = () => {
      try {
        const urls = [...new Set(
          [...document.querySelectorAll('.fp-sidebar a[href]')]
            .map(a => a.href)
            .filter(h => h && h.indexOf(location.origin) === 0 && h.indexOf('#') === -1)
        )];
        if (!urls.length) return;
        const s = document.createElement('script');
        s.type = 'speculationrules';
        s.textContent = JSON.stringify({ prefetch: [{ source: 'list', urls: urls, eagerness: 'moderate' }] });
        document.body.appendChild(s);
      } catch (e) {}
    };
    if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
  } catch (e) {}
})();

// === Paramètres utilisateur persistés (localStorage) ===
FP.settings = {
  STORAGE_KEY: 'auto_flotte_settings',
  defaults: {
    groupes: {
      'siege':       { label: 'Siège',       color: '#F59E0B' },
      'commerciaux': { label: 'Commerciaux', color: '#CA8A04' },
      'gov':         { label: 'Gov',         color: '#10B981' },
      'pool':        { label: 'International', color: '#84CC16' },
      'a-vendre':    { label: 'À vendre',    color: '#DC2626' },
      'retail':      { label: 'Retail',      color: '#8B5CF6' },
      'depot':       { label: 'Dépôt',       color: '#3B82F6' },
      'non-classe':  { label: 'Non classé',  color: '#94A3B8' },
    },
    societe: { nom: 'Auto-flotte', siret: '', adresse: '' },
    platformColor: '#111827', // couleur de base de l'interface (sidebar/titres/boutons foncés) — noir Parc Pilot
    sidebarLabels: {}, // ex: { 'vehicules.html': 'Mes voitures', 'amendes.html': 'PV' }
    customTexts: {}, // textes éditables sur les pages (titres, sous-titres) — ex: { 'amendes.subtitle': 'Mes PV' }
    vehiculesColumns: {
      order: ['immat', 'modele', 'groupes', 'categorie', 'km', 'chauffeur', 'prochainCT', 'statut'],
      hidden: [],
      widths: {},
      labels: {}, // { immat: 'Plaque', modele: 'Voiture', ... } — labels personnalisés
    },
    vehiculesRowOrder: [], // tableau d'IDs véhicules dans l'ordre souhaité par l'utilisateur
    groupeOrder: [], // ordre d'affichage des onglets de groupes (clés) — vide = ordre par défaut
    groupesHidden: [], // clés de groupes dont l'onglet est masqué sur la page Véhicules
    navOrder: [], // ordre d'affichage des onglets du menu de gauche (clés data-nav)
    leasingContrats: {}, // forfaits leasing personnalisés par immat (partagés entre PC)
    tableConfigs: {}, // ordre/largeurs/colonnes masquées de chaque tableau (partagés entre PC)
    contratSectionsOrder: [], // ordre des sections de la page Contrats (partagé)
    darkMode: false, // mode sombre 🌙 (partagé entre PC)
    societes: ['PXP'], // liste des sociétés gérées (multi-flotte, partagée entre PC)
    docStatus: {}, // statut forcé des documents { docId: 'actuel' | 'archive' } (sinon auto par date)
    docTypes: {},  // types de documents personnalisés { cle: 'Libellé' } (créés par l'utilisateur)
    docColsOrder: [], // ordre des colonnes du tableau Documents (vide = ordre par défaut)
  },
  get() {
    try {
      const stored = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}');
      const merged = {
        groupes: { ...this.defaults.groupes },
        societe: { ...this.defaults.societe, ...(stored.societe || {}) },
        vehiculesColumns: stored.vehiculesColumns && Array.isArray(stored.vehiculesColumns.order)
          ? stored.vehiculesColumns
          : { ...this.defaults.vehiculesColumns },
        vehiculesRowOrder: Array.isArray(stored.vehiculesRowOrder) ? stored.vehiculesRowOrder : [],
        groupeOrder: Array.isArray(stored.groupeOrder) ? stored.groupeOrder : [],
        groupesHidden: Array.isArray(stored.groupesHidden) ? stored.groupesHidden : [],
        navOrder: Array.isArray(stored.navOrder) ? stored.navOrder : [],
        sidebarLabels: (stored.sidebarLabels && typeof stored.sidebarLabels === 'object') ? stored.sidebarLabels : {},
        customTexts: (stored.customTexts && typeof stored.customTexts === 'object') ? stored.customTexts : {},
        platformColor: (typeof stored.platformColor === 'string' && /^#?[0-9a-fA-F]{3,6}$/.test(stored.platformColor) && stored.platformColor.replace('#', '').toUpperCase() !== '7D5E43') ? stored.platformColor : this.defaults.platformColor,
        leasingContrats: (stored.leasingContrats && typeof stored.leasingContrats === 'object') ? stored.leasingContrats : {},
        tableConfigs: (stored.tableConfigs && typeof stored.tableConfigs === 'object') ? stored.tableConfigs : {},
        contratSectionsOrder: Array.isArray(stored.contratSectionsOrder) ? stored.contratSectionsOrder : [],
        darkMode: stored.darkMode === true,
        societes: (Array.isArray(stored.societes) && stored.societes.length) ? stored.societes : ['PXP'],
        docStatus: (stored.docStatus && typeof stored.docStatus === 'object') ? stored.docStatus : {},
        docTypes: (stored.docTypes && typeof stored.docTypes === 'object') ? stored.docTypes : {},
        docColsOrder: Array.isArray(stored.docColsOrder) ? stored.docColsOrder : [],
      };
      // Merge groupes par clé (label et color individuels)
      if (stored.groupes) {
        Object.keys(merged.groupes).forEach(k => {
          if (stored.groupes[k]) {
            merged.groupes[k] = { ...merged.groupes[k], ...stored.groupes[k] };
          }
        });
      }
      return merged;
    } catch { return JSON.parse(JSON.stringify(this.defaults)); }
  },
  save(obj) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(obj));
    this.applyTheme();
    // Partage les réglages (noms/couleurs des groupes, libellés, ordre/visibilité des onglets,
    // titres, couleur d'interface…) sur TOUS les postes via Supabase. Passe par la file de
    // sécurité : si la base est momentanément injoignable, c'est renvoyé automatiquement.
    try {
      if (FP.persist && FP.persist.upsert) FP.persist.upsert('app_settings', { id: 'global', data: obj });
      else if (FP.db && FP.supabase) FP.db.upsert('app_settings', { id: 'global', data: obj });
    } catch (e) {}
  },
  reset() {
    localStorage.removeItem(this.STORAGE_KEY);
    this.applyTheme();
  },
  // Éclaircit / assombrit une couleur hex (amt négatif = plus foncé)
  _shade(hex, amt) {
    hex = String(hex || '').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length !== 6) return '#' + hex;
    const cl = x => Math.max(0, Math.min(255, Math.round(x)));
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    return '#' + [cl(r * (1 + amt)), cl(g * (1 + amt)), cl(b * (1 + amt))].map(x => x.toString(16).padStart(2, '0')).join('');
  },
  // Luminance relative (0 = noir, 1 = blanc) d'une couleur hex
  _luminance(hex) {
    hex = String(hex || '').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length !== 6) return 0;
    const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(parseInt(hex.slice(0, 2), 16)) + 0.7152 * f(parseInt(hex.slice(2, 4), 16)) + 0.0722 * f(parseInt(hex.slice(4, 6), 16));
  },
  applyTheme() {
    const s = this.get();
    Object.entries(s.groupes).forEach(([k, v]) => {
      document.documentElement.style.setProperty(`--grp-${k}`, v.color);
    });
    // Couleur de base de la plateforme (sidebar, titres, boutons foncés)
    const pc = (s.platformColor && s.platformColor[0] === '#') ? s.platformColor : '#' + (s.platformColor || this.defaults.platformColor);
    document.documentElement.style.setProperty('--fp-primary', pc);
    document.documentElement.style.setProperty('--fp-primary-2', this._shade(pc, -0.22));
    // Logo : badge noir par défaut, mais blanc si l'interface est trop sombre (contraste)
    const lumBg = this._luminance(pc);
    const lumBlack = 0.0074; // ~ #111
    const contrastBlack = (Math.max(lumBg, lumBlack) + 0.05) / (Math.min(lumBg, lumBlack) + 0.05);
    const useWhite = contrastBlack < 1.8; // interface trop foncée pour un badge noir lisible
    document.documentElement.style.setProperty('--fp-logo-bg', useWhite ? '#FFFFFF' : '#111111');
    document.documentElement.style.setProperty('--fp-logo-fg', useWhite ? pc : '#FFFFFF');
    document.documentElement.style.setProperty('--fp-logo-border', useWhite ? 'rgba(0,0,0,.18)' : '#000000');
    // Mode sombre 🌙
    if (document.body) document.body.classList.toggle('fp-dark', !!s.darkMode);
  },
};
// Nettoie le modèle en retirant la marque répétée au début (ex. BYD "BYD SEAL U" → "SEAL U")
FP.cleanModele = (marque, modele) => {
  let m = (modele || '').trim();
  const mk = (marque || '').trim();
  if (mk) {
    const re = new RegExp('^' + mk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+', 'i');
    while (re.test(m)) m = m.replace(re, '').trim(); // retire les répétitions successives
  }
  return m;
};
// Normalise en mémoire les noms de véhicules (idempotent) : enlève les doublons de marque
FP.normalizeVehicleNames = () => {
  const vs = (window.FP_DATA && window.FP_DATA.vehicules) || [];
  vs.forEach(v => { if (v && v.modele) v.modele = FP.cleanModele(v.marque, v.modele); });
};
FP.normalizeVehicleNames(); // données locales (data.js déjà chargé)
document.addEventListener('fp:data-ready', FP.normalizeVehicleNames); // après chargement Supabase

// Normalisation d'un prénom (1er mot, minuscules, accents conservés) — partagé
FP.normPrenom = (s) => (s || '').toString().trim().split(/\s+/)[0].toLowerCase();
// Conducteurs connus (fichier Drive de référence) — partagé entre pages pour un comptage cohérent
FP.DRIVE_CONDUCTEURS = new Set(["ahmed","akram","ambre","andrea","anna","bram","charles","conu","daniel","david","diana","enguerrand","eugénie","farah","frédéric","fx","gionata","guerric","halim","ilhem","jérémie","jérémy","jimmy","jocelyn","johanna","léopold","lucie","martin","maxime","mégane","mickaël","mona","monsieur","mr","nacim","nawelle","nicolas","pauline","raphaël","romuald","samira","sergio","shakil","shaohui","sofiane","thomas","xavi","yannis","youssouf"]);
// Étiquettes de chauffeur qui ne sont PAS des personnes
FP.NON_CHAUFFEURS = ['Siège', 'Dépôt', 'Navette', 'VENDU', 'x', 'X', 'Fenwick'];
// Comptage des conducteurs ENREGISTRÉS : uniquement les personnes ayant un véhicule
// attribué dans la flotte. On n'inclut PAS les personnes connues seulement via une amende
// (emprunteur ponctuel, ancien conducteur…), conformément à la demande.
FP.driverKeysFromData = (data) => {
  const keys = new Set();
  (data.vehicules || []).forEach(v => {
    const name = (v.chauffeur || '').trim();
    if (!name || name === '—' || FP.NON_CHAUFFEURS.includes(name)) return;
    const k = FP.normPrenom(name); if (k) keys.add(k);
  });
  return keys;
};

// Éditeur de cellule inline réutilisable (double-clic → champ éditable)
// FP.cellEditor(el, value, type, { options, onSave(newVal), onCancel })
FP.cellEditor = (el, value, type, opts) => {
  opts = opts || {};
  if (!el || el.querySelector('.cell-edit')) return;
  let html;
  if (type === 'select') {
    const options = opts.options || [];
    html = `<select class="cell-edit">${options.map(o => `<option value="${String(o).replace(/"/g, '&quot;')}" ${o === value ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
  } else {
    const t = type === 'number' ? 'number' : type === 'date' ? 'date' : 'text';
    const val = type === 'date' ? (typeof value === 'string' ? value.slice(0, 10) : '') : (value == null ? '' : value);
    html = `<input class="cell-edit" type="${t}" value="${String(val).replace(/"/g, '&quot;')}">`;
  }
  el.innerHTML = html;
  const inp = el.querySelector('.cell-edit');
  inp.focus(); if (inp.select) inp.select();
  let done = false;
  const finish = (save) => {
    if (done) return; done = true;
    if (save) {
      let nv = inp.value;
      if (type === 'number') nv = (nv === '' ? null : parseFloat(nv));
      else if (typeof nv === 'string') nv = nv.trim();
      if (opts.onSave) opts.onSave(nv);
    } else if (opts.onCancel) opts.onCancel();
  };
  inp.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
    else if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
  });
  inp.addEventListener('blur', () => finish(true));
  if (type === 'select') inp.addEventListener('change', () => finish(true));
};

FP.groupeLabel = (key) => {
  const k = key || 'non-classe';
  return (FP.settings.get().groupes[k] || FP.settings.defaults.groupes['non-classe']).label;
};
FP.groupeColor = (key) => {
  const k = key || 'non-classe';
  return (FP.settings.get().groupes[k] || FP.settings.defaults.groupes['non-classe']).color;
};
FP.groupeKeys = () => {
  const allKeys = Object.keys(FP.settings.defaults.groupes);
  const order = FP.settings.get().groupeOrder;
  if (!Array.isArray(order) || !order.length) return allKeys;
  const valid = order.filter(k => allKeys.includes(k));         // garde uniquement les clés connues
  const missing = allKeys.filter(k => !valid.includes(k));      // n'oublie aucun groupe
  return [...valid, ...missing];
};
// Clés de groupes visibles (onglets non masqués), dans l'ordre
FP.groupeKeysVisible = () => {
  const hidden = FP.settings.get().groupesHidden || [];
  return FP.groupeKeys().filter(k => !hidden.includes(k));
};

// === Labels des onglets sidebar (personnalisables via Paramètres) ===
FP.DEFAULT_NAV_LABELS = {
  'dashboard.html':     'Tableau de bord',
  'notifications.html': 'Notifications',
  'statistiques.html': 'Statistiques',
  'vehicules.html':    'Véhicules',
  'emprunts.html':     'Emprunt véhicule',
  'conducteurs.html':  'Conducteurs',
  'amendes.html':      'Amendes',
  'sinistres.html':    'Sinistres',
  'a-vendre.html':     'À vendre',
  'factures.html':     'Factures',
  'entretiens.html':   'Entretiens',
  'contrats.html':     'Contrats',
  'guide.html':        'Guide',
  'parametres.html':   'Paramètres',
};
// Ordre d'affichage des onglets du menu (clés data-nav), navOrder en tête puis le reste
FP.navKeysOrdered = () => {
  const allKeys = Object.keys(FP.DEFAULT_NAV_LABELS);
  const order = FP.settings.get().navOrder;
  if (!Array.isArray(order) || !order.length) return allKeys;
  const valid = order.filter(k => allKeys.includes(k));
  const missing = allKeys.filter(k => !valid.includes(k));
  return [...valid, ...missing];
};
// Réorganise les liens du menu (sidebar) selon l'ordre choisi par l'utilisateur
FP.applyNavOrder = () => {
  const order = FP.settings.get().navOrder;
  if (!Array.isArray(order) || !order.length) return;
  document.querySelectorAll('aside nav').forEach(nav => {
    const links = Array.from(nav.querySelectorAll('a[data-nav]'));
    if (!links.length) return;
    const byKey = {};
    links.forEach(a => { byKey[a.dataset.nav] = a; });
    const ordered = [];
    order.forEach(k => { if (byKey[k]) { ordered.push(byKey[k]); delete byKey[k]; } });
    links.forEach(a => { if (byKey[a.dataset.nav]) ordered.push(a); }); // onglets non listés à la fin
    ordered.forEach(a => nav.appendChild(a)); // ré-insère dans le nouvel ordre
  });
};
// Onglets toujours visibles (on ne peut pas masquer Paramètres, sinon plus moyen de revenir)
FP.NAV_ALWAYS_VISIBLE = ['parametres.html'];
// Masque les onglets choisis par l'utilisateur (sans les supprimer)
FP.applyNavVisibility = () => {
  const hidden = FP.settings.get().navHidden;
  const set = new Set(Array.isArray(hidden) ? hidden : []);
  document.querySelectorAll('a[data-nav]').forEach(a => {
    const k = a.dataset.nav;
    a.style.display = (set.has(k) && !FP.NAV_ALWAYS_VISIBLE.includes(k)) ? 'none' : '';
  });
};
// Active le glisser-déposer des onglets directement dans le menu de gauche (toutes pages)
FP.enableNavReorder = () => {
  document.querySelectorAll('aside nav').forEach(nav => {
    if (nav.dataset.reorderable === '1') return; // évite double init
    nav.dataset.reorderable = '1';
    let dragKey = null;
    const clear = () => nav.querySelectorAll('.nav-dragging, .nav-drop-above, .nav-drop-below').forEach(el => el.classList.remove('nav-dragging', 'nav-drop-above', 'nav-drop-below'));
    nav.querySelectorAll('a[data-nav]').forEach(a => a.setAttribute('draggable', 'true'));

    nav.addEventListener('dragstart', (e) => {
      const a = e.target.closest('a[data-nav]');
      if (!a) return;
      dragKey = a.dataset.nav;
      a.classList.add('nav-dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', dragKey); } catch {}
    });
    nav.addEventListener('dragover', (e) => {
      const a = e.target.closest('a[data-nav]');
      if (!a || !dragKey || a.dataset.nav === dragKey) return;
      e.preventDefault();
      const rect = a.getBoundingClientRect();
      const below = e.clientY > rect.top + rect.height / 2;
      nav.querySelectorAll('.nav-drop-above, .nav-drop-below').forEach(el => el.classList.remove('nav-drop-above', 'nav-drop-below'));
      a.classList.add(below ? 'nav-drop-below' : 'nav-drop-above');
    });
    nav.addEventListener('drop', (e) => {
      const a = e.target.closest('a[data-nav]');
      if (!a || !dragKey || a.dataset.nav === dragKey) { clear(); dragKey = null; return; }
      e.preventDefault();
      const rect = a.getBoundingClientRect();
      const below = e.clientY > rect.top + rect.height / 2;
      const links = Array.from(nav.querySelectorAll('a[data-nav]'));
      const order = links.map(x => x.dataset.nav).filter(k => k !== dragKey);
      const idx = order.indexOf(a.dataset.nav);
      order.splice(below ? idx + 1 : idx, 0, dragKey);
      const cur = FP.settings.get();
      cur.navOrder = order;
      FP.settings.save(cur);
      clear();
      dragKey = null;
      FP.applyNavOrder();
    });
    nav.addEventListener('dragend', () => { clear(); dragKey = null; });
  });
};

// === Construction des alertes (partagé dashboard + page Notifications) ===
// =====================================================================
// === Révisions constructeur (intervalles + calcul d'échéance) =========
// =====================================================================
// Intervalle « préconisé » par marque : km OU mois, au premier atteint.
// Valeurs indicatives basées sur les préconisations constructeur usuelles
// (entretien périodique). Les électriques ont un intervalle allongé.
FP.REVISION_INTERVALS = {
  'PORSCHE':       { km: 30000, mois: 24 },
  'MG':            { km: 15000, mois: 12 },
  'MERCEDES BENZ': { km: 25000, mois: 12 },
  'BYD':           { km: 20000, mois: 12 },
  'DACIA':         { km: 20000, mois: 12 },
  'VOLVO':         { km: 30000, mois: 12 },
  'TOYOTA':        { km: 15000, mois: 12 },
  'PEUGEOT':       { km: 20000, mois: 12 },
  'BMW':           { km: 30000, mois: 24 },
  'NISSAN':        { km: 20000, mois: 12 },
  'AUDI':          { km: 30000, mois: 24 },
  'IVECO':         { km: 40000, mois: 24 },
  'OPEL':          { km: 30000, mois: 12 },
  'RENAULT':       { km: 20000, mois: 12 },
  'HYUNDAI':       { km: 20000, mois: 12 },
  'CITROEN':       { km: 20000, mois: 12 },
  'DUCATI':        { km: 12000, mois: 12 },
};
FP.REVISION_DEFAUT = { km: 20000, mois: 12 };

// Intervalle applicable à un véhicule (avec nuance carburant)
FP.revisionIntervalle = (v) => {
  const base = FP.REVISION_INTERVALS[(v.marque || '').toUpperCase().trim()] || FP.REVISION_DEFAUT;
  let km = base.km, mois = base.mois;
  const carb = (v.carburant || '').toLowerCase();
  if (carb.indexOf('lec') !== -1) { km = Math.max(km, 30000); mois = Math.max(mois, 24); } // électrique
  return { km, mois };
};

// Échéance de révision : estimation par paliers de km (multiples de l'intervalle)
// + échéance temporelle si la dernière révision est connue. Renvoie le niveau
// d'alerte (danger / warn / info) ou null si rien à signaler.
FP.revisionInfo = (v) => {
  const intervalle = FP.revisionIntervalle(v);
  const km = Number(v.km) || 0;
  const today = new Date();

  // Rythme estimé (km/jour) à partir de la mise en circulation — sert à relier km et dates
  let pace = null;
  const mec = v.dateMiseEnCirculation ? new Date(v.dateMiseEnCirculation) : null;
  if (mec && !isNaN(mec) && km > 0) {
    const joursMec = (today - mec) / 86400000;
    if (joursMec > 30) pace = km / joursMec;
  }

  const dRev = (v.derniereRevision && v.derniereRevision !== '—') ? new Date(v.derniereRevision) : null;
  const hasRev = dRev && !isNaN(dRev);
  // Km RÉEL à la dernière révision (colonne « KM revision » du Drive → kmDernierReleve)
  const kmRev = (Number(v.kmDernierReleve) > 0) ? Number(v.kmDernierReleve) : null;

  let prochaineKm = null, kmRestant = null, prochaineDate = null, joursRestant = null;

  // Échéance temporelle : dernière révision + intervalle en mois
  if (hasRev) {
    prochaineDate = new Date(dRev);
    prochaineDate.setMonth(prochaineDate.getMonth() + intervalle.mois);
    joursRestant = Math.ceil((prochaineDate - today) / 86400000);
  }

  // Échéance kilométrique — par ordre de fiabilité :
  if (kmRev) {
    // 1) EXACT : km de la dernière révision + intervalle préconisé
    prochaineKm = kmRev + intervalle.km;
    kmRestant = prochaineKm - km;
  } else if (hasRev && pace !== null) {
    // 2) Estimé : km parcourus depuis la révision (rythme × jours écoulés)
    const joursDepuisRev = Math.max(0, (today - dRev) / 86400000);
    kmRestant = Math.round(intervalle.km - pace * joursDepuisRev);
    prochaineKm = Math.round(km + kmRestant);
  } else if (km > 0) {
    // 3) Faute de mieux : prochain palier d'odomètre
    prochaineKm = Math.ceil(km / intervalle.km) * intervalle.km;
    if (prochaineKm <= km) prochaineKm = km + intervalle.km;
    kmRestant = prochaineKm - km;
  }

  const lvlKm = kmRestant === null ? null : (kmRestant <= 1000 ? 'danger' : kmRestant <= 3000 ? 'warn' : kmRestant <= 6000 ? 'info' : null);
  const lvlDt = joursRestant === null ? null : (joursRestant <= 30 ? 'danger' : joursRestant <= 60 ? 'warn' : joursRestant <= 90 ? 'info' : null);
  const rank = { danger: 0, warn: 1, info: 2 };
  let niveau = null;
  [lvlKm, lvlDt].forEach(l => { if (l && (niveau === null || rank[l] < rank[niveau])) niveau = l; });
  return { intervalle, prochaineKm, kmRestant, prochaineDate, joursRestant, niveau, hasRev: !!hasRev, pace };
};

// =====================================================================
// === Leasing BPCE : forfait km contractuel + suivi de dépassement =====
// =====================================================================
// Termes issus des contrats signés BPCE Car Lease (dossier Drive flotte).
// Statique en code = partagé via git, durable, survit au chargement Supabase.
// Pour un nouveau véhicule en leasing : ajouter une ligne (immat → forfait).
FP.LEASING_CONTRATS = {
  'HG-763-VP': { kmContrat: 75000,  dureeMois: 36, debut: '2025-11-25', kmSupp: 0.0707 }, // BYD Atto 3
  'HE-739-WP': { kmContrat: 150000, dureeMois: 36, debut: '2025-07-25', kmSupp: 0.0888 }, // Toyota C-HR
  'HJ-285-FL': { kmContrat: 60000,  dureeMois: 36, debut: '2026-02-18', kmSupp: 0.0990 }, // BMW X1
  'HJ-181-RN': { kmContrat: 60000,  dureeMois: 36, debut: '2026-03-16', kmSupp: null   }, // Nissan X-Trail
  'HG-709-CH': { kmContrat: 60000,  dureeMois: 36, debut: '2025-10-15', kmSupp: null   }, // BYD Seal U
  'HF-749-VD': { kmContrat: 75000,  dureeMois: 36, debut: '2025-09-26', kmSupp: null   }, // Toyota Yaris Cross
  'HH-613-KE': { kmContrat: 60000,  dureeMois: 36, debut: '2025-12-24', kmSupp: null   }, // BYD Seal U
  'HH-464-LQ': { kmContrat: 60000,  dureeMois: 36, debut: '2025-12-29', kmSupp: null   }, // BYD Seal U
  'HH-458-LQ': { kmContrat: 120000, dureeMois: 36, debut: '2025-12-29', kmSupp: null   }, // BYD Seal U (avenant)
  'HF-477-XW': { kmContrat: 165000, dureeMois: 36, debut: '2025-10-01', kmSupp: 0.1157 }, // Hyundai Tucson
  'HJ-804-VM': { kmContrat: 21000,  dureeMois: 36, debut: '2026-03-23', kmSupp: null   }, // Renault Trafic
};

// Overrides éditables (localStorage) : l'utilisateur peut corriger/ajouter un
// contrat sans toucher au code. Ils prennent le pas sur FP.LEASING_CONTRATS.
// Forfaits leasing personnalisés : stockés dans les réglages PARTAGÉS (app_settings)
// pour être visibles/identiques sur tous les PC. (Avant : localStorage local seulement.)
FP.LEASING_OVERRIDES_KEY = 'auto_flotte_leasing_contrats'; // ancien stockage local (migration)
FP.getLeasingOverrides = () => {
  const obj = (FP.settings && FP.settings.get()) || {};
  let shared = (obj.leasingContrats && typeof obj.leasingContrats === 'object') ? obj.leasingContrats : null;
  // Migration unique : remonte d'éventuels anciens forfaits locaux vers les réglages partagés
  if ((!shared || !Object.keys(shared).length) && FP.settings) {
    let local = {};
    try { local = JSON.parse(localStorage.getItem(FP.LEASING_OVERRIDES_KEY) || '{}'); } catch (e) {}
    if (Object.keys(local).length) {
      const o = FP.settings.get(); o.leasingContrats = local; FP.settings.save(o);
      try { localStorage.removeItem(FP.LEASING_OVERRIDES_KEY); } catch (e) {}
      return local;
    }
  }
  return shared || {};
};
FP.saveLeasingOverride = (immat, fields) => {
  const key = (immat || '').trim().toUpperCase(); if (!key || !FP.settings) return;
  const obj = FP.settings.get();
  const all = (obj.leasingContrats && typeof obj.leasingContrats === 'object') ? obj.leasingContrats : {};
  all[key] = { ...(all[key] || {}), ...fields };
  obj.leasingContrats = all;
  FP.settings.save(obj); // -> localStorage + app_settings (partagé sur tous les PC)
};
FP.resetLeasingOverride = (immat) => {
  const key = (immat || '').trim().toUpperCase(); if (!FP.settings) return;
  const obj = FP.settings.get();
  if (obj.leasingContrats && obj.leasingContrats[key]) { delete obj.leasingContrats[key]; FP.settings.save(obj); }
};
// Contrat effectif d'un véhicule = défaut (Drive) fusionné avec l'override.
// Renvoie null si on n'a pas au moins un forfait km et une date de début.
FP.leasingContrat = (immat) => {
  const key = (immat || '').trim().toUpperCase(); if (!key) return null;
  const base = FP.LEASING_CONTRATS[key] || null;
  const ov = FP.getLeasingOverrides()[key] || null;
  if (!base && !ov) return null;
  const merged = { dureeMois: 36, kmSupp: null, ...(base || {}), ...(ov || {}) };
  if (!merged.kmContrat || !merged.debut) return null;
  return merged;
};

// Suivi du forfait : rythme autorisé vs réel, projection en fin de contrat,
// risque de dépassement. Renvoie null si le véhicule n'a pas de contrat connu.
FP.leasingInfo = (v) => {
  const c = FP.leasingContrat(v.immat);
  if (!c) return null;
  const today = new Date();
  const debut = new Date(c.debut);
  const finContrat = new Date(debut); finContrat.setMonth(finContrat.getMonth() + c.dureeMois);
  const moisEcoules = Math.max(0, (today - debut) / (1000 * 60 * 60 * 24 * 30.44));
  const km = Number(v.km) || 0;
  const kmParMoisAutorise = c.kmContrat / c.dureeMois;
  const kmAutoriseAJour = Math.min(c.kmContrat, Math.round(kmParMoisAutorise * moisEcoules));
  const kmParMoisReel = moisEcoules >= 0.3 ? km / moisEcoules : null;
  const projectionFin = kmParMoisReel !== null ? Math.round(kmParMoisReel * c.dureeMois) : null;
  const ratio = projectionFin !== null ? projectionFin / c.kmContrat : null;
  const ecartAJour = Math.round(km - kmAutoriseAJour);                 // > 0 = en avance (à risque)
  const depassementProjete = projectionFin !== null ? projectionFin - c.kmContrat : null;
  let niveau = null;
  if (ratio !== null && moisEcoules >= 1) {
    if (ratio >= 1.05) niveau = 'danger';
    else if (ratio >= 0.98) niveau = 'warn';
    else if (ratio >= 0.90) niveau = 'info';
  }
  return { kmContrat: c.kmContrat, dureeMois: c.dureeMois, kmSupp: c.kmSupp, debut, finContrat,
           moisEcoules, km, kmParMoisAutorise, kmAutoriseAJour, kmParMoisReel,
           projectionFin, ratio, ecartAJour, depassementProjete, niveau };
};

// Véhicule concerné par le contrôle anti-pollution (utilitaires + camions/engins
// routiers diesel type IVECO), mais PAS les chariots élévateurs (Fenwick).
FP.concerneAntiPollution = (v) => {
  if (!v) return false;
  const cat = (v.categorie || '').toLowerCase();
  const nom = (v.marque || '') + ' ' + (v.modele || '');
  const isChariot = /fenwick|chariot|[ée]l[ée]vateur/i.test(nom);
  return (/utilit/.test(cat) || /engin/.test(cat)) && !isChariot;
};

FP.buildAlertes = (data) => {
  const out = [];
  const today = new Date();
  const days = (d) => Math.ceil((new Date(d) - today) / (1000 * 60 * 60 * 24));

  // --- Contrôles techniques ---
  (data.vehicules || []).forEach(v => {
    if (!v.prochainCT || v.prochainCT === '—') return;
    const d = new Date(v.prochainCT);
    if (isNaN(d)) return;
    const diff = days(v.prochainCT);
    const veh = `${v.immat} · ${v.marque} ${v.modele}${v.chauffeur ? ' (' + v.chauffeur + ')' : ''}`;
    const tgt = 'vehicules.html?veh=' + v.id; // ouvre directement la fiche du véhicule
    if (diff < 0)        out.push({ niveau: 'danger', categorie: 'Contrôle technique', message: `CT dépassé de ${-diff}j`, detail: veh, sort: diff, target: tgt });
    else if (diff < 30)  out.push({ niveau: 'danger', categorie: 'Contrôle technique', message: `CT à faire dans ${diff}j`, detail: veh, sort: diff, target: tgt });
    else if (diff < 60)  out.push({ niveau: 'warn',   categorie: 'Contrôle technique', message: `CT à prévoir dans ${diff}j`, detail: veh, sort: diff, target: tgt });
    else if (diff < 90)  out.push({ niveau: 'info',   categorie: 'Contrôle technique', message: `CT dans ~2 mois (${diff}j)`, detail: veh, sort: diff, target: tgt });
  });

  // --- Contrôle anti-pollution (utilitaires / camions diesel) ---
  (data.vehicules || []).forEach(v => {
    if (!FP.concerneAntiPollution(v)) return;
    if (!v.antiPollution || v.antiPollution === '—') return;
    const d = new Date(v.antiPollution);
    if (isNaN(d)) return;
    const diff = days(v.antiPollution);
    const veh = `${v.immat} · ${v.marque} ${v.modele}${v.chauffeur ? ' (' + v.chauffeur + ')' : ''}`;
    const tgt = 'vehicules.html?veh=' + v.id;
    if (diff < 0)        out.push({ niveau: 'danger', categorie: 'Anti-pollution', message: `Anti-pollution dépassé de ${-diff}j`, detail: veh, sort: diff, target: tgt });
    else if (diff < 30)  out.push({ niveau: 'danger', categorie: 'Anti-pollution', message: `Anti-pollution à faire dans ${diff}j`, detail: veh, sort: diff, target: tgt });
    else if (diff < 60)  out.push({ niveau: 'warn',   categorie: 'Anti-pollution', message: `Anti-pollution à prévoir dans ${diff}j`, detail: veh, sort: diff, target: tgt });
  });

  // --- Amendes à payer ---
  const amAPayer = (data.amendes || []).filter(a => a.statut === 'à payer');
  if (amAPayer.length > 0) {
    const totalDu = amAPayer.reduce((s, a) => s + (a.montant || 0), 0);
    out.push({
      niveau: totalDu > 500 ? 'warn' : 'info',
      categorie: 'Amendes',
      message: `${amAPayer.length} amende${amAPayer.length > 1 ? 's' : ''} à payer`,
      detail: `${FP.euro(totalDu)} dus au total`,
      sort: 1000,
      target: 'amendes.html?filtre=apayer',
    });
  }

  // --- Permis de conduire qui expirent (table conducteurs) ---
  (data.conducteurs || []).forEach(c => {
    if (!c || !c.permisExpiration) return;
    const d = new Date(c.permisExpiration);
    if (isNaN(d)) return;
    const diff = days(c.permisExpiration);
    const who = [c.prenom || c.name, c.nom].filter(Boolean).join(' ') || c.name || c.key;
    const detail = `${who} — expire le ${FP.date(c.permisExpiration)}`;
    const tgt = 'conducteurs.html?cond=' + encodeURIComponent(c.key);
    if (diff < 0)        out.push({ niveau: 'danger', categorie: 'Permis', message: `Permis EXPIRÉ depuis ${-diff}j`, detail, sort: diff, target: tgt });
    else if (diff < 60)  out.push({ niveau: 'danger', categorie: 'Permis', message: `Permis expire dans ${diff}j`, detail, sort: diff, target: tgt });
    else if (diff < 120) out.push({ niveau: 'warn',   categorie: 'Permis', message: `Permis à renouveler (${diff}j)`, detail, sort: diff, target: tgt });
  });

  // --- Révisions constructeur ---
  (data.vehicules || []).forEach(v => {
    if (v.statut && v.statut !== 'actif') return; // on ignore vendus / à vendre / hors service
    const r = FP.revisionInfo(v);
    if (!r.niveau) return;
    const veh = `${v.immat} · ${v.marque} ${v.modele}${v.chauffeur && v.chauffeur !== '—' ? ' (' + v.chauffeur + ')' : ''}`;
    const tgt = 'vehicules.html?veh=' + v.id;
    const kmOverdue = r.kmRestant !== null && r.kmRestant <= 0;
    const dtOverdue = r.joursRestant !== null && r.joursRestant <= 0;
    let msg;
    if (kmOverdue || dtOverdue) {
      msg = kmOverdue ? `Révision dépassée (+${FP.num(-r.kmRestant)} km)` : `Révision dépassée depuis ${-r.joursRestant}j`;
    } else if (r.kmRestant !== null && (r.joursRestant === null || r.kmRestant <= r.joursRestant * 100)) {
      msg = `Révision dans ~${FP.num(r.kmRestant)} km`;
    } else {
      msg = `Révision à prévoir dans ${r.joursRestant}j`;
    }
    const detail = `${veh} — préconisé tous les ${FP.num(r.intervalle.km)} km / ${r.intervalle.mois} mois`;
    const sort = r.kmRestant !== null ? r.kmRestant : r.joursRestant * 100;
    out.push({ niveau: r.niveau, categorie: 'Révision', message: msg, detail, sort, target: tgt });
  });

  // --- Dépassement kilométrique leasing BPCE ---
  (data.vehicules || []).forEach(v => {
    if (v.statut && v.statut !== 'actif') return;
    const l = FP.leasingInfo(v);
    if (!l || !l.niveau) return;
    const veh = `${v.immat} · ${v.marque} ${v.modele}${v.chauffeur && v.chauffeur !== '—' ? ' (' + v.chauffeur + ')' : ''}`;
    let msg;
    if (l.niveau === 'danger') msg = `Dépassement leasing projeté : ~${FP.num(l.projectionFin)} km (forfait ${FP.num(l.kmContrat)} km, +${FP.num(l.depassementProjete)} km)`;
    else if (l.niveau === 'warn') msg = `Leasing à surveiller : projection ~${FP.num(l.projectionFin)} km / ${FP.num(l.kmContrat)} km`;
    else msg = `Leasing : rythme soutenu, projection ~${FP.num(l.projectionFin)} km / ${FP.num(l.kmContrat)} km`;
    let detail = `${veh} — ${FP.num(Math.round(l.kmParMoisReel))} km/mois vs ${FP.num(Math.round(l.kmParMoisAutorise))} autorisés`;
    if (l.kmSupp && l.depassementProjete > 0) detail += ` · pénalité estimée ~${FP.euro(Math.round(l.depassementProjete * l.kmSupp))}`;
    out.push({ niveau: l.niveau, categorie: 'Leasing', message: msg, detail, sort: 3000 - Math.round((l.ratio || 0) * 100), target: 'contrats.html' });
  });

  // --- Fin de contrat leasing BPCE approchant (par date de fin) ---
  (data.vehicules || []).forEach(v => {
    if (v.statut && v.statut !== 'actif') return;
    const l = FP.leasingInfo(v);
    if (!l || !l.finContrat || isNaN(l.finContrat)) return;
    const diff = days(l.finContrat);
    const veh = `${v.immat} · ${v.marque} ${v.modele}${v.chauffeur && v.chauffeur !== '—' ? ' (' + v.chauffeur + ')' : ''}`;
    const finStr = FP.date(l.finContrat.toISOString());
    let niveau = null, msg = null;
    if (diff < 0)        { niveau = 'danger'; msg = `Leasing terminé depuis ${-diff}j (${finStr})`; }
    else if (diff < 90)  { niveau = 'danger'; msg = `Fin de leasing dans ${diff}j (${finStr})`; }
    else if (diff < 180) { niveau = 'warn';   msg = `Fin de leasing dans ~${Math.round(diff / 30)} mois (${finStr})`; }
    else return;
    out.push({ niveau, categorie: 'Leasing', message: msg, detail: veh, sort: diff, target: 'contrats.html' });
  });

  // --- Véhicules sans dernière révision enregistrée (info) ---
  const sansRevList = (data.vehicules || []).filter(v => v.statut === 'actif' && (!v.derniereRevision || v.derniereRevision === '—') && (!v.chauffeur || v.chauffeur !== 'VENDU'));
  if (sansRevList.length > 5) {
    out.push({ niveau: 'info', categorie: 'Maintenance', message: `${sansRevList.length} véhicules sans dernière révision enregistrée`, detail: 'Clique pour voir la liste — à compléter pour le suivi maintenance', sort: 2000,
      vehicules: sansRevList.map(v => ({ label: `${v.immat || '—'} · ${(v.marque || '')} ${(v.modele || '')}`.trim() + (v.chauffeur && v.chauffeur !== '—' ? ' — ' + v.chauffeur : ''), target: 'vehicules.html?veh=' + v.id })) });
  }

  const order = { danger: 0, warn: 1, info: 2 };
  out.sort((a, b) => (order[a.niveau] - order[b.niveau]) || (a.sort - b.sort));
  return out;
};
FP.persist = {
  _QKEY: 'fp_pending_writes',
  available() { return !!(FP.db && FP.supabase); },
  _loadQ() { try { return JSON.parse(localStorage.getItem(this._QKEY)) || []; } catch (e) { return []; } },
  _saveQ(q) { try { localStorage.setItem(this._QKEY, JSON.stringify(q)); } catch (e) {} if (FP._syncBadge) FP._syncBadge(); },
  pendingCount() { return this._loadQ().length; },
  // Nombre de modifs en échec DÉFINITIF (erreur base, pas un simple souci réseau)
  failedCount() { return this._loadQ().filter(it => it.failed).length; },
  _enqueue(item) { const q = this._loadQ(); item.ts = Date.now(); item.tries = 0; q.push(item); this._saveQ(q); },
  _err(e) { console.error('[FP.persist] enregistrement différé :', e && (e.message || e)); },
  // Une erreur RENVOYÉE PAR LA BASE (code défini : colonne absente, contrainte…) est
  // définitive : inutile de la rejouer en boucle. Un souci réseau (pas de code) est
  // transitoire : on retentera plus tard.
  _estPermanente(e) {
    if (!e) return false;
    const msg = (e.message || '').toLowerCase();
    if (/failed to fetch|networkerror|network error|load failed|timeout|fetch/.test(msg)) return false;
    return !!(e.code || e.status >= 400);
  },
  // Résumé lisible des échecs définitifs (pour le message à l'utilisateur)
  _resumeEchecs() {
    const noms = { vehicules: 'véhicule', amendes: 'amende', factures: 'facture', conducteurs: 'conducteur' };
    return this._loadQ().filter(it => it.failed).map(it => {
      const quoi = noms[it.table] || it.table;
      const act = it.op === 'delete' ? 'suppression' : (it.op === 'update' ? 'modification' : 'ajout');
      return `• ${act} ${quoi} : ${it.error || 'erreur inconnue'}`;
    }).join('\n');
  },
  // Oublie les modifs en échec définitif (l'utilisateur a choisi d'abandonner)
  _abandonnerEchecs() { this._saveQ(this._loadQ().filter(it => !it.failed)); },
  // Chaque écriture : on tente la base ; si ça échoue, on garde en file locale
  // (filet de sécurité) et on renverra automatiquement plus tard.
  async insert(table, row) {
    if (!this.available()) { this._enqueue({ op: 'insert', table, row }); return; }
    try { const r = await FP.db.insert(table, row); if (r && r.error) throw r.error; this.flush(); }
    catch (e) { this._err(e); this._enqueue({ op: 'insert', table, row }); }
  },
  async upsert(table, row) {
    if (!this.available()) { this._enqueue({ op: 'upsert', table, row }); return; }
    try { const r = await FP.db.upsert(table, row); if (r && r.error) throw r.error; this.flush(); }
    catch (e) { this._err(e); this._enqueue({ op: 'upsert', table, row }); }
  },
  async update(table, id, fields) {
    if (!this.available()) { this._enqueue({ op: 'update', table, id, fields }); return; }
    try { const r = await FP.db.update(table, id, fields); if (r && r.error) throw r.error; this.flush(); }
    catch (e) { this._err(e); this._enqueue({ op: 'update', table, id, fields }); }
  },
  async delete(table, id) {
    if (!this.available()) { this._enqueue({ op: 'delete', table, id }); return; }
    try { const r = await FP.db.delete(table, id); if (r && r.error) throw r.error; this.flush(); }
    catch (e) { this._err(e); this._enqueue({ op: 'delete', table, id }); }
  },
  _flushing: false,
  // Renvoie tout ce qui est en attente. Les insert sont rejoués en upsert
  // (clé = id) pour éviter les doublons si une partie était déjà passée.
  async flush(opts) {
    const force = !!(opts && opts.force); // clic manuel = retente même les échecs définitifs
    if (this._flushing || !this.available()) return;
    const q = this._loadQ();
    if (!q.length) { if (FP._syncBadge) FP._syncBadge(); return; }
    this._flushing = true;
    const remaining = [];
    for (const it of q) {
      // Ne pas reboucler automatiquement sur un échec définitif (sauf retente manuelle)
      if (it.failed && !force) { remaining.push(it); continue; }
      if (force) { it.failed = false; } // on redonne sa chance (ex. colonne ajoutée entre-temps)
      try {
        let r;
        if (it.op === 'insert' || it.op === 'upsert') r = await FP.db.upsert(it.table, it.row);
        else if (it.op === 'update') r = await FP.db.update(it.table, it.id, it.fields);
        else if (it.op === 'delete') r = await FP.db.delete(it.table, it.id);
        if (r && r.error) throw r.error;
      } catch (e) {
        it.tries = (it.tries || 0) + 1;
        it.error = (e && (e.message || e.code)) || 'erreur inconnue';
        // Erreur base (définitive) OU trop d'échecs réseau d'affilée → on arrête de boucler
        if (this._estPermanente(e) || it.tries >= 5) it.failed = true;
        remaining.push(it);
      }
    }
    this._saveQ(remaining);
    this._flushing = false;
    if (FP._syncBadge) FP._syncBadge(remaining.length === 0 && q.length > 0);
  },
};

// --- Indicateur de synchro (pastille en bas à droite) ---
// Jaune = des modifs ne sont pas encore enregistrées dans la base (cliquer = réessayer).
// Vert bref = tout vient d'être renvoyé. Rien = tout est à jour.
FP._ensureSyncBadge = function () {
  if (typeof document === 'undefined' || !document.body) return null;
  let b = document.getElementById('fp-sync-badge');
  if (b) return b;
  b = document.createElement('div');
  b.id = 'fp-sync-badge';
  b.style.cssText = 'position:fixed;bottom:14px;right:14px;z-index:9999;font-size:12px;font-weight:700;padding:7px 13px;border-radius:9999px;box-shadow:0 6px 18px rgba(0,0,0,.18);cursor:pointer;display:none;align-items:center;gap:6px;';
  b.title = 'Cliquer pour renvoyer les modifications en attente';
  b.addEventListener('click', () => {
    const echecs = FP.persist.failedCount();
    if (echecs > 0) {
      const detail = FP.persist._resumeEchecs();
      const ok = confirm(
        `${echecs} modification(s) n'ont PAS pu être enregistrées dans la base :\n\n${detail}\n\n`
        + `Ce sont souvent des erreurs de structure (colonne manquante) qui ne se résoudront pas toutes seules.\n\n`
        + `• OK = réessayer maintenant\n• Annuler = abandonner ces modifications`
      );
      if (ok) FP.persist.flush({ force: true });
      else { FP.persist._abandonnerEchecs(); if (FP._syncBadge) FP._syncBadge(); }
    } else {
      FP.persist.flush();
    }
  });
  document.body.appendChild(b);
  return b;
};
FP._syncBadge = function (justSynced) {
  const b = FP._ensureSyncBadge();
  if (!b) return;
  const n = FP.persist.pendingCount();
  const echecs = FP.persist.failedCount();
  clearTimeout(FP._syncBadgeT);
  if (echecs > 0) {
    // Rouge : échec DÉFINITIF (erreur base) — ne se résoudra pas tout seul
    b.style.display = 'inline-flex';
    b.style.background = '#FEE2E2'; b.style.color = '#991B1B';
    b.textContent = `⚠️ ${echecs} modif${echecs > 1 ? 's' : ''} en échec — cliquer pour voir`;
  } else if (n > 0) {
    b.style.display = 'inline-flex';
    b.style.background = '#FEF3C7'; b.style.color = '#92400E';
    b.textContent = `⏳ ${n} modif${n > 1 ? 's' : ''} non enregistrée${n > 1 ? 's' : ''} — cliquer pour réessayer`;
  } else if (justSynced) {
    b.style.display = 'inline-flex';
    b.style.background = '#ECFDF5'; b.style.color = '#047857';
    b.textContent = '✓ Modifications enregistrées';
    FP._syncBadgeT = setTimeout(() => { b.style.display = 'none'; }, 3000);
  } else {
    b.style.display = 'none';
  }
};
// Renvoi automatique : au chargement des données, au retour en ligne, et régulièrement.
document.addEventListener('fp:data-ready', () => { FP.persist.flush(); });
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { FP.persist.flush(); });
  window.addEventListener('DOMContentLoaded', () => { if (FP._syncBadge) FP._syncBadge(); });
  setInterval(() => { if (FP.persist.pendingCount() > 0) FP.persist.flush(); }, 30000);
}

// =====================================================================
// === Stockage des scans (avis, cartes grises) — Supabase Storage =====
// =====================================================================
// Envoie un fichier dans le bucket "scans" et renvoie son URL public,
// pour pouvoir le revoir à tout moment depuis n'importe quel PC.
// Le bucket "scans" doit exister et être public (voir supabase-storage.sql).
FP.SCAN_BUCKET = 'scans';

// Compresse une photo avant l'envoi (pour économiser l'espace de stockage).
// - Ne touche PAS aux PDF ni aux fichiers non-image : renvoyés tels quels.
// - Réduit la photo à 2000 px max (côté le plus long) et la ré-encode en JPEG.
// - En cas de souci (format exotique type HEIC non décodé), renvoie l'original.
FP.compressImage = async function (file, { maxSide = 2000, quality = 0.72 } = {}) {
  if (!file || !/^image\//i.test(file.type || '')) return file; // PDF & autres : inchangés
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
    if (bitmap.close) bitmap.close();
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file; // si pas plus léger, on garde l'original
    const base = (file.name || 'photo').replace(/\.[a-z0-9]+$/i, '');
    return new File([blob], base + '.jpg', { type: 'image/jpeg' });
  } catch (e) {
    console.warn('[compressImage] non compressé, envoi de l\'original :', e);
    return file;
  }
};

FP.uploadScan = async function (file, folder) {
  if (!FP.supabase || !FP.supabase.storage) throw new Error('Stockage indisponible (Supabase non chargé).');
  if (!file) return null;
  file = await FP.compressImage(file); // photos allégées ; PDF intacts
  const extMatch = (file.name || '').match(/\.[a-z0-9]+$/i);
  const ext = extMatch ? extMatch[0].toLowerCase() : (file.type === 'application/pdf' ? '.pdf' : '.jpg');
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${folder || 'divers'}/${Date.now()}-${rand}${ext}`;
  const { error } = await FP.supabase.storage.from(FP.SCAN_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  });
  if (error) throw error;
  const { data } = FP.supabase.storage.from(FP.SCAN_BUCKET).getPublicUrl(path);
  return (data && data.publicUrl) || null;
};

// =====================================================================
// === OCR partagé + détection automatique de document =================
// =====================================================================
// Réutilisable par toutes les pages (scan depuis le tableau de bord, etc.).
// Lit une image/PDF, en extrait le texte, puis devine : le véhicule (plaque),
// le type de document, une date pertinente et le kilométrage.
FP.ocr = {
  TESSERACT_CDN: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
  PDFJS_CDN:     'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
  PDFJS_WORKER:  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
  loadScript(src) {
    return new Promise((resolve, reject) => {
      const ex = document.querySelector(`script[data-lazy="${src}"]`);
      if (ex) {
        if (ex.dataset.loaded === '1') return resolve();
        ex.addEventListener('load', resolve);
        ex.addEventListener('error', () => reject(new Error('Échec du chargement de ' + src)));
        return;
      }
      const s = document.createElement('script');
      s.src = src; s.dataset.lazy = src;
      s.onload = () => { s.dataset.loaded = '1'; resolve(); };
      s.onerror = () => reject(new Error('Échec du chargement de ' + src));
      document.head.appendChild(s);
    });
  },
  async pdfToCanvas(file) {
    await this.loadScript(this.PDFJS_CDN);
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = this.PDFJS_WORKER;
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    return canvas;
  },
  async fileToText(file) {
    await this.loadScript(this.TESSERACT_CDN);
    let image = file;
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')) image = await this.pdfToCanvas(file);
    // Multilingue : factures FR + Italie + Allemagne + Pays-Bas (téléchargé une fois, mis en cache).
    const worker = await Tesseract.createWorker('fra+ita+deu+nld');
    try { const { data } = await worker.recognize(image); return data.text || ''; }
    finally { await worker.terminate(); }
  },
};

// Devine le contenu d'un document à partir de son texte OCR.
// Renvoie { type, vehicule, immat, date, km, raw }.
FP.detectDoc = function (rawText, vehicules) {
  const text = (rawText || '').toUpperCase().replace(/ /g, ' ');
  const norm = s => (s || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const out = { type: 'autre', vehicule: null, immat: null, date: null, km: null, raw: rawText || '' };

  // --- Plaque (format SIV AA-123-AA) ---
  let m = text.match(/\b([A-Z]{2})\s*[-\s]?\s*([0-9]{3})\s*[-\s]?\s*([A-Z]{2})\b/);
  if (m) out.immat = `${m[1]}-${m[2]}-${m[3]}`;
  const list = Array.isArray(vehicules) ? vehicules : [];
  if (out.immat) {
    const ni = norm(out.immat);
    out.vehicule = list.find(v => norm(v.immat) === ni) || null;
  }
  // Repli : chercher n'importe quelle plaque connue présente dans le texte
  if (!out.vehicule && list.length) {
    const flat = norm(text);
    for (const v of list) { const nv = norm(v.immat); if (nv && nv.length >= 6 && flat.includes(nv)) { out.vehicule = v; out.immat = v.immat; break; } }
  }

  // --- Type de document ---
  if (/CONTR[OÔ]LE\s+TECHNIQUE|PROC[EÈ]S[-\s]?VERBAL|PROCHAIN\s+CONTR|FAVORABLE|D[EÉ]FAVORABLE/.test(text)) out.type = 'controle-technique';
  else if (/CERTIFICAT\s+D.?IMMATRICULATION|CARTE\s+GRISE/.test(text)) out.type = 'carte-grise';
  else if (/ATTESTATION\s+D.?ASSURANCE|CARTE\s+VERTE|\bASSURANCE\b/.test(text)) out.type = 'assurance';
  else if (/\bFACTURE\b|\bFATTURA\b|\bRECHNUNG\b|\bFACTUUR\b|TOTAL\s+TTC|MONTANT\s+TTC|NET\s+[AÀ]\s+PAYER/.test(text)) out.type = 'facture';

  // --- Dates dd/mm/yyyy (filtrées sur une plage plausible) ---
  const toIso = (d, mo, y) => { y = +y; if (y < 100) y += 2000; return `${y}-${String(+mo).padStart(2, '0')}-${String(+d).padStart(2, '0')}`; };
  const allDates = [...text.matchAll(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/g)]
    .map(d => { const iso = toIso(d[1], d[2], d[3]); return { iso, y: +iso.slice(0, 4) }; })
    .filter(d => d.y >= 2015 && d.y <= 2035);
  if (out.type === 'controle-technique') {
    // Date du PROCHAIN contrôle (mots-clés), sinon la date la plus tardive (CT valable 2 ans).
    const lines = text.split(/\r?\n/);
    let ct = null;
    for (const ln of lines) {
      if (/PROCHAIN|AVANT\s+LE|VALABLE|VALIDIT/.test(ln)) {
        const dm = ln.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
        if (dm) { ct = toIso(dm[1], dm[2], dm[3]); break; }
      }
    }
    out.date = ct || (allDates.length ? allDates.map(d => d.iso).sort().slice(-1)[0] : null);
  } else if (allDates.length) {
    out.date = allDates.map(d => d.iso).sort().slice(-1)[0];
  }

  // --- Kilométrage (ex. CT : « Kilométrage relevé : 123 456 km ») ---
  // On cherche la ligne contenant « kilométrage » (tolérant l'OCR) puis le 1er nombre
  // qui suit, sur la même ligne (après « relevé ») ou sur l'une des 2 lignes suivantes.
  const cleanNum = s => parseInt(String(s).replace(/[^\d]/g, ''), 10);
  const kmLines = text.split(/\r?\n/);
  let km = null;
  for (let i = 0; i < kmLines.length && km == null; i++) {
    if (/KILOM.{0,3}TRAGE/.test(kmLines[i])) {
      const here = kmLines[i].replace(/.*KILOM.{0,3}TRAGE\w*/, '');
      const cand = here.match(/\d[\d\s.]{2,}/) || (kmLines[i + 1] || '').match(/\d[\d\s.]{2,}/) || (kmLines[i + 2] || '').match(/\d[\d\s.]{2,}/);
      if (cand) { const n = cleanNum(cand[0]); if (n > 100 && n < 2000000) km = n; }
    }
  }
  if (km == null) { const kmM = text.match(/(\d[\d\s.]{2,})\s*KM\b/) || text.match(/\bKM\s*[:\.]?\s*(\d[\d\s.]{2,})/); if (kmM) { const n = cleanNum(kmM[1]); if (n > 100 && n < 2000000) km = n; } }
  out.km = km;

  // --- Montant TTC (factures) : priorité au montant près de « TTC », sinon le plus gros montant à 2 décimales ---
  const normAmount = raw => {
    let s = String(raw).replace(/[  ]/g, '');
    if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes(',')) s = s.replace(',', '.');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  };
  // Mots-clés « total à payer » en FR / IT / DE / NL (même ligne que le montant) ; sinon, repli sur le plus gros montant.
  const ttcM = text.match(/(?:T\.?\s*T\.?\s*C\.?|NET\s+[AÀ]\s+PAYER|TOTALE|GESAMTBETRAG|GESAMT|BRUTTO|ZU\s+ZAHLEN|TOTAAL|TE\s+BETALEN)[^\d\n]{0,12}(\d[\d .,  ]*\d)/);
  let ttc = ttcM ? normAmount(ttcM[1]) : null;
  if (ttc == null) {
    const amts = [...text.matchAll(/(\d{1,3}(?:[  .]\d{3})*|\d+)[.,](\d{2})\b/g)].map(m => normAmount(m[0])).filter(n => n != null && n > 0 && n < 1000000);
    if (amts.length) ttc = Math.max(...amts);
  }
  out.montantTTC = ttc;

  // --- Catégorie de dépense (pour la table factures) ---
  let cat = 'autre';
  if (/ENTRETIEN|R[EÉ]VISION|VIDANGE|PNEU|PLAQUETTE|COURROIE|DISTRIBUTION|FREIN|FILTRE|TAGLIANDO|MANODOPERA|RICAMBI|MANUTENZIONE|WARTUNG|INSPEKTION|ÖLWECHSEL|ONDERHOUD|BANDEN/.test(text)) cat = 'entretien';
  else if (/R[EÉ]PARATION|CARROSSERIE|CHOC|PARE[- ]?BRISE|BRIS\s+DE\s+GLACE|RIPARAZIONE|GUASTO|PANNE|REPARATUR|REPARATIE/.test(text)) cat = 'réparation';
  else if (/ACHAT\s+V[EÉ]HICULE|ACQUISITION|BON\s+DE\s+COMMANDE|ACQUISTO|KAUFVERTRAG|AANKOOP/.test(text)) cat = 'achat';
  out.factureCategorie = cat;

  // --- Caractéristiques techniques (ex. PV de livraison, carte grise) ---
  // CO2 (g/km)
  let co2m = text.match(/CO2\s*[:\s]*(\d{1,3})/) || text.match(/\b(\d{1,3})\s*GR?\s*\/?\s*KM\b/);
  if (co2m) { const n = +co2m[1]; if (n >= 0 && n < 600) out.co2 = n; }
  // Puissance fiscale (CV)
  const cvm = text.match(/\b(\d{1,2})\s*CV\b/);
  if (cvm) { const n = +cvm[1]; if (n > 0 && n < 100) out.puissanceFiscale = n; }
  // VIN / n° de châssis (17 caractères, sans I/O/Q)
  const vinm = text.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
  if (vinm) out.vin = vinm[1];
  // Carburant
  if (/\bHYBRID|HEV|PHEV/.test(text)) out.carburant = 'Essence / Hybride';
  else if (/[ÉE]LECTRIQUE|\bELEC\b|\bEV\b/.test(text)) out.carburant = 'Électrique';
  else if (/DIESEL|GAZOLE|\bGO\b/.test(text)) out.carburant = 'Diesel';
  else if (/\bESSENCE\b/.test(text)) out.carburant = 'Essence';

  return out;
};


// =====================================================================
// === Journal des modifications (qui / quoi / quand) ===================
// =====================================================================
// Enregistre chaque écriture en base (ajout / modification / suppression)
// avec l'utilisateur connecté et l'horodatage. Stocké en localStorage.
FP.audit = {
  KEY: 'auto_flotte_audit_log',
  MAX: 800,
  TABLE_LABEL: { vehicules: 'Véhicule', amendes: 'Amende', factures: 'Facture', conducteurs: 'Conducteur', emprunts: 'Emprunt', documents: 'Document' },
  get() { try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); } catch (e) { return []; } },
  _save(arr) { try { localStorage.setItem(this.KEY, JSON.stringify(arr.slice(0, this.MAX))); } catch (e) {} },
  log(entry) {
    const arr = this.get();
    arr.unshift({ ts: new Date().toISOString(), user: FP._userEmail || (function () { try { return localStorage.getItem('auto_flotte_last_user'); } catch (e) { return null; } })() || 'inconnu', ...entry });
    this._save(arr);
    try { document.dispatchEvent(new CustomEvent('fp:audit')); } catch (e) {}
  },
  clear() { try { localStorage.removeItem(this.KEY); } catch (e) {} try { document.dispatchEvent(new CustomEvent('fp:audit')); } catch (e) {} },
  _describeRow(table, row) {
    if (!row) return '';
    if (table === 'vehicules') return `${row.immat || ''} ${row.marque || ''} ${row.modele || ''}`.trim();
    if (table === 'amendes')   return `${row.prenom || ''}${row.motif ? ' · ' + row.motif : ''}`.trim();
    if (table === 'factures')  return `${row.vehiculeImmat || ''}${row.fournisseur ? ' · ' + row.fournisseur : (row.numeroFacture ? ' · ' + row.numeroFacture : '')}`.trim();
    if (table === 'conducteurs') return row.name || row.key || '';
    return row.immat || row.nom || row.id || '';
  },
  _describeId(table, id) {
    const d = window.FP_DATA || {};
    const coll = d[table];
    const rec = Array.isArray(coll) ? coll.find(x => x.id === id) : null;
    return rec ? this._describeRow(table, rec) : (id || '');
  },
};

// Instrumente FP.db pour journaliser chaque écriture réussie (une seule couche,
// donc pas de double comptage même via FP.persist qui appelle FP.db).
(function instrumentDbForAudit() {
  if (!FP.db || FP.db.__audited) return;
  FP.db.__audited = true;
  const ACTIONS = { insert: 'ajout', update: 'modification', delete: 'suppression', upsert: 'ajout / mise à jour' };
  ['insert', 'update', 'delete', 'upsert'].forEach(m => {
    const orig = FP.db[m].bind(FP.db);
    FP.db[m] = async function (table, a, b) {
      const id = (m === 'update' || m === 'delete') ? a : (a && a.id) || '';
      const label = (m === 'insert' || m === 'upsert') ? FP.audit._describeRow(table, a) : FP.audit._describeId(table, id);
      const champs = (m === 'update' && b) ? Object.keys(b).join(', ') : '';
      const res = await orig(table, a, b);
      if (!(res && res.error)) {
        FP.audit.log({ action: ACTIONS[m], table, id, label, champs });
      }
      return res;
    };
  });
})();

FP.navLabel = (navKey) => {
  const custom = FP.settings.get().sidebarLabels || {};
  return custom[navKey] || FP.DEFAULT_NAV_LABELS[navKey] || navKey;
};
FP.applyCustomNavLabels = () => {
  document.querySelectorAll('a[data-nav]').forEach(a => {
    const navKey = a.dataset.nav;
    const label = FP.navLabel(navKey);
    let span = a.querySelector('.nav-label');
    if (!span) {
      // Première fois : on retire les text-nodes existants et on insère un span + bouton ✎
      Array.from(a.childNodes).forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) node.remove();
      });
      span = document.createElement('span');
      span.className = 'nav-label';
      a.appendChild(span);
      if (FP.canPersonnaliser()) { // renommage d'onglet (admin + gestionnaire)
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'nav-edit-btn';
        editBtn.title = 'Renommer cet onglet';
        editBtn.textContent = '✎';
        editBtn.dataset.navEdit = navKey;
        a.appendChild(editBtn);
      }
    }
    span.textContent = label;
  });
};

// === Textes éditables (titres / sous-titres / phrases descriptives sur les pages) ===
// Pour rendre un élément éditable : ajouter data-edit-key="page.title|page.subtitle|..."
// Le texte par défaut est mémorisé au 1er chargement (ne pas hardcoder dans une map séparée).
FP.applyCustomTexts = () => {
  const custom = FP.settings.get().customTexts || {};
  document.querySelectorAll('[data-edit-key]').forEach(el => {
    const key = el.dataset.editKey;
    if (!el.dataset.editDefault) el.dataset.editDefault = el.textContent.trim();
    if (custom[key]) el.textContent = custom[key];
    else el.textContent = el.dataset.editDefault;
  });
};

FP.startTextEdit = (el) => {
  if (el.classList.contains('editing-text')) return;
  el.classList.add('editing-text');
  el.contentEditable = 'true';
  el.focus();
  // Sélectionne tout le contenu
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  const originalText = el.textContent;
  const key = el.dataset.editKey;
  const defaultText = el.dataset.editDefault || '';
  let committed = false;

  function finish(save) {
    if (committed) return;
    committed = true;
    el.contentEditable = 'false';
    el.classList.remove('editing-text');
    if (save) {
      const newText = el.textContent.trim();
      const current = FP.settings.get();
      const texts = { ...(current.customTexts || {}) };
      if (newText && newText !== defaultText) texts[key] = newText;
      else delete texts[key];
      try { if (FP.history && FP.history.commit) FP.history.commit(); } catch {}
      current.customTexts = texts;
      FP.settings.save(current);
      if (!newText) el.textContent = defaultText;
    } else {
      el.textContent = originalText;
    }
  }

  el.addEventListener('blur', () => finish(true), { once: true });
  el.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Enter')      { e.preventDefault(); el.blur(); }
    else if (e.key === 'Escape'){ e.preventDefault(); finish(false); el.removeEventListener('keydown', onKey); }
  });
};

// Édition inline d'un onglet de sidebar (clic sur ✎)
FP.startNavEdit = (aEl) => {
  if (aEl.classList.contains('editing')) return;
  const navKey = aEl.dataset.nav;
  const span = aEl.querySelector('.nav-label');
  const editBtn = aEl.querySelector('.nav-edit-btn');
  if (!span) return;
  const currentLabel = span.textContent;

  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentLabel;
  input.className = 'nav-label-input';
  span.style.display = 'none';
  if (editBtn) editBtn.style.display = 'none';
  aEl.insertBefore(input, span);
  aEl.classList.add('editing');
  setTimeout(() => { input.focus(); input.select(); }, 10);

  // Empêche la navigation pendant l'édition
  const blockNav = (e) => { if (aEl.classList.contains('editing')) e.preventDefault(); };
  aEl.addEventListener('click', blockNav);

  function finish(save) {
    if (save) {
      const val = input.value.trim();
      const current = FP.settings.get();
      const labels = { ...(current.sidebarLabels || {}) };
      if (val && val !== FP.DEFAULT_NAV_LABELS[navKey]) labels[navKey] = val;
      else delete labels[navKey];
      // Snapshot historique si dispo sur la page
      try { if (FP.history && FP.history.commit) FP.history.commit(); } catch {}
      current.sidebarLabels = labels;
      FP.settings.save(current);
    }
    input.remove();
    span.style.display = '';
    if (editBtn) editBtn.style.display = '';
    aEl.classList.remove('editing');
    aEl.removeEventListener('click', blockNav);
    FP.applyCustomNavLabels();
  }

  input.addEventListener('blur', () => finish(true));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')      { e.preventDefault(); finish(true); }
    else if (e.key === 'Escape'){ e.preventDefault(); finish(false); }
  });
  // Bloquer la navigation déclenchée par mousedown/click sur l'input lui-même
  input.addEventListener('click', (e) => e.preventDefault());
  input.addEventListener('mousedown', (e) => e.stopPropagation());
};

// === Overrides véhicule (modifications utilisateur persistées en localStorage) ===
FP.VEH_OVERRIDES_KEY = 'auto_flotte_vehicle_overrides';
FP.getVehicleOverrides = () => {
  try { return JSON.parse(localStorage.getItem(FP.VEH_OVERRIDES_KEY) || '{}'); }
  catch { return {}; }
};
FP.saveVehicleOverride = (vehId, updates) => {
  try {
    const all = FP.getVehicleOverrides();
    all[vehId] = { ...(all[vehId] || {}), ...updates };
    localStorage.setItem(FP.VEH_OVERRIDES_KEY, JSON.stringify(all));
  } catch (e) { console.warn('Save override failed', e); }
};
FP.clearVehicleOverrides = () => {
  localStorage.removeItem(FP.VEH_OVERRIDES_KEY);
};
// Retire un champ (ou tout le véhicule) de l'override local — utilisé quand la base
// Supabase a bien enregistré la valeur (la base devient la source de vérité, partagée).
FP.removeVehicleOverride = (vehId, field) => {
  try {
    const all = FP.getVehicleOverrides();
    if (!all[vehId]) return;
    if (field == null) { delete all[vehId]; }
    else { delete all[vehId][field]; if (!Object.keys(all[vehId]).length) delete all[vehId]; }
    localStorage.setItem(FP.VEH_OVERRIDES_KEY, JSON.stringify(all));
  } catch (e) {}
};
// Applique les overrides sauvegardés sur FP_DATA.vehicules (à appeler au chargement de la page)
FP.loadVehicleOverrides = () => {
  if (!window.FP_DATA || !window.FP_DATA.vehicules) return;
  const overrides = FP.getVehicleOverrides();
  window.FP_DATA.vehicules.forEach(v => {
    if (overrides[v.id]) Object.assign(v, overrides[v.id]);
  });
  if (FP.normalizeVehicleNames) FP.normalizeVehicleNames();
};
// Applique les modifs locales dès le 1er affichage (avant le chargement Supabase),
// pour que toute modif se voie immédiatement sur toutes les pages.
try { FP.loadVehicleOverrides(); } catch (e) {}

// Synchro automatique : pousse vers Supabase les modifs restées en local (hors-ligne
// ou faites avant l'ajout d'une colonne), champ par champ, puis nettoie l'override.
// Aucune action de l'utilisateur requise — fonctionne sur 2 PC sans bouton.
FP.autoSyncOverrides = async () => {
  if (!(FP.db && FP.supabase)) return;
  let all = {};
  try { all = FP.getVehicleOverrides() || {}; } catch (e) { return; }
  for (const id of Object.keys(all)) {
    const fields = all[id] || {};
    for (const [k, val] of Object.entries(fields)) {
      try {
        const res = await FP.db.update('vehicules', id, { [k]: val });
        if (!(res && res.error)) FP.removeVehicleOverride(id, k); // synchronisé → la base fait foi
      } catch (e) { /* colonne absente ou hors-ligne : on garde en local */ }
    }
  }
};
document.addEventListener('fp:data-ready', (e) => {
  if (e.detail && e.detail.source === 'supabase') FP.autoSyncOverrides();
});

// === Historique Undo/Redo ===
// Snapshote l'état complet (settings + overrides + vehicules in-memory) avant chaque mutation.
FP.history = {
  past: [],
  future: [],
  capacity: 30,
  renderAll: () => {}, // callback à définir par chaque page utilisant l'historique

  snapshot() {
    const fpData = {};
    if (window.FP_DATA) {
      if (window.FP_DATA.vehicules) fpData.vehicules = JSON.parse(JSON.stringify(window.FP_DATA.vehicules));
      if (window.FP_DATA.amendes)   fpData.amendes   = JSON.parse(JSON.stringify(window.FP_DATA.amendes));
    }
    return {
      settings: JSON.parse(localStorage.getItem(FP.settings.STORAGE_KEY) || '{}'),
      overrides: JSON.parse(localStorage.getItem(FP.VEH_OVERRIDES_KEY) || '{}'),
      fpData,
    };
  },

  // À appeler AVANT chaque mutation utilisateur
  commit() {
    this.past.push(this.snapshot());
    if (this.past.length > this.capacity) this.past.shift();
    this.future = [];
    this.updateUI();
  },

  undo() {
    if (this.past.length === 0) return;
    this.future.push(this.snapshot());
    if (this.future.length > this.capacity) this.future.shift();
    this.restore(this.past.pop());
  },

  redo() {
    if (this.future.length === 0) return;
    this.past.push(this.snapshot());
    if (this.past.length > this.capacity) this.past.shift();
    this.restore(this.future.pop());
  },

  restore(snap) {
    localStorage.setItem(FP.settings.STORAGE_KEY, JSON.stringify(snap.settings));
    localStorage.setItem(FP.VEH_OVERRIDES_KEY, JSON.stringify(snap.overrides));
    if (snap.fpData && window.FP_DATA) {
      if (snap.fpData.vehicules) window.FP_DATA.vehicules = JSON.parse(JSON.stringify(snap.fpData.vehicules));
      if (snap.fpData.amendes)   window.FP_DATA.amendes   = JSON.parse(JSON.stringify(snap.fpData.amendes));
    }
    FP.settings.applyTheme();
    this.renderAll();
    this.updateUI();
  },

  canUndo() { return this.past.length > 0; },
  canRedo() { return this.future.length > 0; },

  updateUI() {
    document.querySelectorAll('[data-history-undo]').forEach(b => {
      b.disabled = !this.canUndo();
      b.classList.toggle('opacity-40', !this.canUndo());
      b.classList.toggle('cursor-not-allowed', !this.canUndo());
    });
    document.querySelectorAll('[data-history-redo]').forEach(b => {
      b.disabled = !this.canRedo();
      b.classList.toggle('opacity-40', !this.canRedo());
      b.classList.toggle('cursor-not-allowed', !this.canRedo());
    });
  },
};
// Retourne TOUJOURS un array de clés de groupes pour un véhicule, peu importe le format stocké
FP.vehGroupes = (v) => {
  if (!v) return ['non-classe'];
  if (Array.isArray(v.groupes) && v.groupes.length) return v.groupes;
  if (v.groupe) return [v.groupe];
  return ['non-classe'];
};

// === Helper réutilisable pour rendre les colonnes d'un tableau éditables ===
// (drag pour déplacer, ✕ pour masquer, double-clic pour renommer, popover pour réafficher)
// Usage :
//   const editor = FP.makeColumnEditor({
//     pageKey: 'amendes',
//     columns: [{ key, label, defaultWidth, cellCls, render(row) }, ...],
//     tableEl: document.querySelector('table'),
//     hiddenBtnContainer: document.querySelector('#header-actions'),  // optionnel
//     onChange: () => rerenderAll(),
//   });
//   // Dans ton render row :
//   editor.getVisibleColumns().map(k => `<td>${editor.getColumn(k).render(row)}</td>`)
FP.makeColumnEditor = (config) => {
  const { pageKey, columns, tableEl, hiddenBtnContainer, onChange } = config;
  const editable = (window.FP && FP.canPersonnaliser) ? FP.canPersonnaliser() : true; // perso. colonnes (admin + gestionnaire)
  const storageKey = `fp_table_${pageKey}`;
  const allKeys = columns.map(c => c.key);
  const defaultOrder = config.defaultOrder || allKeys.slice();

  // Config stockée dans les réglages PARTAGÉS (app_settings) -> identique sur tous les PC.
  function getCfg() {
    try {
      let stored = null;
      if (window.FP && FP.settings) {
        const all = FP.settings.get().tableConfigs || {};
        stored = all[pageKey] || null;
      }
      // Migration depuis l'ancien stockage local (une seule fois)
      if (!stored) {
        try { const legacy = JSON.parse(localStorage.getItem(storageKey) || 'null'); if (legacy) { stored = legacy; saveCfg(legacy); localStorage.removeItem(storageKey); } } catch (e) {}
      }
      stored = stored || {};
      const order = Array.isArray(stored.order) ? stored.order.filter(k => allKeys.includes(k)) : null;
      return {
        order: (order && order.length) ? order : defaultOrder.slice(),
        hidden: Array.isArray(stored.hidden) ? stored.hidden : [],
        labels: (stored.labels && typeof stored.labels === 'object') ? stored.labels : {},
      };
    } catch { return { order: defaultOrder.slice(), hidden: [], labels: {} }; }
  }
  function saveCfg(cfg) {
    if (window.FP && FP.settings) {
      const s = FP.settings.get();
      s.tableConfigs = (s.tableConfigs && typeof s.tableConfigs === 'object') ? s.tableConfigs : {};
      s.tableConfigs[pageKey] = cfg;
      FP.settings.save(s); // localStorage + app_settings (partagé)
    } else { try { localStorage.setItem(storageKey, JSON.stringify(cfg)); } catch (e) {} }
  }
  function getLabel(key) {
    const cfg = getCfg();
    if (cfg.labels[key]) return cfg.labels[key];
    const def = columns.find(c => c.key === key);
    return def ? def.label : key;
  }
  function getColumn(key) { return columns.find(c => c.key === key); }
  function getVisible() {
    const cfg = getCfg();
    return cfg.order.filter(k => !cfg.hidden.includes(k));
  }

  // Crée le colgroup et le thead à partir du config
  function renderHeaders() {
    let colgroup = tableEl.querySelector('colgroup.fp-managed');
    if (!colgroup) {
      colgroup = document.createElement('colgroup');
      colgroup.className = 'fp-managed';
      tableEl.insertBefore(colgroup, tableEl.firstChild);
    }
    const visible = getVisible();
    colgroup.innerHTML = visible.map(k => {
      const def = getColumn(k);
      return `<col data-col-key="${k}" style="width: ${def?.defaultWidth || 120}px">`;
    }).join('');

    const thead = tableEl.querySelector('thead');
    thead.innerHTML = `<tr>${visible.map(k => {
      const def = getColumn(k);
      if (!def) return '';
      return `<th ${editable ? 'draggable="true"' : ''} data-col-key="${k}"${editable ? ' title="Glisser pour déplacer • Double-clic pour renommer"' : ''}>${getLabel(k)}${editable ? `<button class="col-hide-btn" data-hide-key="${k}" title="Masquer">✕</button>` : ''}</th>`;
    }).join('')}</tr>`;

    // Mise à jour pastille colonnes masquées
    if (hiddenBtnContainer && editable) renderHiddenColsButton();

    // Ajouter la classe pour table-layout: fixed
    tableEl.classList.add('fp-table-resizable');
  }

  function renderHiddenColsButton() {
    const cfg = getCfg();
    const hidden = allKeys.filter(k => cfg.hidden.includes(k) || !cfg.order.includes(k));
    let wrap = hiddenBtnContainer.querySelector('.fp-hidden-cols-wrap');
    if (hidden.length === 0) { if (wrap) wrap.remove(); return; }
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'fp-hidden-cols-wrap';
      wrap.style.position = 'relative';
      wrap.innerHTML = `
        <button class="hidden-cols-btn fp-hidden-cols-btn" type="button">
          <span class="fp-eye-off">👁‍🗨</span>
          <span class="fp-hidden-count">0</span> masquée(s)
        </button>
        <div class="hidden-cols-popover fp-hidden-cols-popover"></div>
      `;
      hiddenBtnContainer.insertBefore(wrap, hiddenBtnContainer.firstChild);
      // Wire le clic
      wrap.querySelector('.fp-hidden-cols-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        wrap.querySelector('.fp-hidden-cols-popover').classList.toggle('open');
      });
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.fp-hidden-cols-wrap')) {
          wrap.querySelector('.fp-hidden-cols-popover')?.classList.remove('open');
        }
      });
      wrap.querySelector('.fp-hidden-cols-popover').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-show-key]');
        if (!btn) return;
        const key = btn.dataset.showKey;
        const cfg = getCfg();
        cfg.hidden = cfg.hidden.filter(k => k !== key);
        if (!cfg.order.includes(key)) cfg.order.push(key);
        saveCfg(cfg);
        wrap.querySelector('.fp-hidden-cols-popover').classList.remove('open');
        rerender();
      });
    }
    wrap.querySelector('.fp-hidden-count').textContent = hidden.length;
    wrap.querySelector('.fp-hidden-cols-popover').innerHTML = hidden.map(k => {
      const def = getColumn(k);
      return def ? `<button data-show-key="${k}">+ ${getLabel(k)}</button>` : '';
    }).join('');
  }

  function rerender() {
    renderHeaders();
    if (onChange) onChange();
  }

  // === Wire drag, hide, rename ===
  let draggedKey = null;
  function clearDragVisuals() {
    tableEl.querySelectorAll('.drag-over-left, .drag-over-right, .dragging').forEach(el => {
      el.classList.remove('drag-over-left', 'drag-over-right', 'dragging');
    });
  }
  const thead = tableEl.querySelector('thead');

  if (editable) {
  thead.addEventListener('dragstart', (e) => {
    const th = e.target.closest('th[data-col-key]');
    if (!th) return;
    draggedKey = th.dataset.colKey;
    th.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', draggedKey); } catch {}
  });
  thead.addEventListener('dragover', (e) => {
    const th = e.target.closest('th[data-col-key]');
    if (!th || !draggedKey || th.dataset.colKey === draggedKey) return;
    e.preventDefault();
    const rect = th.getBoundingClientRect();
    const isLeft = e.clientX < rect.left + rect.width / 2;
    thead.querySelectorAll('.drag-over-left, .drag-over-right').forEach(el => el.classList.remove('drag-over-left', 'drag-over-right'));
    th.classList.add(isLeft ? 'drag-over-left' : 'drag-over-right');
  });
  thead.addEventListener('drop', (e) => {
    const th = e.target.closest('th[data-col-key]');
    if (!th || !draggedKey || th.dataset.colKey === draggedKey) { clearDragVisuals(); draggedKey = null; return; }
    e.preventDefault();
    const targetKey = th.dataset.colKey;
    const rect = th.getBoundingClientRect();
    const isLeft = e.clientX < rect.left + rect.width / 2;
    const cfg = getCfg();
    let newOrder = cfg.order.filter(k => k !== draggedKey);
    const targetIdx = newOrder.indexOf(targetKey);
    newOrder.splice(isLeft ? targetIdx : targetIdx + 1, 0, draggedKey);
    cfg.order = newOrder;
    saveCfg(cfg);
    clearDragVisuals();
    draggedKey = null;
    rerender();
  });
  thead.addEventListener('dragend', () => { clearDragVisuals(); draggedKey = null; });

  // Masquer
  thead.addEventListener('click', (e) => {
    const btn = e.target.closest('.col-hide-btn');
    if (!btn) return;
    e.stopPropagation();
    const key = btn.dataset.hideKey;
    const cfg = getCfg();
    if (!cfg.hidden.includes(key)) { cfg.hidden.push(key); saveCfg(cfg); rerender(); }
  });

  // Renommer (double-clic)
  thead.addEventListener('dblclick', (e) => {
    const th = e.target.closest('th[data-col-key]');
    if (!th || e.target.closest('.col-hide-btn')) return;
    const key = th.dataset.colKey;
    const current = getLabel(key);
    th.draggable = false;
    th.innerHTML = `<input type="text" class="col-label-edit" value="${current.replace(/"/g, '&quot;')}" /><button class="col-hide-btn" data-hide-key="${key}">✕</button>`;
    const input = th.querySelector('input');
    input.focus(); input.select();
    let done = false;
    function commit(save) {
      if (done) return; done = true;
      if (save) {
        const newLabel = input.value.trim();
        const def = getColumn(key);
        const cfg = getCfg();
        if (newLabel && newLabel !== (def ? def.label : '')) cfg.labels[key] = newLabel;
        else delete cfg.labels[key];
        saveCfg(cfg);
      }
      rerender();
    }
    input.addEventListener('blur', () => commit(true), { once: true });
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter')      { ev.preventDefault(); input.blur(); }
      else if (ev.key === 'Escape'){ ev.preventDefault(); commit(false); }
    });
  });
  } // fin if(editable) — wiring perso. colonnes

  // Initial render
  renderHeaders();

  return { rerender, getVisibleColumns: getVisible, getLabel, getColumn };
};

// === Recherche globale (injectée automatiquement dans toutes les sidebars) ===
// === Bouton Déconnexion (injecté en bas des sidebars) ===
FP.injectLogoutButton = () => {
  document.querySelectorAll('.fp-sidebar').forEach(sb => {
    if (sb.querySelector('.fp-logout-btn')) return;
    const div = document.createElement('div');
    div.className = 'fp-logout-wrap';
    div.style.cssText = 'margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1)';
    div.innerHTML = `
      <button class="fp-logout-btn" type="button" style="
        width: 100%;
        display: flex;
        align-items: center;
        gap: .65rem;
        padding: .55rem .85rem;
        background: rgba(255,255,255,.05);
        border: none;
        border-radius: .45rem;
        color: rgba(255,255,255,.7);
        font-size: .85rem;
        font-weight: 500;
        cursor: pointer;
        transition: background .12s, color .12s;
      ">
        <span style="font-size: .95rem">↪</span>
        <span class="fp-logout-label">Déconnexion</span>
        <span class="fp-user-email" style="margin-left: auto; font-size: .65rem; opacity: .5; max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"></span>
      </button>
      <div class="fp-user-role" style="margin-top:.4rem; font-size:.62rem; letter-spacing:.04em; text-transform:uppercase; color:rgba(255,255,255,.4); padding-left:.85rem;"></div>
    `;
    sb.appendChild(div);
    const roleEl = div.querySelector('.fp-user-role');
    if (roleEl) roleEl.textContent = 'Rôle : ' + FP.roleLabel();

    const btn = div.querySelector('.fp-logout-btn');
    btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(255,255,255,.12)'; btn.style.color = 'white'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(255,255,255,.05)'; btn.style.color = 'rgba(255,255,255,.7)'; });
    btn.addEventListener('click', () => {
      if (FP.auth) FP.auth.signOut();
    });

    // Afficher l'email de l'utilisateur connecté
    if (FP.auth) {
      FP.auth.getUser().then(user => {
        if (user && user.email) {
          FP._userEmail = user.email;
          try { localStorage.setItem('auto_flotte_last_user', user.email); } catch (e) {}
          const emailEl = div.querySelector('.fp-user-email');
          if (emailEl) emailEl.textContent = user.email;
        }
      });
    }
  });
};

FP.injectGlobalSearch = () => {
  document.querySelectorAll('.fp-sidebar').forEach(sb => {
    if (sb.querySelector('.fp-global-search')) return;
    const nav = sb.querySelector('nav');
    if (!nav) return;
    const wrap = document.createElement('div');
    wrap.className = 'fp-global-search';
    wrap.innerHTML = `
      <div style="position: relative">
        <span style="position:absolute; left:.65rem; top:50%; transform:translateY(-50%); color:rgba(255,255,255,.5); font-size:.85rem">🔍</span>
        <input type="text" class="fp-search-input" placeholder="Rechercher..." />
      </div>
      <div class="fp-search-results"></div>
    `;
    sb.insertBefore(wrap, nav);
  });
};

FP.searchAll = (q) => {
  if (!q || q.length < 2) return [];
  q = q.toLowerCase().trim();
  const inPagesFolder = window.location.pathname.includes('/pages/');
  const pref = inPagesFolder ? '' : 'pages/';
  const out = [];
  (window.FP_DATA?.vehicules || []).forEach(v => {
    const text = `${v.immat || ''} ${v.marque || ''} ${v.modele || ''} ${v.chauffeur || ''} ${v.vin || ''}`.toLowerCase();
    if (text.includes(q)) {
      out.push({ type: 'véh.', icon: '🚗', label: `${v.immat} · ${v.marque} ${v.modele}`.trim(), sub: v.chauffeur || '', url: pref + 'vehicules.html?veh=' + encodeURIComponent(v.id) });
    }
  });
  (window.FP_DATA?.amendes || []).forEach(a => {
    const text = `${a.prenom || ''} ${a.motif || ''} ${a.numeroAvis || ''}`.toLowerCase();
    if (text.includes(q)) {
      out.push({ type: 'amende', icon: '🎫', label: `${a.prenom} · ${a.motif}`, sub: `${a.montant ? FP.euroPrecis(a.montant) : ''} · ${FP.date(a.date)}`, url: pref + 'amendes.html?amende=' + encodeURIComponent(a.id) });
    }
  });
  (window.FP_DATA?.factures || []).forEach(f => {
    const text = `${f.vehiculeImmat || ''} ${f.fournisseur || ''} ${f.description || ''} ${f.numeroFacture || ''}`.toLowerCase();
    if (text.includes(q)) {
      out.push({ type: f.type || 'fact.', icon: f.type === 'sinistre' ? '⚠️' : '📄', label: `${f.vehiculeImmat} · ${f.fournisseur || ''}`, sub: `${f.description ? f.description.slice(0,60) : ''}`, url: pref + (f.type === 'sinistre' ? 'sinistres.html' : 'factures.html?facture=' + encodeURIComponent(f.fileId || '')) });
    }
  });
  return out;
};

// =====================================================================
// === Import / Export CSV (moteur partagé, compatible Excel FR) ========
// =====================================================================
// CSV produit avec : BOM UTF-8 (accents OK), séparateur ';' (colonnes
// séparées dans Excel FR), champs entre guillemets si nécessaire.
FP.csv = {
  BOM: '﻿',
  _esc(v) {
    if (v === null || v === undefined) v = '';
    v = String(v);
    if (/[";\n\r]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
    return v;
  },
  // columns = [{ key, label, format?(value,row) }]
  build(columns, rows) {
    const head = columns.map(c => this._esc(c.label)).join(';');
    const body = (rows || []).map(r => columns.map(c => {
      let val = r[c.key];
      if (c.format) val = c.format(val, r);
      return this._esc(val);
    }).join(';'));
    return this.BOM + [head, ...body].join('\r\n');
  },
  download(filename, columns, rows) {
    const blob = new Blob([this.build(columns, rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  },
  // Parse un texte CSV (auto-détection ; ou ,) → tableau d'objets {entête: valeur}
  parse(text) {
    if (!text) return [];
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const nl = text.indexOf('\n');
    const firstLine = nl < 0 ? text : text.slice(0, nl);
    const delim = (firstLine.split(';').length >= firstLine.split(',').length) ? ';' : ',';
    const rows = [];
    let field = '', row = [], inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
        else field += ch;
      } else {
        if (ch === '"') inQ = true;
        else if (ch === delim) { row.push(field); field = ''; }
        else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (ch === '\r') { /* ignore */ }
        else field += ch;
      }
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    if (!rows.length) return [];
    const headers = rows.shift().map(h => (h || '').trim());
    return rows.filter(r => r.some(c => (c || '').trim() !== '')).map(r => {
      const o = {};
      headers.forEach((h, idx) => { o[h] = r[idx] !== undefined ? r[idx].trim() : ''; });
      return o;
    });
  },
  // Helpers de conversion pour les colonnes numériques
  numFormat: (v) => (v === null || v === undefined || v === '') ? '' : String(v).replace('.', ','),
  numParse: (v) => {
    const s = (v || '').toString().replace(/[^\d,.\-]/g, '').replace(',', '.');
    return s === '' ? null : parseFloat(s);
  },
};

// Toolbar Import/Export réutilisable.
// config = {
//   filename, columns, getRows(),                 // export
//   table?, collection?,                          // import par défaut (Supabase + FP_DATA)
//   idPrefix?, onChange?,                          // re-render après import
//   makeRecord?(csvRow)  -> record (camelCase),   // mapping ligne CSV → enregistrement
//   onImport?(records)                            // sinon : upsert générique
//   container? (élément hôte ; défaut [data-data-io])
// }
FP.injectDataIO = (config) => {
  return; // Boutons Importer/Exporter CSV retirés (remplacés par l'import de document sur Véhicules/Amendes)
  const host = config.container || document.querySelector('[data-data-io]');
  if (!host || host.querySelector('.fp-io-wrap')) return;

  const wrap = document.createElement('span');
  wrap.className = 'fp-io-wrap';
  wrap.style.cssText = 'display:inline-flex; gap:.5rem; align-items:center';
  wrap.innerHTML = `
    <button type="button" class="btn btn-outline text-sm fp-io-export"><i data-lucide="download" class="w-4 h-4"></i> Exporter</button>
    ${config.exportOnly ? '' : `<button type="button" class="btn btn-outline text-sm fp-io-import"><i data-lucide="upload" class="w-4 h-4"></i> Importer</button>
    <input type="file" accept=".csv,text/csv" class="fp-io-file" style="display:none" />`}`;
  host.appendChild(wrap);
  if (window.lucide) lucide.createIcons();

  wrap.querySelector('.fp-io-export').addEventListener('click', () => {
    FP.csv.download(config.filename, config.columns, config.getRows() || []);
  });
  if (config.exportOnly) return;

  const fileInput = wrap.querySelector('.fp-io-file');
  wrap.querySelector('.fp-io-import').addEventListener('click', () => fileInput.click());

  const makeRecord = config.makeRecord || function (csvRow) {
    const rec = {};
    config.columns.forEach(c => {
      let v = csvRow[c.label];
      if (v === undefined) return;
      if (c.parse) v = c.parse(v, csvRow);
      rec[c.key] = v;
    });
    return rec;
  };

  const defaultImport = function (records) {
    const coll = (window.FP_DATA && config.collection) ? (window.FP_DATA[config.collection] || (window.FP_DATA[config.collection] = [])) : null;
    let added = 0, updated = 0;
    records.forEach(rec => {
      if (!rec.id) rec.id = (config.idPrefix || 'IMP-') + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      if (coll) {
        const i = coll.findIndex(x => x.id === rec.id);
        if (i >= 0) { coll[i] = { ...coll[i], ...rec }; updated++; } else { coll.push(rec); added++; }
      }
      if (config.table && FP.persist && FP.persist.available && FP.persist.available()) FP.persist.upsert(config.table, rec);
    });
    if (config.onChange) config.onChange();
    alert(`Import terminé ✓\n${added} ajout(s), ${updated} mise(s) à jour.`);
  };

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = FP.csv.parse(reader.result);
        if (!parsed.length) { alert('Fichier vide ou illisible.'); return; }
        const records = parsed.map(makeRecord).filter(Boolean);
        if (!records.length) { alert('Aucune ligne exploitable dans le fichier.'); return; }
        if (!confirm(`Importer ${records.length} ligne(s) ?\n\n• Les lignes existantes (même ID) sont mises à jour\n• Les nouvelles sont ajoutées\n• Rien n'est supprimé`)) return;
        (config.onImport || defaultImport)(records);
      } catch (e) {
        alert('Erreur de lecture du fichier : ' + (e.message || e));
      } finally {
        fileInput.value = '';
      }
    };
    reader.readAsText(file, 'UTF-8');
  });
};

// Navigation active state (sidebar)
document.addEventListener('DOMContentLoaded', () => {
  // Appliquer le thème (couleurs des groupes) dès le chargement
  FP.settings.applyTheme();
  // Rôle courant : marque le body + retire les onglets réservés à l'admin
  const _isAdmin = FP.isAdmin();
  document.body.setAttribute('data-role', FP.role());
  if (!_isAdmin) {
    (FP.ADMIN_ONLY_NAV || []).forEach(key => {
      document.querySelectorAll(`a[data-nav="${key}"]`).forEach(a => a.remove());
    });
  }
  // Appliquer les labels personnalisés des onglets puis l'ordre choisi
  FP.applyCustomNavLabels();
  FP.applyNavOrder();
  FP.applyNavVisibility();
  if (_isAdmin) FP.enableNavReorder(); // glisser-déposer des onglets (admin only)
  // Appliquer les textes éditables custom (titres, sous-titres)
  FP.applyCustomTexts();
  // Injecter la barre de recherche globale dans toutes les sidebars
  FP.injectGlobalSearch();
  // Injecter le bouton déconnexion en bas des sidebars
  FP.injectLogoutButton();

  // Listener pour la recherche globale (délégation)
  document.addEventListener('input', (e) => {
    const input = e.target.closest('.fp-search-input');
    if (!input) return;
    const wrap = input.closest('.fp-global-search');
    const results = wrap.querySelector('.fp-search-results');
    const q = input.value.toLowerCase().trim();
    if (q.length < 2) { results.innerHTML = ''; results.classList.remove('open'); return; }
    const matches = FP.searchAll(q).slice(0, 15);
    if (matches.length === 0) {
      results.innerHTML = '<div class="fp-search-empty">Aucun résultat</div>';
    } else {
      results.innerHTML = matches.map(m => `
        <a href="${m.url}" class="fp-search-item">
          <span class="fp-search-icon">${m.icon}</span>
          <span class="fp-search-text">
            <span class="fp-search-label">${m.label}</span>
            ${m.sub ? `<span class="fp-search-sub">${m.sub}</span>` : ''}
          </span>
        </a>
      `).join('');
    }
    results.classList.add('open');
  });
  // Fermer le dropdown si clic ailleurs
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.fp-global-search')) {
      document.querySelectorAll('.fp-search-results').forEach(r => r.classList.remove('open'));
    }
  });

  const path = (window.location.pathname.split('/').pop() || 'index').replace(/\.html$/, '');
  document.querySelectorAll('[data-nav]').forEach(el => {
    if ((el.dataset.nav || '').replace(/\.html$/, '') === path) el.classList.add('active');
  });

  // Délégation : clic sur ✎ → édition inline du nom de l'onglet
  document.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.nav-edit-btn');
    if (!editBtn) return;
    if (!FP.isAdmin()) return;
    e.preventDefault();
    e.stopPropagation();
    const a = editBtn.closest('a[data-nav]');
    if (a) FP.startNavEdit(a);
  });

  // Délégation : clic sur un élément [data-edit-key] → édition inline du texte
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-edit-key]');
    if (!el || el.classList.contains('editing-text')) return;
    if (!FP.canPersonnaliser()) return; // édition des titres (admin + gestionnaire)
    // Ignorer si on est en train de cliquer sur un autre bouton/lien
    if (e.target.closest('button, a, input, select')) return;
    FP.startTextEdit(el);
  });

  // Mobile menu toggle (landing)
  const burger = document.getElementById('burger');
  const menu = document.getElementById('mobile-menu');
  if (burger && menu) burger.addEventListener('click', () => menu.classList.toggle('hidden'));
});
