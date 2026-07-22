// Parc Pilot — helpers JS partagés

// Multi-société : si l'utilisateur connecté est un CLIENT (non super-admin), on le verrouille sur
// SA société AVANT tout (clé de cache, filtres, étiquetage des saisies). On lit le profil mis en
// cache au précédent chargement (le serveur le rafraîchit ensuite via supabase-client.js).
(function lockTenant(){
  try {
    const p = JSON.parse(localStorage.getItem('fp_profile') || 'null');
    if (p && p.is_admin === false && p.societe) localStorage.setItem('fp_societe', p.societe);
  } catch (e) {}
})();

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
      // Auto-réparation : un cache VIDE ne doit JAMAIS écraser des données présentes dans data.js
      // (sinon une visite faite pendant un incident — ex. 0 amende — fige la page à 0 ensuite).
      const seed = (k) => {
        if (!Array.isArray(c[k])) return;
        const cur = window.FP_DATA[k];
        if (c[k].length === 0 && Array.isArray(cur) && cur.length > 0) return; // garde data.js
        window.FP_DATA[k] = c[k];
      };
      seed('vehicules'); seed('amendes'); seed('factures'); seed('conducteurs');
    }
  } catch (e) { /* cache illisible : on garde data.js */ }
})();

// === Densité d'affichage (compact / confortable) — réglée dans Paramètres, appliquée à TOUTES les pages ===
(function applyDensity(){ try { if ((localStorage.getItem('fp_density') || '') === 'compact') document.documentElement.classList.add('fp-compact'); } catch (e) {} })();

// EXCEPTION (demande utilisateur) : les fenêtres d'IMPORT / TÉLÉVERSEMENT ne se ferment QUE
// par la croix — pas au clic sur le fond — pour ne pas perdre une saisie en cours (ex. import
// de facture, scan d'avis, carte grise). Tout le RESTE (fiches, autres modales) se ferme au clic
// en dehors, comme ÉCHAP (cf. handler plus bas). On reconnaît une fenêtre d'import si son fond
// contient une zone de téléversement (input file) ou un élément « import »/« upload ».
// On bloque alors le clic sur le fond en phase de CAPTURE (avant tout handler de fermeture).
document.addEventListener('click', (e) => {
  const t = e.target;
  if (!t || !t.matches) return;
  if (!t.matches('.modal-backdrop, [id$="-modal"]')) return;   // uniquement le FOND d'une modale
  const estImport = (t.id && /import|upload/i.test(t.id))
    || t.querySelector('input[type="file"], [id*="import" i], [id*="upload" i]');
  if (estImport) e.stopPropagation();
}, true);

// Garde GLOBAL (toutes les pages + futures) : ÉCHAP ferme TOUTE zone ouverte
// (tiroir, fenêtre modale, popover, menu déroulant, résultats de recherche).
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' && e.keyCode !== 27) return;
  const ae = document.activeElement;
  // Cas spécial : barre de recherche -> ÉCHAP vide la recherche et ferme les résultats.
  if (ae && ae.classList && ae.classList.contains('fp-search-input')) {
    ae.value = '';
    try { ae.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
    const res = document.querySelector('.fp-search-results'); if (res) { res.innerHTML = ''; res.style.display = 'none'; }
    ae.blur(); e.stopPropagation(); return;
  }
  // Si on saisit dans un autre champ (édition inline…), ÉCHAP est géré par le champ lui-même
  // (annule la saisie) et NE ferme PAS la zone parente.
  if (ae && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)) return;
  let closed = false;
  // 1) Tiroirs latéraux (drawer)
  document.querySelectorAll('.drawer.open, .drawer-backdrop.open').forEach(el => { el.classList.remove('open'); closed = true; });
  // 2) Fenêtres modales (backdrops + éléments dont l'id finit par -modal / -backdrop)
  document.querySelectorAll('.modal-backdrop, [id$="-modal"], [id$="-backdrop"]').forEach(el => {
    const vis = !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none' && el.offsetParent !== null;
    if (!vis) return;
    el.classList.add('hidden');
    if (el.style && el.style.display && el.style.display !== 'none') el.style.display = 'none';
    el.classList.remove('open');
    closed = true;
  });
  // 3) Popovers ouverts via la classe .open (éditeur de colonnes, etc.)
  document.querySelectorAll('.hidden-cols-popover.open, .fp-hidden-cols-popover.open, .popover.open, .fp-popover.open').forEach(el => { el.classList.remove('open'); closed = true; });
  // 4) Menus / petites zones ouverts via affichage (menu société, menu mobile, autres popovers/menus)
  document.querySelectorAll('#soc-menu, #mobile-menu, [id$="-menu"], [id$="-popover"], .fp-menu, .popover, .fp-popover').forEach(el => {
    if (el.classList.contains('hidden')) return;
    const vis = getComputedStyle(el).display !== 'none' && el.offsetParent !== null;
    if (!vis) return;
    el.classList.add('hidden'); el.classList.remove('open', 'show');
    closed = true;
  });
  if (closed) e.stopPropagation();
});

// Garde GLOBAL (toutes les pages + futures) : un CLIC EN DEHORS ferme la zone ouverte
// (tiroir/fiche, fenêtre modale, menu déroulant, popover, résultats de recherche),
// EXACTEMENT comme ÉCHAP. Astuce robuste : on mémorise au mousedown les zones DÉJÀ
// ouvertes, pour ne JAMAIS refermer une zone que CE clic vient justement d'ouvrir
// (sinon le menu clignote / se rouvre).
(function () {
  const FLOAT_SEL = '.hidden-cols-popover.open, .fp-hidden-cols-popover.open, .popover.open, .fp-popover.open, .fp-menu, #soc-menu, #mobile-menu, [id$="-menu"], [id$="-popover"]';
  const isVisible = (el) => el && !el.classList.contains('hidden')
    && getComputedStyle(el).display !== 'none' && el.offsetParent !== null;
  function openZones(downTarget) {
    const out = [];
    // downInside : le mousedown a-t-il DÉMARRÉ dans cette zone ? Évalué au mousedown, AVANT tout
    // re-render → immunisé si le clic (ex. édition inline) remplace le DOM et détache la cible.
    const push = (el, type) => { if (el && !out.some(o => o.el === el)) out.push({ el, type, downInside: !!(downTarget && el.contains(downTarget)) }); };
    document.querySelectorAll('.drawer.open').forEach(el => push(el, 'drawer'));
    document.querySelectorAll('.modal-backdrop.open, [id$="-modal"], [id$="-backdrop"]').forEach(el => {
      if (el.classList.contains('drawer-backdrop')) return; // géré avec le tiroir
      if (isVisible(el) && (el.classList.contains('open') || getComputedStyle(el).display === 'flex')) push(el, 'modal');
    });
    document.querySelectorAll(FLOAT_SEL).forEach(el => { if (isVisible(el)) push(el, 'float'); });
    document.querySelectorAll('.fp-search-results').forEach(el => {
      if (el.style.display !== 'none' && (el.innerHTML || '').trim()) push(el, 'search');
    });
    return out;
  }
  let openAtDown = [];
  document.addEventListener('mousedown', (e) => { openAtDown = openZones(e.target); }, true);
  document.addEventListener('click', (e) => {
    if (!openAtDown.length) return;
    const snap = openAtDown; openAtDown = [];
    const t = e.target;
    snap.forEach(({ el, type, downInside }) => {
      if (type === 'drawer') {
        if (downInside || el.contains(t)) return;   // clic DANS la fiche (ou démarré dedans) : on garde
        if (t.closest('.modal-backdrop.open, [id$="-modal"]')) return; // une modale par-dessus la fiche
        el.classList.remove('open');
        document.querySelectorAll('.drawer-backdrop').forEach(bd => bd.classList.remove('open'));
        return;
      }
      if (type === 'modal') {
        if (downInside) return;                     // sélection/édition démarrée dans le panneau : on garde
        if (t === el) { el.classList.add('hidden'); el.classList.remove('open'); if (el.style && el.style.display) el.style.display = 'none'; }
        return;                                     // clic dans le panneau : on garde
      }
      if (downInside || el.contains(t)) return;     // clic À L'INTÉRIEUR de la zone (ou démarré dedans) : on garde
      if (type === 'search') { el.innerHTML = ''; el.style.display = 'none'; return; }
      el.classList.add('hidden'); el.classList.remove('open', 'show');
    });
  }, false);
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
      'actif':        { cls: 'badge-ok',     label: 'Actif' },
      'entretien':    { cls: 'badge-warn',   label: 'En entretien', pulse: true },
      'à vendre':     { cls: 'badge-warn',   label: 'À vendre' },
      'vendu':        { cls: 'badge-info',   label: 'Vendu' },
      'sinistre':     { cls: 'badge-danger', label: 'Sinistre', pulse: true },
      'hors service': { cls: 'badge-danger', label: 'Hors service', pulse: true },
    };
    const m = map[statut] || { cls: 'badge-info', label: statut };
    return `<span class="badge ${m.cls}">${m.pulse ? '<span class="badge-dot"></span>' : ''}${m.label}</span>`;
  },
  // Anime un nombre de 0 → valeur finale (compteur), en gardant préfixe/suffixe (€, km…).
  // Appeler APRÈS avoir posé la valeur finale dans l'élément. Idempotent (1 seule fois).
  countUp(el, durationMs) {
    if (!el || el.dataset.counted === '1') return;
    try { if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { el.dataset.counted = '1'; return; } } catch (e) {}
    const txt = (el.textContent || '').trim();
    // On n'anime PAS les valeurs décimales (ex. « 0,09 €/km ») pour ne pas les déformer.
    if (/\d[.,]\d/.test(txt)) return;
    const m = txt.match(/^(\D*?)([\d  ]*\d)(.*)$/s);
    if (!m) return;
    const target = parseInt(m[2].replace(/[^\d]/g, ''), 10);
    if (!isFinite(target) || target <= 0) { el.dataset.counted = '1'; return; }
    el.dataset.counted = '1';
    const pre = m[1], suf = m[3], dur = durationMs || 800, t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = pre + Math.round(target * e).toLocaleString('fr-FR') + suf;
      if (p < 1) requestAnimationFrame(step); else el.textContent = txt;
    };
    requestAnimationFrame(step);
  },
  // Petite explosion de confettis (succès). Respecte prefers-reduced-motion.
  celebrate(opts) {
    opts = opts || {};
    try { if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) {}
    const colors = ['#F97316', '#16a34a', '#3b82f6', '#eab308', '#ec4899', '#06b6d4'];
    const n = opts.n || 20;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden';
    document.body.appendChild(wrap);
    const cx = opts.x != null ? opts.x : innerWidth / 2;
    const cy = opts.y != null ? opts.y : innerHeight * 0.3;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('div');
      const sz = 6 + Math.random() * 7;
      p.style.cssText = `position:absolute;left:${cx}px;top:${cy}px;width:${sz}px;height:${sz * 0.6}px;background:${colors[i % colors.length]};border-radius:2px;opacity:1;will-change:transform,opacity;transition:transform .9s cubic-bezier(.2,.6,.3,1),opacity .9s ease`;
      wrap.appendChild(p);
      const ang = (Math.PI * 2) * (i / n) + Math.random() * 0.6;
      const dist = 70 + Math.random() * 130;
      const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist + 130;
      requestAnimationFrame(() => { p.style.transform = `translate(${dx}px,${dy}px) rotate(${Math.random() * 600}deg)`; p.style.opacity = '0'; });
    }
    setTimeout(() => wrap.remove(), 1000);
  },
  // Anneau de progression (donut) en SVG. opts: {size, stroke, color, label, textColor, fontSize, track}
  donutHTML(pct, opts) {
    opts = opts || {};
    const size = opts.size || 88, sw = opts.stroke || 10, r = (size - sw) / 2, c = 2 * Math.PI * r;
    const p = Math.max(0, Math.min(100, Number(pct) || 0));
    const off = c * (1 - p / 100);
    const col = opts.color || '#16a34a';
    const center = (opts.label != null) ? opts.label : (Math.round(p) + '%');
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="flex:0 0 ${size}px">
      <g transform="rotate(-90 ${size / 2} ${size / 2})">
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${opts.track || '#e2e8f0'}" stroke-width="${sw}"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" style="transition:stroke-dashoffset .8s ease"/>
      </g>
      ${center !== '' ? `<text x="${size / 2}" y="${size / 2}" text-anchor="middle" dominant-baseline="central" style="font-size:${opts.fontSize || 19}px;font-weight:800;fill:${opts.textColor || '#0f1e3d'}">${center}</text>` : ''}
    </svg>`;
  },
  // Mini-courbe (sparkline) en SVG à partir d'une série de valeurs. opts: {width,height,color}
  sparklineHTML(values, opts) {
    opts = opts || {};
    const w = opts.width || 96, h = opts.height || 28;
    const vals = (values || []).map(v => Number(v) || 0);
    if (vals.length < 2) return '';
    const max = Math.max(...vals), min = Math.min(...vals), span = (max - min) || 1;
    const x = (i) => (i / (vals.length - 1) * (w - 4) + 2);
    const y = (v) => (h - 3 - ((v - min) / span) * (h - 6));
    const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const col = opts.color || '#0e7490';
    const lx = x(vals.length - 1).toFixed(1), ly = y(vals[vals.length - 1]).toFixed(1);
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="overflow:visible">
      <polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${lx}" cy="${ly}" r="2.6" fill="${col}"/>
    </svg>`;
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
// ⚠️ Barème OFFICIEL 2026 (source : entreprendre.service-public.gouv.fr/vosdroits/F22203).
// Les montants changent chaque année. Ne s'applique qu'aux véhicules de tourisme (VP).
// Vérifié : un véhicule à 100 g CO2 (WLTP) = 213 € en 2026 ; 150 g = 1 733 €.
FP.TVS_ANNEE = 2026;
// Barème WLTP 2026 : tarif marginal par g/km (cumulatif par tranches)
FP.TVS_CO2_BAREME = [
  { jusqua: 4,        taux: 0 },
  { jusqua: 45,       taux: 1 },
  { jusqua: 53,       taux: 2 },
  { jusqua: 85,       taux: 3 },
  { jusqua: 105,      taux: 4 },
  { jusqua: 125,      taux: 10 },
  { jusqua: 145,      taux: 50 },
  { jusqua: 165,      taux: 60 },
  { jusqua: Infinity, taux: 65 },
];
FP.tvsCo2 = (co2) => {
  let total = 0, prev = 0;
  for (const b of FP.TVS_CO2_BAREME) {
    if (co2 > prev) { total += (Math.min(co2, b.jusqua) - prev) * b.taux; prev = b.jusqua; }
    else break;
  }
  return Math.round(total);
};
// Taxe annuelle sur les émissions de polluants atmosphériques — barème OFFICIEL 2026
// (source : entreprendre.service-public.gouv.fr/vosdroits/F22203) :
//  - Catégorie E : électrique / hydrogène → 0 €
//  - Catégorie 1 : essence, hybride, gaz conformes Euro 5/6 (1re immat ≳ 2011) → 130 €
//  - « Les plus polluants » : tout le reste (TOUS les diesels, essence/hybride antérieurs) → 650 €
// (Passe à 160 € / 800 € en 2027.) `anneeImmat` = année de 1re mise en circulation si connue.
FP.tvsPolluant = (carburant, anneeImmat) => {
  const c = (carburant || '').toLowerCase();
  if (/lectri|hydrog/.test(c)) return 0;                 // Catégorie E
  if (/diesel|gazole|gas-?oil/.test(c)) return 650;      // diesel : jamais Crit'Air 1 → catégorie la + chère
  const y = Number(anneeImmat);
  if (Number.isFinite(y) && y > 0 && y < 2011) return 650; // essence/hybride/gaz d'avant Euro 5
  return 130;                                            // essence/hybride/gaz Euro 5/6 (ou année inconnue → flotte récente)
};
// Détail TVS d'un véhicule : { applicable, raison?, co2, polluant, total, ... }
FP.tvsDetail = (v) => {
  const cat = (v.categorie || '').toLowerCase();
  const carb = v.carburant || '';
  if (/moto/.test(cat)) return { applicable: false, raison: 'Moto — non soumise' };
  if (/utilit|engin/.test(cat)) return { applicable: false, raison: 'Utilitaire — non soumis' };
  const polluant = FP.tvsPolluant(carb, (v.dateMiseEnCirculation || v.dateImmat || '').slice(0, 4));
  if (/lectri|hydrog/i.test(carb)) return { applicable: true, elec: true, co2: 0, polluant: 0, total: 0 };
  const co2 = Number(v.co2);
  // CO₂ inconnu : la taxe "polluants atmosphériques" reste due → on compte au moins le polluant
  // (la part CO₂ reste inconnue, signalée par co2Manquant), au lieu de tout mettre à 0.
  if (!Number.isFinite(co2) || co2 <= 0) return { applicable: true, co2Manquant: true, co2: null, polluant, total: polluant };
  const co2Tax = FP.tvsCo2(co2);
  return { applicable: true, co2: co2Tax, polluant, total: co2Tax + polluant };
};

// ===== Périmètres véhicules — UNE seule définition, réutilisée partout =====
// estVendu = véhicule qui ne t'appartient plus (sorti du parc). Utilisé pour la
// FLOTTE / le parc / la TVS (une voiture "à vendre" est encore possédée → comptée).
FP.estVendu = (v) => { const s = ((v && v.statut) || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); return s === 'vendu' || s === 'vendue'; };
// horsFlotte = plus à suivre au quotidien (vendu, à vendre, hors service, cédé, archivé, restitué).
// Utilisé pour les ALERTES / échéances / CT (on n'alerte pas sur une voiture en cours de vente).
FP.horsFlotte = (v) => ['vendu', 'vendue', 'à vendre', 'a vendre', 'a-vendre', 'cédé', 'cede', 'cédée', 'hors service', 'hors-service', 'hs', 'archive', 'archivé', 'archivée', 'restitué', 'restitue'].includes(((v && v.statut) || '').toString().toLowerCase().trim());

// Masses en ORDRE DE MARCHE (champ G de la carte grise, en kg) — c'est le champ qu'utilise
// la règle de stationnement de Paris (≤ 2 t), PAS le poids à vide G.1. Valeurs LUES DIRECTEMENT
// dans les cartes grises Drive de la flotte. Sert de repli quand la masse n'a pas encore été
// captée par un scan (verdict stationnement Paris / critère « lourd »). Clé = immat.
// Donnée technique (pas de PII) → OK dans le code public. Un scan de carte grise reste
// prioritaire : cette table n'est utilisée QUE si aucune masse n'est saisie (cf. vehMasse).
FP.MASSE_CG = {
  'GC-885-LB': 2395, 'GT-565-XR': 1885, 'GD-056-CR': 2040, 'GE-349-FZ': 2040, 'HG-763-VP': 1825,
  'GR-745-LR': 1012, 'FF-304-GL': 2215, 'FF-777-XK': 2139, 'GP-795-YL': 1505, 'GW-075-EZ': 1505,
  'GW-087-EZ': 1505, 'GW-173-JV': 1505, 'FJ-607-QH': 1505, 'FZ-301-YZ': 1505, 'GY-860-FG': 1815,
  'GP-333-QJ': 1505, 'HH-464-LQ': 2015, 'GT-818-LC': 1710, 'HB-844-DE': 2015, 'HB-733-DE': 2015,
  'GA-313-PK': 2990, 'FR-141-MP': 1760, 'GA-333-PZ': 1639, 'FS-224-PB': 1390, 'FZ-501-YZ': 1416,
  'HH-458-LQ': 2015, 'GR-585-HP': 1358, 'GR-302-HP': 1358, 'HF-477-XW': 1650, 'HJ-804-VM': 2117,
  'GH-994-AR': 1395, 'ET-095-LV': 1621, 'ED-160-TZ': 1758, 'FT-338-AJ': 1395, 'GE-948-WY': 1446,
  'GR-019-ZG': 1358, 'GR-467-HP': 1358, 'HE-739-WP': 1505, 'GP-232-WF': 1505, 'HJ-285-FL': 1625,
  'HJ-181-RN': 1782, 'HG-709-CH': 2015, 'HF-749-VD': 1265, 'HH-613-KE': 2015, 'GM-548-QA': 1395
};
FP.masseCG = (v) => { try { const k = (v && v.immat || '').toString().toUpperCase().trim(); const m = FP.MASSE_CG[k]; return Number.isFinite(m) ? m : null; } catch (e) { return null; } };

// Données lues dans les cartes grises Drive (par immat) pour PRÉ-REMPLIR les champs vides des fiches
// via le bouton « Compléter depuis les cartes grises » (onglet À compléter). Champs NON personnels
// uniquement (co2, puissance fiscale, dates, carburant) — ⚠️ JAMAIS le VIN (RGPD, repo public).
// L'application se fait côté client (session connectée) sur les champs VIDES seulement.
FP.CG_DATA = {
  // rempli au fil des lectures de cartes grises — { 'AA-123-BC': { co2, puissanceFiscale, dateMiseEnCirculation, prochainCT, carburant } }
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

// === Rôle & droits utilisateur ===
// 3 niveaux d'accès + le portail salarié :
//   • 'ceo'          → super-admin (toi) : TOUTES les sociétés, tous les droits, gère les comptes.
//   • 'admin'        → client (resp. flotte) : SA société uniquement, tous les droits + config + comptes de sa société.
//   • 'gestionnaire' → SA société : ajoute/modifie/supprime les données, mais PAS la config société ni les comptes.
//   • 'chauffeur'    → portail salarié (espace-salarie.html) — inchangé.
// ⚠️ SÉCURITÉ : le rôle et la société qui FONT AUTORITÉ vivent dans la table `profiles`
// (protégée par RLS — l'utilisateur ne peut PAS les modifier lui-même). Ce qui suit n'est
// que l'affichage : le vrai verrou est côté base. Le rôle 'chauffeur' reste, lui, dans les
// métadonnées du token (portail salarié, mécanisme existant).
FP.SUPA_TOKEN_KEY = 'sb-tzjuptlzoywjeigmyfuj-auth-token';
// Profil (société + is_admin + role) lu du cache, rafraîchi par supabase-client.js après login.
FP.profile = (() => { try { return JSON.parse(localStorage.getItem('fp_profile') || 'null'); } catch (e) { return null; } })();
FP.role = () => {
  try {
    const t = JSON.parse(localStorage.getItem(FP.SUPA_TOKEN_KEY) || 'null');
    const um = (t && t.user && t.user.user_metadata && t.user.user_metadata.role) || null;
    if (um === 'chauffeur' || um === 'salarie') return 'chauffeur';   // portail salarié (métadonnées)
    const p = FP.profile;                                            // source de vérité des droits (RLS)
    if (p) {
      if (p.is_admin === true) return 'ceo';
      if (p.role === 'gestionnaire') return 'gestionnaire';
      return 'admin';                                                // client (role 'admin' ou non défini)
    }
    if (um === 'gestionnaire') return 'gestionnaire';                // repli hors-ligne / très ancien compte
    return 'admin';
  } catch { return 'admin'; }
};
FP.isCEO = () => FP.role() === 'ceo';
FP.isGestionnaire = () => FP.role() === 'gestionnaire';
FP.isChauffeur = () => FP.role() === 'chauffeur';
// « Admin » au sens large = peut TOUT faire dans sa société (CEO ou Admin client), hors gestionnaire/salarié.
FP.isAdmin = () => { const r = FP.role(); return r === 'ceo' || r === 'admin'; };
// Plaque(s) du salarié — lues dans ses métadonnées Supabase { immat: 'XX-123-XX' } ou
// { immats: ['A','B'] } (ou liste séparée par , / ;). Sert au filtrage AFFICHÉ du portail.
FP.chauffeurImmats = () => {
  try {
    const t = JSON.parse(localStorage.getItem(FP.SUPA_TOKEN_KEY) || 'null');
    const m = (t && t.user && t.user.user_metadata) || {};
    let list = m.immats != null ? m.immats : (m.immat || '');
    if (Array.isArray(list)) return list.map(x => String(x).trim()).filter(Boolean);
    return String(list).split(/[;,]/).map(x => x.trim()).filter(Boolean);
  } catch (e) { return []; }
};
// Redirection automatique du salarié vers SON espace (dormant pour admin/gestionnaire →
// ne s'active QUE si un compte de rôle 'chauffeur' existe, donc aucun impact sur l'existant).
(function chauffeurGuard() {
  try {
    if (!FP.isChauffeur()) return;
    if (/espace-salarie\.html/.test(location.pathname)) return;
    const base = location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';
    location.replace(base + 'espace-salarie.html');
  } catch (e) {}
})();
// Voit/gère TOUTES les sociétés (sélecteur de société) → réservé au CEO (is_admin=true).
// Repli si le profil n'est pas encore chargé : comportement admin actuel (sauf gestionnaire/salarié).
FP.isSuperAdmin = () => { const p = FP.profile; if (p) return p.is_admin === true; return FP.role() !== 'gestionnaire' && FP.role() !== 'chauffeur'; };
// Peut modifier la CONFIG de la société (Paramètres, contrats, e-mails) → CEO ou Admin client.
FP.canManageSociete = () => FP.isAdmin();
// Peut gérer les COMPTES/accès (créer, changer de rôle, supprimer) → CEO (tout) ou Admin (sa société).
// La portée réelle (une seule société pour l'Admin) est appliquée CÔTÉ SERVEUR par la fonction manage-users.
FP.canManageUsers = () => FP.isAdmin();
FP.roleLabel = () => ({ ceo: 'CEO', admin: 'Admin', gestionnaire: 'Gestionnaire', chauffeur: 'Salarié' }[FP.role()] || 'Admin');
FP.ROLE_LABELS = { ceo: 'CEO', admin: 'Admin', gestionnaire: 'Gestionnaire' };
// Personnalisation de l'apparence (renommer titres/colonnes/onglets) : autorisée admin + gestionnaire.
FP.canPersonnaliser = () => true;
// Onglets réservés (retirés du menu pour les autres rôles). Paramètres reste visible par TOUS
// (le gestionnaire y accède pour ses réglages de base — couleur, mot de passe, notifications,
// groupes) ; à l'intérieur, les sections sensibles (société, données, comptes) sont filtrées.
FP.ADMIN_ONLY_NAV = [];
// Onglets réservés au CEO uniquement (supports de vente Parc Pilot) — cachés aux Admin & Gestionnaires.
FP.CEO_ONLY_NAV = ['brochure.html', 'prix.html'];

// === Sélecteur CHERCHABLE (RÈGLE PROJET) =====================================
// Tout choix de véhicule / conducteur / plaque DOIT être filtrable au clavier (taper pour
// retrouver par plaque, nom, modèle…). FP.searchSelect(<select>) transforme un menu déroulant
// en champ de recherche + liste déroulante, au style du site, SANS changer le reste du code :
// la valeur choisie reste lisible via le <select> d'origine (.value) et l'événement 'change'.
// Le menu est rendu en position:fixed (attaché au body) → jamais rogné par une modale.
FP.searchSelect = function (select, opts) {
  try {
    if (!select || select.dataset.ssDone === '1') return;
    select.dataset.ssDone = '1';
    opts = opts || {};
    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    select.style.display = 'none';
    select.setAttribute('tabindex', '-1');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = select.className || 'field-input';
    input.autocomplete = 'off';
    input.setAttribute('role', 'combobox');
    input.placeholder = opts.placeholder || 'Rechercher…';
    wrap.appendChild(input);
    const menu = document.createElement('div');
    menu.style.cssText = 'position:fixed;z-index:9999;background:#fff;border:1px solid var(--fp-border,#E3E8F0);border-radius:.55rem;box-shadow:0 16px 40px -12px rgba(15,30,61,.3);max-height:260px;overflow:auto;display:none';
    document.body.appendChild(menu);
    const norm = s => (window.FP && FP.norm) ? FP.norm(s) : String(s || '').toLowerCase();
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const optionList = () => Array.from(select.options).map(o => ({ value: o.value, label: o.textContent }));
    const labelFor = v => { const o = Array.from(select.options).find(o => o.value === v); return o ? o.textContent : ''; };
    const sync = () => { input.value = labelFor(select.value); };
    const place = () => { const r = input.getBoundingClientRect(); menu.style.left = r.left + 'px'; menu.style.top = (r.bottom + 3) + 'px'; menu.style.width = r.width + 'px'; };
    let active = -1;
    function open(q) {
      const nq = norm(q); const all = optionList(); const none = all.find(o => o.value === '');
      const items = all.filter(o => o.value !== '' && (!nq || norm(o.label).includes(nq)));
      let html = '';
      if (none) html += `<div class="fp-ss-it" data-v="" style="padding:.5rem .7rem;cursor:pointer;color:var(--fp-muted,#5A6577)">${esc(none.label)}</div>`;
      html += items.map(o => `<div class="fp-ss-it" data-v="${esc(o.value)}" style="padding:.5rem .7rem;cursor:pointer">${esc(o.label)}</div>`).join('');
      menu.innerHTML = html || `<div style="padding:.5rem .7rem;color:var(--fp-muted,#5A6577)">Aucun résultat</div>`;
      place(); menu.style.display = 'block'; active = -1;
    }
    const close = () => { menu.style.display = 'none'; };
    const choose = v => { select.value = v; select.dispatchEvent(new Event('input', { bubbles: true })); select.dispatchEvent(new Event('change', { bubbles: true })); sync(); close(); };
    input.addEventListener('focus', () => { input.select(); open(''); });
    input.addEventListener('input', () => open(input.value));
    input.addEventListener('keydown', e => {
      if (menu.style.display === 'none') { if (e.key === 'ArrowDown') open(input.value); return; }
      const its = Array.from(menu.querySelectorAll('.fp-ss-it'));
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, its.length - 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); }
      else if (e.key === 'Enter') { if (menu.style.display !== 'none') { e.preventDefault(); if (its[active]) choose(its[active].getAttribute('data-v')); } return; }
      else if (e.key === 'Escape') { close(); return; }
      else return;
      its.forEach((el, i) => el.style.background = (i === active) ? 'var(--fp-bg,#EEF1F6)' : '');
      if (its[active]) its[active].scrollIntoView({ block: 'nearest' });
    });
    menu.addEventListener('mousedown', e => { const it = e.target.closest('.fp-ss-it'); if (!it) return; e.preventDefault(); choose(it.getAttribute('data-v')); });
    input.addEventListener('blur', () => setTimeout(() => { close(); sync(); }, 130));
    window.addEventListener('scroll', () => { if (menu.style.display !== 'none') place(); }, true);
    window.addEventListener('resize', () => { if (menu.style.display !== 'none') place(); });
    // Resync l'affichage quand le <select> est repeuplé (options) OU quand sa valeur est
    // changée par le code (émettre un 'change' après un `select.value = …` programmatique).
    try { new MutationObserver(sync).observe(select, { childList: true }); } catch (e) {}
    select.addEventListener('change', sync);
    sync();
  } catch (e) { /* en cas de souci, on garde le <select> natif */ }
};

// === Conducteurs — accès GLOBAL (liste / recherche / création depuis N'IMPORTE QUELLE page) ===
// RÈGLE PROJET : partout où on désigne un conducteur, on doit pouvoir le CHOISIR dans la liste
// existante OU en CRÉER un nouveau en tapant son nom (la plateforme demande alors ses infos).
FP.conducteurs = {
  list() { try { return (window.FP_DATA && Array.isArray(FP_DATA.conducteurs)) ? FP_DATA.conducteurs.filter(c => c && !c.masque) : []; } catch (e) { return []; } },
  displayName(c) {
    if (!c) return '';
    const base = String(c.name || c.prenom || c.key || '').trim();
    return (c.nom && !base.toLowerCase().includes(String(c.nom).toLowerCase())) ? (base + ' ' + c.nom).trim() : base;
  },
  find(name) {
    const k = FP.normPrenom(name || ''); if (!k) return null;
    return this.list().find(c => FP.normPrenom(c.name || c.prenom || c.key) === k) || null;
  },
  async create(info) {
    info = info || {};
    const name = String(info.name || ((info.prenom || '') + ' ' + (info.nom || ''))).trim() || String(info.prenom || '').trim();
    if (!name) return null;
    const key = FP.normPrenom(name);
    const row = { key, name, prenom: info.prenom || null, nom: info.nom || null, tel: info.tel || null, email: info.email || null,
      poste: info.poste || null, permisNumero: info.permisNumero || null, permisType: info.permisType || null, manuel: true };
    try { if (FP.persist && FP.persist.upsert) await FP.persist.upsert('conducteurs', row); } catch (e) { console.warn('[FP.conducteurs.create]', e); }
    try { window.FP_DATA = window.FP_DATA || {}; FP_DATA.conducteurs = FP_DATA.conducteurs || [];
      const ex = FP_DATA.conducteurs.find(c => c.key === key); if (ex) Object.assign(ex, row); else FP_DATA.conducteurs.push(row); } catch (e) {}
    return row;
  }
};

// Modale « Nouveau conducteur » réutilisable → Promise<conductor|null>. Collecte les infos
// essentielles puis crée le conducteur (FP.conducteurs.create). Injectée une fois dans le body.
FP.newConducteurModal = function (prefillName) {
  return new Promise(resolve => {
    let ov = document.getElementById('fp-newcond-ov');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'fp-newcond-ov';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,30,61,.5);display:none;align-items:center;justify-content:center;z-index:10001;padding:1rem';
      ov.innerHTML = '<div style="background:#fff;border-radius:1rem;max-width:470px;width:100%;max-height:90vh;overflow:auto;padding:1.5rem">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem"><h2 style="font-size:1.2rem;font-weight:800;color:var(--fp-primary)">Nouveau conducteur</h2>'
        + '<button type="button" id="fp-nc-x" style="border:none;background:none;cursor:pointer;font-size:1.3rem;color:var(--fp-muted);line-height:1">✕</button></div>'
        + '<p style="font-size:.8rem;color:var(--fp-muted);margin-bottom:1rem">Ce nom n\'existe pas encore — renseigne ses infos pour l\'enregistrer.</p>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.7rem">'
        + '<div><div class="field-label">Prénom</div><input class="field-input" id="fp-nc-prenom"></div>'
        + '<div><div class="field-label">Nom</div><input class="field-input" id="fp-nc-nom"></div>'
        + '<div><div class="field-label">Téléphone</div><input class="field-input" id="fp-nc-tel"></div>'
        + '<div><div class="field-label">Email</div><input class="field-input" id="fp-nc-email" type="email"></div>'
        + '<div style="grid-column:1/3"><div class="field-label">N° de permis</div><input class="field-input" id="fp-nc-permis"></div>'
        + '</div>'
        + '<div style="display:flex;gap:.5rem;margin-top:1.1rem"><button type="button" class="btn btn-outline" id="fp-nc-cancel" style="flex:1;justify-content:center">Annuler</button>'
        + '<button type="button" class="btn btn-dark" id="fp-nc-save" style="flex:1;justify-content:center">Enregistrer</button></div></div>';
      document.body.appendChild(ov);
    }
    const g = id => document.getElementById(id);
    const parts = String(prefillName || '').trim().split(/\s+/).filter(Boolean);
    g('fp-nc-prenom').value = parts.shift() || '';
    g('fp-nc-nom').value = parts.join(' ');
    g('fp-nc-tel').value = ''; g('fp-nc-email').value = ''; g('fp-nc-permis').value = '';
    ov.style.display = 'flex';
    setTimeout(() => g('fp-nc-prenom').focus(), 50);
    const done = (r) => { ov.style.display = 'none'; g('fp-nc-save').onclick = g('fp-nc-cancel').onclick = g('fp-nc-x').onclick = null; resolve(r); };
    g('fp-nc-cancel').onclick = () => done(null);
    g('fp-nc-x').onclick = () => done(null);
    g('fp-nc-save').onclick = () => {
      const info = { prenom: g('fp-nc-prenom').value.trim(), nom: g('fp-nc-nom').value.trim(), tel: g('fp-nc-tel').value.trim(), email: g('fp-nc-email').value.trim(), permisNumero: g('fp-nc-permis').value.trim() };
      if (!info.prenom && !info.nom) { alert('Indique au moins un prénom ou un nom.'); return; }
      // Anti-doublon : si un conducteur du même nom existe déjà, on le réutilise.
      const exist = FP.conducteurs.find((info.prenom + ' ' + info.nom).trim() || info.prenom);
      if (exist) { done(exist); return; }
      FP.conducteurs.create(info).then(c => done(c));
    };
  });
};

// Combobox CONDUCTEUR sur un <input> texte : tape pour filtrer les conducteurs existants,
// ou choisis « ➕ Créer “X” » pour en enregistrer un nouveau (ouvre la modale d'infos).
// opts : { onPick(conducteur, {isNew}) }. La valeur affichée dans l'input = le nom.
FP.conducteurPicker = function (input, opts) {
  try {
    if (!input || input.dataset.cpDone === '1') return;
    input.dataset.cpDone = '1';
    opts = opts || {};
    input.autocomplete = 'off';
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const norm = s => (FP.norm ? FP.norm(s) : String(s || '').toLowerCase());
    const menu = document.createElement('div');
    menu.style.cssText = 'position:fixed;z-index:10000;background:#fff;border:1px solid var(--fp-border,#E3E8F0);border-radius:.55rem;box-shadow:0 16px 40px -12px rgba(15,30,61,.3);max-height:260px;overflow:auto;display:none';
    document.body.appendChild(menu);
    const place = () => { const r = input.getBoundingClientRect(); menu.style.left = r.left + 'px'; menu.style.top = (r.bottom + 3) + 'px'; menu.style.width = r.width + 'px'; };
    const close = () => { menu.style.display = 'none'; };
    function pick(cond, isNew) { input.value = FP.conducteurs.displayName(cond); close(); if (opts.onPick) opts.onPick(cond, { isNew: !!isNew }); }
    async function createFrom(name) {
      const c = await FP.newConducteurModal(name);
      if (c) pick(c, true); else input.focus();
    }
    function open(q) {
      const nq = norm(q);
      const list = FP.conducteurs.list().filter(c => !nq || norm(FP.conducteurs.displayName(c)).includes(nq)).slice(0, 40);
      const exact = FP.conducteurs.find(q);
      let html = list.map(c => `<div class="fp-cp-it" data-k="${esc(c.key)}" style="padding:.5rem .7rem;cursor:pointer">${esc(FP.conducteurs.displayName(c))}</div>`).join('');
      if (q && q.trim() && !exact) {
        html = `<div class="fp-cp-new" style="padding:.55rem .7rem;cursor:pointer;font-weight:700;color:var(--fp-accent,#F97316);border-bottom:1px solid var(--fp-border,#E3E8F0)">➕ Créer « ${esc(q.trim())} »</div>` + html;
      }
      menu.innerHTML = html || '<div style="padding:.5rem .7rem;color:var(--fp-muted,#5A6577)">Tape un nom pour créer un conducteur</div>';
      place(); menu.style.display = 'block';
    }
    input.addEventListener('focus', () => open(input.value));
    input.addEventListener('input', () => open(input.value));
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        // Entrée sur un nom qui n'existe pas → proposer la création.
        const v = input.value.trim(); if (!v) return;
        if (!FP.conducteurs.find(v)) { e.preventDefault(); close(); createFrom(v); }
      } else if (e.key === 'Escape') { close(); }
    });
    menu.addEventListener('mousedown', e => {
      const nw = e.target.closest('.fp-cp-new'); if (nw) { e.preventDefault(); const v = input.value.trim(); close(); createFrom(v); return; }
      const it = e.target.closest('.fp-cp-it'); if (!it) return; e.preventDefault();
      const c = FP.conducteurs.list().find(x => x.key === it.getAttribute('data-k')); if (c) pick(c, false);
    });
    input.addEventListener('blur', () => setTimeout(close, 150));
    window.addEventListener('scroll', () => { if (menu.style.display !== 'none') place(); }, true);
    window.addEventListener('resize', () => { if (menu.style.display !== 'none') place(); });
  } catch (e) { /* en cas de souci, l'input reste un champ texte normal */ }
};

// === Multi-sociétés (vue admin) ===
FP.activeSociete = () => { try { return localStorage.getItem('fp_societe') || 'PXP'; } catch (e) { return 'PXP'; } };
FP.setActiveSociete = (s) => { try { localStorage.setItem('fp_societe', s || 'PXP'); } catch (e) {} };
// Liste des sociétés = métadonnée GLOBALE de l'admin (pas par société, sinon elle se
// réinitialiserait en changeant de société). Stockée à part ; repli sur l'ancienne liste des réglages.
FP.SOCIETES_KEY = 'fp_societes_list';
FP.getSocietes = () => {
  let arr = null;
  try { arr = JSON.parse(localStorage.getItem(FP.SOCIETES_KEY) || 'null'); } catch (e) {}
  if (!Array.isArray(arr) || !arr.length) { try { arr = (FP.settings.get().societes || []).slice(); } catch (e) { arr = []; } }
  if (!Array.isArray(arr)) arr = [];
  if (!arr.includes('PXP')) arr.unshift('PXP');
  return arr;
};
FP.addSociete = (name) => {
  name = (name || '').trim(); if (!name) return false;
  const arr = FP.getSocietes();
  if (arr.some(x => x.toLowerCase() === name.toLowerCase())) return false;
  arr.push(name);
  try { localStorage.setItem(FP.SOCIETES_KEY, JSON.stringify(arr)); } catch (e) {}
  return true;
};
// Modèles d'e-mail par défaut (amende) — source UNIQUE, réutilisée par amendes.html ET
// pré-affichée dans Paramètres pour que l'utilisateur les voie et puisse les personnaliser.
FP.MAIL_DEFAUT = {
  paiement: `Bonjour {prenom}\n\nSauf erreur de ma part, il s'agit de ton véhicule.\nPeux-tu régler cette contravention et m'envoyer le justificatif s'il te plaît ?\n\nMerci d'avance`,
  designation: `Bonjour {prenom},\n\nSauf erreur de ma part, il s'agit de ton véhicule.\nPeux-tu me confirmer afin que je puisse effectuer la désignation ?\n\nMerci de ne pas régler la contravention.\n\nCordialement.`,
};
// Champs du profil société (rendu générique : le formulaire de Paramètres itère dessus).
// Un champ avec `default` est PRÉ-REMPLI avec ce texte quand la valeur est vide (l'utilisateur le voit).
FP.PROFIL_CHAMPS = [
  { key: 'mailExpediteur',     label: "E-mail d'envoi des amendes",       type: 'email', ph: 'ex. contact@masociete.fr' },
  { key: 'mailCopie',          label: 'E-mails en copie (séparés par ,)', type: 'text',  ph: 'ex. compta@masociete.fr, direction@masociete.fr' },
  { key: 'mailDomaineEnvoi',   label: "Domaine d'envoi vérifié (Resend)", type: 'text',  ph: 'ex. resend.masociete.fr — le domaine validé dans Resend (le mail part de <ton adresse>@ce-domaine, réponse vers l’e-mail ci-dessus)' },
  { key: 'loueurNom',          label: 'Nom du loueur (leasing)',          type: 'text',  ph: 'ex. Arval, Ayvens, BPCE Car Lease… (doit correspondre au « propriétaire » des véhicules en leasing)' },
  { key: 'mailModelePaiement',   label: "Modèle e-mail — demande de paiement",     type: 'textarea', ph: 'Écris {prenom} pour insérer le prénom.', default: FP.MAIL_DEFAUT.paiement },
  { key: 'mailModeleDesignation',label: "Modèle e-mail — demande de désignation",  type: 'textarea', ph: 'Écris {prenom}.', default: FP.MAIL_DEFAUT.designation },
];
// Contrat d'assurance de la société ACTIVE (assureur + n° de police), paramétrable dans Contrats.
// Défaut PXP = SWISSLIFE (valeur historique) ; une nouvelle société démarre vide.
FP.assuranceContrat = () => {
  let c = {}; try { c = (FP.settings.get().assuranceContrat) || {}; } catch (e) {}
  const soc = (FP.activeSociete && FP.activeSociete()) || 'PXP';
  const base = (soc === 'PXP') ? { assureur: 'SWISSLIFE', police: '011165247/0599' } : { assureur: '', police: '' };
  return {
    assureur: (String(c.assureur || '').trim()) || base.assureur,
    police: (String(c.police || '').trim()) || base.police,
  };
};
// Libellé « ASSUREUR (police) » réutilisable (titre section, fiche véhicule…). Vide si non configuré.
FP.assuranceLabel = () => { const c = FP.assuranceContrat(); return c.assureur ? (c.assureur + (c.police ? ' (' + c.police + ')' : '')) : ''; };

// Profil de la société ACTIVE : valeurs saisies (settings.profil) par-dessus des valeurs par défaut.
// ⚠️ PXP conserve ses valeurs historiques (rien ne change) ; une NOUVELLE société démarre vide → l'app propose de les remplir.
FP.societeProfil = () => {
  let p = {}; try { p = FP.settings.get().profil || {}; } catch (e) {}
  const soc = (FP.activeSociete && FP.activeSociete()) || 'PXP';
  const base = (soc === 'PXP')
    ? { mailExpediteur: 'shakil.nubeebaccus@projectxparis.fr',
        mailCopie: 'shakil.nubeebaccus@projectxparis.fr,mallaury.herembert@projectxparis.fr',
        mailDomaineEnvoi: 'resend.projectxparis.fr',
        loueurNom: 'BPCE Car Lease', proprietaireLeasing: 'BPCE' }
    : { mailExpediteur: '', mailCopie: '', mailDomaineEnvoi: '', loueurNom: '', proprietaireLeasing: '' };
  // Seules les valeurs NON vides saisies écrasent la base (une base PXP ne se vide pas par accident).
  const over = Object.fromEntries(Object.entries(p).filter(([, v]) => v != null && String(v).trim() !== ''));
  return { ...base, ...over };
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

// === Navigation rapide : PRÉCHARGEMENT (prefetch) du HTML des onglets (Speculation Rules) ===
// On précharge le HTML des liens de la barre latérale → le clic charge la page sans aller
// rechercher le HTML sur le réseau. Combiné à la View-Transition (qui garde l'ancienne page
// affichée jusqu'à ce que la nouvelle soit prête, échange instantané, cf. styles.css), la
// navigation est fluide et SANS flash blanc. Feature-detecté → aucun effet si non supporté.
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
        // PREFETCH (et non prerender) : on précharge seulement le HTML des onglets → fiable,
        // sans effet de bord (le prerender rendait la page en arrière-plan et s'activait parfois
        // à moitié prête → flash aléatoire). La View-Transition garde l'ancienne page visible
        // jusqu'à ce que la nouvelle soit peinte → pas de trou blanc. 'eager' = préchargement
        // immédiat (le HTML est léger), donc le chargement réel au clic est quasi instantané.
        s.textContent = JSON.stringify({ prefetch: [{ source: 'list', urls: urls, eagerness: 'eager' }] });
        document.body.appendChild(s);
      } catch (e) {}
    };
    if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
  } catch (e) {}
})();

// === PWA : appli installable (« Ajouter à l'écran d'accueil ») + fonctionnement hors-ligne ===
// Injecte le manifest + les balises iOS et enregistre le service worker (fichiers à la RACINE
// du site : manifest.json et sw.js). Le chemin de base s'adapte selon qu'on est dans /pages/.
(function pwaSetup() {
  try {
    const base = location.pathname.indexOf('/pages/') !== -1 ? '../' : './';
    const head = document.head;
    const linkOnce = (rel, href, extra) => {
      if (head.querySelector('link[rel="' + rel + '"]')) return;
      const l = document.createElement('link'); l.rel = rel; l.href = href;
      if (extra) Object.assign(l, extra); head.appendChild(l);
    };
    linkOnce('manifest', base + 'manifest.json');
    linkOnce('apple-touch-icon', base + 'assets/icons/apple-touch-icon.png');
    const metaOnce = (name, content, useNameAttr) => {
      const sel = (useNameAttr ? 'meta[name="' : 'meta[name="') + name + '"]';
      if (head.querySelector(sel)) return;
      const m = document.createElement('meta'); m.setAttribute('name', name); m.content = content; head.appendChild(m);
    };
    metaOnce('theme-color', '#0F1E3D');
    metaOnce('apple-mobile-web-app-capable', 'yes');
    metaOnce('apple-mobile-web-app-status-bar-style', 'black-translucent');
    metaOnce('apple-mobile-web-app-title', 'Parc Pilot');
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      addEventListener('load', () => { navigator.serviceWorker.register(base + 'sw.js').catch(() => {}); });
      // Rechargement AUTO quand une nouvelle version prend le contrôle → fini le cache périmé
      // (une seule fois, pour éviter toute boucle de rechargement).
      let _swReloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (_swReloaded) return; _swReloaded = true; location.reload();
      });
    }
  } catch (e) {}
})();

// === Navigation MOBILE : barre + menu latéral repliable (hamburger) ===
// Injecté sur toutes les pages qui ont une sidebar. N'apparaît qu'en < 769px (CSS).
(function mobileNav() {
  const build = () => {
    try {
      const sb = document.querySelector('.fp-sidebar');
      if (!sb || document.querySelector('.fp-mobile-bar')) return;
      const bar = document.createElement('div');
      bar.className = 'fp-mobile-bar';
      bar.innerHTML = '<button type="button" class="fp-burger" aria-label="Ouvrir le menu"><i data-lucide="menu"></i></button><span style="font-weight:900;font-style:italic;font-size:1.05rem">Parc<span style="color:var(--fp-accent)">Pilot</span></span>';
      document.body.insertBefore(bar, document.body.firstChild);
      const bd = document.createElement('div');
      bd.className = 'fp-sidebar-backdrop';
      document.body.appendChild(bd);
      const open = () => { sb.classList.add('fp-open'); bd.classList.add('fp-open'); };
      const close = () => { sb.classList.remove('fp-open'); bd.classList.remove('fp-open'); };
      bar.querySelector('.fp-burger').addEventListener('click', open);
      bd.addEventListener('click', close);
      // clic sur un lien du menu ou en dehors → on referme
      sb.addEventListener('click', (e) => { if (e.target.closest('a[href]')) close(); });
      addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
      if (window.lucide && lucide.createIcons) { try { lucide.createIcons(); } catch (e) {} }
    } catch (e) {}
  };
  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
})();

// === Paramètres utilisateur persistés (localStorage) ===
FP.settings = {
  STORAGE_KEY: 'auto_flotte_settings',
  // Réglages (apparence : groupes, libellés, couleurs…) PROPRES À CHAQUE SOCIÉTÉ.
  // Clé localStorage et ligne app_settings suffixées par la société. Repli sur l'ancienne
  // clé/ligne ('global') pour PXP → la config actuelle n'est pas perdue.
  _soc() { try { const s = (window.FP && FP.activeSociete) ? FP.activeSociete() : (localStorage.getItem('fp_societe') || 'PXP'); return (s === '__all__') ? 'PXP' : s; } catch (e) { return 'PXP'; } },
  _key() { return this.STORAGE_KEY + '_' + this._soc(); },
  _dbId() { return this._soc(); },
  _readLocal() {
    try {
      let raw = localStorage.getItem(this._key());
      if (raw == null && this._soc() === 'PXP') raw = localStorage.getItem(this.STORAGE_KEY); // repli legacy
      return raw || '{}';
    } catch (e) { return '{}'; }
  },
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
    societe: { nom: 'Parc Pilot', siret: '', adresse: '' },
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
    vehDin: {}, // puissance DIN (ch) par véhicule { vehId: nombre } — pas de colonne DB dédiée
    sinistreStatut: {}, // suivi remboursement sinistre { factureId: 'attente'|'rembourse'|'refuse' }
    permisMasque: {}, // permis intégré (FP_DOCS) masqué par l'utilisateur { conducteurKey: true }
    condDocs: {}, // documents perso d'un conducteur { conducteurKey: [ {id,type,label,url,date,createdAt} ] }
    // Profil PROPRE À CHAQUE SOCIÉTÉ (rempli à la création d'une société) : e-mails d'envoi des amendes,
    // nom du loueur leasing, etc. Vide par défaut ; PXP a des valeurs historiques (voir FP.societeProfil).
    profil: {},
  },
  get() {
    try {
      const stored = JSON.parse(this._readLocal()) || {};
      const merged = {
        // ⚠️ On REPART de tout ce qui est stocké : ainsi TOUTE nouvelle clé de réglage est
        // conservée automatiquement, même si elle n'est pas listée ci-dessous. (Sans ce spread,
        // une clé non listée serait silencieusement effacée à chaque lecture — bug déjà rencontré.)
        ...stored,
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
        vehDin: (stored.vehDin && typeof stored.vehDin === 'object') ? stored.vehDin : {},
        sinistreStatut: (stored.sinistreStatut && typeof stored.sinistreStatut === 'object') ? stored.sinistreStatut : {},
        sinistreGroupes: (stored.sinistreGroupes && typeof stored.sinistreGroupes === 'object') ? stored.sinistreGroupes : {},
        sinistreStage: (stored.sinistreStage && typeof stored.sinistreStage === 'object') ? stored.sinistreStage : {},
        alertesMasquees: Array.isArray(stored.alertesMasquees) ? stored.alertesMasquees : [],
        alertesMasqueesInfo: (stored.alertesMasqueesInfo && typeof stored.alertesMasqueesInfo === 'object') ? stored.alertesMasqueesInfo : {},
        permisMasque: (stored.permisMasque && typeof stored.permisMasque === 'object') ? stored.permisMasque : {},
        condDocs: (stored.condDocs && typeof stored.condDocs === 'object') ? stored.condDocs : {},
        profil: (stored.profil && typeof stored.profil === 'object') ? stored.profil : {},
      };
      // Isolation multi-sociétés : les libellés de groupes de PXP (Siège, Gov, International,
      // Retail…) ne doivent PAS « fuiter » vers une autre société. Hors PXP, on part de libellés
      // NEUTRES ; chaque client met ensuite les siens (qui écrasent, via le merge stored ci-dessous).
      // Même principe que FP.societeProfil / FP.assuranceContrat (PXP = historique ; autres = vierge).
      try {
        const soc = (FP.activeSociete ? FP.activeSociete() : 'PXP');
        if (soc !== 'PXP' && soc !== '__all__') {
          const NEUTRE = { siege: 'Groupe 1', commerciaux: 'Groupe 2', gov: 'Groupe 3', pool: 'Groupe 4', retail: 'Groupe 5', depot: 'Groupe 6', 'a-vendre': 'À vendre', 'non-classe': 'Non classé' };
          Object.keys(merged.groupes).forEach(k => { if (NEUTRE[k]) merged.groupes[k] = { ...merged.groupes[k], label: NEUTRE[k] }; });
          // Nom de société : vierge (le client saisit le sien) au lieu du « Parc Pilot » par défaut.
          if (!(stored.societe && String(stored.societe.nom || '').trim())) merged.societe = { ...merged.societe, nom: '' };
        }
      } catch (e) {}
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
    localStorage.setItem(this._key(), JSON.stringify(obj));
    this.applyTheme();
    // Partage les réglages PAR SOCIÉTÉ sur tous les postes via Supabase (ligne app_settings = la
    // société). Passe par la file de sécurité : renvoyé auto si la base est momentanément injoignable.
    try {
      const id = this._dbId();
      if (FP.persist && FP.persist.upsert) FP.persist.upsert('app_settings', { id, data: obj });
      else if (FP.db && FP.supabase) FP.db.upsert('app_settings', { id, data: obj });
    } catch (e) {}
  },
  reset() {
    localStorage.removeItem(this._key());
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
    // Mode sombre 🌙 — préférence LOCALE (par poste/utilisateur), pas synchronisée
    if (document.body) { try { document.body.classList.toggle('fp-dark', localStorage.getItem('fp_dark_mode') === '1'); } catch (e) {} }
  },
};

// Mode sombre = choix propre à CHAQUE utilisateur/poste (stocké en local, jamais partagé).
FP.darkMode = {
  get() { try { return localStorage.getItem('fp_dark_mode') === '1'; } catch (e) { return false; } },
  set(v) { try { localStorage.setItem('fp_dark_mode', v ? '1' : '0'); } catch (e) {} if (FP.settings && FP.settings.applyTheme) FP.settings.applyTheme(); },
  toggle() { this.set(!this.get()); return this.get(); },
};

// « Ignorer » réutilisable (toute la plateforme) : masque une info manquante / une alerte
// pour qu'elle ne compte plus (ex. conformité, CO₂ à compléter…). Clé libre (ex. 'conf:ct:<id>').
// Mémorisé PAR SOCIÉTÉ dans les réglages (settings.ignores) ; get() conserve la clé automatiquement.
FP.ignore = {
  _all() { try { return FP.settings.get().ignores || {}; } catch (e) { return {}; } },
  has(key) { return !!this._all()[key]; },
  set(key, on) { try { const s = FP.settings.get(); s.ignores = s.ignores || {}; if (on) s.ignores[key] = true; else delete s.ignores[key]; FP.settings.save(s); } catch (e) {} },
  toggle(key) { this.set(key, !this.has(key)); return this.has(key); },
  clearPrefix(prefix) { try { const s = FP.settings.get(); s.ignores = s.ignores || {}; Object.keys(s.ignores).forEach(k => { if (k.indexOf(prefix) === 0) delete s.ignores[k]; }); FP.settings.save(s); } catch (e) {} },
  countPrefix(prefix) { return Object.keys(this._all()).filter(k => k.indexOf(prefix) === 0).length; },
};
// Un véhicule dont le CT (resp. l'assurance) a été marqué « ignoré » dans la conformité
// (ex. véhicule étranger sans contrôle technique français) NE doit plus générer d'alerte
// ni fausser les calculs. Clé partagée avec la page Statistiques ('conf:ct:<id>' / 'conf:assur:<id>').
FP.ctIgnored    = (v) => !!(v && FP.ignore && FP.ignore.has('conf:ct:' + v.id));
FP.assurIgnored = (v) => !!(v && FP.ignore && FP.ignore.has('conf:assur:' + v.id));

// Sécurité : empêche « Retour arrière » de faire « page précédente » (et de perdre une saisie)
// quand le focus n'est pas dans un champ éditable.
// Normalisation pour la recherche : minuscules + SANS accents (taper « jeremy » trouve « Jérémy »).
FP.norm = (s) => (s == null ? '' : s.toString()).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

(function guardBackspace() {
  // Empêche la touche « Retour arrière » de déclencher « page précédente » du navigateur
  // (sinon : on efface du texte, le curseur sort du champ, un Backspace de plus = la page
  // se ferme/recule et on perd tout). On autorise Backspace UNIQUEMENT si un vrai champ
  // de saisie est actif. Phase capture + champ actif + repli keyCode = couverture maximale.
  function editable(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = (el.tagName || '').toUpperCase();
    if (tag === 'TEXTAREA') return true;
    if (tag === 'INPUT') {
      if (el.readOnly || el.disabled) return false;
      return !/^(button|submit|reset|checkbox|radio|file|range|color|image)$/i.test(el.type || 'text');
    }
    return false;
  }
  function block(e) {
    if (e.key !== 'Backspace' && e.keyCode !== 8 && e.which !== 8) return;
    if (editable(e.target) || editable(document.activeElement)) return; // saisie en cours → on laisse
    e.preventDefault();
  }
  window.addEventListener('keydown', block, true);   // capture : on intercepte avant tout
  document.addEventListener('keydown', block, true);
})();
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
  'notifications.html': 'Suivi & alertes',
  'taches.html':       'Tâches',
  'statistiques.html': 'Statistiques',
  'vehicules.html':    'Véhicules',
  'emprunts.html':     'Emprunt véhicule',
  'conducteurs.html':  'Conducteurs',
  'amendes.html':      'Amendes',
  'sinistres.html':    'Sinistres',
  'factures.html':     'Factures',
  'contrats.html':     'Contrats',
  'guide.html':        'Guide',
  'aide.html':         'Aide',
  'parametres.html':   'Paramètres',
  'brochure.html':     'Brochure',
  'prix.html':         'Tarifs',
  // Regroupés (accessibles depuis leur page parente, retirés du menu) :
  'calendrier.html':   'Calendrier',
  'renouvellements.html': 'Renouvellements',
  'entretiens.html':   'Entretiens',
  'a-vendre.html':     'À vendre',
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
// Onglets de la section « Compte » (bas de la sidebar) — le reste = « Espace de travail ».
FP.NAV_ACCOUNT = ['guide.html', 'aide.html', 'parametres.html', 'brochure.html', 'prix.html'];
// Libellés des sections (éditables plus tard via réglages si besoin).
FP.NAV_GROUP_LABELS = { workspace: 'Espace de travail', compte: 'Compte' };
// Range les onglets en 2 sections (Espace de travail / Compte) façon SaaS.
// ⚠️ Robuste : on NE déplace PAS les liens dans le DOM (ça se faisait casser par le
// ré-ordonnancement / le prefetch → les 2 titres finissaient collés en haut). On utilise
// `order` (CSS, nav en flex-column) : Espace=order 0, liens workspace=1, Compte=2, liens
// compte=3. L'ordre DANS un groupe suit l'ordre DOM (donc navOrder). La catégorie est FIXE
// (FP.NAV_ACCOUNT). Un ré-ordonnancement du DOM ne peut plus casser l'affichage.
// Idempotent (réutilise les mêmes 2 titres via data-grp) → sûr à ré-exécuter.
FP.applyNavGroups = () => {
  document.querySelectorAll('aside nav').forEach(nav => {
    const links = Array.from(nav.querySelectorAll('a[data-nav]'));
    if (!links.length) return;
    let hasAc = false;
    links.forEach(a => { const acc = FP.NAV_ACCOUNT.includes(a.dataset.nav); a.style.order = acc ? '3' : '1'; if (acc && a.style.display !== 'none') hasAc = true; });
    const ensure = (key, txt, ord) => {
      let d = nav.querySelector('.fp-nav-group[data-grp="' + key + '"]');
      if (!d) { d = document.createElement('div'); d.className = 'fp-nav-group'; d.setAttribute('data-grp', key); nav.appendChild(d); }
      d.textContent = txt; d.style.order = ord; return d;
    };
    ensure('ws', FP.NAV_GROUP_LABELS.workspace, '0');
    ensure('ac', FP.NAV_GROUP_LABELS.compte, '2').style.display = hasAc ? '' : 'none';
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
      FP.applyNavGroups();
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
FP.REVISION_DEFAUT = { km: 15000, mois: 12 };

// Réglages de notifications/seuils (modifiables dans Paramètres → Notifications).
// Valeurs par défaut = comportement historique → rien ne change tant qu'on n'y touche pas.
FP.notifCfg = () => {
  const s = (FP.settings && FP.settings.get) ? (FP.settings.get() || {}) : {};
  const n = (s.notif && typeof s.notif === 'object') ? s.notif : {};
  const num = (v, def) => (Number(v) > 0 ? Number(v) : def);
  return {
    revKm:   num(n.revKm, 15000),   // intervalle de révision (km)
    revMois: num(n.revMois, 12),    // intervalle de révision (mois)
    ctJours: num(n.ctJours, 90),    // anticipation d'alerte du contrôle technique (jours)
  };
};
// Intervalle de révision : par défaut tous les 15 000 km OU tous les 12 mois (au premier atteint),
// réglable dans Paramètres → Notifications (FP.notifCfg).
FP.revisionIntervalle = (v) => { const c = FP.notifCfg(); return { km: c.revKm, mois: c.revMois }; };

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

  // Échéance temporelle : ancrée sur la dernière révision, sinon (pas de révision connue)
  // sur la date de mise en circulation → 1ʳᵉ révision estimée.
  const anchorDate = hasRev ? dRev : (mec && !isNaN(mec) ? mec : null);
  if (anchorDate) {
    prochaineDate = new Date(anchorDate);
    prochaineDate.setMonth(prochaineDate.getMonth() + intervalle.mois);
    // Sans révision enregistrée, la mise en circulation peut être ancienne : on avance d'un
    // intervalle à la fois jusqu'à une date FUTURE (sinon on afficherait une date passée absurde).
    if (!hasRev) {
      let guard = 0;
      while (prochaineDate < today && guard++ < 600) prochaineDate.setMonth(prochaineDate.getMonth() + intervalle.mois);
    }
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
  } else {
    // 3) Faute de mieux (dont véhicule neuf km=0) : prochain palier d'odomètre
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
// === Widget « Coût par période » (réutilisable : factures, sinistres, stats) =====
// =====================================================================
// items() renvoie un tableau d'objets { date, montantTTC }. Affiche le total par
// année (boutons cliquables) + un sélecteur de période personnalisée (du / au).
FP.coutParPeriode = function (opts) {
  const $ = id => document.getElementById(id);
  const yearsEl = $(opts.yearsEl), fromEl = $(opts.fromEl), toEl = $(opts.toEl), totalEl = $(opts.totalEl), clearEl = $(opts.clearEl);
  if (!yearsEl || !fromEl || !toEl) return { render() {} };
  const list = () => (opts.items() || []);
  function renderYears() {
    const by = {};
    list().forEach(f => { const y = (f.date || '').slice(0, 4); if (/^\d{4}$/.test(y)) by[y] = (by[y] || 0) + (Number(f.montantTTC) || 0); });
    const ys = Object.keys(by).sort().reverse();
    yearsEl.innerHTML = ys.length
      ? ys.map(y => `<button type="button" class="kpi p-3" data-cp-year="${y}" style="cursor:pointer;text-align:left"><div class="kpi-label">${y}</div><div class="kpi-value" style="font-size:1.15rem">${FP.euro(by[y])}</div></button>`).join('')
      : '<div class="text-sm text-slate-500">Aucune donnée pour le moment.</div>';
  }
  function renderRange() {
    const from = fromEl.value, to = toEl.value;
    if (!from && !to) { if (totalEl) totalEl.textContent = ''; if (clearEl) clearEl.classList.add('hidden'); return; }
    if (clearEl) clearEl.classList.remove('hidden');
    const t = list().filter(f => { const d = f.date || ''; if (from && d < from) return false; if (to && d > to) return false; return true; }).reduce((s, f) => s + (Number(f.montantTTC) || 0), 0);
    if (totalEl) totalEl.textContent = FP.euro(t);
  }
  yearsEl.addEventListener('click', e => { const b = e.target.closest('[data-cp-year]'); if (!b) return; const y = b.dataset.cpYear; fromEl.value = y + '-01-01'; toEl.value = y + '-12-31'; renderRange(); });
  fromEl.addEventListener('change', renderRange);
  toEl.addEventListener('change', renderRange);
  if (clearEl) clearEl.addEventListener('click', () => { fromEl.value = ''; toEl.value = ''; renderRange(); });
  // Export CSV du total par année
  const exportEl = $(opts.exportEl);
  if (exportEl) exportEl.addEventListener('click', () => {
    const by = {};
    list().forEach(f => { const y = (f.date || '').slice(0, 4); if (/^\d{4}$/.test(y)) by[y] = (by[y] || 0) + (Number(f.montantTTC) || 0); });
    const ys = Object.keys(by).sort();
    const eur = n => n.toFixed(2).replace('.', ',');
    const lines = ['Année;Total TTC (€)'].concat(ys.map(y => `${y};${eur(by[y])}`));
    lines.push(`Total;${eur(ys.reduce((s, y) => s + by[y], 0))}`);
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (opts.fileLabel || 'cout-par-annee') + '.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  return { render() { renderYears(); renderRange(); } };
};

// =====================================================================
// === Leasing BPCE : forfait km contractuel + suivi de dépassement =====
// =====================================================================
// Termes issus des contrats signés BPCE Car Lease (dossier Drive flotte).
// Statique en code = partagé via git, durable, survit au chargement Supabase.
// Pour un nouveau véhicule en leasing : ajouter une ligne (immat → forfait).
// ⚠️ Forfaits leasing codés en dur = PROPRES À PXP (immatriculations PXP). Ils ne servent
// de base QUE pour la société PXP (voir FP.leasingContrat) ; une autre société part de zéro
// et saisit ses forfaits via l'éditeur (settings.leasingContrats).
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
  // Base PXP en dur → uniquement pour PXP. Les autres sociétés n'utilisent que leurs overrides.
  const base = (((FP.activeSociete && FP.activeSociete()) || 'PXP') === 'PXP') ? (FP.LEASING_CONTRATS[key] || null) : null;
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

// Score « santé » d'un véhicule (0–100) à partir de ses échéances (CT, révision, leasing,
// anti-pollution). Renvoie null pour les véhicules sortis de la flotte (vendu/HS…).
//   { score, niveau:'bon'|'surveiller'|'critique', raisons:[...] }
FP.santeVehicule = (v) => {
  if (!v) return null;
  const st = (v.statut || 'actif').toString().toLowerCase().trim();
  if (st && st !== 'actif') return null; // seulement les véhicules en service
  let score = 100; const raisons = [];
  // Contrôle technique
  const jCT = (v.prochainCT && v.prochainCT !== '—' && !FP.ctIgnored(v)) ? FP.joursRestants(v.prochainCT) : null;
  if (jCT !== null && jCT !== undefined) {
    if (jCT < 0) { score -= 40; raisons.push(`CT dépassé (${-jCT} j)`); }
    else if (jCT < 30) { score -= 25; raisons.push(`CT dans ${jCT} j`); }
    else if (jCT < 60) { score -= 10; raisons.push(`CT dans ${jCT} j`); }
  }
  // Révision
  const r = FP.revisionInfo ? FP.revisionInfo(v) : null;
  if (r && r.niveau === 'danger') { score -= 22; raisons.push('Révision dépassée/imminente'); }
  else if (r && r.niveau === 'warn') { score -= 9; raisons.push('Révision à prévoir'); }
  // Leasing : dépassement km + fin de contrat proche
  const l = FP.leasingInfo ? FP.leasingInfo(v) : null;
  if (l && l.niveau === 'danger') { score -= 18; raisons.push('Dépassement km leasing'); }
  else if (l && l.niveau === 'warn') { score -= 7; raisons.push('Km leasing à surveiller'); }
  if (l && l.finContrat && !isNaN(l.finContrat)) {
    const jf = Math.ceil((l.finContrat - new Date()) / 86400000);
    if (jf < 0) { score -= 12; raisons.push('Leasing terminé'); }
    else if (jf < 90) { score -= 7; raisons.push(`Fin leasing dans ${jf} j`); }
  }
  // Anti-pollution (utilitaires concernés)
  if (FP.concerneAntiPollution(v) && v.antiPollution && v.antiPollution !== '—') {
    const ja = FP.joursRestants(v.antiPollution);
    if (ja !== null && ja < 0) { score -= 14; raisons.push('Anti-pollution dépassé'); }
    else if (ja !== null && ja < 30) { score -= 7; raisons.push('Anti-pollution proche'); }
  }
  score = Math.max(0, Math.min(100, score));
  const niveau = score >= 80 ? 'bon' : (score >= 55 ? 'surveiller' : 'critique');
  return { score, niveau, raisons };
};

// Estimation INDICATIVE de la valeur de revente d'un véhicule (décote).
// Repose sur la valeur d'achat, l'âge (mise en circulation) et le kilométrage.
//   { valeur, ageAnnees, residuel, kmAdj, attendu } | null si données insuffisantes
FP.decoteVehicule = (v) => {
  if (!v) return null;
  const achat = Number(v.valeurAchat);
  if (!Number.isFinite(achat) || achat <= 0) return null;
  const mec = v.dateMiseEnCirculation ? new Date(v.dateMiseEnCirculation) : null;
  if (!mec || isNaN(mec)) return null;
  const ageY = Math.max(0, (Date.now() - mec.getTime()) / (365.25 * 86400000));
  // Résiduel selon l'âge : ~-20% la 1re année, puis ~-12%/an. Plancher à 10%.
  let res = ageY <= 1 ? (1 - 0.20 * ageY) : (0.80 * Math.pow(0.88, ageY - 1));
  res = Math.max(0.10, Math.min(1, res));
  // Ajustement kilométrage vs attendu (~20 000 km/an) : 100 000 km d'écart ≈ ±10%.
  const km = Number(v.km) || 0;
  const attendu = ageY * 20000;
  let kmAdj = 1;
  if (attendu > 0) { kmAdj = 1 - ((km - attendu) / 100000) * 0.10; kmAdj = Math.max(0.80, Math.min(1.10, kmAdj)); }
  const valeur = Math.max(0, Math.round((achat * res * kmAdj) / 50) * 50);
  return { valeur, ageAnnees: ageY, residuel: res, kmAdj, attendu };
};

FP.buildAlertes = (data) => {
  const out = [];
  const today = new Date();
  const days = (d) => Math.ceil((new Date(d) - today) / (1000 * 60 * 60 * 24));
  // Véhicules sortis de la flotte active (vendus / à vendre / cédés…) : pas d'alertes pour eux.
  const horsFlotte = FP.horsFlotte; // défini plus haut (source unique)

  // --- Contrôles techniques ---
  (data.vehicules || []).forEach(v => {
    if (horsFlotte(v)) return;
    if (FP.ctIgnored(v)) return; // véhicule étranger / CT ignoré → pas d'alerte
    if (!v.prochainCT || v.prochainCT === '—') return;
    const d = new Date(v.prochainCT);
    if (isNaN(d)) return;
    const diff = days(v.prochainCT);
    const veh = `${v.immat} · ${v.marque} ${v.modele}${v.chauffeur ? ' (' + v.chauffeur + ')' : ''}`;
    const tgt = 'vehicules.html?veh=' + v.id; // ouvre directement la fiche du véhicule
    const mk = 'ct|' + v.id + '|' + v.prochainCT;
    if (diff < 0)        out.push({ niveau: 'danger', categorie: 'Contrôle technique', message: `CT dépassé de ${-diff}j`, detail: veh, sort: diff, target: tgt, muteKey: mk, vehLabel: veh });
    else if (diff < 30)  out.push({ niveau: 'danger', categorie: 'Contrôle technique', message: `CT à faire dans ${diff}j`, detail: veh, sort: diff, target: tgt, muteKey: mk, vehLabel: veh });
    else if (diff < 60)  out.push({ niveau: 'warn',   categorie: 'Contrôle technique', message: `CT à prévoir dans ${diff}j`, detail: veh, sort: diff, target: tgt, muteKey: mk, vehLabel: veh });
    else if (diff < FP.notifCfg().ctJours) out.push({ niveau: 'info', categorie: 'Contrôle technique', message: `CT à venir (${diff}j)`, detail: veh, sort: diff, target: tgt, muteKey: mk, vehLabel: veh });
  });

  // --- Contrôle anti-pollution (utilitaires / camions diesel) ---
  (data.vehicules || []).forEach(v => {
    if (horsFlotte(v)) return;
    if (!FP.concerneAntiPollution(v)) return;
    if (!v.antiPollution || v.antiPollution === '—') return;
    const d = new Date(v.antiPollution);
    if (isNaN(d)) return;
    const diff = days(v.antiPollution);
    const veh = `${v.immat} · ${v.marque} ${v.modele}${v.chauffeur ? ' (' + v.chauffeur + ')' : ''}`;
    const tgt = 'vehicules.html?veh=' + v.id;
    const mk = 'pol|' + v.id + '|' + v.antiPollution;
    if (diff < 0)        out.push({ niveau: 'danger', categorie: 'Anti-pollution', message: `Anti-pollution dépassé de ${-diff}j`, detail: veh, sort: diff, target: tgt, muteKey: mk, vehLabel: veh });
    else if (diff < 30)  out.push({ niveau: 'danger', categorie: 'Anti-pollution', message: `Anti-pollution à faire dans ${diff}j`, detail: veh, sort: diff, target: tgt, muteKey: mk, vehLabel: veh });
    else if (diff < 60)  out.push({ niveau: 'warn',   categorie: 'Anti-pollution', message: `Anti-pollution à prévoir dans ${diff}j`, detail: veh, sort: diff, target: tgt, muteKey: mk, vehLabel: veh });
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

  // --- Amendes marquées payées SANS justificatif (uniquement celles suivies = à partir de maintenant) ---
  try {
    const watchJ = (FP.settings.get().amendesJustifWatch) || [];
    if (watchJ.length) {
      const sansJustif = (data.amendes || []).filter(a => watchJ.includes(a.id) && a.statut === 'payée' && !a.justifUrl);
      if (sansJustif.length) {
        out.push({
          niveau: 'warn', categorie: 'Amendes',
          message: `${sansJustif.length} amende${sansJustif.length > 1 ? 's' : ''} payée${sansJustif.length > 1 ? 's' : ''} sans justificatif`,
          detail: 'Ajoute le reçu de paiement sur la fiche de l\'amende',
          sort: 1200,
          vehicules: sansJustif.map(a => ({ label: `${a.prenom || '?'} · ${a.motif || 'amende'}${a.montant ? ' · ' + FP.euro(a.montant) : ''} (${FP.date(a.date)})`, target: 'amendes.html?amende=' + encodeURIComponent(a.id) })),
        });
      }
    }
  } catch (e) {}

  // --- Amendes à payer approchant la MAJORATION ---
  // Pas de date d'échéance stockée → on l'estime depuis la date de l'amende :
  // stationnement/FPS ~90 j, contravention forfaitaire ~45 j (même logique que la page Amendes).
  try {
    const maintenant = new Date();
    const risque = (data.amendes || [])
      .filter(a => a && a.statut === 'à payer' && a.date && !isNaN(new Date(a.date)))
      .map(a => {
        const base = new Date(a.date);
        const isFps = /stationnement/i.test(a.motif || '');
        const lim = new Date(base); lim.setDate(lim.getDate() + (isFps ? 90 : 45));
        const jours = Math.ceil((lim - maintenant) / 86400000);
        return { a, lim, jours };
      })
      .filter(x => x.jours < 30)            // bientôt majorée (< 30 j) ou déjà dépassée
      .sort((x, y) => x.jours - y.jours);
    if (risque.length) {
      const depasse = risque.filter(x => x.jours < 0).length;
      out.push({
        niveau: depasse ? 'danger' : 'warn',
        categorie: 'Amendes',
        message: depasse
          ? `${depasse} amende(s) probablement majorée(s)` + (risque.length > depasse ? ` · ${risque.length - depasse} bientôt` : '')
          : `${risque.length} amende(s) bientôt majorée(s)`,
        detail: 'Payez avant la date limite estimée pour éviter la majoration (estimation — vérifiez l\'avis)',
        sort: 1100,
        vehicules: risque.map(x => ({
          label: `${x.a.prenom || '?'} · ${x.a.motif || 'amende'}${x.a.montant ? ' · ' + FP.euro(x.a.montant) : ''} — ${x.jours < 0 ? `limite dépassée (~${-x.jours} j)` : `~${x.jours} j restants`} · limite est. ${FP.date(x.lim.toISOString())}`,
          target: 'amendes.html?amende=' + encodeURIComponent(x.a.id),
        })),
      });
    }
  } catch (e) {}

  // --- Permis de conduire qui expirent (table conducteurs) ---
  (data.conducteurs || []).forEach(c => {
    if (!c || !c.permisExpiration) return;
    const d = new Date(c.permisExpiration);
    if (isNaN(d)) return;
    const diff = days(c.permisExpiration);
    const who = [c.prenom || c.name, c.nom].filter(Boolean).join(' ') || c.name || c.key;
    const detail = `${who} — expire le ${FP.date(c.permisExpiration)}`;
    const tgt = 'conducteurs.html?cond=' + encodeURIComponent(c.key);
    const mk = 'permis|' + c.key + '|' + c.permisExpiration;
    if (diff < 0)        out.push({ niveau: 'danger', categorie: 'Permis', message: `Permis EXPIRÉ depuis ${-diff}j`, detail, sort: diff, target: tgt, muteKey: mk, vehLabel: who });
    else if (diff < 60)  out.push({ niveau: 'danger', categorie: 'Permis', message: `Permis expire dans ${diff}j`, detail, sort: diff, target: tgt, muteKey: mk, vehLabel: who });
    else if (diff < 120) out.push({ niveau: 'warn',   categorie: 'Permis', message: `Permis à renouveler (${diff}j)`, detail, sort: diff, target: tgt, muteKey: mk, vehLabel: who });
  });

  // --- Pièces d'identité (carte d'identité, titre de séjour…) qui expirent (réglages condDocs) ---
  try {
    const condDocs = (FP.settings.get().condDocs) || {};
    const byKey = {}; (data.conducteurs || []).forEach(c => { if (c && c.key) byKey[c.key] = c; });
    const LABELS = { 'carte-identite': "Carte d'identité", 'titre-sejour': 'Titre de séjour', 'rib': 'RIB', 'mutuelle': 'Carte mutuelle', 'visite-medicale': 'Visite médicale', 'autre': 'Document' };
    Object.entries(condDocs).forEach(([key, docs]) => {
      (docs || []).forEach(doc => {
        if (!doc || !doc.date || isNaN(new Date(doc.date))) return;
        const diff = days(doc.date);
        const c = byKey[key];
        const who = c ? ([c.prenom || c.name, c.nom].filter(Boolean).join(' ') || c.name || key) : key;
        const lib = LABELS[doc.type] || doc.label || 'Document';
        const detail = `${who} — ${lib} expire le ${FP.date(doc.date)}`;
        const tgt = 'conducteurs.html?cond=' + encodeURIComponent(key);
        const mk = 'cid|' + key + '|' + doc.type + '|' + doc.date;
        if (diff < 0)        out.push({ niveau: 'danger', categorie: "Pièce d'identité", message: `${lib} EXPIRÉE depuis ${-diff}j`, detail, sort: diff, target: tgt, muteKey: mk, vehLabel: who + ' — ' + lib });
        else if (diff < 60)  out.push({ niveau: 'danger', categorie: "Pièce d'identité", message: `${lib} expire dans ${diff}j`, detail, sort: diff, target: tgt, muteKey: mk, vehLabel: who + ' — ' + lib });
        else if (diff < 120) out.push({ niveau: 'warn',   categorie: "Pièce d'identité", message: `${lib} à renouveler (${diff}j)`, detail, sort: diff, target: tgt, muteKey: mk, vehLabel: who + ' — ' + lib });
      });
    });
  } catch (e) {}

  // --- Révisions constructeur ---
  (data.vehicules || []).forEach(v => {
    if (v.statut && v.statut !== 'actif') return; // on ignore vendus / à vendre / hors service
    const r = FP.revisionInfo(v);
    const veh = `${v.immat} · ${v.marque} ${v.modele}${v.chauffeur && v.chauffeur !== '—' ? ' (' + v.chauffeur + ')' : ''}`;
    const tgt = 'vehicules.html?veh=' + v.id;
    // ⚠️ Aucune date de révision ET le véhicule a déjà parcouru au moins un intervalle complet
    // (ex. ≥ 15 000 km) → la révision est due (ou pas enregistrée). Alerte prioritaire.
    const _hasRev = v.derniereRevision && v.derniereRevision !== '—';
    const _hasRevKm = Number(v.kmDernierReleve) > 0; // km à la dernière révision renseigné ?
    const _km = Number(v.km) || 0;
    // Alerte seulement si AUCUNE info de révision (ni date ni km) — sinon revisionInfo sait calculer.
    if (!_hasRev && !_hasRevKm && _km >= r.intervalle.km) {
      out.push({ niveau: 'danger', categorie: 'Révision',
        message: `Aucune date de révision · ${FP.num(_km)} km`,
        detail: `${veh} — aucune date de révision enregistrée alors que le véhicule a parcouru ${FP.num(_km)} km (préconisé tous les ${FP.num(r.intervalle.km)} km). Révision à faire, ou à saisir si déjà faite.`,
        sort: -100000, target: tgt, muteKey: 'rev|' + v.id + '|norev', vehLabel: veh });
      return;
    }
    if (!r.niveau) return;
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
    out.push({ niveau: r.niveau, categorie: 'Révision', message: msg, detail, sort, target: tgt, muteKey: 'rev|' + v.id + '|' + (v.derniereRevision || ''), vehLabel: veh });
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
    out.push({ niveau: l.niveau, categorie: 'Leasing', message: msg, detail, sort: 3000 - Math.round((l.ratio || 0) * 100), target: 'contrats.html', muteKey: 'leasingkm|' + v.id, vehLabel: veh });
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
    out.push({ niveau, categorie: 'Leasing', message: msg, detail: veh, sort: diff, target: 'contrats.html', muteKey: 'leasingfin|' + v.id + '|' + finStr, vehLabel: veh });
  });

  // (Le « véhicules sans dernière révision » n'est PAS une alerte : véhicules neufs, etc.
  //  → retiré des notifications. L'info reste visible dans la fiche véhicule.)

  // --- Sinistres en attente de remboursement (rappel de suivi) ---
  const sinStatut = (FP.settings.get().sinistreStatut) || {};
  const sinAttente = (data.factures || []).filter(f => f.type === 'sinistre' && sinStatut[f.id] === 'attente');
  if (sinAttente.length) {
    out.push({ niveau: 'warn', categorie: 'Sinistres', message: `${sinAttente.length} sinistre(s) en attente de remboursement`, detail: "Vérifie si l'assureur t'a remboursé", sort: 500,
      vehicules: sinAttente.map(s => ({ label: `${s.vehiculeImmat || '—'} · ${(s.description || 'sinistre').slice(0, 45)}${s.montantTTC ? ' — ' + FP.euro(s.montantTTC) : ''}`, target: 'sinistres.html' })) });
  }

  // --- Budgets d'entretien dépassés (budget annuel défini par véhicule) ---
  try {
    const budgets = (FP.settings.get().budgets) || {};
    if (Object.keys(budgets).length) {
      const yr = String(new Date().getFullYear());
      const COUT = ['entretien', 'réparation', 'reparation'];
      const spendByImmat = {};
      (data.factures || []).forEach(f => {
        if (!(f.date || '').startsWith(yr)) return;
        const t = (f.type || '').toLowerCase();
        let amt = 0;
        if (COUT.includes(t)) amt = Number(f.montantTTC) || 0;
        else if (t === 'sinistre' && sinStatut[f.id] !== 'rembourse' && sinStatut[f.id] !== 'pec') amt = Number(f.montantTTC) || 0;
        if (amt && f.vehiculeImmat) spendByImmat[f.vehiculeImmat] = (spendByImmat[f.vehiculeImmat] || 0) + amt;
      });
      const over = [];
      (data.vehicules || []).forEach(v => {
        if (horsFlotte(v)) return;
        const b = Number(budgets[v.id]); if (!Number.isFinite(b) || b <= 0) return;
        const spent = spendByImmat[v.immat] || 0;
        if (spent > b) over.push({ v, b, spent });
      });
      if (over.length) {
        over.sort((a, b) => (b.spent - b.b) - (a.spent - a.b));
        out.push({
          niveau: 'warn', categorie: 'Budget',
          message: `${over.length} véhicule(s) au-dessus du budget entretien ${yr}`,
          detail: 'Dépenses d\'entretien supérieures au budget défini',
          sort: 600,
          vehicules: over.map(o => ({ label: `${o.v.immat} · ${o.v.marque} ${o.v.modele} — ${FP.euro(o.spent)} / ${FP.euro(o.b)} (+${FP.euro(o.spent - o.b)})`, target: 'vehicules.html?immat=' + encodeURIComponent(o.v.immat) })),
        });
      }
    }
  } catch (e) {}

  const order = { danger: 0, warn: 1, info: 2 };
  out.sort((a, b) => (order[a.niveau] - order[b.niveau]) || (a.sort - b.sort));
  // Masque les alertes que l'utilisateur a explicitement enlevées (par véhicule / échéance)
  const masquees = (FP.settings.get().alertesMasquees) || [];
  return masquees.length ? out.filter(a => !a.muteKey || !masquees.includes(a.muteKey)) : out;
};

// Masquer / réafficher une alerte (clé liée au véhicule + échéance : reparaît si l'échéance change)
FP.alertes = {
  masquees() { return (FP.settings.get().alertesMasquees) || []; },
  infos() { return (FP.settings.get().alertesMasqueesInfo) || {}; },
  masquer(key, label) {
    if (!key) return;
    const s = FP.settings.get(); s.alertesMasquees = s.alertesMasquees || []; s.alertesMasqueesInfo = s.alertesMasqueesInfo || {};
    if (!s.alertesMasquees.includes(key)) s.alertesMasquees.push(key);
    if (label) s.alertesMasqueesInfo[key] = label;
    FP.settings.save(s);
  },
  reafficher(key) {
    const s = FP.settings.get();
    s.alertesMasquees = (s.alertesMasquees || []).filter(k => k !== key);
    if (s.alertesMasqueesInfo) delete s.alertesMasqueesInfo[key];
    FP.settings.save(s);
  },
  reafficherTout() { const s = FP.settings.get(); s.alertesMasquees = []; s.alertesMasqueesInfo = {}; FP.settings.save(s); },
};

// Échéances DATÉES (pour le calendrier) : chaque entrée a une vraie date.
// { date:'YYYY-MM-DD', categorie, label, detail, niveau, target }
FP.buildEcheances = (data) => {
  const out = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const iso = (d) => { const x = new Date(d); return isNaN(x) ? null : x.toISOString().slice(0, 10); };
  const niv = (dateStr) => {
    const diff = Math.ceil((new Date(dateStr) - today) / 86400000);
    if (diff < 0) return 'danger';
    if (diff < 30) return 'danger';
    if (diff < 90) return 'warn';
    return 'info';
  };
  const push = (dateStr, categorie, label, detail, target) => {
    const d = iso(dateStr); if (!d) return;
    out.push({ date: d, categorie, label, detail, niveau: niv(d), target });
  };

  (data.vehicules || []).forEach(v => {
    const veh = `${v.immat} · ${v.marque} ${v.modele}`;
    const tgt = 'vehicules.html?veh=' + v.id;
    if (v.prochainCT && v.prochainCT !== '—' && !FP.ctIgnored(v)) push(v.prochainCT, 'Contrôle technique', 'CT — ' + v.immat, veh, tgt);
    if (FP.concerneAntiPollution(v) && v.antiPollution && v.antiPollution !== '—') push(v.antiPollution, 'Anti-pollution', 'Anti-pollution — ' + v.immat, veh, tgt);
    // Fin de leasing (BPCE)
    const l = FP.leasingInfo && FP.leasingInfo(v);
    if (l && l.finContrat && !isNaN(l.finContrat)) push(l.finContrat.toISOString(), 'Leasing', 'Fin leasing — ' + v.immat, veh, 'contrats.html');
  });

  // Permis qui expirent
  (data.conducteurs || []).forEach(c => {
    if (!c || !c.permisExpiration) return;
    const who = [c.prenom || c.name, c.nom].filter(Boolean).join(' ') || c.name || c.key;
    push(c.permisExpiration, 'Permis', 'Permis — ' + who, who, 'conducteurs.html?cond=' + encodeURIComponent(c.key));
  });

  // Pièces d'identité qui expirent (réglages condDocs)
  try {
    const condDocs = (FP.settings.get().condDocs) || {};
    const byKey = {}; (data.conducteurs || []).forEach(c => { if (c && c.key) byKey[c.key] = c; });
    const LABELS = { 'carte-identite': "Carte d'identité", 'titre-sejour': 'Titre de séjour', 'rib': 'RIB', 'mutuelle': 'Carte mutuelle', 'visite-medicale': 'Visite médicale', 'autre': 'Document' };
    Object.entries(condDocs).forEach(([key, docs]) => {
      (docs || []).forEach(doc => {
        if (!doc || !doc.date) return;
        const c = byKey[key];
        const who = c ? ([c.prenom || c.name, c.nom].filter(Boolean).join(' ') || c.name || key) : key;
        const lib = LABELS[doc.type] || doc.label || 'Document';
        push(doc.date, "Pièce d'identité", lib + ' — ' + who, who, 'conducteurs.html?cond=' + encodeURIComponent(key));
      });
    });
  } catch (e) {}

  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
};

// === RAPPORT DE DIRECTION ===================================================
// One-pager imprimable / PDF (synthèse à envoyer à la direction) : KPI clés,
// coûts, TVS, CO₂, échéances à venir et top coûts par véhicule. Purement client
// (aucune écriture), réutilise les helpers existants → dispo sur toutes les pages.
FP.rapportDirection = (data) => {
  data = data || (window.FP_DATA || {});
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let soc = 'PXP'; try { soc = localStorage.getItem('fp_societe') || 'PXP'; if (soc === '__all__') soc = 'Toutes sociétés'; } catch (e) {}
  const now = new Date();
  const moisLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const ym = now.toISOString().slice(0, 7);
  const y12 = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().slice(0, 7);
  const today = now.toLocaleDateString('fr-FR');

  const vehs = (data.vehicules || []);
  const actifs = vehs.filter(v => !FP.estVendu(v)); // parc possédé (hors vendus) — même règle que dashboard/écran/stats
  const kmTotal = actifs.reduce((s, v) => s + (Number(v.km) || 0), 0);
  const valeurParc = actifs.reduce((s, v) => s + (Number(v.valeurAchat) || Number(v.prix) || 0), 0);

  // Factures dédoublonnées par numéro (comme Statistiques / Factures) → chiffres cohérents dans le rapport.
  const _seenF = new Set();
  const facts = (data.factures || []).filter(f => { const k = (f.numeroFacture || '').toString().toUpperCase(); if (!k) return true; if (_seenF.has(k)) return false; _seenF.add(k); return true; });
  const coutMois = facts.filter(f => (f.date || '').slice(0, 7) === ym).reduce((s, f) => s + (+f.montantTTC || 0), 0);
  const cout12 = facts.filter(f => (f.date || '').slice(0, 7) >= y12).reduce((s, f) => s + (+f.montantTTC || 0), 0);

  const byVeh = {};
  facts.filter(f => (f.date || '').slice(0, 7) >= y12).forEach(f => { const k = f.vehiculeImmat || '—'; byVeh[k] = (byVeh[k] || 0) + (+f.montantTTC || 0); });
  const topCouts = Object.entries(byVeh).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topMax = topCouts.length ? topCouts[0][1] : 0;

  const tvsTotal = actifs.reduce((s, v) => { const d = FP.tvsDetail ? FP.tvsDetail(v) : null; return s + (d && d.applicable && d.total != null ? d.total : 0); }, 0);
  let co2G = 0; actifs.forEach(v => { const carb = (v.carburant || '').toLowerCase(); if (/lectri|hydrog/.test(carb)) return; const c = Number(v.co2); if (Number.isFinite(c) && c > 0) co2G += c * 15000; });
  const co2T = co2G / 1e6;
  const nbElec = actifs.filter(v => /lectri|hydrog|hybrid/.test((v.carburant || '').toLowerCase())).length;

  const am = (data.amendes || []);
  const amTot = am.reduce((s, a) => s + ((a.majoree && +a.montantMajore) ? +a.montantMajore : (+a.montant || 0)), 0);

  const alerts = FP.buildAlertes ? FP.buildAlertes(data) : [];
  const ech = (FP.buildEcheances ? FP.buildEcheances(data) : []).filter(e => {
    const diff = Math.ceil((new Date(e.date) - now) / 86400000); return diff <= 90;
  }).slice(0, 14);

  const eur = (n) => FP.euro ? FP.euro(n) : Math.round(n) + ' €';
  const num = (n) => FP.num ? FP.num(n) : String(n);
  const dnum = (d) => FP.dateNum ? FP.dateNum(d) : d;
  const nivColor = { danger: '#DC2626', warn: '#F59E0B', info: '#0e7490' };

  const kpi = (label, val, sub, color) =>
    `<div class="kpi"><div class="kl">${esc(label)}</div><div class="kv" style="color:${color || '#0F1E3D'}">${val}</div>${sub ? `<div class="ks">${esc(sub)}</div>` : ''}</div>`;

  const echRows = ech.length ? ech.map(e => `<tr>
      <td><span class="dot" style="background:${nivColor[e.niveau] || '#94a3b8'}"></span>${esc(dnum(e.date))}</td>
      <td>${esc(e.categorie)}</td>
      <td>${esc((e.label || '').replace(/^.*? — /, ''))}</td>
      <td class="muted">${esc(e.detail || '')}</td>
    </tr>`).join('') : '<tr><td colspan="4" class="muted" style="text-align:center;padding:14px">Aucune échéance dans les 90 jours 🎉</td></tr>';

  const topRows = topCouts.length ? topCouts.map(([k, v]) => `<div class="bar-row">
      <div class="bar-lbl">${esc(k)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${topMax ? Math.max(4, Math.round(v / topMax * 100)) : 0}%"></div></div>
      <div class="bar-val">${eur(v)}</div>
    </div>`).join('') : '<div class="muted">Aucune facture sur 12 mois.</div>';

  const logo = `<svg width="120" height="27" viewBox="0 0 154 36" xmlns="http://www.w3.org/2000/svg"><line x1="2" y1="10" x2="24" y2="10" stroke="#FB923C" stroke-width="3" stroke-linecap="round"/><line x1="0" y1="18" x2="28" y2="18" stroke="#F97316" stroke-width="3" stroke-linecap="round"/><line x1="6" y1="26" x2="22" y2="26" stroke="#FB923C" stroke-width="3" stroke-linecap="round"/><text x="34" y="26" font-size="20" font-weight="900" font-style="italic" fill="#fff">Parc</text><text x="86" y="26" font-size="20" font-weight="900" font-style="italic" fill="#F97316">Pilot</text></svg>`;

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Rapport de direction — ${esc(soc)} — ${esc(moisLabel)}</title>
    <style>
      @page { margin: 12mm; }
      * { box-sizing: border-box; }
      body { font-family: 'Inter','Segoe UI',Roboto,Arial,sans-serif; color:#0F1E3D; margin:0; padding:26px; background:#fff; }
      .head { display:flex; align-items:center; justify-content:space-between; background:#0F1E3D; color:#fff; padding:16px 22px; border-radius:14px; }
      .head h1 { font-size:18px; margin:0; font-weight:800; }
      .head .grp { color:#FB923C; }
      .head .meta { font-size:11px; opacity:.85; margin-top:3px; text-transform:capitalize; }
      .sec { margin-top:22px; }
      .sec-t { font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:#F97316; margin:0 0 10px; }
      .kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
      .kpi { border:1px solid #e2e8f0; border-radius:12px; padding:12px 14px; background:linear-gradient(145deg,#fff,#f8fafc); }
      .kl { font-size:10.5px; text-transform:uppercase; letter-spacing:.03em; color:#64748b; font-weight:700; }
      .kv { font-size:22px; font-weight:800; margin-top:3px; line-height:1.1; }
      .ks { font-size:10.5px; color:#94a3b8; margin-top:2px; }
      table { width:100%; border-collapse:collapse; font-size:12px; }
      thead th { text-align:left; background:#f1f5f9; color:#334155; padding:8px 10px; border-bottom:2px solid #cbd5e1; text-transform:uppercase; font-size:10px; letter-spacing:.03em; }
      tbody td { padding:7px 10px; border-bottom:1px solid #eef2f7; }
      .muted { color:#94a3b8; }
      .dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:7px; vertical-align:middle; }
      .grid2 { display:grid; grid-template-columns:1.15fr .85fr; gap:22px; align-items:start; }
      .bar-row { display:flex; align-items:center; gap:10px; margin-bottom:8px; font-size:12px; }
      .bar-lbl { width:88px; font-family:'Courier New',monospace; font-weight:700; flex:0 0 auto; }
      .bar-track { flex:1; height:14px; background:#f1f5f9; border-radius:7px; overflow:hidden; }
      .bar-fill { height:100%; background:linear-gradient(90deg,#FB923C,#F97316); border-radius:7px; }
      .bar-val { width:88px; text-align:right; font-weight:700; flex:0 0 auto; }
      .foot { margin-top:22px; font-size:10px; color:#94a3b8; text-align:center; border-top:1px solid #eef2f7; padding-top:10px; }
      .noprint { position:fixed; top:14px; right:14px; padding:9px 18px; border:none; border-radius:8px; cursor:pointer; background:#F97316; color:#fff; font-weight:700; font-size:13px; box-shadow:0 6px 18px -6px rgba(249,115,22,.6); }
      @media print { .noprint { display:none; } body { padding:0; } }
    </style></head>
    <body>
      <button class="noprint" onclick="window.print()">Imprimer / Enregistrer en PDF</button>
      <div class="head">
        <div>
          <h1>Rapport de direction — <span class="grp">${esc(soc)}</span></h1>
          <div class="meta">${esc(moisLabel)} · édité le ${esc(today)}</div>
        </div>
        <div>${logo}</div>
      </div>

      <div class="sec">
        <div class="kpis">
          ${kpi('Parc actif', num(actifs.length), (nbElec ? nbElec + ' électrifiés' : 'véhicules'), '#0F1E3D')}
          ${kpi('Kilométrage total', num(kmTotal) + ' km', 'cumul compteurs', '#0e7490')}
          ${kpi('Valeur du parc', eur(valeurParc), "prix d'acquisition", '#7c3aed')}
          ${kpi('Coûts du mois', eur(coutMois), 'entretien, répa…', '#F97316')}
          ${kpi('Coûts 12 mois', eur(cout12), 'glissants', '#F97316')}
          ${kpi('TVS annuelle', eur(tvsTotal), 'taxe estimée', '#DC2626')}
          ${kpi('CO₂ estimé', (Math.round(co2T * 10) / 10).toLocaleString('fr-FR') + ' t', '/ an (15 000 km)', '#10B981')}
          ${kpi('Amendes', eur(amTot), am.length + ' au total', '#F59E0B')}
        </div>
      </div>

      <div class="sec grid2">
        <div>
          <div class="sec-t">Échéances à venir (90 jours)</div>
          <table><thead><tr><th>Date</th><th>Type</th><th>Concerné</th><th>Détail</th></tr></thead><tbody>${echRows}</tbody></table>
        </div>
        <div>
          <div class="sec-t">Top 5 coûts / véhicule (12 mois)</div>
          ${topRows}
          <div class="sec-t" style="margin-top:20px">Vigilance</div>
          <div style="font-size:12px;line-height:1.6">
            <div>🔔 <b>${alerts.length}</b> alerte${alerts.length > 1 ? 's' : ''} active${alerts.length > 1 ? 's' : ''}</div>
            <div>📅 <b>${ech.length}</b> échéance${ech.length > 1 ? 's' : ''} sous 90 j</div>
            <div>🌱 <b>${actifs.length ? Math.round(nbElec / actifs.length * 100) : 0}%</b> de flotte électrifiée</div>
          </div>
        </div>
      </div>

      <div class="foot">Généré par Parc Pilot — gestion de flotte · ${esc(soc)} · ${esc(today)}. Les montants TVS et CO₂ sont des estimations.</div>
      <scr` + `ipt>setTimeout(function(){try{window.print()}catch(e){}},450)</scr` + `ipt>
    </body></html>`;

  const w = window.open('', '_blank');
  if (!w) { alert('Autorise les fenêtres pop-up pour générer le rapport.'); return; }
  w.document.write(html); w.document.close();
};

// ===== Rapport RSE / bilan carbone (imprimable / PDF) =====
FP.rapportRSE = (data) => {
  data = data || (window.FP_DATA || {});
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let soc = 'PXP'; try { soc = localStorage.getItem('fp_societe') || 'PXP'; if (soc === '__all__') soc = 'Toutes sociétés'; } catch (e) {}
  const today = new Date().toLocaleDateString('fr-FR');
  const KM_AN = 15000;
  const eur = (n) => FP.euro ? FP.euro(n) : Math.round(n) + ' €';
  const num = (n) => FP.num ? FP.num(n) : String(n);
  const isElec = (v) => /lectri|hydrog/.test((v.carburant || '').toLowerCase());
  const isHyb = (v) => /hybrid/.test((v.carburant || '').toLowerCase());

  const vehs = (data.vehicules || []).filter(v => !(FP.estVendu ? FP.estVendu(v) : false));
  const nbElec = vehs.filter(isElec).length, nbHyb = vehs.filter(isHyb).length;
  const nbPropres = nbElec + nbHyb;
  const pctPropre = vehs.length ? Math.round(nbPropres / vehs.length * 100) : 0;
  let co2G = 0, nCo2 = 0; vehs.forEach(v => { if (isElec(v)) return; const c = Number(v.co2); if (Number.isFinite(c) && c > 0) { co2G += c * KM_AN; nCo2++; } });
  const co2T = co2G / 1e6;
  const co2Moy = nCo2 ? Math.round(co2G / nCo2 / KM_AN) : 0;

  const parCarb = {}; vehs.forEach(v => { const c = (v.carburant || '—').toString().trim() || '—'; parCarb[c] = (parCarb[c] || 0) + 1; });
  const carbRows = Object.entries(parCarb).sort((a, b) => b[1] - a[1]).map(([k, n]) =>
    `<tr><td>${esc(k)}</td><td style="text-align:right">${n}</td><td style="text-align:right">${vehs.length ? Math.round(n / vehs.length * 100) : 0}%</td></tr>`).join('');
  const topRows = vehs.filter(v => !isElec(v) && Number(v.co2) > 0).sort((a, b) => Number(b.co2) - Number(a.co2)).slice(0, 6).map(v =>
    `<tr><td>${esc(v.immat)}</td><td>${esc(((v.marque || '') + ' ' + (v.modele || '')).trim())}</td><td style="text-align:right">${num(v.co2)} g/km</td><td style="text-align:right">${(Number(v.co2) * KM_AN / 1e6).toFixed(2)} t/an</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:12px">Aucun véhicule thermique avec CO₂ renseigné.</td></tr>';

  const kpi = (l, v, s, c) => `<div class="kpi"><div class="kl">${esc(l)}</div><div class="kv" style="color:${c || '#0F1E3D'}">${v}</div>${s ? `<div class="ks">${esc(s)}</div>` : ''}</div>`;

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Rapport RSE — ${esc(soc)}</title>
    <style>
      *{box-sizing:border-box;font-family:Inter,system-ui,Arial,sans-serif}
      body{margin:0;color:#0F1E3D;background:#fff;padding:28px;max-width:820px;margin:0 auto}
      .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #F97316;padding-bottom:12px;margin-bottom:18px}
      h1{font-size:22px;margin:0}.mut{color:#64748B;font-size:13px}
      .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}
      .kpi{border:1px solid #E7EBF0;border-radius:10px;padding:12px}
      .kl{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748B}
      .kv{font-size:20px;font-weight:800;margin-top:4px}.ks{font-size:11px;color:#64748B}
      .sec-t{font-weight:800;font-size:13px;margin:18px 0 8px;color:#0F1E3D}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{padding:6px 8px;border-bottom:1px solid #EEF2F6;text-align:left}
      th{color:#64748B;font-size:10px;text-transform:uppercase;letter-spacing:.06em}
      .note{background:#F8FAFC;border:1px solid #E7EBF0;border-radius:10px;padding:12px;font-size:12px;line-height:1.6;margin-top:10px}
      .foot{margin-top:22px;color:#94a3b8;font-size:11px;border-top:1px solid #EEF2F6;padding-top:10px}
      @media print{body{padding:0}@page{size:A4;margin:14mm}}
    </style></head><body>
      <div class="top">
        <div><h1>Rapport RSE — bilan carbone</h1><div class="mut">${esc(soc)} · ${esc(today)}</div></div>
        <svg width="120" height="27" viewBox="0 0 154 36" xmlns="http://www.w3.org/2000/svg"><line x1="2" y1="10" x2="24" y2="10" stroke="#FB923C" stroke-width="3" stroke-linecap="round"/><line x1="0" y1="18" x2="28" y2="18" stroke="#F97316" stroke-width="3" stroke-linecap="round"/><line x1="6" y1="26" x2="22" y2="26" stroke="#FB923C" stroke-width="3" stroke-linecap="round"/><text x="34" y="26" font-size="20" font-weight="900" font-style="italic" fill="#0F1E3D">Parc</text><text x="86" y="26" font-size="20" font-weight="900" font-style="italic" fill="#F97316">Pilot</text></svg>
      </div>
      <div class="grid">
        ${kpi('Parc actif', num(vehs.length), 'véhicules', '#0F1E3D')}
        ${kpi('CO₂ estimé', co2T.toFixed(1) + ' t/an', 'base ' + num(KM_AN) + ' km/an', '#DC2626')}
        ${kpi('Émission moyenne', num(co2Moy) + ' g/km', 'véhicules thermiques', '#0F1E3D')}
        ${kpi('Flotte électrifiée', pctPropre + ' %', nbElec + ' élec. + ' + nbHyb + ' hybr.', '#047857')}
      </div>
      <div class="sec-t">Répartition par énergie</div>
      <table><thead><tr><th>Énergie</th><th style="text-align:right">Véhicules</th><th style="text-align:right">Part</th></tr></thead><tbody>${carbRows}</tbody></table>
      <div class="sec-t">Véhicules les plus émetteurs</div>
      <table><thead><tr><th>Immat.</th><th>Modèle</th><th style="text-align:right">CO₂</th><th style="text-align:right">Estimé</th></tr></thead><tbody>${topRows}</tbody></table>
      <div class="note"><b>Méthode :</b> émissions estimées sur ${num(KM_AN)} km/an et le CO₂ (carte grise, champ V.7) de chaque véhicule thermique ; les véhicules électriques/hydrogène sont comptés à 0 g/km à l'usage. <b>Loi LOM :</b> les flottes de plus de 100 véhicules ont une obligation croissante de véhicules à faibles émissions au renouvellement — la part électrifiée ci-dessus suit cette trajectoire.</div>
      <div class="foot">Généré par Parc Pilot — gestion de flotte · ${esc(soc)} · ${esc(today)}. Estimations à but indicatif (RSE / reporting interne).</div>
      <scr` + `ipt>setTimeout(function(){try{window.print()}catch(e){}},450)</scr` + `ipt>
    </body></html>`;

  const w = window.open('', '_blank');
  if (!w) { alert('Autorise les fenêtres pop-up pour générer le rapport.'); return; }
  w.document.write(html); w.document.close();
};

// Notification d'erreur visible (bandeau rouge en bas). Utilisée quand une
// écriture en base échoue DÉFINITIVEMENT (rejet base : RLS, colonne, contrainte…),
// pour ne jamais laisser croire à un faux « enregistré ».
FP.notifyError = (msg) => {
  const el = document.createElement('div');
  el.textContent = '⚠️ ' + (msg || 'Échec de l’enregistrement dans la base. Réessaie ou vérifie ta connexion.');
  el.style.cssText = 'position:fixed;bottom:1rem;left:50%;transform:translateX(-50%);background:#dc2626;color:#fff;padding:.7rem 1.1rem;border-radius:8px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.2);font-weight:600;max-width:90vw;text-align:center';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 5000);
};

// Petit message de confirmation (toast) en bas d'écran, avec bouton d'action optionnel ("Annuler").
// FP.toast('✓ Enregistré')  ou  FP.toast('Amende payée', { actionLabel:'Annuler', onAction: fn })
FP.toast = (msg, opts) => {
  opts = opts || {};
  const old = document.getElementById('fp-toast'); if (old) old.remove();
  const el = document.createElement('div');
  el.id = 'fp-toast';
  el.style.cssText = 'position:fixed;bottom:1.25rem;left:50%;transform:translateX(-50%);background:#0F1E3D;color:#fff;padding:.7rem 1rem;border-radius:10px;z-index:9998;box-shadow:0 12px 32px -12px rgba(0,0,0,.45);font-weight:600;display:flex;align-items:center;gap:.85rem;max-width:92vw;font-size:.9rem;animation:fp-toast-in .2s ease';
  const span = document.createElement('span'); span.textContent = msg; el.appendChild(span);
  let timer;
  const close = () => { clearTimeout(timer); el.style.opacity = '0'; el.style.transition = 'opacity .25s'; setTimeout(() => el.remove(), 250); };
  if (opts.actionLabel && typeof opts.onAction === 'function') {
    const btn = document.createElement('button');
    btn.textContent = opts.actionLabel;
    btn.style.cssText = 'background:#F97316;color:#fff;border:none;border-radius:7px;padding:.35rem .75rem;font-weight:700;cursor:pointer;flex-shrink:0';
    btn.onclick = () => { close(); try { opts.onAction(); } catch (e) {} };
    el.appendChild(btn);
  }
  if (!document.getElementById('fp-toast-style')) {
    const st = document.createElement('style'); st.id = 'fp-toast-style';
    st.textContent = '@keyframes fp-toast-in{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
    document.head.appendChild(st);
  }
  document.body.appendChild(el);
  timer = setTimeout(close, opts.duration || (opts.actionLabel ? 6000 : 3000));
  return el;
};

// Avatar « initiales colorées » réutilisable (couleur stable dérivée du nom).
FP.initiales = (name) => {
  const parts = String(name == null ? '' : name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
};
FP.avatarHTML = (name, size) => {
  const s = size || 24;
  const n = String(name == null ? '' : name).trim();
  let h = 0; for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `<span class="fp-avatar" aria-hidden="true" style="display:inline-flex;align-items:center;justify-content:center;width:${s}px;height:${s}px;border-radius:50%;background:hsl(${hue} 65% 90%);color:hsl(${hue} 55% 35%);font-size:${Math.round(s * 0.42)}px;font-weight:700;flex-shrink:0;line-height:1">${FP.initiales(n)}</span>`;
};

// Liens cliquables RÉUTILISABLES (toute la plateforme) :
//  • une PLAQUE -> fiche véhicule (vehicules.html?immat=…)
//  • un PRÉNOM/conducteur -> fiche conducteur (conducteurs.html?cond=…)
FP._pagePrefix = function () { try { return location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/'; } catch (e) { return ''; } };
FP._escLien = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); };
FP.lienVehicule = function (immat, label) {
  const im = (immat == null ? '' : String(immat)).trim();
  const txt = FP._escLien(label != null ? label : im);
  if (!im) return txt;
  return `<a class="fp-lien" href="${FP._pagePrefix()}vehicules.html?immat=${encodeURIComponent(im)}" title="Voir la fiche véhicule" onclick="event.stopPropagation()">${txt}</a>`;
};
FP.lienConducteur = function (name, label) {
  const raw = (name == null ? '' : String(name)).trim();
  const txt = FP._escLien(label != null ? label : raw);
  const excl = ['', '—', 'x', 'X', 'Siège', 'Dépôt', 'Navette', 'VENDU', 'Fenwick'];
  if (excl.includes(raw)) return txt;
  const key = raw.split(/\s+/)[0].toLowerCase();
  return `<a class="fp-lien" href="${FP._pagePrefix()}conducteurs.html?cond=${encodeURIComponent(key)}" title="Voir la fiche conducteur" onclick="event.stopPropagation()">${txt}</a>`;
};

// Densité d'affichage : bascule compact/confortable (mémorisée, appliquée partout).
FP.getDensity = () => { try { return (localStorage.getItem('fp_density') || '') === 'compact' ? 'compact' : 'confort'; } catch (e) { return 'confort'; } };
FP.setDensity = (compact) => {
  try { localStorage.setItem('fp_density', compact ? 'compact' : 'confort'); } catch (e) {}
  document.documentElement.classList.toggle('fp-compact', !!compact);
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
    catch (e) { this._err(e); this._enqueue({ op: 'insert', table, row }); if (this._estPermanente(e) && FP.notifyError) FP.notifyError(); }
  },
  async upsert(table, row) {
    if (!this.available()) { this._enqueue({ op: 'upsert', table, row }); return; }
    try { const r = await FP.db.upsert(table, row); if (r && r.error) throw r.error; this.flush(); }
    catch (e) { this._err(e); this._enqueue({ op: 'upsert', table, row }); if (this._estPermanente(e) && FP.notifyError) FP.notifyError(); }
  },
  async update(table, id, fields) {
    if (!this.available()) { this._enqueue({ op: 'update', table, id, fields }); return; }
    try { const r = await FP.db.update(table, id, fields); if (r && r.error) throw r.error; this.flush(); }
    catch (e) { this._err(e); this._enqueue({ op: 'update', table, id, fields }); if (this._estPermanente(e) && FP.notifyError) FP.notifyError(); }
  },
  async delete(table, id) {
    if (!this.available()) { this._enqueue({ op: 'delete', table, id }); return; }
    try { const r = await FP.db.delete(table, id); if (r && r.error) throw r.error; this.flush(); }
    catch (e) { this._err(e); this._enqueue({ op: 'delete', table, id }); if (this._estPermanente(e) && FP.notifyError) FP.notifyError(); }
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

// Instructions de lecture envoyées à l'IA. ⚠️ Vit ICI (côté site) pour pouvoir être améliorée
// par un simple déploiement GitHub, SANS jamais redéployer l'Edge Function. La fonction « scan-doc »
// utilise ce texte s'il est fourni, sinon son prompt interne (repli). Pour ajuster ce que l'IA lit,
// modifier UNIQUEMENT ce texte ci-dessous.
FP.SCAN_PROMPT = [
  "Lis attentivement ce document de gestion de flotte (facture, permis de conduire, carte identite, carte grise, assurance, controle technique, etc.). Le document peut etre incline ou de travers : redresse-le mentalement.",
  "Identifie son type puis extrais les infos. Renvoie UNIQUEMENT un objet JSON valide, sans aucun texte autour, avec ces cles (mets null si l info est absente) :",
  "docType : un parmi facture, sinistre, permis, carte-identite, carte-grise, assurance, controle-technique, autre.",
  "date : date principale du document au format AAAA-MM-JJ (pour une facture, la date d emission).",
  "fournisseur : pour une facture, nom de la societe qui EMET la facture (souvent en haut avec un SIREN ou SIRET). Ce n est PAS le client TJMAX.",
  "numeroFacture, vehiculeImmat (plaque francaise AB-123-CD), km (entier sans espaces).",
  "montantHT, montantTVA, montantTTC (nombres a point decimal).",
  "description : courte, max 80 caracteres.",
  "AMENDE / AVIS DE CONTRAVENTION / PV - repere precisement :",
  "- numeroAvis : le numero de l avis, libelle 'Numero de l avis de contravention', en general EN HAUT A GAUCHE, ~10 chiffres. Recopie CHAQUE chiffre exactement (ne confonds pas 3 et 8, 0 et 6, 1 et 7).",
  "- CAS PARTICULIER FPS (Forfait de Post-Stationnement = 'Avis de paiement / Forfait de post-stationnement (FPS)', amende de stationnement) : le numero est sur la ligne 'Numero de l avis de paiement' sous la forme [longue reference 14 chiffres en bloc] [numero d avis en cases groupees NN N NNN NNN NNN] [Cle 2 chiffres]. Ex : '21590350100017  26 1 163 072 245  Cle 37'. Pour numeroAvis, prends le bloc en cases groupees SUIVI de la Cle, en CONSERVANT LES ESPACES tels quels -> '26 1 163 072 245 37' (mais SANS le long prefixe '21590350100017'). Mets aussi la Cle seule ('37') dans le champ cle. Pour un FPS : motif = 'Stationnement', points = 0 (un FPS ne retire jamais de point), et montant = 'Le montant du FPS du est egal a : XX euros'.",
  "- motif : nature de l infraction (ex Exces de vitesse, Stationnement, Feu rouge, Telephone au volant, Ceinture).",
  "- points : LIS EN PRIORITE la section 'Effet(s) sur le permis de conduire' de l avis. Si elle indique que l infraction 'n entraine pas de retrait de point' -> renvoie 0. Si elle indique un nombre de points retires -> ce nombre. SEULEMENT si cette section est absente, estime via le bareme (exces de vitesse selon le depassement RETENU : <20=1, 20 a 29=2, 30 a 39=3, 40 a 49=4, >=50=6 ; telephone tenu en main=3 ; feu rouge=4 ; stop=4 ; ceinture=3 ; distance de securite=3 ; sens interdit=4 ; stationnement/voie de bus=0). En cas de doute, mets null.",
  "- vitesseRetenue : la VITESSE RETENUE apres marge technique, souvent ecrite 'la vitesse retenue est de : XX km/h' EN BAS de la description. C est ELLE qui compte, PAS la vitesse mesuree par le radar. vitesseLimite : la vitesse maximale autorisee. Ex : radar 96 km/h, 'vitesse retenue est de 91 km/h', limite 90 -> vitesseRetenue 91, vitesseLimite 90. Nombres sans 'km/h'.",
  "- date : la DATE DE L AVIS de contravention = sa date d edition / d envoi (souvent en haut a droite, 'le JJ/MM/AAAA' ou 'Avis edite le'). Ce n est PAS la date de l infraction, ni la date du jour.",
  "- montantTTC : le montant a payer, dans la section 'Montant de l amende' EN BAS de l avis. Il y a souvent 3 montants : amende forfaitaire (ex 68), montant MINORE 'ramene a' si paiement rapide (ex 45), montant MAJORE (ex 180). Mets le montant MINORE s il existe, sinon le forfaitaire. C est un PETIT montant (en general entre 11 et 1500 euros). NE prends JAMAIS comme montant un numero d avis, de telepaiement, de telephone, une reference, un code, une annee ou un code postal.",
  "- vehiculeImmat : la plaque.",
  "- numeroTelepaiement : le numero de telepaiement pour payer en ligne. Il est sur la NOTICE / CARTE DE PAIEMENT (souvent une AUTRE PAGE du document, pas la 1re), sous le libelle 'N° de telepaiement'. C'est ~10 a 14 chiffres. Donne UNIQUEMENT les chiffres, sans espaces.",
  "- cle : la 'Cle' (de telepaiement) associee, en general 2 chiffres, juste a cote du numero de telepaiement.",
  "CONTROLE TECHNIQUE (proces-verbal de controle technique automobile) :",
  "- controleTechniqueProchain : la date du PROCHAIN controle technique / fin de validite (souvent 'Prochain controle technique avant le JJ/MM/AAAA', 'visite a effectuer avant le', 'valable jusqu au'). Format AAAA-MM-JJ. C est une date FUTURE.",
  "- date : pour un controle technique, la date a laquelle le controle a ete EFFECTUE (date de la visite).",
  "PERMIS - distingue bien les rubriques numerotees : rubrique 3 = DATE DE NAISSANCE (ne l utilise JAMAIS comme date du permis). rubrique 4a = date de delivrance du permis = permisObtention. rubrique 4b = date d expiration = permisExpiration. rubrique 5 = numero du permis = permisNumero. rubrique 9 = categories = permisType.",
  "dateNaissance : la DATE DE NAISSANCE = RUBRIQUE 3 du permis (ou la date de naissance d une carte d identite / titre de sejour). Format AAAA-MM-JJ. C est une date passee (personne agee d environ 16 a 100 ans). Ne la confonds PAS avec la date de delivrance (4a) ni d expiration (4b).",
  "permisNumero : RUBRIQUE 5 uniquement (ex 16AQ28381, 9 a 12 caracteres). N utilise JAMAIS la longue ligne tout en bas (zone machine qui commence par D1FRA).",
  "permisObtention (4a) est toujours bien POSTERIEURE a la date de naissance (4a apres la rubrique 3). Si la date que tu allais mettre en permisObtention est egale ou proche de la rubrique 3, c est une erreur : reprends la 4a, ou mets null. permisExpiration = 4b du RECTO uniquement (jamais les dates par categorie du verso).",
  "idNumero (numero de carte identite ou titre de sejour), idExpiration (AAAA-MM-JJ).",
  "personne : nom complet de la personne sur le document (permis, carte identite), sinon null.",
  "REGLES DATES : format europeen jour/mois/annee. Ex 11.03.2030 = 11 mars 2030 = 2030-03-11 (n inverse JAMAIS le jour et le mois). Convertis aussi les dates en lettres.",
  "IMPORTANT : remplis le MAXIMUM de champs. Une valeur PRESENTE sur le document doit TOUJOURS etre remplie, meme si elle est petite, penchee, de travers ou de qualite moyenne : fais l effort de la dechiffrer. Ne mets null QUE si l information est vraiment ABSENTE du document, ou totalement illisible (coupee, barbouillee, trop floue pour toute lecture serieuse). Distinction clef : 'difficile a lire mais presente' = tu la lis et tu la remplis ; 'absente ou illisible' = null. Tu ne dois JAMAIS INVENTER une valeur qui n est pas ecrite (surtout pas une date, un montant, un nom de conducteur) ni mettre la date du jour. Si tu hesites entre deux lectures possibles d une valeur PRESENTE, choisis la plus plausible plutot que de laisser vide. Verifie chaque date (jour/mois/annee) avant de repondre.",
  "Montants sans symbole euro ni separateur de milliers (ex 1466.48).",
].join("\n");

// Prompt IA SPÉCIFIQUE carte grise (lecture directe de l'image/PDF via l'Edge Function scan-doc).
// Bien plus fiable que le regex local, surtout pour le VIN (champ E) et le modèle (D.3).
FP.CG_SCAN_PROMPT = [
  "Lis attentivement cette CARTE GRISE (certificat d immatriculation francais). Redresse mentalement l image si elle est inclinee ou de travers.",
  "Renvoie UNIQUEMENT un objet JSON valide, sans aucun texte autour, avec ces cles (mets null si l info est absente ou illisible) :",
  "docType : toujours 'carte-grise'.",
  "immat : plaque, champ A, au format AB-123-CD.",
  "dateMiseEnCirculation : date de 1re mise en circulation, champ B, format AAAA-MM-JJ (jour/mois/annee europeen).",
  "marque : champ D.1 (ex HYUNDAI, RENAULT, PEUGEOT).",
  "modele : denomination commerciale, champ D.3 (ex KONA, CLIO, 208).",
  "vin : numero d identification du vehicule, champ E. EXACTEMENT 17 caracteres (lettres majuscules + chiffres, SANS espace). Les lettres I, O et Q n existent JAMAIS dans un VIN (ce sont des 1 ou des 0). Recopie chaque caractere avec le plus grand soin ; si tu n es pas certain d un caractere, relis plutot que de deviner.",
  "puissanceFiscale : puissance fiscale en CV, champ P.6, entier.",
  "carburant : type d energie, champ P.3. Renvoie le libelle clair : Essence (ES), Diesel (GO/gazole), Electrique (EL), Hybride (EE/HE/GL), GPL (GP), GNV (GN).",
  "co2 : emissions de CO2 en g/km, champ V.7, entier.",
  "masse : masse en ordre de marche en kg, champ G, entier (PAS la masse en charge G.1).",
  "prochainCT : date du prochain controle technique, champ X.1 (souvent ecrit 'X.1' ou 'Visite technique avant le' / 'Visite avant le' ou 'Date limite de validite'). Format AAAA-MM-JJ (date FUTURE). Si le champ X.1 est absent (vehicule neuf jamais controle), mets null.",
  "categorie : d apres le genre national J.1 et la carrosserie, renvoie une categorie SIMPLE parmi : Citadine, Berline, Break, SUV, Monospace, Utilitaire ; sinon null.",
  "IMPORTANT : ne devine ni n invente aucune valeur ; un champ illisible = null. Dates au format europeen jour/mois/annee (ex 05.11.2021 = 2021-11-05).",
].join("\n");

// Lecture IA d'un document via l'Edge Function sécurisée « scan-doc » (Haiku).
// Renvoie un objet de champs { date, fournisseur, numeroFacture, vehiculeImmat, km,
// montantHT, montantTVA, montantTTC, description } ou null si indisponible/échec
// (dans ce cas l'appelant retombe sur le lecteur local). La clé API reste côté
// serveur : on n'envoie que le fichier + le type de document.
FP.scanIA = async function (file, docType, promptOverride) {
  try {
    if (!file || !(FP.supabase && FP.supabase.functions)) return null;
    // Les permis/CI sont souvent des PHOTOS lourdes : on les allège avant l'envoi
    // (sinon l'API refuse l'image ou le transfert échoue). Les PDF passent tels quels.
    let f = file;
    if (/^image\//i.test(file.type || '') && FP.compressImage) {
      // Résolution plus haute pour l'OCR des documents denses (avis d'amende : montant/n° en petit)
      try { f = await FP.compressImage(file, { maxSide: 2200, quality: 0.85 }); } catch (_) { f = file; }
    }
    // base64 (sans le préfixe data:)
    const b64 = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => { const s = String(r.result || ''); resolve(s.slice(s.indexOf(',') + 1)); };
      r.onerror = reject;
      r.readAsDataURL(f);
    });
    const mediaType = f.type || (/\.pdf$/i.test(f.name || '') ? 'application/pdf' : 'image/jpeg');
    const payload = { fileBase64: b64, mediaType, docType: docType || 'facture', prompt: promptOverride || FP.SCAN_PROMPT };
    // Le nom de l'Edge Function est sensible à la casse côté serveur. On essaie les
    // variantes courantes pour que ça marche quelle que soit la façon dont elle a été créée.
    const names = ['scan-doc', 'Scan-doc'];
    for (const name of names) {
      try {
        const { data, error } = await FP.supabase.functions.invoke(name, { body: payload });
        if (!error && data && data.ok && data.fields) { FP._scanFn = name; return data.fields; }
      } catch (_) { /* essaie le nom suivant */ }
    }
    return null;
  } catch (e) {
    console.warn('[FP.scanIA] indisponible :', e && (e.message || e));
    return null;
  }
};
FP.uploadScan = async function (file, folder, opts) {
  opts = opts || {};
  if (!FP.supabase || !FP.supabase.storage) throw new Error('Stockage indisponible (Supabase non chargé).');
  if (!file) return null;
  file = await FP.compressImage(file); // photos allégées ; PDF intacts
  const extMatch = (file.name || '').match(/\.[a-z0-9]+$/i);
  const ext = extMatch ? extMatch[0].toLowerCase() : (file.type === 'application/pdf' ? '.pdf' : '.jpg');
  let path, named = false;
  // opts.name : nomme le fichier de façon lisible (ex. n° de contravention) au lieu d'un nom aléatoire
  const slug = opts.name ? String(opts.name).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) : '';
  if (slug) { path = `${folder || 'divers'}/${slug}${ext}`; named = true; }
  else { const rand = Math.random().toString(36).slice(2, 8); path = `${folder || 'divers'}/${Date.now()}-${rand}${ext}`; }
  const { error } = await FP.supabase.storage.from(FP.SCAN_BUCKET).upload(path, file, {
    upsert: named, // un fichier nommé (n° d'avis) remplace l'ancien ; un aléatoire ne doit jamais écraser
    contentType: file.type || 'application/octet-stream',
  });
  if (error) throw error;
  const { data } = FP.supabase.storage.from(FP.SCAN_BUCKET).getPublicUrl(path);
  return (data && data.publicUrl) || null;
};

// === Sauvegarde complète : exporte TOUTES les données en un fichier JSON (anti-perte) ===
// Récupère chaque table en direct (l'admin voit tout via la RLS) + les réglages, et télécharge
// un fichier daté. À garder précieusement (Drive, disque…). Réimportable si besoin.
FP.exportBackup = async function () {
  if (!(FP.supabase && FP.db)) { alert('Connexion requise pour exporter.'); return; }
  const tables = ['vehicules', 'amendes', 'factures', 'conducteurs', 'documents', 'emprunts'];
  const out = { app: 'Parc Pilot', exportedAt: new Date().toISOString() };
  for (const t of tables) {
    try { const r = await FP.supabase.from(t).select('*'); out[t] = (r && r.data) || []; }
    catch (e) { out[t] = []; }
  }
  try { out.reglages = FP.settings.get(); } catch (e) {}
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `parc-pilot-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return out;
};

// === Documents privés : ouverture via un lien temporaire SIGNÉ (sécurité + RGPD) ===
// Quand le bucket "scans" est privé, les URL "…/object/public/scans/…" ne marchent plus.
// On extrait le chemin du fichier et on génère un lien signé (valable quelques minutes),
// réservé à l'utilisateur connecté. Si le bucket est resté public, le lien d'origine marche
// quand même (repli) → aucun risque de coupure.
FP.scanPath = (url) => { const m = String(url || '').match(/\/scans\/([^?]+)/); return m ? decodeURIComponent(m[1]) : null; };
FP.signedScanUrl = async (url) => {
  try {
    const path = FP.scanPath(url);
    if (!path || !(FP.supabase && FP.supabase.storage)) return url;
    const { data, error } = await FP.supabase.storage.from(FP.SCAN_BUCKET).createSignedUrl(path, 180);
    return (error || !data || !data.signedUrl) ? url : data.signedUrl;
  } catch (e) { return url; }
};
// Ouvre un document : lien signé si c'est un fichier du bucket, sinon ouverture normale.
FP.openScan = (url) => {
  if (!url) return;
  if (!/\/scans\//.test(url)) { window.open(url, '_blank', 'noopener'); return; }
  const w = window.open('', '_blank'); // ouvert TOUT DE SUITE (dans le geste de clic → pas bloqué)
  FP.signedScanUrl(url).then(u => { if (w) { try { w.opener = null; } catch (e) {} w.location = u; } else { location.href = u; } });
};
// Intercepte les clics sur les liens « Voir / Ouvrir » d'un document → ouverture signée.
document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a[href]');
  if (!a) return;
  const href = a.getAttribute('href') || '';
  if (!/\/scans\//.test(href)) return; // seulement les fichiers stockés (pas les liens Drive, etc.)
  e.preventDefault();
  FP.openScan(href);
}, true);

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
  // Extraction de la couche texte d'un PDF (si le PDF n'est pas une simple image) — fiable, sans OCR.
  async pdfToText(file, maxPages = 3) {
    await this.loadScript(this.PDFJS_CDN);
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = this.PDFJS_WORKER;
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    let out = '';
    const n = Math.min(pdf.numPages, maxPages);
    for (let p = 1; p <= n; p++) { const page = await pdf.getPage(p); const tc = await page.getTextContent(); out += tc.items.map(i => i.str).join(' ') + '\n'; }
    return out;
  },
  async fileToText(file, maxPages) {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
    // 1) PDF avec texte intégré (PV, cartes grises de leasing, factures…) → lecture EXACTE sans OCR
    // maxPages : par défaut 3 (factures simples) ; passer un grand nombre pour lire tout le document (ex. relevés Ulys multi-pages).
    if (isPdf) {
      try { const t = await this.pdfToText(file, maxPages || 3); if (t && t.replace(/\s/g, '').length > 80) return t; } catch (e) { console.warn('[pdfToText]', e); }
    }
    // 2) Sinon (image, ou PDF scanné sans texte) → OCR Tesseract multilingue
    await this.loadScript(this.TESSERACT_CDN);
    const image = isPdf ? await this.pdfToCanvas(file) : file;
    const worker = await Tesseract.createWorker('fra+ita+deu+nld');
    try { const { data } = await worker.recognize(image); return data.text || ''; }
    finally { await worker.terminate(); }
  },
};

// ================= DÉTECTION DE DOUBLONS (toute la plateforme) =================
// Un helper unique pour éviter d'ajouter deux fois le même élément (factures, amendes,
// véhicules, conducteurs, emprunts, sinistres). Chaque table a sa règle d'identité.
//   • FP.dupe.find(table, rec, list)  → l'enregistrement existant en doublon, ou null.
//   • FP.dupe.confirmAdd(table, rec, list) → true si on peut ajouter (pas de doublon, ou
//     l'utilisateur confirme malgré tout). Sert de garde AVANT chaque insertion.
FP.dupe = {
  _n(s){ return (s == null ? '' : String(s)).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''); },
  _num(v){ if (v == null || v === '') return null; const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? null : n; },
  _amtEq(a, b){ const x = this._num(a), y = this._num(b); return x != null && y != null && Math.abs(x - y) < 0.01; },
  _same(a, b){ return a && b && a === b; },
  find(table, rec, list){
    if (!rec) return null;
    list = list || [];
    const n = (s) => this._n(s);
    const notSelf = (o) => o !== rec && !(rec.id != null && o.id === rec.id);
    switch (table){
      case 'factures': {
        // Doublon SÛR = même n° de facture ET même montant TTC. À défaut de n°, on retombe sur
        // fournisseur + TTC + date. (Durci sur demande : le n° seul ne suffit pas, on exige le montant.)
        const num = n(rec.numeroFacture), ttc = this._num(rec.montantTTC), four = n(rec.fournisseur), date = rec.date || null;
        return list.find(f => {
          if (!notSelf(f)) return false;
          if (num && num.length >= 4 && n(f.numeroFacture) === num){
            // même n° : si les deux ont un TTC, il doit coïncider ; sinon on considère doublon (même n°)
            if (ttc != null && f.montantTTC != null) return this._amtEq(f.montantTTC, ttc);
            return true;
          }
          return ttc != null && date && four && this._amtEq(f.montantTTC, ttc) && this._same(f.date, date) && n(f.fournisseur) === four;
        }) || null;
      }
      case 'amendes': {
        // Même n° d'avis (+ montant si dispo), sinon prénom + date + montant.
        const av = n(rec.numeroAvis), mt = this._num(rec.montant), pre = n(rec.prenom), date = rec.date || null;
        return list.find(a => {
          if (!notSelf(a)) return false;
          if (av && av.length >= 4 && n(a.numeroAvis) === av){
            if (mt != null && a.montant != null) return this._amtEq(a.montant, mt);
            return true;
          }
          return pre && date && mt != null && n(a.prenom) === pre && this._same(a.date, date) && this._amtEq(a.montant, mt);
        }) || null;
      }
      case 'vehicules': {
        const im = n(rec.immat); if (!im) return null;
        return list.find(v => notSelf(v) && n(v.immat) === im) || null;
      }
      case 'conducteurs': {
        const key = n(rec.key), nom = n((rec.name || '') + ' ' + (rec.nom || ''));
        return list.find(c => { if (!notSelf(c)) return false; if (key && n(c.key) === key) return true; return nom && nom.length >= 3 && n((c.name || '') + ' ' + (c.nom || '')) === nom; }) || null;
      }
      case 'emprunts': {
        const veh = n(rec.vehicule || rec.vehiculeId || rec.immat);
        const cond = n(rec.conducteur || rec.emprunteur);
        const deb = rec.dateDebut || rec.debut || rec.dateEmprunt || rec.date || null;
        if (!veh || !deb) return null;
        return list.find(e => notSelf(e)
          && n(e.vehicule || e.vehiculeId || e.immat) === veh
          && n(e.conducteur || e.emprunteur) === cond
          && this._same(e.dateDebut || e.debut || e.dateEmprunt || e.date, deb)) || null;
      }
      default: return null;
    }
  },
  _label(table){ return { factures:'Une facture', amendes:'Une amende', vehicules:'Un véhicule', conducteurs:'Un conducteur', emprunts:'Un emprunt' }[table] || 'Un élément'; },
  _tag(d){ return d.numeroFacture ? ' n° ' + d.numeroFacture : d.numeroAvis ? ' avis ' + d.numeroAvis : d.immat ? ' ' + d.immat : (d.name || d.prenom) ? ' ' + (d.name || d.prenom) : ''; },
  // Garde AVANT insertion : renvoie false si l'utilisateur refuse d'ajouter un doublon.
  confirmAdd(table, rec, list){
    const d = this.find(table, rec, list);
    if (!d) return true;
    const extra = d.montantTTC != null ? ' · ' + FP.euro(d.montantTTC) : d.montant != null ? ' · ' + FP.euro(d.montant) : '';
    return confirm(`⚠️ Doublon possible\n\n${this._label(table)} identique semble déjà exister (${this._tag(d).trim()}${extra}).\n\nL'ajouter quand même ?`);
  },
};

// ---- Helpers factures : dates en toutes lettres (FR/IT/DE/NL/EN) + montants par libellé ----
const _MONTHS = {
  janvier:1,fevrier:2,mars:3,avril:4,mai:5,juin:6,juillet:7,aout:8,septembre:9,octobre:10,novembre:11,decembre:12,
  gennaio:1,febbraio:2,marzo:3,aprile:4,maggio:5,giugno:6,luglio:7,agosto:8,settembre:9,ottobre:10,dicembre:12,
  januar:1,februar:2,marz:3,april:4,juni:6,juli:7,august:8,september:9,oktober:10,november:11,dezember:12,
  januari:1,februari:2,maart:3,mei:5,augustus:8,december:12,
  january:1,february:2,march:3,may:5,june:6,july:7,october:10,
};
const _stripAcc = s => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const _toIso2 = (d, mo, y) => { y = +y; if (y < 100) y += 2000; return `${y}-${String(+mo).padStart(2, '0')}-${String(+d).padStart(2, '0')}`; };
function _normAmount(raw) {
  let s = String(raw).replace(/[\s €$]/g, '');
  if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); // 1.258,88 → 1258.88
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}
// Montant juste après un libellé (Total TTC, Total HT…) — on prend le dernier nombre de la ligne (ou la suivante)
function _amountNear(raw, labelRe) {
  const lines = (raw || '').split(/\r?\n/);
  const amtRe = /(\d{1,3}(?:[ .]\d{3})+(?:[.,]\d{2})?|\d+[.,]\d{2})/g;
  const sameLine = [], nextLine = [];
  for (let i = 0; i < lines.length; i++) {
    if (!labelRe.test(lines[i])) continue;
    let ms = lines[i].match(amtRe);
    if (ms && ms.length) { const n = _normAmount(ms[ms.length - 1]); if (n != null) { sameLine.push(n); continue; } }
    ms = (lines[i + 1] || '').match(amtRe);
    if (ms && ms.length) { const n = _normAmount(ms[ms.length - 1]); if (n != null) nextLine.push(n); }
  }
  // Le montant du RÉCAPITULATIF est sur la même ligne que le libellé (≠ en-tête de colonne « Total HT »).
  if (sameLine.length) return sameLine[sameLine.length - 1];
  if (nextLine.length) return nextLine[nextLine.length - 1];
  return null;
}
// Date de facture : priorité à « date d'émission / facture / data / datum » ; gère les mois en lettres
function _invoiceDate(raw) {
  const text = (raw || ''), up = text.toUpperCase();
  const kw = '(?:DATE\\s*D.?[EÉ]MISSION|DATE\\s*(?:DE\\s*)?FACTURE|\\bDATA\\b|\\bDATUM\\b|RECHNUNGSDATUM|INVOICE\\s*DATE)';
  let m = up.match(new RegExp(kw + '[^\\d]{0,30}(\\d{1,2})[\\/.\\-](\\d{1,2})[\\/.\\-](\\d{2,4})'));
  if (m) return _toIso2(m[1], m[2], m[3]);
  m = text.match(new RegExp('(?:[EÉ]MISSION|FACTURE|\\bDATA\\b|\\bDATUM\\b|RECHNUNGSDATUM)[^\\d]{0,30}(\\d{1,2})\\s+([A-Za-zÀ-ÿ]{3,12})\\.?\\s+(\\d{4})', 'i'));
  if (m) { const mo = _MONTHS[_stripAcc(m[2])]; if (mo) return _toIso2(m[1], mo, m[3]); }
  return null;
}

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
  // Une VRAIE facture (mot « Facture » + un récapitulatif Total TTC/TVA/HT) est prioritaire :
  // sinon une facture qui MENTIONNE « contrôle technique » (prestation) finissait classée en CT.
  const factureFort = /\bFACTURE\b|\bFATTURA\b|\bRECHNUNG\b|\bFACTUUR\b|\bINVOICE\b/.test(text)
    && /TOTAL\s*TTC|MONTANT\s*TTC|TOTAL\s*TVA|NET\s+[AÀ]\s+PAYER|TOTALE\s*:?\s*€|\bTOTAAL\b|GESAMTBETRAG/.test(text);
  if (/PRISE\s+EN\s+CHARGE|\bSINISTRE\b|PARE.?BRISE|BRIS\s+DE\s+GLACE|POINTS?\s+DE\s+CHOC|\bVRADE\b/.test(text)) out.type = 'sinistre';
  else if (factureFort) out.type = 'facture';
  else if (/PV\s+DE\s+LIVRAISON|PROC[EÈ]S[-\s]?VERBAL\s+DE\s+LIVRAISON|BON\s+DE\s+LIVRAISON/.test(text)) out.type = 'pv';
  else if (/CONTR[OÔ]LE\s+TECHNIQUE|PROC[EÈ]S[-\s]?VERBAL|PROCHAIN\s+CONTR|FAVORABLE|D[EÉ]FAVORABLE/.test(text)) out.type = 'controle-technique';
  else if (/CERTIFICAT\s+D.?IMMATRICULATION|CARTE\s+GRISE/.test(text)) out.type = 'carte-grise';
  else if (/ATTESTATION\s+D.?ASSURANCE|CARTE\s+VERTE|\bASSURANCE\b/.test(text)) out.type = 'assurance';
  else if (/CARTE\s+NATIONALE\s+D.?IDENTIT|CARTE\s+D.?IDENTIT|\bIDENTITY\s+CARD\b|CARTA\s+D.?IDENTIT|PERSONALAUSWEIS|IDENTITEITSKAART/.test(text)) out.type = 'carte-identite';
  else if (/PERMIS\s+DE\s+CONDUIRE|DRIVING\s+LICEN|F[UÜ]HRERSCHEIN|RIJBEWIJS|PERMESSO\s+DI\s+GUIDA/.test(text)) out.type = 'permis';
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
  } else if (out.type === 'facture' || out.type === 'sinistre') {
    // Date de facture : « date d'émission/facture » en priorité (chiffres OU mois en lettres),
    // sinon la PLUS ANCIENNE date plausible (évite d'attraper une date de garantie/échéance tardive).
    out.date = _invoiceDate(rawText) || (allDates.length ? allDates.map(d => d.iso).sort()[0] : null);
  } else if (allDates.length) {
    out.date = allDates.map(d => d.iso).sort().slice(-1)[0];
  }

  // --- Permis de conduire : numéro, catégories, dates d'obtention / d'expiration ---
  if (out.type === 'permis') {
    const nm = text.match(/\b(\d{2}[A-Z]{2}\d{5,6})\b/) || text.match(/\b(\d{12,15})\b/);
    if (nm) out.permisNumero = nm[1];
    const cats = text.match(/\b(AM|A1|A2|B1|BE|C1E|C1|CE|D1E|D1|DE|A|B|C|D)\b/g);
    if (cats && cats.length) out.permisType = [...new Set(cats)].join('/');
    // Dates : on lit en PRIORITÉ les rubriques 4a (délivrance/obtention) et 4b (expiration).
    // (le « [^\dA-Z]{0,5} » autorise « . », espaces, « : » mais s'arrête avant la lettre suivante,
    //  donc 4a ne « déborde » pas sur 4b.)
    const m4a = text.match(/4\s*A[^\dA-Z]{0,5}(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2,4})/);
    const m4b = text.match(/4\s*B[^\dA-Z]{0,5}(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2,4})/);
    if (m4a) out.permisObtention = toIso(m4a[1], m4a[2], m4a[3]);
    if (m4b) out.permisExpiration = toIso(m4b[1], m4b[2], m4b[3]);
    // Repli heuristique si 4a/4b sont illisibles à l'OCR
    const pd = [...text.matchAll(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/g)]
      .map(d => toIso(d[1], d[2], d[3])).filter(iso => { const y = +iso.slice(0, 4); return y >= 1960 && y <= 2050; });
    const uniq = [...new Set(pd)].sort();
    const today = new Date().toISOString().slice(0, 10);
    const fut = uniq.filter(d => d > today), past = uniq.filter(d => d <= today);
    if (!out.permisExpiration && fut.length) out.permisExpiration = fut[fut.length - 1];
    if (!out.permisObtention && past.length) out.permisObtention = past[0];
    // Si l'expiration reste introuvable : un permis (cat. A/B) est valable 15 ans → obtention + 15 ans
    if (out.permisObtention && !out.permisExpiration) {
      const p = out.permisObtention.split('-'); out.permisExpiration = `${(+p[0]) + 15}-${p[1]}-${p[2]}`;
    }
  }

  // --- Carte d'identité : numéro (best effort) + date d'expiration ---
  if (out.type === 'carte-identite') {
    const idDates = [...text.matchAll(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/g)]
      .map(d => toIso(d[1], d[2], d[3])).filter(iso => { const y = +iso.slice(0, 4); return y >= 2000 && y <= 2045; });
    const fut = [...new Set(idDates)].sort().filter(d => d > new Date().toISOString().slice(0, 10));
    if (fut.length) out.idExpiration = fut[fut.length - 1];
    const nm = text.match(/\b([0-9A-Z]{9,14})\b/);
    if (nm) out.idNumero = nm[1];
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
  // « 14 768 KMS », « 89 548 KM », « KM : 8276 », « KMS 12000 »… (tolère le « S » du pluriel)
  if (km == null) { const kmM = text.match(/(\d[\d\s.]{2,})\s*KMS?\b/) || text.match(/\bKMS?\s*[:\.]?\s*(\d[\d\s.]{2,})/); if (kmM) { const n = cleanNum(kmM[1]); if (n > 100 && n < 2000000) km = n; } }
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
  // Lecture PRÉCISE par libellé (Total HT / Total TVA / Total TTC) — prioritaire sur l'heuristique.
  const _ht = _amountNear(rawText, /TOTAL\s*HT|MONTANT\s*HT|TOTALE\s*IMPONIBILE|\bIMPONIBILE\b|NETTOBETRAG/i);
  const _tva = _amountNear(rawText, /TOTAL\s*(?:DE\s*)?T\.?\s?V\.?\s?A|TOTALE\s*IVA|\bMWST\b|\bBTW\b/i);
  const _ttc = _amountNear(rawText, /TOTAL\s*TTC|NET\s*[AÀ]\s*PAYER|TOTAL\s*[AÀ]\s*PAYER|TOTALE\s*:?\s*€|GESAMTBETRAG|\bTOTAAL\b|TE\s*BETALEN/i);
  if (_ht != null) out.montantHT = _ht;
  if (_tva != null) out.montantTVA = _tva;
  if (_ttc != null) out.montantTTC = _ttc;
  // Numéro de facture
  const _nf = rawText.match(/(?:Num[eé]ro|Facture\s*n[°ºo]?|N[°ºo]\s*(?:de\s*)?facture|Fattura\s*n[°ºo.]?|Rechnung(?:snummer)?|Invoice\s*(?:no|number))\s*[:.]?\s*([A-Z0-9][A-Z0-9\/\-]{2,})/i);
  if (_nf) out.numeroFacture = _nf[1].trim();
  // Fournisseur : 1ʳᵉ ligne « société » juste après « Émetteur / Fornitore / Lieferant »
  const _ls = rawText.split(/\r?\n/);
  for (let i = 0; i < _ls.length; i++) {
    if (/[ÉE]METTE|FORNITORE|LIEFERANT/i.test(_ls[i])) {
      for (let j = i + 1; j < Math.min(i + 4, _ls.length); j++) {
        const c = (_ls[j] || '').trim();
        if (c.length >= 3 && /[A-Za-zÀ-ÿ]/.test(c)) { out.fournisseur = c.slice(0, 60); break; }
      }
      break;
    }
  }

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
  // Masse en ORDRE DE MARCHE (champ G, PAS le poids à vide G.1) — kg — sert au verdict
  // stationnement Paris (≤ 2 t). Sur la carte grise, le champ G est la valeur qui précède
  // « G.1 » (les deux sont parfois séparés par « J M1 »). On ancre donc sur : G <valeur> … G.1.
  let gm = text.match(/\bG\b[^0-9A-Za-z]{0,6}(\d[\d ]{2,5})[\s\S]{0,22}?G\s*[.,]?\s*1\b/);
  if (!gm) gm = text.match(/MASSE\s+(?:EN\s+)?ORDRE\s+DE\s+MARCHE[^0-9]{0,20}(\d[\d .]{2,6})/);
  if (gm) { const n = parseInt(String(gm[1]).replace(/[ .]/g, ''), 10); if (n >= 500 && n < 8000) out.masse = n; }
  // Date de 1re mise en circulation (champ B) → AAAA-MM-JJ
  const mkIso = (d, m, y) => y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  const bm = text.match(/1(?:ERE|RE|E)?\s*IMMATRICULATION[\s\S]{0,28}?(\d\d?)[.\/-](\d\d?)[.\/-](\d{4})/);
  if (bm && +bm[3] >= 1980 && +bm[3] <= 2100) out.dateMiseEnCirculation = mkIso(bm[1], bm[2], bm[3]);
  // Prochain contrôle technique (champ X.1 « VISITE AVANT LE ») → AAAA-MM-JJ
  const xm = text.match(/VISITE\s+AVANT\s+LE[^0-9]{0,10}(\d\d?)[.\/-](\d\d?)[.\/-](\d{4})/);
  if (xm && +xm[3] >= 2000 && +xm[3] <= 2100) out.prochainCT = mkIso(xm[1], xm[2], xm[3]);
  // Puissance fiscale (CV)
  const cvm = text.match(/\b(\d{1,2})\s*CV\b/);
  if (cvm) { const n = +cvm[1]; if (n > 0 && n < 100) out.puissanceFiscale = n; }
  // VIN / n° de châssis — priorité au libellé « châssis » (plus fiable que le 1er bloc de 17 car.)
  const chassisM = text.match(/CH[AÂ]SSIS\s*[:\s°N]*([A-HJ-NPR-Z0-9]{15,18})/) || text.match(/\bVIN\s*[:\s]*([A-HJ-NPR-Z0-9]{15,18})/);
  if (chassisM) out.vin = chassisM[1];
  else { const vinm = text.match(/\b([A-HJ-NPR-Z0-9]{17})\b/); if (vinm) out.vin = vinm[1]; }
  // Puissance DIN (chevaux réels — ex. PV : « 239 chevaux ») — à ne pas confondre avec les CV fiscaux
  const dinm = text.match(/\b(\d{2,4})\s*(?:CHEVAUX|CH\b|CH DIN|CV DIN)/);
  if (dinm) { const n = +dinm[1]; if (n >= 30 && n < 2000) out.puissanceDin = n; }
  // Carburant
  if (/\bHYBRID|HEV|PHEV/.test(text)) out.carburant = 'Essence / Hybride';
  else if (/[ÉE]LECTRIQUE|\bELEC\b|\bEV\b/.test(text)) out.carburant = 'Électrique';
  else if (/DIESEL|GAZOLE|\bGO\b/.test(text)) out.carburant = 'Diesel';
  else if (/\bESSENCE\b/.test(text)) out.carburant = 'Essence';
  // Catégorie / carrosserie (ex. PV : « … SUV … »)
  if (/\bSUV\b|4X4|CROSSOVER/.test(text)) out.categorie = 'SUV';
  else if (/\bBERLINE\b/.test(text)) out.categorie = 'Berline';
  else if (/\bBREAK\b/.test(text)) out.categorie = 'Break';
  else if (/MONOSPACE/.test(text)) out.categorie = 'Monospace';
  else if (/UTILITAIRE|FOURGON|\bCTTE\b/.test(text)) out.categorie = 'Utilitaire';
  else if (/COUP[EÉ]/.test(text)) out.categorie = 'Coupé';
  else if (/CITADINE/.test(text)) out.categorie = 'Citadine';

  // --- Marque + modèle (ex. PV : « HYUNDAI TUCSON 1.6 HYBRID … ») ---
  const BRANDS = ['MERCEDES-BENZ','MERCEDES','LAND ROVER','ALFA ROMEO','VOLKSWAGEN','HYUNDAI','PEUGEOT','RENAULT','CITROEN','CITROËN','PORSCHE','TOYOTA','NISSAN','DACIA','VOLVO','SUZUKI','MAZDA','LEXUS','CUPRA','TESLA','SKODA','IVECO','DUCATI','OPEL','AUDI','BMW','FIAT','FORD','MINI','JEEP','SEAT','HONDA','KIA','BYD','MG','DS'];
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let brand = null;
  for (const b of BRANDS) { if (new RegExp('\\b' + esc(b) + '\\b').test(text)) { brand = b; break; } }
  if (brand) {
    out.marque = brand === 'VW' ? 'VOLKSWAGEN' : brand;
    const mm = text.match(new RegExp(esc(brand) + '\\s+([A-Z0-9ÉÈÀ\\- ]{2,40})'));
    if (mm) {
      const STOP = /^(SUV|VP|VU|BERLINE|BREAK|MONOSPACE|HYBRID|HYBRIDE|DIESEL|ESSENCE|[ÉE]LECTRIQUE|AUTOMATIQUE|MANUELLE|BOITE|BOÎTE|CV|CH|NEUF|NEUVE)$/;
      const words = [];
      for (const w of mm[1].trim().split(/\s+/)) { if (/\d/.test(w) || STOP.test(w) || w.length < 2) break; words.push(w); if (words.length >= 3) break; }
      if (words.length) out.modele = words.join(' ');
    }
  }

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
      settings: JSON.parse(FP.settings._readLocal()),
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
    localStorage.setItem(FP.settings._key(), JSON.stringify(snap.settings));
    localStorage.setItem(FP.VEH_OVERRIDES_KEY, JSON.stringify(snap.overrides));
    if (snap.fpData && window.FP_DATA) {
      // Remplacement EN PLACE (même référence de tableau) — sinon les pages qui ont capté
      // data.vehicules au chargement gardent l'ancien tableau et affichent des données périmées.
      const replace = (arr, src) => { if (Array.isArray(arr) && Array.isArray(src)) { arr.length = 0; JSON.parse(JSON.stringify(src)).forEach(x => arr.push(x)); } };
      if (snap.fpData.vehicules) replace(window.FP_DATA.vehicules, snap.fpData.vehicules);
      if (snap.fpData.amendes)   replace(window.FP_DATA.amendes,   snap.fpData.amendes);
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
        <span class="fp-user-av" style="width:26px;height:26px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center"></span>
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

    // Afficher l'email + l'avatar de l'utilisateur connecté
    if (FP.auth) {
      FP.auth.getUser().then(user => {
        if (user && user.email) {
          FP._userEmail = user.email;
          try { localStorage.setItem('auto_flotte_last_user', user.email); } catch (e) {}
          const emailEl = div.querySelector('.fp-user-email');
          if (emailEl) emailEl.textContent = user.email;
        }
        const url = user && user.user_metadata && user.user_metadata.avatar_url;
        FP._avatarUrl = url || null;
        FP.renderUserAvatar();
      });
    }
  });
};
// (Ré)affiche l'avatar dans la sidebar : photo si l'utilisateur en a choisi une, sinon initiales.
FP.renderUserAvatar = () => {
  const url = FP._avatarUrl, email = FP._userEmail || '';
  const inner = url
    ? `<img src="${String(url).replace(/"/g, '&quot;')}" alt="" style="width:26px;height:26px;border-radius:50%;object-fit:cover">`
    : (FP.avatarHTML ? FP.avatarHTML(email, 26) : '');
  document.querySelectorAll('.fp-user-av').forEach(el => { el.innerHTML = inner; });
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
  q = FP.norm(q).trim();
  const inPagesFolder = window.location.pathname.includes('/pages/');
  const pref = inPagesFolder ? '' : 'pages/';
  const D = window.FP_DATA || {};
  const out = [];
  // texte de date « cherchable » : ISO + format FR (12/07/2026) → tape « 07/2026 » ou « 2026 »
  const dstr = (d) => d ? (d + ' ' + (FP.date ? FP.date(d) : '')) : '';
  const clip = (s, n) => (s && s.length > n) ? s.slice(0, n) + '…' : (s || '');
  // Recherche insensible aux tirets/espaces : « ff777xk » trouve « FF-777-XK ».
  const qc = q.replace(/[^a-z0-9]/g, '');
  const hit = (text) => text.includes(q) || (qc.length >= 2 && text.replace(/[^a-z0-9]/g, '').includes(qc));

  // Véhicules — plaque, marque, modèle, conducteur, VIN, ASSURANCE, propriétaire, catégorie, carburant, version
  (D.vehicules || []).forEach(v => {
    const text = FP.norm([v.immat, v.marque, v.modele, v.chauffeur, v.vin, v.assurance, v.proprietaire, v.categorie, v.carburant, v.version].filter(Boolean).join(' '));
    if (hit(text)) {
      out.push({ type: 'véh.', icon: '🚗', label: `${v.immat || ''} · ${v.marque || ''} ${v.modele || ''}`.trim(), sub: [v.chauffeur, v.assurance].filter(x => x && x !== '—').join(' · '), url: pref + 'vehicules.html?veh=' + encodeURIComponent(v.id) });
    }
  });
  // Conducteurs (fiche) — nom complet, e-mail, téléphone
  (D.conducteurs || []).forEach(c => {
    const nom = [c.prenom || c.name, c.nom].filter(Boolean).join(' ').trim() || c.name || c.key || '';
    const text = FP.norm([nom, c.email, c.telephone, c.tel, c.societe].filter(Boolean).join(' '));
    if (nom && hit(text)) {
      out.push({ type: 'conduct.', icon: '👤', label: nom, sub: c.email || c.telephone || c.tel || '', url: pref + 'conducteurs.html?cond=' + encodeURIComponent(c.key || nom) });
    }
  });
  // Amendes — conducteur, motif, n° avis, DATE
  (D.amendes || []).forEach(a => {
    const text = FP.norm([a.prenom, a.motif, a.numeroAvis, dstr(a.date)].filter(Boolean).join(' '));
    if (hit(text)) {
      out.push({ type: 'amende', icon: '🎫', label: `${a.prenom || ''} · ${a.motif || ''}`.trim(), sub: `${a.montant ? FP.euroPrecis(a.montant) : ''} · ${FP.date(a.date)}`, url: pref + 'amendes.html?amende=' + encodeURIComponent(a.id) });
    }
  });
  // Factures / sinistres — véhicule, GARAGE (fournisseur), description, n° facture, DATE
  (D.factures || []).forEach(f => {
    const text = FP.norm([f.vehiculeImmat, f.fournisseur, f.description, f.numeroFacture, f.type, dstr(f.date)].filter(Boolean).join(' '));
    if (hit(text)) {
      const isSin = f.type === 'sinistre';
      out.push({ type: f.type || 'fact.', icon: isSin ? '⚠️' : '📄', label: `${f.vehiculeImmat || ''} · ${f.fournisseur || ''}`.trim(), sub: [clip(f.description, 48), FP.date(f.date)].filter(Boolean).join(' · '), url: pref + (isSin ? 'sinistres.html' : 'factures.html?facture=' + encodeURIComponent(f.fileId || '')) });
    }
  });
  return out;
};

// === RECHERCHE INTELLIGENTE (réponses directes) ============================
// Détecte des intentions courantes et renvoie des « cartes réponse » (0 à 4),
// affichées EN TÊTE des résultats. 100 % client, déterministe (aucune clé/API).
FP.smartAnswers = (q) => {
  if (!q) return [];
  const raw = FP.norm(q).trim();
  if (raw.length < 2) return [];
  const compact = raw.replace(/[^a-z0-9]/g, '');
  const D = window.FP_DATA || {};
  const vehs = D.vehicules || [], facts = D.factures || [], am = D.amendes || [], conds = D.conducteurs || [];
  const pref = location.pathname.includes('/pages/') ? '' : 'pages/';
  const eur = n => FP.euro ? FP.euro(n) : Math.round(n) + ' €';
  const has = (...w) => w.some(x => raw.includes(x));
  const out = [];

  // 1) « combien de … »
  if (has('combien', 'nombre de', 'nb ')) {
    if (has('vehicule', 'voiture')) { const n = vehs.filter(v => !/vendu/i.test(v.statut || '')).length; out.push({ icon: '💡', label: `${n} véhicules actifs`, sub: 'dans la flotte', url: pref + 'vehicules.html' }); }
    if (has('amende')) out.push({ icon: '💡', label: `${am.length} amendes`, sub: 'enregistrées', url: pref + 'amendes.html' });
    if (has('facture')) out.push({ icon: '💡', label: `${facts.length} factures`, sub: 'enregistrées', url: pref + 'factures.html' });
    if (has('conducteur', 'chauffeur', 'salarie')) out.push({ icon: '💡', label: `${conds.length} conducteurs`, sub: 'enregistrés', url: pref + 'conducteurs.html' });
  }

  // 2) coût total d'un véhicule (plaque/modèle cité + mot « coût/dépense/total »)
  if (has('cout', 'total', 'depense', 'coute', 'combien')) {
    const v = vehs.find(v => {
      const imm = FP.norm(v.immat || ''); const immc = imm.replace(/[^a-z0-9]/g, '');
      const mod = FP.norm(v.modele || '');
      return (imm && (raw.includes(imm) || (immc.length >= 4 && compact.includes(immc)))) || (mod.length >= 4 && raw.includes(mod));
    });
    if (v) {
      const total = facts.filter(f => f.vehiculeImmat && FP.norm(f.vehiculeImmat) === FP.norm(v.immat)).reduce((s, f) => s + (+f.montantTTC || 0), 0);
      const nb = facts.filter(f => f.vehiculeImmat && FP.norm(f.vehiculeImmat) === FP.norm(v.immat)).length;
      out.push({ icon: '💶', label: `${eur(total)} — coût total ${v.immat}`, sub: `${v.marque || ''} ${v.modele || ''} · ${nb} facture${nb > 1 ? 's' : ''}`.trim(), url: pref + 'vehicules.html?veh=' + encodeURIComponent(v.id) });
    }
  }

  // 3) Contrôle technique : par mois, ou expirés
  const MOIS = { janvier: '01', fevrier: '02', mars: '03', avril: '04', mai: '05', juin: '06', juillet: '07', aout: '08', septembre: '09', octobre: '10', novembre: '11', decembre: '12' };
  if (has('ct', 'controle', 'technique')) {
    if (has('expire', 'depasse', 'perime', 'perimee')) {
      const l = vehs.filter(v => { if (FP.ctIgnored(v)) return false; const j = (v.prochainCT && v.prochainCT !== '—') ? FP.joursRestants(v.prochainCT) : null; return j !== null && j < 0; });
      out.push({ icon: '⚠️', label: `${l.length} CT dépassé${l.length > 1 ? 's' : ''}`, sub: l.slice(0, 4).map(v => v.immat).join(', ') || '—', url: pref + 'renouvellements.html' });
    } else {
      const mk = Object.keys(MOIS).find(m => raw.includes(m));
      if (mk) { const mm = MOIS[mk]; const l = vehs.filter(v => !FP.ctIgnored(v) && v.prochainCT && v.prochainCT.slice(5, 7) === mm); out.push({ icon: '🛠️', label: `${l.length} CT en ${mk}`, sub: l.slice(0, 4).map(v => v.immat).join(', ') || 'aucun', url: pref + 'renouvellements.html' }); }
    }
  }

  // 4) Carburant (mot seul ou en bord de requête)
  [['diesel', 'diesel'], ['essence', 'essence'], ['electrique', 'électriques'], ['hybride', 'hybrides']].forEach(([kw, lbl]) => {
    if (raw === kw || raw.startsWith(kw + ' ') || raw.endsWith(' ' + kw)) {
      const n = vehs.filter(v => FP.norm(v.carburant || '').includes(kw)).length;
      if (n) out.push({ icon: '⛽', label: `${n} véhicules ${lbl}`, sub: 'dans la flotte', url: pref + 'vehicules.html' });
    }
  });

  // 5) TVS / CO₂ (totaux flotte)
  if (has('tvs', 'taxe')) { const t = vehs.reduce((s, v) => { const d = FP.tvsDetail ? FP.tvsDetail(v) : null; return s + (d && d.applicable && d.total != null ? d.total : 0); }, 0); out.push({ icon: '🏛️', label: `${eur(t)} — TVS annuelle`, sub: 'estimée sur la flotte', url: pref + 'statistiques.html' }); }
  if (has('co2', 'carbone', 'emission')) { let g = 0; vehs.forEach(v => { const cat = (v.categorie || '').toLowerCase(); if (/moto|utilit|engin|remorque/.test(cat) || /vendu/i.test(v.statut || '')) return; const c = Number(v.co2); if (/lectri|hydrog/.test((v.carburant || '').toLowerCase())) return; if (Number.isFinite(c) && c > 0) g += c * 15000; }); out.push({ icon: '🌱', label: `${(Math.round(g / 1e5) / 10).toLocaleString('fr-FR')} t CO₂/an`, sub: 'estimation (15 000 km/an)', url: pref + 'statistiques.html' }); }

  const seen = new Set();
  return out.filter(a => { if (seen.has(a.label)) return false; seen.add(a.label); return true; }).slice(0, 4);
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

// ============================================================
//  Export EXCEL (.xlsx) natif — sans aucune dépendance externe.
//  Un .xlsx est un ZIP de fichiers XML : on génère le ZIP « stored »
//  (sans compression) + CRC32 à la main. Les nombres sont de VRAIS
//  nombres (pas de séparateur/virgule ambigus comme en CSV), en-tête
//  en gras + figé, filtres auto, largeurs de colonnes, ligne TOTAL.
// ============================================================
FP.xlsx = (function () {
  const _crc = (() => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = _crc[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  const enc = (s) => new TextEncoder().encode(s);
  const u16 = (n) => [n & 255, (n >>> 8) & 255];
  const u32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  function zip(files) {
    const parts = [], central = []; let offset = 0;
    files.forEach(f => {
      const name = enc(f.name), data = f.data, crc = crc32(data);
      const lh = new Uint8Array([].concat([0x50, 0x4b, 0x03, 0x04], u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0)));
      parts.push(lh, name, data);
      const cd = new Uint8Array([].concat([0x50, 0x4b, 0x01, 0x02], u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset)));
      central.push(cd, name);
      offset += lh.length + name.length + data.length;
    });
    let cSize = 0; central.forEach(c => cSize += c.length);
    const end = new Uint8Array([].concat([0x50, 0x4b, 0x05, 0x06], u16(0), u16(0), u16(files.length), u16(files.length), u32(cSize), u32(offset), u16(0)));
    const all = parts.concat(central, [end]);
    let tot = 0; all.forEach(a => tot += a.length);
    const out = new Uint8Array(tot); let p = 0; all.forEach(a => { out.set(a, p); p += a.length; });
    return out;
  }
  const escX = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const colLetter = (i) => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  return {
    // columns = [{ label, value(row), number?:bool }]
    // opts = { sheetName, total?:bool }
    build(columns, rows, opts) {
      opts = opts || {};
      const data = rows || [];
      // Largeurs auto (selon le contenu le plus long, borné)
      const widths = columns.map(c => {
        let w = String(c.label || '').length;
        data.forEach(r => { const v = c.value(r); const len = (v == null ? 0 : String(c.number ? v : v).length); if (len > w) w = len; });
        return Math.min(Math.max(w + 2, 9), 52);
      });
      const colsXml = '<cols>' + columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${widths[i]}" customWidth="1"/>`).join('') + '</cols>';
      const cell = (ref, val, isNum, style) => {
        const s = style ? ` s="${style}"` : '';
        if (isNum) { if (val === null || val === undefined || val === '' || isNaN(val)) return `<c r="${ref}"${s}/>`; return `<c r="${ref}"${s}><v>${Number(val)}</v></c>`; }
        return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${escX(val)}</t></is></c>`;
      };
      let body = '';
      // En-tête (gras = style 1)
      body += `<row r="1">` + columns.map((c, i) => cell(colLetter(i) + '1', c.label, false, 1)).join('') + '</row>';
      // Lignes
      data.forEach((r, ri) => {
        const rn = ri + 2;
        body += `<row r="${rn}">` + columns.map((c, i) => {
          const v = c.value(r);
          return cell(colLetter(i) + rn, v, !!c.number, c.number ? 2 : 0);
        }).join('') + '</row>';
      });
      // Ligne TOTAL
      let lastRow = data.length + 1;
      if (opts.total && data.length) {
        const rn = data.length + 2; lastRow = rn;
        const sums = columns.map(c => (c.number && !c.noTotal) ? Math.round(data.reduce((s, r) => { const v = c.value(r); return s + (isNaN(v) || v == null ? 0 : Number(v)); }, 0) * 100) / 100 : null);
        const firstNum = columns.findIndex(c => c.number);
        body += `<row r="${rn}">` + columns.map((c, i) => {
          if (c.number) return cell(colLetter(i) + rn, sums[i], true, 3);
          if (i === Math.max(0, firstNum - 1)) return cell(colLetter(i) + rn, 'TOTAL', false, 1);
          return cell(colLetter(i) + rn, '', false, 1);
        }).join('') + '</row>';
      }
      const ref = 'A1:' + colLetter(columns.length - 1) + (data.length + 1);
      const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${colsXml}<sheetData>${body}</sheetData><autoFilter ref="${ref}"/></worksheet>`;
      const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="4" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
      const wb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escX((opts.sheetName || 'Export').slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
      const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
      const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
      const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
      return zip([
        { name: '[Content_Types].xml', data: enc(ct) },
        { name: '_rels/.rels', data: enc(rels) },
        { name: 'xl/workbook.xml', data: enc(wb) },
        { name: 'xl/_rels/workbook.xml.rels', data: enc(wbRels) },
        { name: 'xl/styles.xml', data: enc(styles) },
        { name: 'xl/worksheets/sheet1.xml', data: enc(sheet) },
      ]);
    },
    download(filename, columns, rows, opts) {
      const bytes = this.build(columns, rows, opts);
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename.replace(/\.(csv|xls)$/i, '') + (filename.endsWith('.xlsx') ? '' : '.xlsx');
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    },
  };
})();

// Export unifié : même définition de colonnes pour CSV et Excel.
// colDefs = [{ label, value(row), number?:bool }] · kind = 'xlsx' | 'csv' · opts = { sheetName, total }
FP.exportRows = function (baseName, colDefs, rows, kind, opts) {
  opts = opts || {};
  if (kind === 'csv') {
    const cols = colDefs.map(c => ({
      key: c.label, label: c.label,
      format: (_, r) => { const v = c.value(r); return c.number ? (v == null || v === '' || isNaN(v) ? '' : FP.csv.numFormat(v)) : v; },
    }));
    let data = rows.slice();
    if (opts.total && rows.length) {
      const firstNum = colDefs.findIndex(c => c.number);
      // ligne TOTAL synthétique : on enrobe value() via un faux row marqué
      const marker = { __total: true };
      colDefs.forEach((c, i) => {
        if (c.number && !c.noTotal) marker['__' + i] = Math.round(rows.reduce((s, r) => { const v = c.value(r); return s + (isNaN(v) || v == null ? 0 : Number(v)); }, 0) * 100) / 100;
        else if (c.number) marker['__' + i] = null;
        else marker['__' + i] = (i === Math.max(0, firstNum - 1) ? 'TOTAL' : '');
      });
      const cols2 = colDefs.map((c, i) => ({
        key: c.label, label: c.label,
        format: (_, r) => r.__total ? (c.number ? (r['__' + i] == null ? '' : FP.csv.numFormat(r['__' + i])) : r['__' + i]) : (c.number ? (() => { const v = c.value(r); return v == null || v === '' || isNaN(v) ? '' : FP.csv.numFormat(v); })() : c.value(r)),
      }));
      FP.csv.download(baseName + '.csv', cols2, data.concat([marker]));
      return;
    }
    FP.csv.download(baseName + '.csv', cols, data);
    return;
  }
  FP.xlsx.download(baseName + '.xlsx', colDefs, rows, opts);
};

// Composant RÉUTILISABLE : un bouton « Exporter » + menu (Excel .xlsx / CSV), avec en option
// un export PAR PÉRIODE (Du → Au). Identique sur toutes les pages (et futures sociétés).
//   opts = {
//     mount,            // élément (ou sélecteur) où insérer le bouton
//     label,            // libellé du bouton (def. « Exporter »)
//     baseName,         // string | () => string  (nom de fichier sans extension)
//     columns,          // [{ label, value(row), number?, noTotal? }]
//     getRows,          // () => rows (vue courante, respecte les filtres de la page)
//     period,           // optionnel { dateOf(row) => 'YYYY-MM-DD' }  -> active l'export par période
//     total, sheetName, // passés à l'export
//   }
(function () {
  let styleInjected = false;
  function injectStyleOnce() {
    if (styleInjected) return; styleInjected = true;
    const st = document.createElement('style');
    st.textContent = `.fp-export-wrap{position:relative;display:inline-block}
.fp-export-menu{position:absolute;right:0;top:100%;margin-top:6px;background:#fff;border:1px solid var(--fp-border,#e2e8f0);border-radius:10px;box-shadow:0 14px 34px -12px rgba(15,30,61,.3);z-index:60;min-width:236px;overflow:hidden;padding:5px}
.fp-export-menu .fp-exp-it{width:100%;text-align:left;border:none;background:none;cursor:pointer;font-size:13px;padding:8px 10px;border-radius:7px;display:flex;align-items:center;gap:8px;color:#1e293b}
.fp-export-menu .fp-exp-it:hover{background:#f1f5f9}
.fp-export-menu .fp-exp-sec{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#94a3b8;padding:6px 10px 3px}
.fp-export-menu .fp-exp-div{height:1px;background:#eef2f7;margin:5px 0}
.fp-export-menu .fp-exp-dates{display:flex;gap:8px;padding:2px 10px 6px}
.fp-export-menu .fp-exp-dates label{font-size:11px;color:#64748b;display:flex;flex-direction:column;gap:2px;flex:1}
.fp-export-menu .fp-exp-dates input{font-size:12px;padding:4px 6px;border:1px solid var(--fp-border,#e2e8f0);border-radius:6px}`;
    document.head.appendChild(st);
  }
  FP.makeExportMenu = function (opts) {
    injectStyleOnce();
    const mount = (typeof opts.mount === 'string') ? document.querySelector(opts.mount) : opts.mount;
    if (!mount) { console.warn('[makeExportMenu] mount introuvable'); return; }
    const nameOf = () => (typeof opts.baseName === 'function' ? opts.baseName() : opts.baseName) || 'export';
    const wrap = document.createElement('div'); wrap.className = 'fp-export-wrap';
    const hasPeriod = !!(opts.period && typeof opts.period.dateOf === 'function');
    wrap.innerHTML = `
      <button type="button" class="btn btn-outline text-sm fp-export-btn"><i data-lucide="download" class="w-4 h-4"></i> ${opts.label || 'Exporter'} <i data-lucide="chevron-down" class="w-3.5 h-3.5"></i></button>
      <div class="fp-menu fp-export-menu hidden">
        <div class="fp-exp-sec">Vue actuelle</div>
        <button type="button" class="fp-exp-it" data-exp="xlsx"><i data-lucide="sheet" class="w-4 h-4" style="color:#16a34a"></i> Excel (.xlsx)</button>
        <button type="button" class="fp-exp-it" data-exp="csv"><i data-lucide="file-text" class="w-4 h-4" style="color:#64748b"></i> CSV</button>
        ${hasPeriod ? `<div class="fp-exp-div"></div>
        <div class="fp-exp-sec">Par période</div>
        <div class="fp-exp-dates"><label>Du <input type="date" class="fp-exp-from"></label><label>Au <input type="date" class="fp-exp-to"></label></div>
        <button type="button" class="fp-exp-it" data-exp="xlsx" data-period="1"><i data-lucide="sheet" class="w-4 h-4" style="color:#16a34a"></i> Excel — période</button>
        <button type="button" class="fp-exp-it" data-exp="csv" data-period="1"><i data-lucide="file-text" class="w-4 h-4" style="color:#64748b"></i> CSV — période</button>` : ''}
      </div>`;
    mount.appendChild(wrap);
    if (window.lucide && lucide.createIcons) { try { lucide.createIcons(); } catch (e) {} }
    const menu = wrap.querySelector('.fp-export-menu');
    const btn = wrap.querySelector('.fp-export-btn');
    btn.addEventListener('click', (e) => { e.stopPropagation(); menu.classList.toggle('hidden'); });
    menu.addEventListener('click', (e) => {
      const it = e.target.closest('[data-exp]'); if (!it) return;
      const kind = it.dataset.exp;
      let rows = (opts.getRows() || []).slice();
      let suffix = '';
      if (it.dataset.period) {
        const from = (wrap.querySelector('.fp-exp-from') || {}).value || '';
        const to = (wrap.querySelector('.fp-exp-to') || {}).value || '';
        rows = rows.filter(r => {
          const d = opts.period.dateOf(r) || '';
          if (from && d < from) return false;
          if (to && d > to) return false;
          return true;
        });
        suffix = '-' + (from || 'debut') + '_' + (to || 'fin');
      }
      menu.classList.add('hidden');
      if (!rows.length) { if (FP.toast) FP.toast('Aucune ligne à exporter (vérifie les filtres / la période).'); return; }
      FP.exportRows(nameOf() + suffix, opts.columns, rows, kind, { total: opts.total, sheetName: opts.sheetName });
      if (FP.toast) FP.toast(`${rows.length} ligne(s) exportée(s) en ${kind === 'csv' ? 'CSV' : 'Excel'}`);
    });
    return { el: wrap };
  };

})();

// Toolbar Import/Export CSV retirée (remplacée par l'import de document sur Véhicules/Amendes).
// Conservée en NO-OP : encore appelée par plusieurs pages (amendes, vehicules, factures…).
FP.injectDataIO = () => {};

// Compteurs animés GLOBAUX : anime tous les chiffres « .kpi-value » (montée depuis 0) au
// chargement de N'IMPORTE QUELLE page, puis à chaque arrivée de données Supabase. Idempotent
// (chaque valeur n'est animée qu'une fois) et sans toucher aux valeurs décimales.
(function () {
  function animateKpis() {
    if (!FP.countUp) return;
    document.querySelectorAll('.kpi-value').forEach(el => FP.countUp(el));
  }
  document.addEventListener('DOMContentLoaded', () => setTimeout(animateKpis, 130));
  document.addEventListener('fp:data-ready', () => setTimeout(animateKpis, 40));
})();

// Navigation active state (sidebar)
document.addEventListener('DOMContentLoaded', () => {
  // Appliquer le thème (couleurs des groupes) dès le chargement
  FP.settings.applyTheme();
  // Rôle courant : marque le body + retire les onglets réservés à l'admin (rôle interne)
  const _isAdmin = FP.isAdmin();
  document.body.setAttribute('data-role', FP.role());
  if (!_isAdmin) {
    (FP.ADMIN_ONLY_NAV || []).forEach(key => {
      document.querySelectorAll(`a[data-nav="${key}"]`).forEach(a => a.remove());
    });
  }
  // Brochure / Tarifs : supports de vente Parc Pilot → visibles UNIQUEMENT par le CEO.
  if (!FP.isCEO()) {
    (FP.CEO_ONLY_NAV || []).forEach(key => {
      document.querySelectorAll(`a[data-nav="${key}"]`).forEach(a => a.remove());
    });
  }
  // Appliquer les labels personnalisés des onglets puis l'ordre choisi
  FP.applyCustomNavLabels();
  FP.applyNavOrder();
  FP.applyNavVisibility();
  FP.applyNavGroups(); // intitulés de section (Espace de travail / Compte)
  if (_isAdmin) FP.enableNavReorder(); // glisser-déposer des onglets (admin only)
  // Appliquer les textes éditables custom (titres, sous-titres)
  FP.applyCustomTexts();
  // Injecter la barre de recherche globale dans toutes les sidebars
  FP.injectGlobalSearch();
  // Injecter le bouton déconnexion en bas des sidebars
  FP.injectLogoutButton();

  // === Menu hamburger mobile (sidebar en tiroir sur petit écran) ===
  (function mobileNav() {
    try {
      if (document.querySelector('.fp-nav-toggle')) return;
      const sb = document.querySelector('.fp-sidebar'); if (!sb) return;
      const btn = document.createElement('button');
      btn.className = 'fp-nav-toggle'; btn.type = 'button'; btn.setAttribute('aria-label', 'Ouvrir le menu');
      btn.innerHTML = '<i data-lucide="menu"></i>';
      const ov = document.createElement('div'); ov.className = 'fp-nav-overlay';
      document.body.appendChild(btn); document.body.appendChild(ov);
      const close = () => document.body.classList.remove('fp-nav-open');
      btn.addEventListener('click', () => document.body.classList.toggle('fp-nav-open'));
      ov.addEventListener('click', close);
      // Refermer après un clic sur un lien de navigation
      sb.addEventListener('click', (e) => { if (e.target.closest('a[data-nav], a[href]')) close(); });
      window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
      if (window.lucide) lucide.createIcons();
    } catch (e) {}
  })();

  // Listener pour la recherche globale (délégation)
  document.addEventListener('input', (e) => {
    const input = e.target.closest('.fp-search-input');
    if (!input) return;
    const wrap = input.closest('.fp-global-search');
    const results = wrap.querySelector('.fp-search-results');
    const q = input.value.toLowerCase().trim();
    if (q.length < 2) { results.innerHTML = ''; results.classList.remove('open'); return; }
    const item = (m) => `
        <a href="${m.url}" class="fp-search-item">
          <span class="fp-search-icon">${m.icon}</span>
          <span class="fp-search-text">
            <span class="fp-search-label">${m.label}</span>
            ${m.sub ? `<span class="fp-search-sub">${m.sub}</span>` : ''}
          </span>
        </a>`;
    const answers = FP.smartAnswers ? FP.smartAnswers(q) : [];
    const matches = FP.searchAll(q).slice(0, 15);
    if (!answers.length && !matches.length) {
      results.innerHTML = '<div class="fp-search-empty">Aucun résultat</div>';
    } else {
      let html = '';
      if (answers.length) html += '<div class="fp-search-cat">Réponse</div>' + answers.map(item).join('');
      if (matches.length) html += (answers.length ? '<div class="fp-search-cat">Résultats</div>' : '') + matches.map(item).join('');
      results.innerHTML = html;
    }
    results.classList.add('open');
  });
  // Fermer le dropdown si clic ailleurs
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.fp-global-search')) {
      document.querySelectorAll('.fp-search-results').forEach(r => r.classList.remove('open'));
    }
  });
  // Spotlight : ⌘K / Ctrl+K ouvre la recherche ; ↑ ↓ naviguent, Entrée ouvre, Échap ferme.
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      const inp = document.querySelector('.fp-search-input');
      if (inp) { e.preventDefault(); inp.focus(); inp.select(); }
      return;
    }
    const inp = e.target && e.target.closest && e.target.closest('.fp-search-input');
    if (!inp) return;
    const wrap = inp.closest('.fp-global-search');
    const results = wrap && wrap.querySelector('.fp-search-results');
    if (!results || !results.classList.contains('open')) return;
    const items = Array.from(results.querySelectorAll('.fp-search-item'));
    if (!items.length) return;
    let idx = items.findIndex(it => it.classList.contains('kbd-active'));
    if (e.key === 'ArrowDown') { e.preventDefault(); idx = (idx + 1) % items.length; }
    else if (e.key === 'ArrowUp') { e.preventDefault(); idx = (idx - 1 + items.length) % items.length; }
    else if (e.key === 'Enter') { e.preventDefault(); (items[idx] || items[0]).click(); return; }
    else if (e.key === 'Escape') { results.classList.remove('open'); inp.blur(); return; }
    else return;
    items.forEach(it => it.classList.remove('kbd-active'));
    if (items[idx]) { items[idx].classList.add('kbd-active'); items[idx].scrollIntoView({ block: 'nearest' }); }
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
