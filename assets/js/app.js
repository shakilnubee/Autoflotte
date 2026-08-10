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
    // Référence à MINUIT (comme buildEcheances) → décompte en jours calendaires cohérent partout
    // (Alertes, fiche véhicule, Renouvellements). Évite un off-by-one selon l'heure ou un DST.
    d.setHours(0, 0, 0, 0);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const diff = Math.round((d - now) / (1000*60*60*24));
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
// ⚠️ HELPER CANONIQUE — montant RÉELLEMENT DÛ d'une amende : le majoré si elle est majorée,
// sinon le montant initial. À UTILISER PARTOUT (sommes, podiums, KPI, alertes, exports) pour
// que tous les écrans affichent le même montant (règle « une seule source de vérité », CLAUDE.md).
// Montant qui fait foi pour TOUS les totaux/KPI (source unique — cf. règle « une seule source de vérité ») :
//  1) si l'amende est PAYÉE et qu'un montant réellement payé a été saisi (remise/arrangement) → ce montant ;
//  2) sinon, le majoré si l'amende est majorée ;
//  3) sinon, le montant normal (minoré/forfaitaire).
// Le montant payé est stocké dans les réglages PAR SOCIÉTÉ (app_settings.amendeMontantPaye), pas en base
// (aucune colonne DB à créer). On ne lit les réglages que pour les amendes payées (pas dans toutes les boucles).
FP.montantDu = (a) => {
  if (!a) return 0;
  if (FP.estPayee(a) && a.id != null && FP.settings) {
    try {
      const ov = FP.settings.get().amendeMontantPaye;
      if (ov && ov[a.id] != null && ov[a.id] !== '') return Number(ov[a.id]) || 0;
    } catch (e) {}
  }
  return (a.majoree && a.montantMajore != null && a.montantMajore !== '') ? Number(a.montantMajore) : (Number(a.montant) || 0);
};
// ⚠️ HELPER CANONIQUE — l'amende est-elle un FPS (Forfait Post-Stationnement) plutôt qu'un avis de
// contravention ANTAI ? À UTILISER PARTOUT (règle « une seule source ») pour choisir le BON site de
// paiement et le BON délai : FPS → stationnement.gouv.fr (RAPO ~3 mois, PAS de désignation ANTAI) ;
// contravention → amendes.gouv.fr (minoré ~45 j, désignation ANTAI possible).
// ⚠️ « Stationnement » seul ne suffit PAS : un « stationnement gênant/interdit » est une CONTRAVENTION,
// pas un FPS. On tranche : (1) mention explicite FPS/forfait post-stationnement → FPS ; sinon
// (2) présence d'un n° de télépaiement ANTAI → contravention ; sinon (3) « stationnement (payant) »
// sans mention gênant/interdit → FPS.
FP.estFps = (a) => {
  if (!a) return false;
  const m = (a.motif || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/forfait\s*post.?stationnement/.test(m) || /\bf\.?p\.?s\.?\b/.test(m)) return true;
  const tel = (a.numeroTelepaiement || '').toString().replace(/\D/g, '');
  if (tel.length >= 10) return false; // n° de télépaiement ANTAI présent ⇒ contravention amendes.gouv.fr
  if (/stationnement/.test(m) && !/(genant|interdit|dangereux|abusif|arret|double|trottoir|passage|livraison|bande|couloir|\bbus\b)/.test(m)) return true;
  return false;
};
// Enregistre (ou efface si val vide) le montant réellement payé d'une amende — réglages par société, partagé entre postes.
FP.setAmendeMontantPaye = (id, val) => {
  if (!FP.settings || id == null) return;
  const s = FP.settings.get();
  const map = (s.amendeMontantPaye && typeof s.amendeMontantPaye === 'object') ? s.amendeMontantPaye : {};
  if (val == null || val === '' || isNaN(Number(val))) delete map[id];
  else map[id] = Number(val);
  s.amendeMontantPaye = map;
  FP.settings.save(s);
};
FP.getAmendeMontantPaye = (id) => {
  try { const m = FP.settings.get().amendeMontantPaye; return (m && m[id] != null && m[id] !== '') ? Number(m[id]) : null; } catch (e) { return null; }
};
// Détail des 3 montants officiels d'un avis (minoré / forfaitaire / majoré) + les 2 dates limites,
// lus par l'IA au scan. Stockés PAR SOCIÉTÉ dans les réglages (app_settings.amendeMontants[id]) —
// AUCUNE colonne DB à créer. On ne change PAS le montant qui fait foi (FP.montantDu) : c'est juste
// pour ne pas PERDRE la ventilation lue et pouvoir l'afficher / l'exploiter plus tard.
FP.setAmendeMontants = (id, o) => {
  if (!FP.settings || id == null) return;
  const s = FP.settings.get();
  const map = (s.amendeMontants && typeof s.amendeMontants === 'object') ? s.amendeMontants : {};
  const clean = {};
  ['montantMinore', 'montantForfaitaire', 'montantMajore', 'dateLimiteMinore', 'dateLimiteForfaitaire'].forEach(k => {
    const v = o && o[k]; if (v != null && v !== '') clean[k] = v;
  });
  if (Object.keys(clean).length) { map[id] = clean; s.amendeMontants = map; FP.settings.save(s); }
};
FP.getAmendeMontants = (id) => {
  try { const m = FP.settings.get().amendeMontants; return (m && m[id]) ? m[id] : null; } catch (e) { return null; }
};
// ⚠️ HELPER CANONIQUE — année d'une amende (peut revenir en NOMBRE depuis Supabase) : on force
// en chaîne, avec repli sur l'année de la date. Évite les filtres `annee === '2026'` qui ratent le nombre.
FP.anneeAmende = (a) => { if (!a) return ''; const y = a.annee; if (y != null && String(y).trim() !== '') return String(y).trim(); return String(a.date || '').slice(0, 4); };
// ⚠️ HELPER CANONIQUE — coût d'EXPLOITATION d'un mois (AAAA-MM) : somme des factures TTC en
// EXCLUANT leasing / sinistre / achat de véhicule / cession (investissement ou argent entrant,
// pas une charge d'exploitation). À utiliser PARTOUT (dashboard, écran mural, rapport direction)
// pour que « Coût du mois » affiche le même chiffre. `exclureType` réutilisable seul.
FP.coutFactureExploit = (f) => { const t = String((f && f.type) || '').toLowerCase(); return t !== 'leasing' && t !== 'sinistre' && t !== 'achat' && t !== 'cession'; };
// Détection carburant / péages — UNE seule règle partagée (dashboard, factures, statistiques) :
// par TYPE (carburant/peage/ulys) OU par FOURNISSEUR (Ulys, TotalEnergies). Avant, un carburant
// sans type mais avec le bon fournisseur était compté à un endroit et pas à l'autre.
FP.estUlys = (f) => { const n = s => String(s || '').toLowerCase(); return n(f && f.type) === 'ulys' || /\bulys\b/.test(n(f && f.fournisseur)); };
FP.estTotalFleet = (f) => { if (FP.estUlys(f)) return false; const n = s => String(s || '').toLowerCase(); const t = n(f && f.type); if (t === 'carburant' || t === 'peage') return true; return /total\s*energies|totalenergies/.test(n(f && f.fournisseur)); };
FP.estCarburantPeage = (f) => FP.estUlys(f) || FP.estTotalFleet(f);
// ⚠️ HELPER CANONIQUE — parse un montant saisi/OCR : gère l'espace (dont insécable), le point ET la
// virgule décimale. « 1 466,48 » / « 1 466.48 » / « 1466,48 » → 1466.48. À utiliser PARTOUT au lieu de
// parseFloat(x.replace(',','.')) qui casse sur « 1 500 » (→ 1). Renvoie null si vide/non numérique.
FP.parseMontant = (s) => { if (s == null || s === '') return null; const n = parseFloat(String(s).replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? null : n; };
// ⚠️ HELPER CANONIQUE — normalise une immatriculation pour la COMPARER (majuscules, retrait de tout ce
// qui n'est pas alphanumérique : tirets, espaces, points). « AB-123-CD », « ab 123 cd », « AB123CD » →
// « AB123CD ». À utiliser pour TOUT match facture↔véhicule / amende↔véhicule / document↔véhicule.
FP.normImmat = (s) => String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '');
// ⚠️ HELPER CANONIQUE — prime d'assurance annuelle TTC d'un véhicule. La prime est stockée en OBJET
// { ht, ttc } (settings.assurancePrimes[id]) — ne JAMAIS faire Number(prime) (→ NaN). Renvoie le TTC (nombre) ou 0.
// La prime est keyée par IMMATRICULATION (comparaison normalisée, comme dans Contrats), PAS par id.
FP.primeVeh = (v) => {
  try {
    const map = FP.settings.get().assurancePrimes || {};
    const k = FP.normImmat(v && v.immat); if (!k) return 0;
    let p = map[v.immat];
    if (p == null) { for (const key in map) { if (FP.normImmat(key) === k) { p = map[key]; break; } } }
    if (p == null) return 0;
    return (typeof p === 'object') ? (Number(p.ttc) || 0) : (Number(p) || 0);
  } catch (e) { return 0; }
};
// ⚠️ HELPER CANONIQUE — total annuel des primes d'assurance du parc POSSÉDÉ (exclut les vendus).
FP.assuranceAnnuelle = (vehicules) => (vehicules || []).filter(v => !FP.estVendu(v)).reduce((s, v) => s + FP.primeVeh(v), 0);
// ⚠️ HELPER CANONIQUE — loyer ANNUEL total des contrats Localease/Ayvens (LLD) enregistrés
// (settings.localeaseContrats, synchronisé par société). Même calcul que la page Contrats (loyer courant
// = offre + avenant, sinon loyer de base ; override loyer par plaque prioritaire) ×12. Sert à ce que le
// leasing du Budget/écran corresponde à celui des Contrats (avant, le Budget ratait les LLD).
FP.leasingLocaleaseAnnuel = function () {
  try {
    const list = FP.settings.get().localeaseContrats;
    if (!Array.isArray(list)) return 0;
    const ov = FP.getLeasingOverrides ? FP.getLeasingOverrides() : {};
    const mens = list.reduce((s, c) => {
      const ik = String(c.immat || '').toUpperCase();
      const o = (ik && ov[ik]) ? ov[ik].loyer : null;
      const base = (o != null && o !== '') ? Number(o) : c.loyerTTC;
      const off = FP.leasingLoyerCourant ? FP.leasingLoyerCourant({ loyer: base, avenants: c.avenants }) : null;
      return s + (off != null ? off : (Number(base) || 0));
    }, 0);
    return mens * 12;
  } catch (e) { return 0; }
};
// ⚠️ HELPER CANONIQUE — coût RESTANT À CHARGE d'une facture de sinistre : 0 si remboursé/pris en charge
// (sinistreStatut ∈ {rembourse, pec}) ou si c'est un simple devis (sinistreStage ou mots devis/proforma/
// estimation), sinon le TTC. Même règle que la page Sinistres et le KPI Statistiques.
// Statut de suivi d'un sinistre (— / attente / pec / rembourse / refuse), SOURCE UNIQUE.
// Le statut est saisi PAR INCIDENT (clé de groupe sinistreGroupes[id] || id) dans la page Sinistres,
// mais l'import le pose parfois par id de facture. On résout donc via la clé de groupe D'ABORD,
// puis repli sur l'id de facture → page, alertes et coûts lisent toujours la même valeur.
FP.sinistreStatutOf = (f) => {
  if (!f) return '';
  try {
    const s = FP.settings.get();
    const grp = s.sinistreGroupes || {}, st = s.sinistreStatut || {};
    const gk = grp[f.id] || f.id;
    return (st[gk] || st[f.id] || '').toString().toLowerCase();
  } catch (e) { return ''; }
};
FP.coutSinistre = (f) => {
  try {
    if (!f) return 0;
    const st = FP.sinistreStatutOf(f);
    if (st === 'rembourse' || st === 'pec') return 0;
    const stage = ((FP.settings.get().sinistreStage || {})[f.id] || '').toString().toLowerCase();
    const isDevis = stage ? (stage === 'devis') : /\b(devis|proforma|estimation)\b/i.test(((f.description || '') + ' ' + (f.fournisseur || '')));
    if (isDevis) return 0;
    return Number(f.montantTTC) || 0;
  } catch (e) { return Number(f && f.montantTTC) || 0; }
};
// RESTE À CHARGE réel des sinistres (ce que la société paie vraiment, après remboursement assureur).
// Le remboursement étant saisi PAR INCIDENT (settings.sinistreAssurance[clé].rembourse) et non par
// facture, on REGROUPE d'abord par incident (settings.sinistreGroupes[id] || id), on somme le coût
// (FP.coutSinistre → devis exclus, sinistre 100 % pris en charge = 0), puis on soustrait le remboursé.
// Source unique pour toutes les vues « coût réel » (Coût d'usage, coût/km, TCO).
FP.resteChargeSinistre = function (factures) {
  try {
    const s = FP.settings.get();
    const grp = s.sinistreGroupes || {}, doss = s.sinistreAssurance || {};
    const gk = id => grp[id] || id;
    const byInc = {};
    (factures || []).forEach(f => {
      if (!f || (f.type || '').toLowerCase() !== 'sinistre') return;
      const k = gk(f.id);
      byInc[k] = (byInc[k] || 0) + (FP.coutSinistre ? FP.coutSinistre(f) : (Number(f.montantTTC) || 0));
    });
    let total = 0;
    Object.keys(byInc).forEach(k => { total += Math.max(0, byInc[k] - (Number((doss[k] || {}).rembourse) || 0)); });
    return total;
  } catch (e) { return (factures || []).filter(f => f && (f.type || '').toLowerCase() === 'sinistre').reduce((a, f) => a + (Number(f.montantTTC) || 0), 0); }
};
// ⚠️ HELPER CANONIQUE — dédoublonnage des factures par n° (comme Statistiques / rapport direction) :
// deux lignes qui partagent le même numeroFacture ne sont comptées qu'une fois (évite de gonfler les
// totaux). Les factures sans numéro sont toutes gardées. À utiliser partout où on somme des factures.
FP.dedupeFactures = (list) => {
  const seen = new Set();
  // SOURCE UNIQUE : même normalisation/règle que FP.dupe pour les factures (n° normalisé — accents
  // & ponctuation retirés — de longueur ≥ 4 ET même TTC). Sinon un n° court/séquentiel (« 24 ») ou
  // deux vraies factures au même n° mais montants différents étaient fusionnés à tort (sous-comptage),
  // et une variante de ponctuation (« FA-2026/01 » vs « FA 2026 01 ») n'était PAS fusionnée (sur-comptage).
  const norm = (s) => (FP.dupe && FP.dupe._n) ? FP.dupe._n(s) : (s == null ? '' : String(s)).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const numOf = (v) => (FP.dupe && FP.dupe._num) ? FP.dupe._num(v) : (() => { const n = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? null : n; })();
  return (list || []).filter(f => {
    const k = norm(f && f.numeroFacture);
    if (!k || k.length < 4) return true; // n° absent ou trop court → jamais dédoublonné (peut être une 2e vraie facture)
    const ttc = numOf(f && f.montantTTC);
    const key = k + '|' + (ttc == null ? '' : ttc);
    if (seen.has(key)) return false; seen.add(key); return true;
  });
};
// ⚠️ HELPER CANONIQUE — coût d'exploitation d'un mois : factures dédoublonnées par n° + filtre exploit.
// Même chiffre partout (dashboard, écran mural, rapport direction) — sinon un doublon de n° gonflait le mois.
FP.coutMois = (data, ym) => (FP.dedupeFactures(((data && data.factures) || [])).filter(f => (f.date || '').slice(0, 7) === ym && FP.coutFactureExploit(f)).reduce((s, f) => s + (Number(f.montantTTC) || 0), 0));
// ⚠️ HELPER CANONIQUE — amende « à payer » (statut tolérant aux accents/espaces/casse) : « à payer »,
// « a payer », « À Payer » … sont tous reconnus, pour que dashboard, page Amendes et alertes comptent pareil.
FP.estAPayer = (a) => { const s = ((a && a.statut) || '').toString().trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); return s === 'a payer'; };
// ⚠️ HELPER CANONIQUE — amende « payée » (symétrique de estAPayer, tolérant accents/casse) : « payée »,
// « payee », « Payé »… tous reconnus. À utiliser partout au lieu de statut === 'payée' (sinon totaux faux).
FP.estPayee = (a) => { const s = ((a && a.statut) || '').toString().trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); return s === 'payee' || s === 'paye'; };
// ⚠️ HELPER CANONIQUE — « facture d'entretien / réparation » (tolérant à l'accent : entretien, réparation,
// reparation). À utiliser PARTOUT (carnet fiche, page Entretiens, coût véhicule, budget, alertes) — sinon
// une facture typée « reparation » (sans accent) apparaît sur un écran et pas sur l'autre.
FP.estEntretien = (f) => { const t = ((f && f.type) || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); return t === 'entretien' || t === 'reparation'; };
// ⚠️ HELPER CANONIQUE — kilométrage RÉEL d'un véhicule : le max entre le km à jour et le km de la dernière
// révision (le véhicule ne peut pas rouler moins que son dernier relevé). À utiliser partout où on AFFICHE
// « km actuel », pour que même des données non réconciliées (data.js figé) montrent la bonne valeur.
FP.kmActuel = (v) => Math.max(Number(v && v.km) || 0, Number(v && v.kmDernierReleve) || 0);
// ⚠️ HELPERS CANONIQUES — statut d'un emprunt. « en cours » = pas encore rendu (dateRetour absente ou
// sentinelle inconnue). À utiliser partout (page Emprunts, dashboard, fiche véhicule) — sinon deux écrans
// divergent sur « ce véhicule est-il sorti ? ».
FP.EMP_RETOUR_INCONNU = '1900-01-01';
// ⚠️ Sémantique alignée sur l'UI : une dateRetour renseignée = RENDU (y compris la sentinelle
// « 1900-01-01 » = rendu à une date inconnue, via la case « je ne connais pas la date de retour »).
// EN COURS = aucune dateRetour du tout. (Ne PAS traiter la sentinelle comme « en cours ».)
FP.empEnCours = (e) => !(e && e.dateRetour && String(e.dateRetour).slice(0, 10));
// Jours écoulés depuis la date d'emprunt (calendaires, minuit → aujourd'hui).
FP.empJoursDepuis = (e) => { const d = (e && e.dateEmprunt) ? new Date(String(e.dateEmprunt).slice(0, 10)) : null; if (!d || isNaN(d)) return 0; const t = new Date(); t.setHours(0, 0, 0, 0); return Math.floor((t - d) / 86400000); };
// SOURCE UNIQUE « emprunt en retard » (règle choisie par l'utilisateur) : en cours ET emprunté
// depuis plus de X jours (réglable dans Paramètres → Seuils d'alerte, défaut 2). Utilisé par le
// tableau de bord ET la page Emprunts.
FP.empRetardJours = () => { try { return FP.notifCfg ? FP.notifCfg().empruntRetardJours : 2; } catch (e) { return 2; } };
FP.empEnRetard = (e) => FP.empEnCours(e) && FP.empJoursDepuis(e) > FP.empRetardJours();
// ⚠️ SOURCE UNIQUE — recalcule la fiche véhicule à partir des factures RESTANTES (à appeler après la
// SUPPRESSION d'une facture, symétrique de FP.applyFactureToVehicule). Évite les « dernière révision /
// km / pneus » fantômes laissés par une facture supprimée. Ne fait jamais BAISSER le km affiché (v.km),
// mais recale la dernière révision, le km de révision et la date pneus sur ce qui reste réellement.
FP.recomputeVehiculeFromFactures = function (v, factures) {
  try {
    if (!v || !v.immat) return null;
    const mine = (factures || []).filter(f => f && FP.estEntretien(f) && FP.normImmat(f.vehiculeImmat) === FP.normImmat(v.immat));
    const patch = {};
    // Dernière révision = date la plus récente parmi les factures d'entretien restantes (sinon vide).
    const dates = mine.map(f => f.date).filter(Boolean).sort();
    const derniere = dates.length ? dates[dates.length - 1] : null;
    if ((v.derniereRevision || null) !== (derniere || null)) { v.derniereRevision = derniere; patch.derniereRevision = derniere; }
    // Km de révision = max km parmi les factures d'entretien restantes (sinon vide).
    const kms = mine.map(f => Number(f.km)).filter(n => Number.isFinite(n) && n > 0);
    const kmRev = kms.length ? Math.max(...kms) : null;
    if ((Number(v.kmDernierReleve) || null) !== (kmRev || null)) { v.kmDernierReleve = kmRev; patch.kmDernierReleve = kmRev; }
    // Date pneus = date la plus récente parmi les factures d'entretien « pneu » restantes (sinon vide).
    const pneuDates = mine.filter(f => /pneu/i.test(String(f.description || ''))).map(f => f.date).filter(Boolean).sort();
    const pneu = pneuDates.length ? pneuDates[pneuDates.length - 1] : null;
    if ((v.dateChangementPneus || null) !== (pneu || null)) { v.dateChangementPneus = pneu; patch.dateChangementPneus = pneu; }
    if (!Object.keys(patch).length) return null;
    if (FP.persist && FP.persist.update) { try { FP.persist.update('vehicules', v.id, patch); } catch (e) {} }
    return { veh: v, patch };
  } catch (e) { return null; }
};
// ⚠️ HELPER CANONIQUE — nom du loueur d'un véhicule (multi-loueurs) : on matche le propriétaire du
// véhicule sur settings.loueurs[].prop ; repli sur le propriétaire brut puis sur le loueur unique du
// profil (loueurNom). Sert au LIBELLÉ « Forfait leasing X » de la fiche (sans toucher à la détection
// du leasing) — sinon une société multi-loueurs affichait toujours le loueur unique du profil.
FP.loueurOf = (v) => {
  const p = String((v && v.proprietaire) || '').trim(); const pl = p.toLowerCase();
  let list = []; try { const s = FP.settings.get(); if (Array.isArray(s.loueurs)) list = s.loueurs; } catch (e) {}
  const m = pl ? (list || []).find(l => l && String(l.prop || '').trim().toLowerCase() === pl) : null;
  if (m && m.nom) return String(m.nom).trim();
  if (p) return p;
  const prof = FP.societeProfil ? FP.societeProfil() : {};
  return String(prof.loueurNom || '').trim();
};

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

// === Onglet privé « JIS » — RÉSERVÉ AU PROPRIÉTAIRE (Shakil), gating par e-mail ================
// Regroupe les supports commerciaux internes (brochure, tarifs, carte de visite, argumentaire,
// générateurs de devis/contrat). Visible UNIQUEMENT si l'e-mail de connexion est dans la liste.
// ⚠️ Consigne explicite : personne d'autre ne doit y avoir accès.
FP.userEmail = (() => { try { return (localStorage.getItem('fp_email') || '').trim().toLowerCase(); } catch (e) { return ''; } })();
FP.JIS_OWNERS = ['shakil.nubee@projectxparis.fr', 'jis.nubee@gmail.com'];
FP.isJisOwner = () => FP.JIS_OWNERS.indexOf((FP.userEmail || '').trim().toLowerCase()) !== -1;

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

// ⚠️ RÈGLE PROJET — un bouton « Réinitialiser » par barre de filtres (partout sur le site).
// FP.filterResetButton(bar, { onReset, mount, after }) : ajoute un bouton « ↺ Réinitialiser » qui
// remet les filtres de la page à zéro. `onReset` (recommandé) = fonction de la page qui remet son
// état + resync les contrôles + re-render (fiable). Sans `onReset`, un reset GÉNÉRIQUE vide les
// champs texte/date, remet les <select> sur l'option « all »/vide, et clique la puce « Tous » de
// chaque groupe, en émettant les événements (compatible FP.searchSelect qui resync sur 'change').
// `mount` = où poser le bouton (défaut = la barre). Renvoie le bouton (ou null).
FP.filterResetButton = function (bar, opts) {
  try {
    opts = opts || {};
    const barEl = (typeof bar === 'string') ? document.querySelector(bar) : bar;
    const mount = (typeof opts.mount === 'string' ? document.querySelector(opts.mount) : opts.mount) || barEl;
    if (!mount || mount.querySelector('.fp-filter-reset')) return null;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fp-filter-reset';
    btn.title = 'Réinitialiser les filtres';
    btn.innerHTML = '<i data-lucide="rotate-ccw" style="width:14px;height:14px"></i><span>Réinitialiser</span>';
    btn.style.cssText = 'display:inline-flex;align-items:center;gap:.35rem;padding:.5rem .8rem;border:1px solid var(--fp-border,#E3E8F0);border-radius:9999px;background:#fff;color:var(--fp-muted,#5A6577);font-size:.82rem;font-weight:600;cursor:pointer;white-space:nowrap';
    btn.addEventListener('click', () => {
      if (typeof opts.onReset === 'function') { try { opts.onReset(); } catch (e) {} }
      else if (barEl) {
        barEl.querySelectorAll('input').forEach(i => {
          const t = (i.type || 'text').toLowerCase();
          if (['checkbox', 'radio', 'button', 'submit', 'hidden'].indexOf(t) !== -1) return;
          i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true }));
        });
        barEl.querySelectorAll('select').forEach(s => {
          const optAll = Array.from(s.options).find(o => o.value === 'all' || o.value === '');
          s.value = optAll ? optAll.value : (s.options[0] ? s.options[0].value : '');
          s.dispatchEvent(new Event('change', { bubbles: true }));
        });
        const groups = new Set();
        Array.from(barEl.querySelectorAll('.filter-chip, .emp-chip, .sin-chip, [data-remb], [data-statut], [data-filtre]')).forEach(c => { if (c.parentElement) groups.add(c.parentElement); });
        groups.forEach(grp => {
          const list = Array.from(grp.children).filter(x => x.tagName === 'BUTTON' || x.classList.contains('filter-chip') || x.classList.contains('emp-chip') || x.classList.contains('sin-chip'));
          const tok = x => (x.dataset.remb || x.dataset.statut || x.dataset.filtre || x.dataset.value || x.textContent || '').trim().toLowerCase();
          const def = list.find(x => /^(all|tous|toutes)\b/.test(tok(x))) || list[0];
          if (def) def.click();
        });
      }
      if (window.lucide) lucide.createIcons();
      if (typeof opts.after === 'function') { try { opts.after(); } catch (e) {} }
    });
    // Placer le bouton JUSTE APRÈS les filtres : s'il y a un élément poussé à droite (ml-auto,
    // ex. une étiquette ou des boutons d'action), on insère AVANT lui pour rester collé aux filtres ;
    // sinon on ajoute à la fin de la barre.
    const pushed = Array.from(mount.children).find(c => c.classList && c.classList.contains('ml-auto'));
    if (pushed) mount.insertBefore(btn, pushed); else mount.appendChild(btn);
    if (window.lucide) lucide.createIcons();
    return btn;
  } catch (e) { return null; }
};

// ⚠️ RÈGLE PROJET — sélection multi-lignes réutilisable (« bulk actions »).
// FP.bulkSelect({ mount, tbody, getFilteredIds, onDelete, onRender, noun, nounPlural }) pose une
// case « Tout sélectionner » (toujours visible) + une barre flottante « N sélectionné(s) · Supprimer
// · Désélectionner » (apparaît dès qu'une ligne est cochée). La page appelle bulk.cbCell(id) pour
// injecter la case en tête de sa 1re cellule, marque le <tr> avec la classe row-selected via
// bulk.has(id), et appelle bulk.refresh() après CHAQUE render. `getFilteredIds()` = ids des lignes
// actuellement affichées (pour « Tout sélectionner » + le compteur). `onDelete(ids)` = suppression
// réelle côté page (les ids sont des CHAÎNES). Déjà branché : factures, entretiens, sinistres.
// ⚠️ Tout nouveau tableau qui veut la sélection multiple DOIT passer par ce helper.
FP.bulkSelect = function (opts) {
  opts = opts || {};
  const noun = opts.noun || 'élément';
  const nounP = opts.nounPlural || (noun + 's');
  const sel = new Set(); // ids en CHAÎNE
  const S = (x) => String(x);
  const host = (typeof opts.mount === 'string') ? document.getElementById(opts.mount) : opts.mount;
  const api = {
    selected: () => [...sel],
    has: (id) => sel.has(S(id)),
    cbCell(id) { return `<input type="checkbox" class="fp-bulk-cb" data-id="${S(id)}"${sel.has(S(id)) ? ' checked' : ''} title="Sélectionner" onclick="event.stopPropagation()">`; },
    refresh() { update(); },
    clear() { sel.clear(); rerender(); },
  };
  if (!host) { api.cbCell = () => ''; return api; }
  const filteredIds = () => ((opts.getFilteredIds && opts.getFilteredIds()) || []).map(S);
  const wrap = document.createElement('div');
  wrap.className = 'fp-bulk-wrap';
  wrap.innerHTML =
    `<label class="fp-bulk-selall"><input type="checkbox" class="fp-bulk-all"> <span>Tout sélectionner <span class="fp-bulk-total"></span></span></label>`
    + `<div class="fp-bulkbar"><span class="fp-bulkbar-count"><b class="fp-bulk-n">0</b> ${nounP} sélectionné(s)</span>`
    + `<button type="button" class="fp-bulk-btn danger" data-bulk="delete"><i data-lucide="trash-2" style="width:14px;height:14px"></i> Supprimer</button>`
    + `<button type="button" class="fp-bulk-btn" data-bulk="clear"><i data-lucide="x" style="width:14px;height:14px"></i> Désélectionner</button></div>`;
  host.prepend(wrap);
  const bar = wrap.querySelector('.fp-bulkbar');
  const allCb = wrap.querySelector('.fp-bulk-all');
  function rerender() { if (typeof opts.onRender === 'function') { try { opts.onRender(); } catch (e) {} } update(); }
  function update() {
    const ids = filteredIds();
    wrap.querySelector('.fp-bulk-n').textContent = sel.size;
    if (bar) bar.classList.toggle('active', sel.size > 0);
    const inFilter = ids.filter(id => sel.has(id)).length;
    allCb.checked = ids.length > 0 && inFilter === ids.length;
    allCb.indeterminate = inFilter > 0 && inFilter < ids.length;
    const tot = wrap.querySelector('.fp-bulk-total'); if (tot) tot.textContent = ids.length ? `(${ids.length})` : '';
    if (window.lucide) lucide.createIcons();
  }
  allCb.addEventListener('change', (e) => {
    const ids = filteredIds();
    if (e.target.checked) ids.forEach(id => sel.add(id)); else ids.forEach(id => sel.delete(id));
    rerender();
  });
  wrap.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-bulk]'); if (!b) return;
    const act = b.dataset.bulk;
    if (act === 'clear') { sel.clear(); rerender(); return; }
    if (act === 'delete') {
      const ids = [...sel]; if (!ids.length) return;
      const label = ids.length > 1 ? nounP : noun;
      const ok = FP.confirm ? await FP.confirm(`Supprimer ${ids.length} ${label} ?`) : window.confirm('Supprimer ?');
      if (!ok) return;
      let undo = null;
      try { if (typeof opts.onDelete === 'function') undo = await opts.onDelete(ids); } catch (err) { console.error('[FP.bulkSelect.onDelete]', err); }
      sel.clear(); rerender();
      // Si onDelete renvoie une fonction, on l'utilise comme action « Annuler ».
      if (typeof undo === 'function' && FP.undoToast) FP.undoToast(`🗑 ${ids.length} ${label} supprimé(s)`, undo);
      else if (FP.toast) FP.toast(`🗑 ${ids.length} ${label} supprimé(s)`);
    }
  });
  const tb = (typeof opts.tbody === 'string') ? document.getElementById(opts.tbody) : opts.tbody;
  if (tb) tb.addEventListener('change', (e) => {
    const cb = e.target.closest('.fp-bulk-cb'); if (!cb) return;
    const id = S(cb.dataset.id);
    if (cb.checked) sel.add(id); else sel.delete(id);
    const tr = cb.closest('tr'); if (tr) tr.classList.toggle('row-selected', cb.checked);
    update();
  });
  update();
  return api;
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
    const list = this.list();
    // 1) match EXACT sur le nom complet (départage les homonymes de prénom quand le nom est fourni)
    const full = FP.normNomComplet(name || '');
    if (full && full.indexOf(' ') !== -1) {
      const exact = list.find(c => FP.normNomComplet(FP.conducteurs.displayName(c)) === full);
      if (exact) return exact;
    }
    // 2) repli historique : match par prénom seul (préserve les liens des données ne portant qu'un prénom)
    const k = FP.normPrenom(name || ''); if (!k) return null;
    return list.find(c => FP.normPrenom(c.name || c.prenom || c.key) === k) || null;
  },
  async create(info) {
    info = info || {};
    const name = String(info.name || ((info.prenom || '') + ' ' + (info.nom || ''))).trim() || String(info.prenom || '').trim();
    if (!name) return null;
    // Clé = prénom seul (rétro-compatible). MAIS si un homonyme de prénom existe déjà avec un nom
    // DIFFÉRENT, on prend une clé prénom+nom pour ne pas fusionner deux personnes distinctes.
    let key = FP.normPrenom(name);
    const nom = String(info.nom || '').toLowerCase().trim();
    if (nom) {
      const homonymeDiff = this.list().some(c => FP.normPrenom(c.name || c.prenom || c.key) === key && String(c.nom || '').toLowerCase().trim() && String(c.nom || '').toLowerCase().trim() !== nom);
      if (homonymeDiff) { const kf = FP.normNomComplet(name).replace(/\s+/g, '-'); if (kf) key = kf; }
    }
    const row = { key, name, prenom: info.prenom || null, nom: info.nom || null, tel: info.tel || null, email: info.email || null,
      poste: info.poste || null, permisNumero: info.permisNumero || null, permisType: info.permisType || null, manuel: true };
    try { if (FP.persist && FP.persist.upsert) await FP.persist.upsert('conducteurs', row); } catch (e) { console.warn('[FP.conducteurs.create]', e); }
    try { window.FP_DATA = window.FP_DATA || {}; FP_DATA.conducteurs = FP_DATA.conducteurs || [];
      const ex = FP_DATA.conducteurs.find(c => c.key === key); if (ex) Object.assign(ex, row); else FP_DATA.conducteurs.push(row); } catch (e) {}
    return row;
  }
};

// ================= INDICATEUR « ENREGISTREMENT EN COURS » (overlay centré, TRÈS visible) =========
// ⚠️ RÈGLE (consigne explicite) : à CHAQUE enregistrement/import, montrer clairement que ça travaille
// (spinner « … en cours ») PUIS le résultat (« ✓ … enregistré » / « ✕ échec »), au lieu d'un statut
// discret en bas de page. Usage :
//   const b = FP.busy('Enregistrement en cours…');  … ;  b.done('✓ 3 factures enregistrées');
//   (ou b.fail('Échec : …'))  — b.update('…') pour changer le texte pendant le travail.
FP.busy = (message) => {
  let host = document.getElementById('fp-busy');
  if (!host) {
    if (!document.getElementById('fp-busy-style')) { const st = document.createElement('style'); st.id = 'fp-busy-style'; st.textContent = '@keyframes fpspin{to{transform:rotate(360deg)}}'; document.head.appendChild(st); }
    host = document.createElement('div'); host.id = 'fp-busy';
    host.setAttribute('style', 'position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;background:rgba(15,30,61,.30)');
    host.innerHTML = '<div role="status" aria-live="polite" style="background:#fff;border-radius:14px;box-shadow:0 24px 60px -18px rgba(15,30,61,.55);padding:22px 26px;min-width:250px;max-width:90vw;text-align:center;color:#0F1E3D"><div id="fp-busy-ico" style="margin-bottom:10px;min-height:30px"></div><div id="fp-busy-msg" style="font-weight:600;line-height:1.45;font-size:.95rem"></div></div>';
    document.body.appendChild(host);
  }
  const spin = '<span style="display:inline-block;width:28px;height:28px;border:3px solid #E2E8F0;border-top-color:#F97316;border-radius:50%;animation:fpspin .7s linear infinite"></span>';
  const setIco = (h) => { const el = document.getElementById('fp-busy-ico'); if (el) el.innerHTML = h; };
  const setMsg = (m) => { const el = document.getElementById('fp-busy-msg'); if (el) el.textContent = m || ''; };
  host.style.display = 'flex'; setIco(spin); setMsg(message || 'Enregistrement en cours…');
  const close = () => { if (host) host.style.display = 'none'; };
  return {
    update: setMsg,
    done: (m, ms) => { setIco('<span style="color:#16a34a;font-size:32px;line-height:1">✓</span>'); setMsg(m || '✓ Enregistré'); setTimeout(close, ms == null ? 1900 : ms); },
    fail: (m, ms) => { setIco('<span style="color:#DC2626;font-size:32px;line-height:1">✕</span>'); setMsg(m || "Échec de l'enregistrement"); setTimeout(close, ms == null ? 3800 : ms); },
    close
  };
};

// ================= PRESTATAIRES CARTE CARBURANT / BADGE PÉAGE (nom PAR SOCIÉTÉ, synchronisé) =========
// ⚠️ MULTI-SOCIÉTÉS : chaque société nomme SON prestataire (comme le leasing). PXP = TotalEnergies / Ulys
// par défaut ; toute autre société part sur un libellé générique jusqu'à ce qu'elle règle le sien
// (Paramètres → Société). Stockés dans app_settings (settings.prestataireCarte / .prestataireBadge).
FP.prestataireCarte = () => { try { const v = FP.settings.get().prestataireCarte; if (v && String(v).trim()) return String(v).trim(); } catch (e) {} return (((FP.activeSociete && FP.activeSociete()) || 'PXP') === 'PXP') ? 'TotalEnergies' : 'Carte carburant'; };
FP.prestataireBadge = () => { try { const v = FP.settings.get().prestataireBadge; if (v && String(v).trim()) return String(v).trim(); } catch (e) {} return (((FP.activeSociete && FP.activeSociete()) || 'PXP') === 'PXP') ? 'Ulys' : 'Badge péage'; };

// ===== MULTI-PRESTATAIRES (générique) : Total & Ulys (natifs) + prestataires PERSO ajoutés par l'utilisateur =====
// Chaque prestataire porte : id, nom, type ('carburant' = carte essence | 'peage' = badge de péage), et
// numKey = la clé de réglage qui stocke le n° PAR CONDUCTEUR (settings[numKey][condKey]). Ainsi tout nouveau
// prestataire est « branché » partout automatiquement : champ n° dans la fiche conducteur, colonne dans
// « Cartes & badges », sous-onglet dans Contrôle. Persos synchronisés dans settings.prestatairesPerso.
FP.prestataires = () => {
  const out = [
    { id: 'total', nom: FP.prestataireCarte(), type: 'carburant', builtin: true, numKey: 'condCarteTotal' },
    { id: 'ulys',  nom: FP.prestataireBadge(), type: 'peage',     builtin: true, numKey: 'condBadgeUlys' }
  ];
  try { const p = FP.settings.get().prestatairesPerso; if (Array.isArray(p)) p.forEach(x => { if (x && x.id && x.nom) out.push({ id: x.id, nom: String(x.nom), type: (x.type === 'peage' ? 'peage' : 'carburant'), builtin: false, numKey: 'condNum_' + x.id }); }); } catch (e) {}
  return out;
};
FP.prestataireById = (id) => FP.prestataires().find(p => p.id === id) || null;
FP.addPrestataire = (nom, type) => {
  nom = String(nom || '').trim(); if (!nom) return null;
  const s = FP.settings.get(); const list = Array.isArray(s.prestatairesPerso) ? s.prestatairesPerso.slice() : [];
  const base = (nom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '') || 'presta').slice(0, 14);
  let id = 'p_' + base, n = 1; const taken = new Set(list.map(x => x.id).concat(['total', 'ulys']));
  while (taken.has(id)) id = 'p_' + base + (++n);
  const rec = { id, nom, type: (type === 'peage' ? 'peage' : 'carburant') };
  list.push(rec); s.prestatairesPerso = list; FP.settings.save(s); return rec;
};
FP.removePrestataire = (id) => { if (!id) return; const s = FP.settings.get(); s.prestatairesPerso = (s.prestatairesPerso || []).filter(x => x.id !== id); FP.settings.save(s); };
// n° d'un prestataire pour un conducteur (généralise numCarteConducteur à N prestataires).
FP.condNum = (condKey, numKey) => { try { const v = (FP.settings.get()[numKey] || {})[condKey]; if (v) return v; } catch (e) {} return (FP.numCarteConducteur && (numKey === 'condCarteTotal' || numKey === 'condBadgeUlys')) ? (FP.numCarteConducteur(condKey, numKey) || '') : ''; };
FP.setCondNum = (condKey, numKey, val) => { if (!condKey || !numKey) return; const s = FP.settings.get(); s[numKey] = s[numKey] || {}; val = (val || '').trim(); if (val) s[numKey][condKey] = val; else delete s[numKey][condKey]; FP.settings.save(s); };

// ================= CONGÉS / ABSENCES DES CONDUCTEURS (par société, synchronisé app_settings) =========
// But : repérer une conso carte carburant PENDANT un congé (interdit). On enregistre les périodes
// d'absence PAR CONDUCTEUR (clé = key du conducteur). Stockage partagé (tous les postes) :
//   settings.condConges = { [condKey]: [ { debut:'AAAA-MM-JJ', fin:'AAAA-MM-JJ', motif:'' } ] }.
FP.getAllConges = () => { try { const m = FP.settings.get().condConges; return (m && typeof m === 'object') ? m : {}; } catch (e) { return {}; } };
FP.getConges = (condKey) => { const a = FP.getAllConges()[condKey]; return Array.isArray(a) ? a : []; };
FP.setConges = (condKey, arr) => {
  if (!FP.settings || !condKey) return;
  const s = FP.settings.get(); const m = (s.condConges && typeof s.condConges === 'object') ? s.condConges : {};
  const clean = (Array.isArray(arr) ? arr : []).filter(c => c && c.debut && c.fin).map(c => ({ debut: String(c.debut).slice(0, 10), fin: String(c.fin).slice(0, 10), motif: c.motif || '' }))
    .sort((a, b) => String(a.debut).localeCompare(String(b.debut)));
  if (clean.length) m[condKey] = clean; else delete m[condKey];
  s.condConges = m; FP.settings.save(s);
};
FP.addConge = (condKey, conge) => { if (!conge || !conge.debut || !conge.fin) return; const a = FP.getConges(condKey).slice(); a.push({ debut: conge.debut, fin: conge.fin, motif: conge.motif || '' }); FP.setConges(condKey, a); };
FP.removeConge = (condKey, idx) => { const a = FP.getConges(condKey).slice(); if (idx >= 0 && idx < a.length) { a.splice(idx, 1); FP.setConges(condKey, a); } };
// Le conducteur `condKey` est-il en congé à la date ISO (bornes incluses) ? Renvoie le congé couvrant, ou null.
FP.congeCouvrant = (condKey, dateISO) => {
  if (!condKey || !dateISO) return null;
  const d = String(dateISO).slice(0, 10);
  return FP.getConges(condKey).find(c => c.debut && c.fin && d >= String(c.debut).slice(0, 10) && d <= String(c.fin).slice(0, 10)) || null;
};
FP.estEnConge = (condKey, dateISO) => !!FP.congeCouvrant(condKey, dateISO);
// Un congé du conducteur chevauche-t-il le MOIS `AAAA-MM` ? (pour les conso mensuelles non datées, ex. Ulys).
FP.congeDansMois = (condKey, mois) => {
  if (!condKey || !mois) return null;
  const m = String(mois).slice(0, 7);
  return FP.getConges(condKey).find(c => c.debut && c.fin && String(c.debut).slice(0, 10) <= m + '-31' && String(c.fin).slice(0, 10) >= m + '-01') || null;
};
// Clé conducteur d'une ligne de conso — la plus FIABLE possible, dans l'ordre :
//   1) n° de CARTE/BADGE lu sur la conso → conducteur qui le porte (lien saisi sur la fiche) ;
//   2) NOM du conducteur (nom complet puis prénom) ;
//   3) PLAQUE → chauffeur du véhicule ;
//   4) repli : prénom normalisé du nom lu.
// Indispensable : la conso Total/Ulys est rattachée par carte/plaque, pas toujours par un nom qui
// correspond exactement à la clé du congé. Sans ça, une vraie conso pendant un congé passe inaperçue.
FP.condKeyDeConso = (t) => {
  if (!t) return null;
  const carte = t.carte || t.badge || null;
  if (carte) {
    const s = String(carte);
    // ⚠️ Le badge Ulys est stocké « ULYS-<n°> » : on RETIRE le préfixe « ULYS » avant de comparer au
    // n° de la fiche (sinon les lettres « ULYS » cassent la comparaison « se termine par » quand la
    // fiche porte le n° complet alors que le relevé n'affiche que les derniers chiffres).
    const isUlys = /^ULYS/i.test(s);
    const num = s.replace(/^ULYS[-_\s]*/i, '');
    if (isUlys) {
      try { const c = FP.conducteurParBadgeUlys && FP.conducteurParBadgeUlys(num); if (c && c.key) return c.key; } catch (e) {}
    } else {
      try { const c = FP.conducteurParCarteTotal && FP.conducteurParCarteTotal(s); if (c && c.key) return c.key; } catch (e) {}
      try { const c = FP.conducteurParBadgeUlys && FP.conducteurParBadgeUlys(s); if (c && c.key) return c.key; } catch (e) {}
    }
  }
  const nm = t.conducteur || '';
  if (nm) { try { const c = FP.conducteurs && FP.conducteurs.find ? FP.conducteurs.find(nm) : null; if (c && c.key) return c.key; } catch (e) {} }
  const pl = t.plaque || null;
  if (pl) {
    try {
      const vehs = (window.FP_DATA && FP_DATA.vehicules) || (window.data && data.vehicules) || [];
      const v = vehs.find(x => FP.normImmat(x.immat) === FP.normImmat(pl));
      if (v && v.chauffeur && v.chauffeur !== '—') { const c = FP.conducteurs.find(v.chauffeur); if (c && c.key) return c.key; }
    } catch (e) {}
  }
  return (nm && FP.normPrenom) ? FP.normPrenom(nm) : null;
};
// Nom AFFICHÉ *unifié* d'un conducteur, à partir d'un nom brut lu sur un relevé (Total/Ulys/autre)
// et/ou d'une clé déjà résolue. ⚠️ RÈGLE PROJET (consigne explicite) : une même personne = UN SEUL
// nom affiché — celui de sa FICHE CONDUCTEUR — quel que soit le libellé du relevé (« ROMUALD » seul
// vs « Romuald LAMARQUE-BRUNET », « THOMAS HOCQUET » vs « Thomas HOCQUET »). Tout écran qui affiche
// un nom venant d'une conso/facture DOIT passer par ce helper pour rester unifié partout.
FP.conducteurNomUnifie = (name, key) => {
  try {
    let c = null;
    if (key) c = FP.conducteurs.list().find(x => x.key === key) || null;
    if (!c && name) c = FP.conducteurs.find(name);
    if (!c && key) c = FP.conducteurs.find(key);
    if (c) return FP.conducteurs.displayName(c);
  } catch (e) {}
  return name || key || '';
};
// Détecte les consos survenues PENDANT un congé (interdit). `txList` = transactions DATÉES
// { conducteur (nom), carte, plaque, dateTx:'AAAA-MM-JJ', categorie, montantTtc, produit }. Par défaut
// on regarde TOUS les types de conso (carburant, péage, boutique, lavage…) ; `opts.categories` restreint.
FP.consoPendantConge = (txList, opts) => {
  const o = opts || {}; const cats = (o.categories && o.categories.length) ? o.categories.map(c => String(c).toLowerCase()) : null;
  const out = [];
  (txList || []).forEach(t => {
    if (!t) return;
    // Tolérant camelCase (FP.db) ET snake_case (lecture brute Supabase) : date_tx / montant_ttc.
    const dtx = t.dateTx || t.date_tx; if (!dtx) return;
    const cat = String(t.categorie || '').toLowerCase();
    const mtt = (t.montantTtc != null ? t.montantTtc : t.montant_ttc);
    if (cats && cats.indexOf(cat) === -1) return;
    // Une même personne peut avoir plusieurs « clés » selon comment son nom est écrit (prénom seul,
    // prénom+nom) ou d'où vient la conso (carte/badge). On teste le congé sous TOUTES les clés
    // plausibles (la plus fiable d'abord) pour ne RATER aucune conso réellement faite pendant un congé.
    const cand = [];
    const k1 = FP.condKeyDeConso(t); if (k1) cand.push(k1);
    try { const c = FP.conducteurs && FP.conducteurs.find ? FP.conducteurs.find(t.conducteur) : null; if (c && c.key && cand.indexOf(c.key) < 0) cand.push(c.key); } catch (e) {}
    const np = (FP.normPrenom && t.conducteur) ? FP.normPrenom(t.conducteur) : null;
    if (np && cand.indexOf(np) < 0) cand.push(np);
    // + TOUTE clé de congé du MÊME prénom (ex. congé saisi sous la fiche « romuald-lamarque-brunet »
    //   alors que la conso se résout vers « romuald ») → sinon la conso pendant congé passe inaperçue.
    if (np) { try { Object.keys(FP.getAllConges()).forEach(k => { if (String(k).split(/[-\s]/)[0] === np && cand.indexOf(k) < 0) cand.push(k); }); } catch (e) {} }
    let cg = null, key = null;
    for (const k of cand) { const g = FP.congeCouvrant(k, dtx); if (g) { cg = g; key = k; break; } }
    // Nom AFFICHÉ = celui de la fiche conducteur (unifié), jamais le libellé brut du relevé.
    if (cg) out.push({ conducteur: FP.conducteurNomUnifie(t.conducteur, key), conducteurBrut: t.conducteur || '', key, date: dtx, montant: mtt, categorie: cat, produit: t.produit, conge: cg, facnum: t.facnum || t.facNum || '', carte: t.carte || '', plaque: t.plaque || '' });
  });
  return out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
};
// Libellé lisible d'une catégorie de conso (carte carburant / péage).
FP.consoCatLabel = (cat) => ({ carburant: 'plein carburant', peage: 'péage', boutique: 'achat boutique', lavage: 'lavage', parking: 'parking', adblue: 'AdBlue' })[String(cat || '').toLowerCase()] || 'achat';

// Détecte les consos survenues APRÈS le DÉPART du conducteur : une carte/badge encore active pour un
// salarié dont l'affectation (au véhicule) est TERMINÉE avant la date de la conso — signe que la carte
// n'a pas été désactivée / est utilisée par quelqu'un d'autre. S'appuie sur l'historique d'affectation
// (FP.affectations) + les transactions datées (total_conso_tx). Renvoie une liste d'anomalies.
FP.consoApresDepart = (txList) => {
  const out = [];
  if (!FP.affectations || !FP.affectations.forConducteur) return out;
  (txList || []).forEach(t => {
    if (!t) return;
    const dtx = t.dateTx || t.date_tx; if (!dtx) return;
    const key = FP.condKeyDeConso ? FP.condKeyDeConso(t) : null; if (!key) return;
    const nom = FP.conducteurNomUnifie ? FP.conducteurNomUnifie(t.conducteur, key) : (t.conducteur || key);
    if (!nom) return;
    const periodes = FP.affectations.forConducteur(nom);
    if (!periodes || !periodes.length) return;                    // pas d'historique → on ne juge pas
    // Une période "couvre" la conso si debut ≤ dtx ≤ (fin ou +∞). Si UNE période ouverte/couvrante existe → OK.
    const couvre = periodes.some(p => (!p.debut || String(p.debut) <= dtx) && (!p.fin || dtx <= String(p.fin)));
    if (couvre) return;
    // Sinon : la conso tombe hors de toute période. Si TOUTES les périodes sont closes AVANT la conso
    // (le salarié était déjà parti), c'est une conso « après départ ».
    const fins = periodes.map(p => p.fin).filter(Boolean).map(String).sort();
    const derniereFin = fins.length ? fins[fins.length - 1] : null;
    if (derniereFin && dtx > derniereFin) {
      const mtt = (t.montantTtc != null ? t.montantTtc : t.montant_ttc);
      out.push({ conducteur: nom, key, date: dtx, montant: mtt, categorie: String(t.categorie || '').toLowerCase(),
        produit: t.produit, facnum: t.facnum || t.facNum || '', carte: t.carte || '', plaque: t.plaque || '', finAffect: derniereFin });
    }
  });
  return out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
};

// ================= RATTACHEMENT CONSO → CONDUCTEUR PAR N° DE CARTE / BADGE =================
// Chaque conducteur peut porter un n° de carte carburant Total et un n° de badge péage Ulys
// (réglages `condCarteTotal` / `condBadgeUlys`, par société — cf. fiche conducteur). Ces numéros
// servent à attribuer la conso des onglets Total Fleet / Ulys à la BONNE personne, par NUMÉRO
// (fiable) plutôt que par nom (fragile). ⚠️ Retirer un numéro d'une fiche N'EFFACE PAS la conso
// déjà enregistrée : ça enlève seulement le lien pour les prochains imports / l'affichage.
FP.normCarte = (s) => (s == null ? '' : String(s)).toUpperCase().replace(/[^A-Z0-9]/g, '');
// Deux numéros « collent » si l'un se termine par l'autre (un relevé n'affiche souvent que les
// derniers chiffres de la carte/badge). On exige ≥ 4 caractères communs pour rester fiable.
FP.carteMatch = (enregistre, lu) => {
  const a = FP.normCarte(enregistre), b = FP.normCarte(lu);
  if (!a || !b) return false;
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 4) return false;
  return a.endsWith(b) || b.endsWith(a);
};
FP._condParNumero = (settingKey, lu) => {
  if (!lu || !FP.settings) return null;
  let map; try { map = FP.settings.get()[settingKey] || {}; } catch (e) { return null; }
  const b = FP.normCarte(lu); if (!b) return null;
  // 1) Match EXACT prioritaire (jamais ambigu) : on tranche tout de suite.
  for (const key in map) { if (FP.normCarte(map[key]) === b) return _condOut(key); }
  // 2) Match par SUFFIXE (un n° tronqué « …1234 ») : on ne devine PAS si plusieurs cartes
  //    partagent les mêmes derniers chiffres (2 cartes → 2 conducteurs) — sinon fausse attribution.
  const partiels = [];
  for (const key in map) { if (FP.carteMatch(map[key], lu)) partiels.push(key); }
  if (partiels.length === 1) return _condOut(partiels[0]);
  return null; // 0 ou ≥2 correspondances partielles → on laisse le repli nom/plaque décider
  function _condOut(key) { let name = key; try { const c = FP.conducteurs.list().find(x => x.key === key); if (c) name = FP.conducteurs.displayName(c); } catch (e) {} return { key, name }; }
};
// Conducteur associé à un n° de carte Total / badge Ulys enregistré sur une fiche conducteur (ou null).
FP.conducteurParCarteTotal = (lu) => FP._condParNumero('condCarteTotal', lu);
FP.conducteurParBadgeUlys  = (lu) => FP._condParNumero('condBadgeUlys', lu);
// Attribution d'une conso Total à partir du n° de carte : 1) fiche CONDUCTEUR (prioritaire) ;
// 2) fiche VÉHICULE (rubrique Contrats → réglage `vehCarteCarb`) → chauffeur + plaque du véhicule.
// Renvoie { conducteur, plaque } ou null (on laisse alors le repli nom/plaque habituel).
FP.attributionCarteTotal = (lu) => {
  if (!lu) return null;
  const c = FP.conducteurParCarteTotal(lu);
  if (c) return { conducteur: c.name, plaque: null };
  try {
    const map = FP.settings.get().vehCarteCarb || {};
    const vehs = (window.FP_DATA && FP_DATA.vehicules) || (window.data && data.vehicules) || [];
    const b = FP.normCarte(lu);
    const vehOf = (vid) => vehs.find(x => String(x.id) === String(vid));
    const outOf = (v) => ({ conducteur: (v.chauffeur && v.chauffeur !== '—') ? v.chauffeur : null, plaque: v.immat || null });
    // 1) Match EXACT prioritaire (jamais ambigu).
    for (const vid in map) { if (FP.normCarte(map[vid]) === b) { const v = vehOf(vid); if (v) return outOf(v); } }
    // 2) Match par SUFFIXE : on n'attribue PAS si ≥2 véhicules partagent les mêmes derniers chiffres
    //    (même garde anti-ambiguïté que FP._condParNumero — sinon fausse attribution plaque/chauffeur).
    const partiels = [];
    for (const vid in map) { if (FP.carteMatch(map[vid], lu)) partiels.push(vid); }
    if (partiels.length === 1) { const v = vehOf(partiels[0]); if (v) return outOf(v); }
  } catch (e) {}
  return null;
};
// ---- UNE SEULE BRANCHE : le n° de carte Total / badge Ulys se range sur le CONDUCTEUR ----
// Les fiches VÉHICULE et la rubrique Contrats « Cartes carburant » affichent/éditent le MÊME numéro
// que la fiche conducteur (celui du chauffeur du véhicule). Ainsi, changer le n° à un endroit le
// change PARTOUT. Repli sur l'ancien stockage par véhicule si le véhicule n'a pas de chauffeur reconnu.
FP.CARTE_COND_MAP = { vehCarteCarb: 'condCarteTotal', vehBadge: 'condBadgeUlys' };
FP.condKeyDuVehicule = (v) => {
  if (!v || !v.chauffeur || v.chauffeur === '—') return null;
  try { const c = FP.conducteurs.find(v.chauffeur); return c ? c.key : null; } catch (e) { return null; }
};
// Lit le n° d'un véhicule en privilégiant le CONDUCTEUR (source unique), repli sur le n° par véhicule.
FP.numCarteVehicule = (v, vehKey) => {
  try {
    const s = FP.settings.get();
    const condMapKey = FP.CARTE_COND_MAP[vehKey];
    const condKey = FP.condKeyDuVehicule(v);
    if (condKey && condMapKey) { const cv = (s[condMapKey] || {})[condKey]; if (cv) return cv; }
    return (s[vehKey] || {})[v.id] || '';
  } catch (e) { return ''; }
};
// Écrit un n° de carte/badge édité depuis une fiche véhicule / Contrats : va sur le CONDUCTEUR
// (chauffeur reconnu), sinon repli sur le stockage par véhicule. Ne concerne QUE les champs "numéro".
FP.setNumCarteVehicule = (v, vehKey, val) => {
  const s = FP.settings.get();
  const condMapKey = FP.CARTE_COND_MAP[vehKey];
  const condKey = FP.condKeyDuVehicule(v);
  let k = vehKey, id = v.id;
  if (condKey && condMapKey) { k = condMapKey; id = condKey; }
  s[k] = s[k] || {};
  val = (val || '').trim();
  if (val) s[k][id] = val; else delete s[k][id];
  FP.settings.save(s);
};
// Lu depuis une fiche CONDUCTEUR : n° enregistré sur le conducteur, sinon repli d'affichage sur un
// n° saisi par le passé sur un VÉHICULE qu'il conduit (pour que les deux fiches montrent la même
// valeur avant première édition). condMapKey ∈ { 'condCarteTotal', 'condBadgeUlys' }.
FP.numCarteConducteur = (condKey, condMapKey) => {
  try {
    const s = FP.settings.get();
    const direct = (s[condMapKey] || {})[condKey]; if (direct) return direct;
    const vehKey = Object.keys(FP.CARTE_COND_MAP).find(k => FP.CARTE_COND_MAP[k] === condMapKey);
    if (!vehKey) return '';
    const map = s[vehKey] || {};
    const vehs = (window.FP_DATA && FP_DATA.vehicules) || [];
    for (const v of vehs) { if (map[v.id] && FP.condKeyDuVehicule(v) === condKey) return map[v.id]; }
    return '';
  } catch (e) { return ''; }
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
// ⚠️ « Tombstone » des sociétés SUPPRIMÉES : une société supprimée pouvait « revenir » via une synchro
// (réglages serveur, compte résiduel, autre poste). On tient donc une liste des sociétés supprimées et
// getSocietes la FILTRE toujours → une société supprimée ne réapparaît JAMAIS (sauf si on la recrée).
FP.SOCIETES_DEL_KEY = 'fp_societes_deleted';
FP.getSocietesDeleted = () => {
  const set = new Set();
  try { (JSON.parse(localStorage.getItem(FP.SOCIETES_DEL_KEY) || '[]') || []).forEach(x => set.add(String(x).trim().toLowerCase())); } catch (e) {}
  try { (FP.settings.get().societesDeleted || []).forEach(x => set.add(String(x).trim().toLowerCase())); } catch (e) {}
  set.delete('pxp');
  return [...set];
};
FP.getSocietes = () => {
  let arr = null;
  try { arr = JSON.parse(localStorage.getItem(FP.SOCIETES_KEY) || 'null'); } catch (e) {}
  if (!Array.isArray(arr) || !arr.length) { try { arr = (FP.settings.get().societes || []).slice(); } catch (e) { arr = []; } }
  if (!Array.isArray(arr)) arr = [];
  if (!arr.includes('PXP')) arr.unshift('PXP');
  // Filtre les sociétés supprimées (tombstone) + dédoublonne (garde toujours PXP).
  const del = FP.getSocietesDeleted();
  const seen = new Set();
  arr = arr.filter(s => {
    const k = String(s).trim().toLowerCase();
    if (k !== 'pxp' && del.includes(k)) return false;
    if (seen.has(k)) return false; seen.add(k); return true;
  });
  return arr;
};
FP.addSociete = (name) => {
  name = (name || '').trim(); if (!name) return false;
  // Recréer une société supprimée = lever son tombstone (sinon getSocietes la re-filtrerait).
  try { const d = (JSON.parse(localStorage.getItem(FP.SOCIETES_DEL_KEY) || '[]') || []).filter(x => String(x).trim().toLowerCase() !== name.toLowerCase()); localStorage.setItem(FP.SOCIETES_DEL_KEY, JSON.stringify(d)); } catch (e) {}
  try { const s = FP.settings.get(); if (Array.isArray(s.societesDeleted)) { s.societesDeleted = s.societesDeleted.filter(x => String(x).trim().toLowerCase() !== name.toLowerCase()); FP.settings.save(s); } } catch (e) {}
  const arr = FP.getSocietes();
  if (arr.some(x => x.toLowerCase() === name.toLowerCase())) return false;
  arr.push(name);
  try { localStorage.setItem(FP.SOCIETES_KEY, JSON.stringify(arr)); } catch (e) {}
  return true;
};
// Retire une société de la LISTE (registre) — CEO only côté UI. La maison « PXP » est protégée.
// ⚠️ Ne supprime PAS les données (véhicules/amendes…) déjà en base : elles restent isolées par RLS,
// juste plus sélectionnables. Nettoie le registre local + la config partagée + pose un TOMBSTONE.
FP.removeSociete = (name) => {
  name = (name || '').trim();
  if (!name || name.toLowerCase() === 'pxp') return false;
  let arr = FP.getSocietes().filter(x => String(x).toLowerCase() !== name.toLowerCase());
  if (!arr.includes('PXP')) arr.unshift('PXP');
  try { localStorage.setItem(FP.SOCIETES_KEY, JSON.stringify(arr)); } catch (e) {}
  // Tombstone local (bloque tout retour via synchro, même hors-ligne).
  try { const d = JSON.parse(localStorage.getItem(FP.SOCIETES_DEL_KEY) || '[]') || []; if (!d.map(x => String(x).trim().toLowerCase()).includes(name.toLowerCase())) { d.push(name); localStorage.setItem(FP.SOCIETES_DEL_KEY, JSON.stringify(d)); } } catch (e) {}
  try {
    const s = FP.settings.get();
    if (Array.isArray(s.societes)) { s.societes = s.societes.filter(x => String(x).toLowerCase() !== name.toLowerCase()); if (!s.societes.includes('PXP')) s.societes.unshift('PXP'); }
    s.societesDeleted = Array.isArray(s.societesDeleted) ? s.societesDeleted : [];
    if (!s.societesDeleted.map(x => String(x).trim().toLowerCase()).includes(name.toLowerCase())) s.societesDeleted.push(name);
    FP.settings.save(s);
  } catch (e) {}
  return true;
};
// SÉCURITÉ MULTI-PC : `fp_societe` (société active) est stockée PAR APPAREIL. Si cette société a été
// SUPPRIMÉE (sur un autre poste → tombstone synchronisé via settings.societesDeleted), ce poste ne
// doit pas rester « coincé » dessus (sinon on voit une société fantôme, vide). On revient sur PXP.
// Appelé après la synchro des réglages (fp:data-ready), quand getSocietes() reflète les suppressions.
FP.ensureValidSociete = () => {
  try {
    const cur = FP.activeSociete();
    if (cur === 'PXP' || cur === '__all__') return false;
    const list = (FP.getSocietes ? FP.getSocietes() : ['PXP']).map(x => String(x).trim().toLowerCase());
    if (!list.includes(String(cur).trim().toLowerCase())) { FP.setActiveSociete('PXP'); return true; }
  } catch (e) {}
  return false;
};
document.addEventListener('fp:data-ready', () => {
  try {
    if (FP.ensureValidSociete && FP.ensureValidSociete() && !sessionStorage.getItem('fp_soc_reset')) {
      sessionStorage.setItem('fp_soc_reset', '1'); // anti-boucle
      location.reload(); // recharge proprement les données de PXP
    }
  } catch (e) {}
});
// Modèles d'e-mail par défaut (amende) — source UNIQUE, réutilisée par amendes.html ET
// pré-affichée dans Paramètres pour que l'utilisateur les voie et puisse les personnaliser.
FP.MAIL_DEFAUT = {
  paiement: `Bonjour {prenom}\n\nSauf erreur de ma part, il s'agit de ton véhicule.\nPeux-tu régler cette contravention et m'envoyer le justificatif s'il te plaît ?\n\nMerci d'avance`,
  designation: `Bonjour {prenom},\n\nSauf erreur de ma part, il s'agit de ton véhicule.\nPeux-tu me confirmer afin que je puisse effectuer la désignation ?\n\nMerci de ne pas régler la contravention.\n\nCordialement.`,
  relance: `Bonjour {prenom},\n\nPetite relance concernant la contravention ci-dessous.\nMerci d'avance.`,
};
// Champs du profil société (rendu générique : le formulaire de Paramètres itère dessus).
// Un champ avec `default` est PRÉ-REMPLI avec ce texte quand la valeur est vide (l'utilisateur le voit).
FP.PROFIL_CHAMPS = [
  { key: 'mailExpediteur',     label: "E-mail d'envoi des amendes",       type: 'email', ph: 'ex. contact@masociete.fr' },
  { key: 'mailCopie',          label: 'E-mails en copie (séparés par ,)', type: 'text',  ph: 'ex. compta@masociete.fr, direction@masociete.fr' },
  { key: 'mailDomaineEnvoi',   label: "Domaine d'envoi vérifié (Resend)", type: 'text',  ph: 'ex. resend.masociete.fr — le domaine validé dans Resend (le mail part de <ton adresse>@ce-domaine, réponse vers l’e-mail ci-dessus)' },
  // Prestataires carte carburant / badge péage PROPRES à la société (comme le loueur). Vide = valeur
  // par défaut (PXP → TotalEnergies / Ulys ; autre société → libellé générique). Sert aux libellés
  // partout (fiches, Total Fleet, Ulys) et au rattachement de la conso.
  { key: 'prestataireCarte',   label: 'Prestataire carte carburant',      type: 'text',  ph: 'ex. TotalEnergies, Shell, BP… (vide = TotalEnergies pour PXP)' },
  { key: 'prestataireBadge',   label: 'Prestataire badge de péage',       type: 'text',  ph: 'ex. Ulys, Fulli, Bip&Go… (vide = Ulys pour PXP)' },
  // ⚠️ Les LOUEURS (BPCE, Ayvens…) se gèrent dans l'onglet CONTRATS (liste multi-loueurs
  // settings.loueurs), PAS ici. On n'expose donc PAS loueurNom/proprietaireLeasing dans le
  // formulaire Paramètres (les valeurs restent en base pour la rétro-compat / le repli PXP).
  { key: 'mailModelePaiement',   label: "Modèle e-mail — demande de paiement",     type: 'textarea', ph: 'Écris {prenom} pour insérer le prénom.', default: FP.MAIL_DEFAUT.paiement },
  { key: 'mailModeleDesignation',label: "Modèle e-mail — demande de désignation",  type: 'textarea', ph: 'Écris {prenom}.', default: FP.MAIL_DEFAUT.designation },
  { key: 'mailModeleRelance',    label: "Modèle e-mail — relance",                 type: 'textarea', ph: 'Écris {prenom}.', default: FP.MAIL_DEFAUT.relance },
  { key: 'mailSignature',        label: "Signature (bas des e-mails d'amende)",    type: 'textarea', ph: 'Colle ta signature — texte simple OU le CODE HTML de ta signature Gmail (avec logo/images). Le HTML est envoyé tel quel (le logo s\'affiche). Astuce : Gmail → Paramètres → Signature ; ou clic droit « Inspecter » sur ta signature → copier l\'élément.' },
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
    ? { mailExpediteur: 'shakil.nubee@projectxparis.fr',
        mailCopie: 'shakil.nubee@projectxparis.fr,mallaury.herembert@projectxparis.fr',
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
    const d = window.FP_DATA;
    if (d) ['vehicules', 'amendes', 'factures', 'conducteurs'].forEach(k => {
      const arr = d[k]; if (!Array.isArray(arr)) return;
      for (let i = arr.length - 1; i >= 0; i--) { if (((arr[i] && arr[i].societe) || 'PXP') !== s) arr.splice(i, 1); }
    });
    // FP_DOCS (permis intégrés par prénom + mémos assurance par plaque) = données PXP EN DUR
    // (fleet-docs.js). Sans filtre, un conducteur d'une autre société portant le même prénom
    // qu'un salarié PXP hériterait de son permis. → on les neutralise hors PXP.
    if (window.FP_DOCS) window.FP_DOCS = { assurance: {}, permis: {} };
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

// === jsPDF paresseux : chargé À LA DEMANDE (1er export), pas à l'ouverture de la page ===
// jsPDF + autotable pèsent ~400 Ko et ne servent QU'au clic sur un bouton « Télécharger PDF ».
// Les charger en <script defer> bloquait l'init de chaque page (DOMContentLoaded attendait le
// parse de 400 Ko) → navigation ralentie. On les injecte donc dynamiquement (async, non bloquant)
// à la 1re demande, et on lance un préchargement discret dès que la page est libre (requestIdle).
// FP.ensureJsPDF() renvoie une promesse résolue quand window.jspdf.jsPDF est prêt.
FP.ensureJsPDF = function () {
  if (window._jspdfReady) return window._jspdfReady;
  if (window.jspdf && window.jspdf.jsPDF) { window._jspdfReady = Promise.resolve(true); return window._jspdfReady; }
  window._jspdfReady = new Promise((resolve, reject) => {
    try {
      const base = location.pathname.indexOf('/pages/') !== -1 ? '../' : './';
      let ver = '';
      try { const s = document.querySelector('script[src*="app.js"]'); const m = s && s.src && s.src.match(/\?v=[^"'&]+/); if (m) ver = m[0]; } catch (e) {}
      const load = (src) => new Promise((res, rej) => {
        const sc = document.createElement('script'); sc.src = src + ver; sc.async = true;
        sc.onload = res; sc.onerror = rej; document.head.appendChild(sc);
      });
      load(base + 'assets/js/vendor/jspdf.umd.min.js')
        .then(() => load(base + 'assets/js/vendor/jspdf.plugin.autotable.min.js'))
        .then(() => resolve(true))
        .catch(reject);
    } catch (e) { reject(e); }
  });
  return window._jspdfReady;
};
// Préchargement discret sur les pages qui ont des exports PDF (marqueur window.FP_PDF), une fois
// la page interactive → le clic « PDF » est immédiat, sans jamais bloquer le chargement de l'onglet.
(function preloadJsPDF() {
  try {
    if (!window.FP_PDF) return;
    const kick = () => { try { FP.ensureJsPDF(); } catch (e) {} };
    if ('requestIdleCallback' in window) requestIdleCallback(kick, { timeout: 2500 });
    else setTimeout(kick, 1200);
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
      // clic sur un VRAI lien de navigation → on referme le tiroir.
      // ⚠️ Exception : les liens internes (href="#") et les bascules de sous-menu
      // (ex. l'entête « JIS » qui déplie ses sous-onglets) ne doivent PAS fermer le
      // tiroir — sinon cliquer JIS referme tout le menu au lieu de l'ouvrir.
      sb.addEventListener('click', (e) => {
        const a = e.target.closest('a[href]');
        if (!a) return;
        const href = a.getAttribute('href') || '';
        if (href === '#' || href.charAt(0) === '#' || a.classList.contains('fp-jis-toggle')) return;
        close();
      });
      addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
      if (window.lucide && lucide.createIcons) { try { lucide.createIcons(); } catch (e) {} }
    } catch (e) {}
  };
  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
})();

// === Menus déroulants : rester dans l'écran sur mobile (ne jamais couper) ======
// Un menu « position:absolute; right:0 » ancré à un bouton proche du bord gauche
// débordait hors écran à gauche (ex. Raccourcis). Après CHAQUE ouverture, on
// recale horizontalement tout menu déroulant visible pour qu'il tienne dans la
// fenêtre — position-agnostique (gauche OU droite). Les menus « position:fixed »
// (FP.searchSelect) se placent déjà seuls → ignorés.
FP.clampDropdowns = () => {
  try {
    if (window.innerWidth > 640) return;
    const vw = window.innerWidth, M = 8;
    document.querySelectorAll('#sc-menu, #soc-menu, .fp-export-menu, .fp-menu').forEach(m => {
      if (!m || m.classList.contains('hidden')) return;
      const cs = getComputedStyle(m);
      if (cs.display === 'none' || cs.position === 'fixed') return;
      m.style.transform = 'none';
      const r = m.getBoundingClientRect();
      if (r.width < 2) return;
      let dx = 0;
      if (r.right > vw - M) dx = (vw - M) - r.right;   // déborde à droite → décaler à gauche
      if (r.left + dx < M) dx = M - r.left;            // déborde à gauche → décaler à droite
      if (dx) m.style.transform = 'translateX(' + Math.round(dx) + 'px)';
    });
  } catch (e) {}
};
document.addEventListener('click', () => setTimeout(FP.clampDropdowns, 0), true);
window.addEventListener('resize', () => { try { FP.clampDropdowns(); } catch (e) {} });

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
    prestataires: undefined, // garages / prestataires PROPRES À CHAQUE SOCIÉTÉ [ {id,nom,adresse,email,tel} ] — semé une fois (PXP hérite de son garage historique, autres = vide). undefined = jamais initialisé (déclenche le semis)
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
        // Groupes PERSO créés par l'utilisateur (clés absentes des 8 défauts) : on les ajoute tels
        // quels. Marqués `custom:true` → l'UI n'autorise la SUPPRESSION que sur ceux-là.
        Object.keys(stored.groupes).forEach(k => {
          if (!merged.groupes[k] && stored.groupes[k] && stored.groupes[k].label) {
            merged.groupes[k] = { label: stored.groupes[k].label, color: stored.groupes[k].color || '#94A3B8', custom: true };
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
    // société). Écriture par FUSION « delta » anti-écrasement (voir _pushSettings) — sinon deux
    // postes admin qui enregistrent en même temps s'écrasaient (le dernier gagnait, l'autre perdait
    // ses ajouts). Passe par la file de sécurité : renvoyé auto si la base est momentanément injoignable.
    this._pushSettings(obj);
  },
  // Réf. = ce que le serveur contenait au dernier chargement/écriture (posé par supabase-client au load).
  // Sert à ne réécrire QUE les clés que CE poste a modifiées (le « delta »).
  _serverSnap: null,
  _pushSettings(obj) {
    const self = this;
    let id; try { id = this._dbId(); } catch (e) { id = 'global'; }
    const plainUpsert = (data) => {
      try {
        if (FP.persist && FP.persist.upsert) FP.persist.upsert('app_settings', { id, data });
        else if (FP.db && FP.supabase) FP.db.upsert('app_settings', { id, data });
      } catch (e) {}
    };
    const base = (this._serverSnap && typeof this._serverSnap === 'object') ? this._serverSnap : null;
    // Sans point de référence (pas encore chargé depuis le serveur) OU sans Supabase : comportement
    // d'avant (on écrit le blob local tel quel). Aucun risque de régression.
    if (!base || !(FP.supabase && FP.supabase.from)) { this._serverSnap = null; plainUpsert(obj); return; }
    (async () => {
      try {
        const r = await FP.supabase.from('app_settings').select('data').eq('id', id).maybeSingle();
        const remote = (r && r.data && r.data.data && typeof r.data.data === 'object') ? r.data.data : null;
        if (!remote) { self._serverSnap = JSON.parse(JSON.stringify(obj)); plainUpsert(obj); return; }
        // On repart de la version FRAÎCHE du serveur, et on n'y applique QUE les clés que CE poste a
        // changées depuis son dernier sync (obj vs base) : ajout/màj = on pose notre valeur ;
        // suppression = on retire la clé. → les modifs d'un AUTRE poste sont préservées, et une
        // suppression reste une suppression (pas de « resurrection »).
        const merged = { ...remote };
        const keys = new Set([...Object.keys(obj), ...Object.keys(base)]);
        keys.forEach(k => {
          const changedHere = JSON.stringify(obj[k]) !== JSON.stringify(base[k]);
          if (changedHere) { if (Object.prototype.hasOwnProperty.call(obj, k)) merged[k] = obj[k]; else delete merged[k]; }
        });
        self._serverSnap = JSON.parse(JSON.stringify(merged));
        // Le local se met à jour vers la fusion (il récupère aussi les changements de l'autre poste).
        try { localStorage.setItem(self._key(), JSON.stringify(merged)); } catch (_) {}
        plainUpsert(merged);
      } catch (e) {
        // Base momentanément injoignable / erreur : repli sur l'écriture simple (comme avant).
        plainUpsert(obj);
      }
    })();
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
    // Règles .dot-<k> / .gp-<k> générées pour TOUS les groupes (8 défauts + perso) : ainsi un groupe
    // personnalisé (ex. « direction ») reçoit sa couleur partout (pastilles, onglets, filtres) sans
    // toucher chaque page. La feuille de style de base ne définit que les 8 défauts.
    try {
      let st = document.getElementById('fp-grp-style');
      if (!st) { st = document.createElement('style'); st.id = 'fp-grp-style'; (document.head || document.documentElement).appendChild(st); }
      st.textContent = Object.keys(s.groupes)
        .filter(k => /^[a-z0-9-]+$/.test(k))                       // clés sûres pour un sélecteur CSS
        .map(k => `.dot-${k},.gp-${k} .dot{background:var(--grp-${k})}`).join('');
    } catch (e) {}
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
    // Mode sombre 🌙 — SYNCHRONISÉ (règle 0-sync) : lu depuis les réglages, cache local pour l'instant.
    if (document.body) { try { const p = (this.get().prefs || {}); const dk = (p.darkMode != null) ? !!p.darkMode : (localStorage.getItem('fp_dark_mode') === '1'); document.body.classList.toggle('fp-dark', dk); } catch (e) {} }
  },
};

// === Graphiques (Chart.js) — couleurs lisibles selon le thème (clair/sombre) ===
// Encre « primaire » des barres/lignes : navy en clair, bleu clair en sombre (invisible sinon sur
// fond nuit). Tout graphique dont la couleur de série était #0F1E3D doit passer par FP.chartInk().
FP.chartInk = () => { try { return (FP.settings && FP.settings.isDark && FP.settings.isDark()) ? '#60A5FA' : '#0F1E3D'; } catch (e) { return '#0F1E3D'; } };
// Applique aux défauts Chart.js la couleur du TEXTE (axes/légende) et des GRILLES selon le thème.
FP.setupChartTheme = () => {
  try {
    if (!window.Chart || !window.Chart.defaults) return;
    const dark = FP.settings && FP.settings.isDark && FP.settings.isDark();
    window.Chart.defaults.color = dark ? '#cbd5e1' : '#475569';
    window.Chart.defaults.borderColor = dark ? 'rgba(148,163,184,.18)' : 'rgba(15,30,61,.08)';
    // Police plus GRANDE et lisible partout (légendes, axes) — les libellés par défaut (11-12px)
    // étaient trop petits, surtout les légendes de camemberts.
    if (window.Chart.defaults.font) window.Chart.defaults.font.size = 13;
    try { window.Chart.defaults.plugins.legend.labels.font = { size: 13 }; window.Chart.defaults.plugins.legend.labels.boxWidth = 14; window.Chart.defaults.plugins.legend.labels.padding = 12; } catch (e) {}
  } catch (e) {}
};
try { FP.setupChartTheme(); } catch (e) {}
document.addEventListener('DOMContentLoaded', () => { try { FP.setupChartTheme(); } catch (e) {} });
document.addEventListener('fp:data-ready', () => { try { FP.setupChartTheme(); } catch (e) {} });

// === Dernier sous-onglet ouvert d'une page (rouvre là où l'utilisateur était) ===
// RÈGLE (consigne explicite) : chaque page à sous-onglets doit rouvrir sur le DERNIER onglet consulté.
// Synchronisé (FP.settings → tous les appareils, règle 0-sync). pageKey = id court ('controle'…).
FP.lastTab = {
  get(pageKey, def) { try { const m = FP.settings.get().lastTab || {}; return m[pageKey] || def; } catch (e) { return def; } },
  set(pageKey, tabId) {
    try {
      const s = FP.settings.get(); const m = s.lastTab || {};
      if (m[pageKey] === tabId || !tabId) return; // pas d'écriture inutile
      m[pageKey] = tabId; s.lastTab = m; FP.settings.save(s);
    } catch (e) {}
  },
};

// ⚠️ RÈGLE 0-sync — PRÉFÉRENCE UTILISATEUR SYNCHRONISÉE (tous les appareils) : stockée dans les réglages
// (FP.settings → app_settings, par société) sous s.prefs[<clé>], avec localStorage comme simple cache
// rapide. À utiliser pour TOUT réglage/choix d'affichage (favoris, filtres, ordres, cases, styles…).
FP.pref = {
  get(key, dflt) {
    try { const p = (FP.settings.get().prefs) || {}; if (Object.prototype.hasOwnProperty.call(p, key)) return p[key]; } catch (e) {}
    try { const v = localStorage.getItem(key); if (v != null) { try { return JSON.parse(v); } catch (e) { return v; } } } catch (e) {}
    return dflt;
  },
  set(key, val) {
    try { const s = FP.settings.get(); s.prefs = s.prefs || {}; s.prefs[key] = val; FP.settings.save(s); } catch (e) {}
    try { localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val)); } catch (e) {}
  },
  remove(key) {
    try { const s = FP.settings.get(); if (s.prefs) { delete s.prefs[key]; FP.settings.save(s); } } catch (e) {}
    try { localStorage.removeItem(key); } catch (e) {}
  },
};

// Mode sombre 🌙 — SYNCHRONISÉ sur tous les appareils (via FP.settings.prefs.darkMode) + cache local.
FP.darkMode = {
  get() {
    try { const p = FP.settings.get().prefs || {}; if (p.darkMode != null) return !!p.darkMode; } catch (e) {}
    try { return localStorage.getItem('fp_dark_mode') === '1'; } catch (e) { return false; }
  },
  set(v) {
    v = !!v;
    try { localStorage.setItem('fp_dark_mode', v ? '1' : '0'); } catch (e) {}
    try { const s = FP.settings.get(); s.prefs = s.prefs || {}; s.prefs.darkMode = v; FP.settings.save(s); } catch (e) {}
    if (FP.settings && FP.settings.applyTheme) FP.settings.applyTheme();
  },
  toggle() { this.set(!this.get()); return this.get(); },
};

// « Ignorer » réutilisable (toute la plateforme) : masque une info manquante / une alerte
// pour qu'elle ne compte plus (ex. conformité, CO₂ à compléter…). Clé libre (ex. 'conf:ct:<id>').
// Mémorisé PAR SOCIÉTÉ dans les réglages (settings.ignores) ; get() conserve la clé automatiquement.
FP.ignore = {
  _all() { try { return FP.settings.get().ignores || {}; } catch (e) { return {}; } },
  has(key) { return !!this._all()[key]; },
  // Valeur stockée : `true` (legacy) OU `{ l: '<libellé lisible>' }`. Le libellé sert à afficher
  // la liste des éléments ignorés (pour en réafficher UN SEUL) sans tout réafficher d'un coup.
  set(key, on, label) { try { const s = FP.settings.get(); s.ignores = s.ignores || {}; if (on) s.ignores[key] = label ? { l: String(label) } : true; else delete s.ignores[key]; FP.settings.save(s); } catch (e) {} },
  toggle(key, label) { this.set(key, !this.has(key), label); return this.has(key); },
  label(key) { const v = this._all()[key]; return (v && typeof v === 'object' && v.l) ? v.l : ''; },
  // Liste des clés ignorées sous un préfixe, avec leur libellé → pour un gestionnaire « voir / réafficher ».
  list(prefix) { const all = this._all(); return Object.keys(all).filter(k => !prefix || k.indexOf(prefix) === 0).map(k => ({ key: k, label: (all[k] && typeof all[k] === 'object' && all[k].l) ? all[k].l : k })); },
  clear(key) { this.set(key, false); },              // réaffiche UN élément
  clearPrefix(prefix) { try { const s = FP.settings.get(); s.ignores = s.ignores || {}; Object.keys(s.ignores).forEach(k => { if (k.indexOf(prefix) === 0) delete s.ignores[k]; }); FP.settings.save(s); } catch (e) {} },
  countPrefix(prefix) { return Object.keys(this._all()).filter(k => k.indexOf(prefix) === 0).length; },
};
// Un véhicule dont le CT (resp. l'assurance) a été marqué « ignoré » dans la conformité
// (ex. véhicule étranger sans contrôle technique français) NE doit plus générer d'alerte
// ni fausser les calculs. Clé partagée avec la page Statistiques ('conf:ct:<id>' / 'conf:assur:<id>').
FP.ctIgnored    = (v) => !!(v && FP.ignore && FP.ignore.has('conf:ct:' + v.id));
FP.assurIgnored = (v) => !!(v && FP.ignore && FP.ignore.has('conf:assur:' + v.id));
// Véhicule vendu / supprimé → on ARCHIVE ses documents (dossier Sinistres « Drive ») dans un
// sous-dossier « OUT » automatiquement : on crée le sous-dossier s'il manque et on y déplace
// tous ses fichiers. Ne touche QUE le classement (settings.sinistreSous / sinistreDocSub),
// jamais les fichiers ni le véhicule → sûr. Renvoie le nombre de fichiers archivés.
FP.archiveVehicleDocs = async (immats) => {
  try {
    if (!(FP.db && FP.db.select && FP.settings)) return 0;
    const normPl = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const pls = new Set((Array.isArray(immats) ? immats : [immats]).map(normPl).filter(Boolean));
    if (!pls.size) return 0;
    const r = await FP.db.select('documents');
    if (!r || r.error) return 0;
    const docs = (r.data || []).filter(d => d && d.type === 'sinistre-doc' && pls.has(normPl(d.vehiculeId)));
    if (!docs.length) return 0;
    // Une SEULE lecture/écriture des réglages (évite les écrasements quand on archive un lot).
    const s = FP.settings.get();
    s.sinistreSous = s.sinistreSous || {};
    s.sinistreDocSub = s.sinistreDocSub || {};
    pls.forEach(pl => {
      if (!docs.some(d => normPl(d.vehiculeId) === pl)) return; // ce véhicule n'a pas de fichier
      const subs = Array.isArray(s.sinistreSous[pl]) ? s.sinistreSous[pl].slice() : [];
      if (!subs.some(x => String(x).toUpperCase() === 'OUT')) subs.push('OUT');
      s.sinistreSous[pl] = subs;
    });
    docs.forEach(d => { s.sinistreDocSub[d.id] = 'OUT'; });
    FP.settings.save(s);
    return docs.length;
  } catch (e) { console.warn('[archiveVehicleDocs]', e); return 0; }
};

// Sécurité : empêche « Retour arrière » de faire « page précédente » (et de perdre une saisie)
// quand le focus n'est pas dans un champ éditable.
// Normalisation pour la recherche : minuscules + SANS accents (taper « jeremy » trouve « Jérémy »).
FP.norm = (s) => (s == null ? '' : s.toString()).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// Échappement HTML — À UTILISER pour toute donnée saisie/OCR injectée en innerHTML (anti-XSS).
FP.esc = (s) => (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---- REPLI DES LONGUES LISTES (helper GLOBAL) ----
// Replie une liste de lignes à N (5 par défaut) et ajoute un bouton « Voir tout (X de plus) ↓ »
// ↔ « Réduire ↑ ». Prend un TABLEAU de lignes HTML, renvoie le HTML prêt à injecter. Le déroulé
// est géré par UN SEUL écouteur global (ci-dessous) → utilisable sur n'importe quelle page/fiche.
FP.clampList = function (rowsHtml, limit) {
  const N = limit || 5;
  const rows = (rowsHtml || []).filter(Boolean);
  if (rows.length <= N) return rows.join('');
  const more = rows.length - N;
  return rows.slice(0, N).join('')
    + '<div class="clamp-more" hidden>' + rows.slice(N).join('') + '</div>'
    + '<button type="button" class="clamp-toggle" data-more="' + more + '" style="margin-top:.5rem;display:inline-flex;align-items:center;gap:5px;background:#F1F5F9;color:#334155;border:1px solid var(--fp-border,#E3E8F0);border-radius:8px;padding:.4rem .75rem;font-size:.8rem;font-weight:700;cursor:pointer">Voir tout (' + more + ' de plus) ↓</button>';
};
// Écouteur unique (délégué au document) : bascule « Voir tout » / « Réduire » partout.
document.addEventListener('click', function (e) {
  const btn = e.target.closest && e.target.closest('.clamp-toggle');
  if (!btn) return;
  const more = btn.previousElementSibling;
  if (!more || !more.classList.contains('clamp-more')) return;
  if (more.hasAttribute('hidden')) { more.removeAttribute('hidden'); btn.textContent = 'Réduire ↑'; }
  else { more.setAttribute('hidden', ''); btn.textContent = 'Voir tout (' + (btn.dataset.more || '') + ' de plus) ↓'; }
});

// ---- ADRESSES EN CASES SÉPARÉES (helper GLOBAL) ----
// « Une info par case » : on saisit rue / code postal / ville / pays séparément, mais on continue de
// STOCKER une seule chaîne « rue, CP ville, pays » (aucune colonne DB à créer). compose() fabrique la
// chaîne canonique ; parse() la re-découpe (heuristique tolérante : repère le code postal 4-5 chiffres).
FP.addr = {
  compose(p) {
    p = p || {};
    const g = k => (p[k] == null ? '' : String(p[k])).trim();
    const cpVille = [g('cp'), g('ville')].filter(Boolean).join(' ');
    return [g('rue'), cpVille, g('pays')].filter(Boolean).join(', ');
  },
  parse(str) {
    const s = (str == null ? '' : String(str)).trim();
    const empty = { rue: '', cp: '', ville: '', pays: '' };
    if (!s) return empty;
    const parts = s.split(',').map(x => x.trim()).filter(Boolean);
    const idx = parts.findIndex(x => /\b\d{4,5}\b/.test(x));
    if (idx === -1) return { rue: s, cp: '', ville: '', pays: '' }; // pas de CP → tout en rue
    // Adresse « en vrac » sans virgule (ex. « 15 rue du Test 75015 Paris ») → on découpe autour du CP.
    if (parts.length === 1) {
      const mm = s.match(/\b(\d{4,5})\b/);
      const cp = mm[1];
      return {
        rue: s.slice(0, mm.index).replace(/[,\-–\s]+$/, '').trim(),
        cp,
        ville: s.slice(mm.index + cp.length).replace(/^[,\-–\s]+/, '').trim(),
        pays: '',
      };
    }
    const seg = parts[idx];
    const m = seg.match(/\b(\d{4,5})\b/);
    const cp = m ? m[1] : '';
    // ⚠️ La ville se trouve TOUJOURS juste après le code postal (règle utilisateur) : d'abord
    // ce qui reste dans le même segment (« 75015 Paris »), sinon le segment suivant (« 75015, Paris »).
    let ville = seg.replace(/\b\d{4,5}\b/, '').replace(/^[\s\-–,]+|[\s\-–,]+$/g, '').trim();
    let rest = parts.slice(idx + 1);
    if (!ville && rest.length) { ville = rest[0]; rest = rest.slice(1); }
    return { rue: parts.slice(0, idx).join(', '), cp, ville, pays: rest.join(', ') };
  },
};

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
// L'e-mail de connexion est connu après le chargement Supabase → (re)construit l'onglet privé JIS
// (utile au 1er login, quand l'e-mail n'était pas encore en cache lors du 1er rendu).
document.addEventListener('fp:data-ready', () => { try { FP.userEmail = (localStorage.getItem('fp_email') || '').trim().toLowerCase(); FP.buildJisMenu(); } catch (e) {} });

// Normalisation d'un prénom (1er mot, minuscules, accents conservés) — partagé
FP.normPrenom = (s) => (s || '').toString().trim().split(/\s+/)[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// ⚠️ HELPER CANONIQUE — nom COMPLET normalisé (prénom + nom, accents/casse/espaces neutralisés).
// Sert à distinguer deux homonymes de prénom (« Jean Dupont » ≠ « Jean Martin ») SANS casser le
// rapprochement historique par prénom seul (qui reste le repli quand la donnée n'a qu'un prénom).
FP.normNomComplet = (s) => (s || '').toString().trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
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
  // Toutes les clés = 8 défauts + groupes PERSO (créés dans Paramètres). « non-classe » reste en dernier.
  const allKeys = Object.keys(FP.settings.get().groupes);
  const order = FP.settings.get().groupeOrder;
  const lastPin = (arr) => { const a = arr.filter(k => k !== 'non-classe'); if (arr.includes('non-classe')) a.push('non-classe'); return a; };
  if (!Array.isArray(order) || !order.length) return lastPin(allKeys);
  const valid = order.filter(k => allKeys.includes(k));         // garde uniquement les clés connues
  const missing = allKeys.filter(k => !valid.includes(k));      // n'oublie aucun groupe (dont les perso récents)
  return lastPin([...valid, ...missing]);
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
  'budget.html':       'Budget',
  'guide.html':        'Guide',
  'manuel.html':       'Manuel',
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

// Sous-onglets de l'onglet privé « JIS » (tous des pages autonomes → nouvel onglet).
FP.JIS_PAGES = [
  { file: 'prospects.html',    label: 'Prospects (pipeline)',  icon: 'user-plus' },
  { file: 'pages/facturation.html', label: 'Facturation',       icon: 'receipt-euro' },
  { file: 'kit-commercial.html', label: 'Kit commercial',      icon: 'target' },
  { file: 'brochure.html',     label: 'Brochure',              icon: 'sparkles' },
  { file: 'prix.html',         label: 'Tarifs',                icon: 'badge-euro' },
  { file: 'carte-visite.html', label: 'Carte de visite',       icon: 'contact' },
  { file: 'argumentaire.html', label: 'Argumentaire',          icon: 'megaphone' },
  { file: 'devis.html',        label: 'Générateur de devis',   icon: 'file-text' },
  { file: 'contrat.html',      label: 'Générateur de contrat', icon: 'file-signature' },
  { file: 'contrat-modele.html', label: 'Contrat modèle',      icon: 'file-check' },
  { file: 'logos.html',        label: 'Logos & marque',        icon: 'palette' },
  { file: 'demo.html',         label: 'Présentation (démo)',   icon: 'presentation' },
];
// Construit le menu déroulant « JIS » en bas de la sidebar, UNIQUEMENT pour le propriétaire.
// Idempotent (réutilise le même groupe). Retire toujours les liens plats Brochure/Tarifs
// (ils passent sous JIS) → un client ne les voit jamais.
FP.buildJisMenu = () => {
  const pfx = /\/pages\//.test(location.pathname) ? '../' : '';
  const cur = (location.pathname.split('/').pop() || '');
  document.querySelectorAll('aside nav').forEach(nav => {
    nav.querySelectorAll('a[data-nav="brochure.html"], a[data-nav="prix.html"]').forEach(a => a.remove());
    if (!FP.isJisOwner()) { const old = nav.querySelector('.fp-jis-group'); if (old) old.remove(); return; }
    if (nav.querySelector('.fp-jis-group')) return; // déjà construit
    let open = false; try { open = localStorage.getItem('fp_jis_open') === '1'; } catch (e) {}
    if (FP.JIS_PAGES.some(p => p.file === cur)) open = true; // on est sur une page JIS → ouvert
    const grp = document.createElement('div');
    grp.className = 'fp-jis-group';
    grp.style.order = '3';
    const subLinks = FP.JIS_PAGES.map(p =>
      `<a href="${pfx}${p.file}" target="_blank" rel="noopener" class="fp-jis-link${cur === p.file ? ' active' : ''}" style="padding-left:2.4rem;font-size:.86rem"><i data-lucide="${p.icon}"></i> ${FP.esc ? FP.esc(p.label) : p.label}</a>`
    ).join('');
    grp.innerHTML =
      `<a href="#" class="fp-jis-toggle" style="display:flex;align-items:center;gap:.55rem" title="Espace privé JIS (CEO)">`
      + `<i data-lucide="crown"></i><span style="font-weight:700">JIS</span>`
      + `<span class="fp-jis-chev" style="margin-left:auto;transition:transform .2s;transform:rotate(${open ? 0 : -90}deg);font-size:.7rem;opacity:.6">▼</span></a>`
      + `<div class="fp-jis-sub" style="display:${open ? 'block' : 'none'}">${subLinks}</div>`;
    nav.appendChild(grp);
    const toggle = grp.querySelector('.fp-jis-toggle');
    const sub = grp.querySelector('.fp-jis-sub');
    const chev = grp.querySelector('.fp-jis-chev');
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      const willOpen = sub.style.display === 'none';
      sub.style.display = willOpen ? 'block' : 'none';
      chev.style.transform = 'rotate(' + (willOpen ? 0 : -90) + 'deg)';
      try { localStorage.setItem('fp_jis_open', willOpen ? '1' : '0'); } catch (e) {}
    });
  });
  if (window.lucide && lucide.createIcons) { try { lucide.createIcons(); } catch (e) {} }
  if (FP.refreshProspectsBadge) FP.refreshProspectsBadge();
};
// Alerte prospects : badge rouge (nb de nouveaux prospects) sur l'entête « JIS » du menu.
// Réservé au propriétaire JIS ; silencieux si la table prospects n'existe pas encore.
FP.refreshProspectsBadge = async () => {
  try {
    if (!FP.isJisOwner || !FP.isJisOwner() || !FP.supabase) return;
    const r = await FP.supabase.from('prospects').select('id', { count: 'exact', head: true }).eq('statut', 'nouveau');
    if (r.error) return; // table absente → pas de badge
    const count = r.count || 0;
    document.querySelectorAll('.fp-jis-toggle').forEach(t => {
      let b = t.querySelector('.fp-jis-prospect-badge');
      if (!count) { if (b) b.remove(); return; }
      if (!b) {
        b = document.createElement('span');
        b.className = 'fp-jis-prospect-badge';
        b.title = count + ' nouveau(x) prospect(s)';
        b.style.cssText = 'background:#EF4444;color:#fff;font-size:.66rem;font-weight:800;min-width:1.1rem;text-align:center;padding:.05rem .35rem;border-radius:999px;margin-left:.4rem';
        const chev = t.querySelector('.fp-jis-chev');
        if (chev) t.insertBefore(b, chev); else t.appendChild(b);
      }
      b.textContent = count;
    });
  } catch (e) {}
};
// Rafraîchit le badge quand les données Supabase sont prêtes (le menu peut être bâti avant).
try { window.addEventListener('fp:data-ready', () => { if (FP.refreshProspectsBadge) FP.refreshProspectsBadge(); }); } catch (e) {}

// === Bouton « Mémo » : depuis le titre de chaque page → la section correspondante du Manuel ===
FP.MANUAL_SECTION = {
  'dashboard.html': 's-dashboard', 'notifications.html': 's-alertes', 'taches.html': 's-divers',
  'statistiques.html': 's-stats', 'vehicules.html': 's-vehicules', 'emprunts.html': 's-divers',
  'conducteurs.html': 's-conducteurs', 'amendes.html': 's-amendes', 'sinistres.html': 's-sinistres',
  'factures.html': 's-factures', 'entretiens.html': 's-factures', 'contrats.html': 's-contrats',
  'budget.html': 's-budget', 'renouvellements.html': 's-divers',
  'parametres.html': 's-params', 'aide.html': 's-divers',
};
FP.injectManualButton = function () {
  try {
    if (document.getElementById('fp-memo-btn')) return;
    var file = (location.pathname.split('/').pop() || '').toLowerCase();
    var sec = FP.MANUAL_SECTION[file]; if (!sec) return;
    var h1 = document.querySelector('main h1') || document.querySelector('.guide-hero h1') || document.querySelector('h1');
    if (!h1) return;
    if (!document.getElementById('fp-memo-style')) {
      var st = document.createElement('style'); st.id = 'fp-memo-style';
      st.textContent = '.fp-memo-btn{display:inline-flex;align-items:center;gap:.3rem;margin-left:.7rem;padding:.22rem .62rem;border:1px solid var(--fp-border);border-radius:999px;font-size:.72rem;font-weight:600;color:var(--fp-accent);background:#fff;vertical-align:middle;text-decoration:none;box-shadow:0 1px 2px rgba(15,30,61,.06);transition:all .12s;white-space:nowrap}.fp-memo-btn:hover{border-color:var(--fp-accent);background:#FFF7ED;transform:translateY(-1px)}.fp-memo-btn i{width:14px;height:14px}';
      document.head.appendChild(st);
    }
    var pfx = /\/pages\//.test(location.pathname) ? '' : 'pages/';
    var a = document.createElement('a');
    a.id = 'fp-memo-btn'; a.className = 'fp-memo-btn';
    a.href = pfx + 'manuel.html#' + sec;
    a.title = 'Mémo — comprendre cette page dans le manuel';
    a.innerHTML = '<i data-lucide="book-open-check"></i> Mémo';
    h1.style.display = 'inline-block';
    h1.insertAdjacentElement('afterend', a);
    if (window.lucide && lucide.createIcons) { try { lucide.createIcons(); } catch (e) {} }
  } catch (e) {}
};
try { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', FP.injectManualButton); else FP.injectManualButton(); } catch (e) {}

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
    revAlerteKm:   num(n.revAlerteKm, 1000),   // alerte révision quand il reste ≤ X km
    revAlerteJours: num(n.revAlerteJours, 30), // alerte révision quand il reste ≤ X jours (avant l'échéance mois)
    releveKmJours: num(n.releveKmJours, 45),   // rappel « relevé km » : tous les X jours (défaut 45 = 1 mois et demi)
    releveKmDebut: (typeof n.releveKmDebut === 'string' && n.releveKmDebut.trim()) ? n.releveKmDebut.trim() : '', // date d'ancrage du cycle (optionnelle)
    leasingFinMois: num(n.leasingFinMois, 2),  // anticipation d'alerte « fin de leasing » (mois avant la fin ; défaut 2)
    immobiliseJours: num(n.immobiliseJours, 15), // alerte « véhicule immobilisé » après X jours (défaut 15)
    consoSeuilPct: num(n.consoSeuilPct, 60),   // alerte conso carburant : hausse ≥ X % vs moyenne du véhicule (défaut 60 %)
    amendeTotalWarn: num(n.amendeTotalWarn, 500),       // amendes à payer : alerte (orange) au-delà de X € dus au total
    amendeMajorationJours: num(n.amendeMajorationJours, 30), // amende « bientôt majorée » : alerte X jours avant la date limite estimée
    docAlerteJours: num(n.docAlerteJours, 120),          // permis + pièces d'identité : 1re alerte X j avant expiration (rouge = moitié)
    carteExpJours: num(n.carteExpJours, 30),             // carte carburant / badge télépéage : alerte X j avant expiration
    sinistreRelanceJours: num(n.sinistreRelanceJours, 21), // sinistre sans réponse de l'assureur : relancer après X jours
    empruntRetardJours: num(n.empruntRetardJours, 2),    // emprunt non rendu : considéré « en retard » au-delà de X jours
  };
};

// ⚠️ SOURCE UNIQUE — Total Fleet : catégorie d'un achat, seuils, et « points à vérifier » (anomalies).
// Utilisé PARTOUT (page Factures ET page Suivi & alertes) pour ne pas diverger.
FP.txCat = function (p) {
  const s = (p || '').toLowerCase();
  if (/gazole|gasoil|diesel|super|sp\d|sans[- ]?plomb|essence|excellium|premier|adblue|gnr|gpl|e10|e85|b7/.test(s)) return 'carburant';
  if (/lavage/.test(s)) return 'lavage';
  if (/parking/.test(s)) return 'parking';
  if (/aliment|boisson|sandwich|repas|restaur|snack|produit\s*frais|caf[ée]|menu/.test(s)) return 'repas';
  if (/lubrifiant/.test(s)) return 'boutique';
  return 'autre';
};
FP.tfSeuils = function () {
  let s = {}; try { s = (FP.settings.get().tfSeuils) || {}; } catch (e) {}
  return {
    repasJour: Number(s.repasJour) > 0 ? Number(s.repasJour) : 20,
    autreItem: (s.autreItem === 0 || Number(s.autreItem) > 0) ? Number(s.autreItem) : 20,
    horsCarbMois: Number(s.horsCarbMois) > 0 ? Number(s.horsCarbMois) : 40,
  };
};
// Anomalies « carte carburant » à partir du détail transaction (total_conso_tx déjà filtré par l'appelant) :
// >3 pleins/jour, repas > seuil/jour, achat « Autres » (hors carburant) ≥ seuil. Renvoie [{t,mois,facnum,txt,key}].
FP.totalFleetAnomaliesTx = function (tx) {
  const lim = FP.tfSeuils(), list = tx || [], anom = [];
  const dnum = (d) => FP.dateNum ? FP.dateNum(d) : (d || '');
  const eur = (v) => FP.euro ? FP.euro(v) : (v + ' €');
  const catOf = (t) => (t && t.produit ? FP.txCat(t.produit) : (t && t.categorie) || 'autre');
  const pleins = {};
  list.filter(t => catOf(t) === 'carburant').forEach(t => { const k = (t.conducteur || '—') + '|' + (t.date_tx || '') + '|' + (t.facnum || ''); const o = pleins[k] || (pleins[k] = { n: t.conducteur || '—', d: t.date_tx, fac: t.facnum, mois: t.mois, c: 0, items: [] }); o.c += 1; o.items.push({ p: String(t.produit || 'Plein').replace(/\s+/g, ' ').trim(), m: Number(t.montant_ttc) || 0 }); });
  Object.values(pleins).forEach(o => { if (o.c > 3) { const s = o.items.reduce((x, i) => x + i.m, 0); anom.push({ t: 'warn', mois: o.mois, facnum: o.fac, key: 'pleins|' + o.n + '|' + (o.d || '') + '|' + (o.fac || ''), conducteur: o.n, date: o.d, montant: s, items: o.items, categorie: 'carburant', motif: o.c + ' pleins/jour', txt: `${o.n} · ${dnum(o.d)} : ${o.c} pleins de carburant le MÊME jour pour ${eur(s)} → à vérifier (carte prêtée ? plusieurs véhicules ? carburant revendu ?)` }); } });
  // DIESEL (gazole) : la flotte roule à l'essence → toute conso de gazole/diesel = à vérifier.
  // Regroupé par conducteur (clé stable « diesel|nom ») pour rester lisible.
  // DIESEL / GAZOLE = anomalie (flotte à l'essence). On reconnaît toutes les écritures d'un relevé :
  // « gazole/gasoil/diesel », mais aussi « B7 » (gazole routier EN590), « GNR » (gazole non routier)
  // et « GO » (gasoil). L'essence (SP95/98, E10/E85, Super…) n'est PAS concernée.
  const RE_DIESEL = /gazole|gasoil|gazoil|diesel|\bb7\b|\bgnr\b|\bgo\b/i;
  const diesel = {};
  list.filter(t => catOf(t) === 'carburant' && RE_DIESEL.test(t.produit || '')).forEach(t => { const n = t.conducteur || '—'; const o = diesel[n] || (diesel[n] = { n, fac: t.facnum, mois: t.mois, c: 0, s: 0, items: [] }); o.c += 1; o.s += Number(t.montant_ttc) || 0; o.items.push({ p: String(t.produit || 'Gazole').replace(/\s+/g, ' ').trim(), m: Number(t.montant_ttc) || 0, d: t.date_tx }); if (!o.fac) o.fac = t.facnum; if (t.mois) o.mois = t.mois; });
  Object.values(diesel).forEach(o => anom.push({ t: 'warn', mois: o.mois, facnum: o.fac, key: 'diesel|' + o.n, conducteur: o.n, date: null, montant: o.s, items: o.items, categorie: 'carburant', produit: 'Gazole (diesel)', motif: o.c + ' conso gazole', txt: `${o.n} : ${o.c} conso de GAZOLE (diesel) pour ${eur(o.s)} → à vérifier (la carte carburant est censée être à l'essence)` }));
  const day = {};
  list.filter(t => catOf(t) === 'repas').forEach(t => { const k = (t.conducteur || '—') + '|' + (t.date_tx || '') + '|' + (t.facnum || ''); const o = day[k] || (day[k] = { n: t.conducteur || '—', d: t.date_tx, fac: t.facnum, mois: t.mois, s: 0, prods: [], items: [] }); o.s += Number(t.montant_ttc) || 0; const pp = String(t.produit || '').replace(/\s+/g, ' ').trim(); if (pp && o.prods.indexOf(pp) < 0) o.prods.push(pp); o.items.push({ p: pp || 'Repas', m: Number(t.montant_ttc) || 0 }); });
  Object.values(day).forEach(o => { if (o.s > lim.repasJour) { const pl = o.prods.join(', '); anom.push({ t: 'warn', mois: o.mois, facnum: o.fac, key: 'repas|' + o.n + '|' + (o.d || '') + '|' + (o.fac || ''), conducteur: o.n, date: o.d, montant: o.s, items: o.items, categorie: 'repas', produit: pl || 'Repas / boissons', motif: pl || 'repas / boissons', txt: `${o.n} · ${dnum(o.d)} : ${eur(o.s)} de repas/boissons${pl ? ' (' + pl + ')' : ''} en une seule journée → à vérifier (seuil ${lim.repasJour} €/jour)` }); } });
  list.filter(t => catOf(t) === 'autre' && (Number(t.montant_ttc) || 0) >= (lim.autreItem || 0))
    .sort((a, b) => (Number(b.montant_ttc) || 0) - (Number(a.montant_ttc) || 0))
    .forEach(t => { const p = String(t.produit || 'Achat').replace(/\s+/g, ' ').trim(); anom.push({ t: 'warn', mois: t.mois, facnum: t.facnum, key: 'autre|' + (t.conducteur || '—') + '|' + (t.date_tx || '') + '|' + (Number(t.montant_ttc) || 0) + '|' + (t.facnum || ''), conducteur: t.conducteur || '—', date: t.date_tx, montant: Number(t.montant_ttc) || 0, categorie: 'autre', produit: p, motif: p, txt: `${t.conducteur || '—'} · ${dnum(t.date_tx)} : ${p} à ${eur(t.montant_ttc)} (payé avec la carte carburant) → à vérifier` }); });
  anom.forEach(a => { if (!a.key) a.key = a.t + '|' + (a.facnum || '') + '|' + a.txt; });
  return anom;
};
// Vrai si une anomalie a été archivée (« vérifié »). Reconnaît aussi l'ANCIENNE clé
// (« warn|<facnum>|<txt> ») pour que ce qui a déjà été archivé ne réapparaisse pas après un changement
// de clé (ex. diesel devenu « diesel|<nom> »). SOURCE UNIQUE — utilisée par Factures et Suivi & alertes.
FP.tfAnomArchivee = function (a, ok) {
  if (!a) return false; ok = ok || {};
  return !!(ok[a.key] || ok[a.t + '|' + (a.facnum || '') + '|' + a.txt]);
};
// Anomalies NON archivées (exclut celles cochées « vérifié » dans les réglages tfAnomOk).
FP.totalFleetAnomaliesActives = function (tx) {
  let ok = {}; try { ok = FP.settings.get().tfAnomOk || {}; } catch (e) {}
  return FP.totalFleetAnomaliesTx(tx).filter(a => !FP.tfAnomArchivee(a, ok));
};
// ⚠️ SOURCE UNIQUE — Applique une facture à la fiche du véhicule (km + dernière révision + pneus +
// rappel « relevé km »). TOUS les chemins qui créent OU éditent une facture DOIVENT passer par ici
// (saisie manuelle, scanner du tableau de bord, édition inline/drawer, sinistres). Ne jamais
// réécrire cette logique ailleurs — c'est la cause des régressions « le km ne se met pas à jour ».
// Règles : le km ne fait QUE monter (jamais de baisse) ; « dernière révision » + « pneus » seulement
// pour les factures entretien/réparation. Renvoie { veh, patch, label, bits } si qqch a changé, sinon null.
FP.applyFactureToVehicule = function (f, vehicules) {
  try {
    if (!f || !f.vehiculeImmat) return null;
    const list = vehicules || (typeof window !== 'undefined' && window.FP_DATA && window.FP_DATA.vehicules) || [];
    const v = list.find(x => FP.normImmat(x.immat) === FP.normImmat(f.vehiculeImmat));
    if (!v) return null;
    const estEntretien = FP.estEntretien(f);
    const patch = {}; const bits = [];
    const km = (f.km != null && f.km !== '' && Number.isFinite(Number(f.km))) ? Number(f.km) : null;
    // KM : toute facture, à la hausse uniquement.
    if (km != null && km > 0 && (!v.kmDernierReleve || km >= Number(v.kmDernierReleve))) {
      v.kmDernierReleve = km; patch.kmDernierReleve = km;
      if (!v.km || km > Number(v.km)) { v.km = km; patch.km = km; }
      bits.push(FP.num(km) + ' km');
      // Réinitialise le rappel « Relevé km » (date du relevé = date de la facture, sinon aujourd'hui).
      try {
        const s = FP.settings.get(); s.kmMajDates = (s.kmMajDates && typeof s.kmMajDates === 'object') ? s.kmMajDates : {};
        const d = (f.date && /^\d{4}-\d{2}-\d{2}/.test(f.date)) ? f.date.slice(0, 10) : new Date().toISOString().slice(0, 10);
        if (!s.kmMajDates[v.immat] || d > s.kmMajDates[v.immat]) { s.kmMajDates[v.immat] = d; FP.settings.save(s); }
      } catch (e) {}
    }
    // Dernière révision + pneus : entretien/réparation uniquement.
    if (estEntretien) {
      if (f.date && (!v.derniereRevision || v.derniereRevision === '—' || f.date > v.derniereRevision)) {
        v.derniereRevision = f.date; patch.derniereRevision = f.date; bits.push('révision ' + FP.date(f.date));
      }
      if (/pneu/i.test(`${f.description || ''}`) && f.date && (!v.dateChangementPneus || f.date > v.dateChangementPneus)) {
        v.dateChangementPneus = f.date; patch.dateChangementPneus = f.date; bits.push('pneus');
      }
    }
    if (!Object.keys(patch).length) return null;
    if (FP.persist && FP.persist.update) { try { FP.persist.update('vehicules', v.id, patch); } catch (e) {} }
    return { veh: v, patch, bits, label: `${v.immat} (${bits.join(' · ')})` };
  } catch (e) { return null; }
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

  // Alerte SEULEMENT quand l'échéance est proche : dépassée = danger, sinon ≤ seuil = warn.
  // Plus de niveau « info » (bleu) : on n'alerte pas des mois/milliers de km à l'avance.
  const cfg = FP.notifCfg();
  const lvlKm = kmRestant === null ? null : (kmRestant <= 0 ? 'danger' : kmRestant <= cfg.revAlerteKm ? 'warn' : null);
  const lvlDt = joursRestant === null ? null : (joursRestant <= 0 ? 'danger' : joursRestant <= cfg.revAlerteJours ? 'warn' : null);
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
  'HJ-181-RN': { kmContrat: 60000,  dureeMois: 36, debut: '2026-03-16', kmSupp: 0.0979 }, // Nissan X-Trail (contrat 62166024 : 9,79 x100)
  'HG-709-CH': { kmContrat: 60000,  dureeMois: 36, debut: '2025-10-15', kmSupp: 0.0814 }, // BYD Seal U Boost (62150450 : 8,14 x100)
  'HF-749-VD': { kmContrat: 75000,  dureeMois: 36, debut: '2025-09-26', kmSupp: 0.0707 }, // Toyota Yaris Cross (62148102 : 7,07 x100)
  'HH-613-KE': { kmContrat: 60000,  dureeMois: 36, debut: '2025-12-24', kmSupp: 0.0814 }, // BYD Seal U (62182784 : 8,14 x100)
  'HH-464-LQ': { kmContrat: 60000,  dureeMois: 36, debut: '2025-12-29', kmSupp: 0.0814 }, // BYD Seal U (62184020 : 8,14 x100)
  'HH-458-LQ': { kmContrat: 120000, dureeMois: 36, debut: '2025-12-29', kmSupp: 0.0993 }, // BYD Seal U avenant 120000km (62184022 : 9,93 x100)
  'HF-477-XW': { kmContrat: 165000, dureeMois: 36, debut: '2025-10-01', kmSupp: 0.1157 }, // Hyundai Tucson
  'HJ-804-VM': { kmContrat: 21000,  dureeMois: 36, debut: '2026-03-23', kmSupp: 0.0881 }, // Renault Trafic (62181976 : 8,81 x100)
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

// ===== GARAGES / PRESTATAIRES (par société, partagés entre postes via app_settings) =====
// Chaque société gère SA propre liste de garages/prestataires (page Entretiens → « Contacter un
// garage »). Rien n'est codé en dur : PXP hérite UNE FOIS de son garage historique (CWCF), toute
// autre société part d'une liste vide et ajoute les siens. Même logique que le leasing (semis unique
// pour PXP, sinon []), pour ne jamais faire hériter une nouvelle société des prestataires de PXP.
FP.PRESTATAIRE_DEFAUT_PXP = [
  { id: 'cwcf', nom: 'CAR WORLD CONSULTING FRANCE', sigle: 'CWCF', adresse: '13 Villa des Sorbiers, 95500 Gonesse — France', email: 'carworldconsultingfrance@gmail.com', tel: '+33 7 44 97 96 90' },
];
FP.getPrestataires = () => {
  if (!FP.settings) return [];
  let obj = FP.settings.get();
  // 1) Semis unique si jamais initialisé (PXP = garage historique ; autres sociétés = vide).
  if (!Array.isArray(obj.prestataires)) {
    const estPXP = (((FP.activeSociete && FP.activeSociete()) || 'PXP') === 'PXP');
    obj.prestataires = estPXP ? FP.PRESTATAIRE_DEFAUT_PXP.map(d => ({ ...d })) : [];
    FP.settings.save(obj); obj = FP.settings.get();
  }
  // 2) Migration de l'ANCIEN annuaire garages (page Sinistres, settings.garages) vers le
  //    référentiel UNIQUE prestataires → une seule liste partagée Entretiens + Sinistres.
  if (Array.isArray(obj.garages) && obj.garages.length) {
    const list = obj.prestataires.slice();
    const key = s => String(s || '').trim().toLowerCase();
    const seen = new Set(list.map(p => key(p.nom)));
    obj.garages.forEach(g => {
      if (!g || !g.nom || seen.has(key(g.nom))) return;
      seen.add(key(g.nom));
      list.push({ id: 'g' + Date.now().toString(36) + Math.floor(Math.random() * 1000), nom: g.nom, ville: g.ville || '', tel: g.tel || '', rdv: g.rdv || '', adresse: '', email: '' });
    });
    obj.prestataires = list; delete obj.garages;
    FP.settings.save(obj); obj = FP.settings.get();
  }
  return obj.prestataires.map(d => ({ ...d }));
};
FP.savePrestataire = (rec) => {
  if (!FP.settings || !rec) return null;
  const obj = FP.settings.get();
  const list = Array.isArray(obj.prestataires) ? obj.prestataires.slice() : [];
  if (!rec.id) rec.id = 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1000);
  const i = list.findIndex(p => p && p.id === rec.id);
  if (i >= 0) list[i] = { ...list[i], ...rec }; else list.push(rec);
  obj.prestataires = list;
  FP.settings.save(obj); // -> localStorage + app_settings (partagé sur tous les PC, isolé par société)
  return rec;
};
FP.deletePrestataire = (id) => {
  if (!FP.settings || !id) return;
  const obj = FP.settings.get();
  obj.prestataires = (Array.isArray(obj.prestataires) ? obj.prestataires : []).filter(p => p && p.id !== id);
  FP.settings.save(obj);
};

// ===== NOTES DE ZONE (globales, réutilisables sur n'importe quelle page/onglet/zone) =====
// Pose un bouton « 📝 Notes » sur tout élément portant l'attribut data-fp-note="<clé unique>"
// (+ data-fp-note-label="Titre lisible" optionnel). Clic → modale de lecture/édition. Le texte est
// stocké par SOCIÉTÉ (FP.settings.zoneNotes[clé]) → partagé sur tous les postes, isolé par société.
// ⚠️ Mécanisme GLOBAL : pour ajouter des notes à une nouvelle zone, il suffit d'ajouter l'attribut.
FP.notes = {
  _all() { try { const z = FP.settings.get().zoneNotes; return (z && typeof z === 'object') ? z : {}; } catch (e) { return {}; } },
  get(key) { const r = this._all()[key]; return (r && typeof r === 'object' && r.text) ? String(r.text) : (typeof r === 'string' ? r : ''); },
  info(key) { const r = this._all()[key]; return (r && typeof r === 'object') ? r : (typeof r === 'string' ? { text: r } : null); },
  has(key) { return !!this.get(key).trim(); },
  set(key, text) {
    try {
      const o = FP.settings.get(); const z = (o.zoneNotes && typeof o.zoneNotes === 'object') ? o.zoneNotes : {};
      const t = String(text == null ? '' : text).trim();
      if (t) z[key] = { text: t, updatedAt: new Date().toISOString() }; else delete z[key];
      o.zoneNotes = z; FP.settings.save(o);
    } catch (e) { console.warn('[notes.set]', e); }
  },
  _esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); },
  buttonHTML(key, label) {
    const has = this.has(key);
    return `<button type="button" data-fp-note-open="${this._esc(key)}" data-fp-note-label="${this._esc(label || '')}" title="Notes / infos sur cette zone" `
      + `style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:2px 8px;border-radius:9999px;border:1px solid ${has ? 'var(--fp-accent,#F97316)' : 'var(--fp-border,#E2E8F0)'};background:${has ? 'rgba(249,115,22,.10)' : '#fff'};color:${has ? 'var(--fp-accent,#F97316)' : '#64748B'};cursor:pointer;vertical-align:middle">`
      + `📝 <span>${has ? 'Note' : 'Notes'}</span>${has ? '<span style="width:6px;height:6px;border-radius:50%;background:var(--fp-accent,#F97316);display:inline-block"></span>' : ''}</button>`;
  },
  decorate(root) {
    (root || document).querySelectorAll('[data-fp-note]').forEach(el => {
      const key = el.getAttribute('data-fp-note'); if (!key) return;
      // Bouton posé une seule fois par zone ; on rafraîchit son état (note présente ou non).
      let btnWrap = el.querySelector(':scope > .fp-note-anchor');
      const label = el.getAttribute('data-fp-note-label') || '';
      if (!btnWrap) { btnWrap = document.createElement('span'); btnWrap.className = 'fp-note-anchor'; btnWrap.style.marginLeft = '8px'; el.appendChild(btnWrap); }
      btnWrap.innerHTML = this.buttonHTML(key, label);
    });
  },
  open(key, label) {
    const info = this.info(key); const cur = info ? info.text : '';
    let m = document.getElementById('fp-note-modal');
    if (!m) {
      m = document.createElement('div'); m.id = 'fp-note-modal';
      m.style.cssText = 'position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.45)';
      m.innerHTML = `<div style="background:#fff;border-radius:14px;padding:20px;width:100%;max-width:520px;margin:0 16px;box-shadow:0 24px 70px rgba(0,0,0,.35)">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px">
          <h3 id="fp-note-title" style="font-size:1.05rem;font-weight:800;margin:0">Notes</h3>
          <button type="button" id="fp-note-x" style="border:none;background:none;font-size:26px;line-height:1;color:#94A3B8;cursor:pointer">&times;</button>
        </div>
        <p id="fp-note-sub" style="font-size:12px;color:#94A3B8;margin:0 0 10px"></p>
        <textarea id="fp-note-text" rows="8" placeholder="Écris ici tes notes / infos sur cette zone…" style="width:100%;border:1px solid #E2E8F0;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;resize:vertical;outline:none"></textarea>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:14px">
          <button type="button" id="fp-note-del" style="font-size:12px;color:#94A3B8;background:none;border:none;cursor:pointer">🗑 Effacer</button>
          <div style="display:flex;gap:8px">
            <button type="button" id="fp-note-cancel" class="btn btn-outline" style="font-size:13px;padding:6px 14px;border-radius:8px;border:1px solid #E2E8F0;background:#fff;cursor:pointer">Fermer</button>
            <button type="button" id="fp-note-save" class="btn btn-dark" style="font-size:13px;padding:6px 16px;border-radius:8px;border:none;background:var(--fp-primary,#111827);color:#fff;cursor:pointer">Enregistrer</button>
          </div>
        </div></div>`;
      document.body.appendChild(m);
      const close = () => { m.style.display = 'none'; };
      m.addEventListener('click', e => { if (e.target === m) close(); });
      m.querySelector('#fp-note-x').addEventListener('click', close);
      m.querySelector('#fp-note-cancel').addEventListener('click', close);
      m.querySelector('#fp-note-save').addEventListener('click', () => {
        this.set(m.dataset.key, m.querySelector('#fp-note-text').value);
        close(); this.decorate(document);
        if (FP.toast) FP.toast('Note enregistrée'); if (typeof m._after === 'function') m._after();
      });
      m.querySelector('#fp-note-del').addEventListener('click', async () => {
        if (!await FP.confirm('Effacer cette note ?')) return;
        this.set(m.dataset.key, ''); m.querySelector('#fp-note-text').value = '';
        close(); this.decorate(document); if (FP.toast) FP.toast('Note effacée');
      });
    }
    m.dataset.key = key;
    m.querySelector('#fp-note-title').textContent = label ? ('Notes — ' + label) : 'Notes';
    const upd = info && info.updatedAt ? new Date(info.updatedAt) : null;
    m.querySelector('#fp-note-sub').textContent = upd && !isNaN(upd) ? ('Dernière modif. ' + upd.toLocaleDateString('fr-FR') + ' à ' + upd.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })) : 'Aucune note pour l’instant.';
    m.querySelector('#fp-note-text').value = cur;
    m.style.display = 'flex';
    setTimeout(() => { try { m.querySelector('#fp-note-text').focus(); } catch (e) {} }, 30);
  },
  init() {
    if (this._wired) { this.decorate(document); return; }
    this._wired = true;
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-fp-note-open]'); if (!b) return;
      e.preventDefault(); e.stopPropagation();
      this.open(b.getAttribute('data-fp-note-open'), b.getAttribute('data-fp-note-label') || '');
    });
    this.decorate(document);
    // Redécoration après un rendu de données (certaines zones apparaissent après le chargement).
    document.addEventListener('fp:data-ready', () => { try { this.decorate(document); } catch (e) {} });
  }
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => FP.notes.init());
else FP.notes.init();
// Contrat effectif d'un véhicule = défaut (Drive) fusionné avec l'override.
// Renvoie null si on n'a pas au moins un forfait km et une date de début.
FP.leasingContrat = (immat) => {
  const key = (immat || '').trim().toUpperCase(); if (!key) return null;
  // Base PXP en dur → uniquement pour PXP. Les autres sociétés n'utilisent que leurs overrides.
  const base = (((FP.activeSociete && FP.activeSociete()) || 'PXP') === 'PXP') ? (FP.LEASING_CONTRATS[key] || null) : null;
  const ov = FP.getLeasingOverrides()[key] || null;
  if (!base && !ov) return null;
  const merged = { dureeMois: 36, kmSupp: null, kmTolerance: null, ...(base || {}), ...(ov || {}) };
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
  return { kmContrat: c.kmContrat, dureeMois: c.dureeMois, kmSupp: c.kmSupp, kmTolerance: c.kmTolerance, debut, finContrat,
           moisEcoules, km, kmParMoisAutorise, kmAutoriseAJour, kmParMoisReel,
           projectionFin, ratio, ecartAJour, depassementProjete, niveau,
           loyer: (c.loyer != null ? Number(c.loyer) : null), avenants: Array.isArray(c.avenants) ? c.avenants : [] };
};

// ===== HISTORIQUE D'AFFECTATION véhicule ↔ conducteur =====
// Journal DATÉ de « qui conduit quel véhicule et depuis quand ». Stocké par société
// dans app_settings (settings.affectations = { [vehId]: [ {conducteur, debut, fin} ] }) —
// pas de nouvelle table. La dernière entrée avec fin=null = affectation EN COURS.
// Alimenté automatiquement à chaque changement de conducteur d'un véhicule (fiche véhicule).
FP.affectations = {
  _norm(n) { return (n == null ? '' : String(n)).trim(); },
  all() { const s = FP.settings.get(); return (s.affectations && typeof s.affectations === 'object') ? s.affectations : {}; },
  forVeh(vehId) { const a = this.all()[vehId]; return Array.isArray(a) ? a.slice() : []; },
  // Affectation EN COURS (fin === null) d'un véhicule, ou null.
  courante(vehId) { const o = this.forVeh(vehId).filter(x => !x.fin); return o.length ? o[o.length - 1] : null; },
  // Garantit qu'une affectation EN COURS existe pour le chauffeur actuel du véhicule. Si aucune n'est
  // ouverte (véhicules d'avant l'historique, imports…), on en crée une avec pour DATE D'ENTRÉE (par
  // défaut) la 1re mise en circulation du véhicule. Consigne explicite : toujours afficher une date
  // d'entrée, même sans date de sortie. Écrit UNE fois (les ouvertures suivantes trouvent l'entrée).
  // Renvoie l'affectation en cours (existante ou créée), ou null si le véhicule n'a pas de chauffeur.
  ensureCourante(veh) {
    if (!veh || veh.id == null) return null;
    const ch = this._norm(veh.chauffeur);
    if (!ch || ch === '—') return null;
    const cur = this.courante(veh.id);
    if (cur) return cur;                                   // une affectation est déjà ouverte
    this.addEntry(veh.id, ch, veh.dateMiseEnCirculation || null, null);
    return this.courante(veh.id);
  },
  // Date d'ENTRÉE affichée du chauffeur actuel : début de l'affectation en cours si connu, sinon
  // (défaut) la 1re mise en circulation du véhicule. 'AAAA-MM-JJ' ou null. Ne mute rien (lecture).
  debutAffiche(veh) {
    if (!veh) return null;
    const cur = this.courante(veh.id);
    if (cur && cur.debut) return cur.debut;
    return veh.dateMiseEnCirculation || null;
  },
  // Véhicules conduits par un conducteur (par nom, tolérant casse/espaces).
  forConducteur(nom) {
    const cible = this._norm(nom).toLowerCase(); if (!cible) return [];
    const out = []; const map = this.all();
    Object.keys(map).forEach(vehId => (Array.isArray(map[vehId]) ? map[vehId] : []).forEach(a => {
      if (this._norm(a.conducteur).toLowerCase() === cible) out.push({ vehId, ...a });
    }));
    return out.sort((x, y) => String(y.debut || '').localeCompare(String(x.debut || '')));
  },
  // Enregistre un changement de conducteur : ferme l'entrée en cours si le nom change,
  // en ouvre une nouvelle si un conducteur est désigné. Idempotent (rien si inchangé).
  record(vehId, nouveauConducteur, dateISO, ancienConducteur) {
    if (!vehId) return;
    const nom = this._norm(nouveauConducteur);
    const vide = !nom || nom === '—';
    const jour = dateISO || new Date().toISOString().slice(0, 10);
    const s = FP.settings.get();
    s.affectations = (s.affectations && typeof s.affectations === 'object') ? s.affectations : {};
    const list = Array.isArray(s.affectations[vehId]) ? s.affectations[vehId] : [];
    let encours = [...list].reverse().find(x => !x.fin) || null;
    let changed = false;
    // Rattrapage : un conducteur était déjà sur la fiche AVANT que l'historique n'existe
    // (aucune entrée ouverte) → on trace sa sortie pour ne rien perdre au moment du retrait/
    // changement. Début inconnu (null → affiché « depuis l'origine »).
    const ancien = this._norm(ancienConducteur);
    if (!encours && ancien && ancien !== '—' && ancien.toLowerCase() !== (vide ? '' : nom.toLowerCase())) {
      list.push({ conducteur: ancien, debut: null, fin: jour });
      changed = true;
    }
    const actuel = encours ? this._norm(encours.conducteur) : '';
    if (actuel !== (vide ? '' : nom)) {   // vrai changement
      if (encours) { encours.fin = jour; changed = true; } // on clôt l'affectation précédente
      if (!vide) { list.push({ conducteur: nom, debut: jour, fin: null }); changed = true; }
    }
    if (changed) { s.affectations[vehId] = list; FP.settings.save(s); }
  },
  // --- Édition manuelle (crayon dans la fiche véhicule) ---
  // Modifie les dates début/fin d'une entrée (index = position dans le tableau stocké).
  setEntry(vehId, index, patch) {
    const s = FP.settings.get();
    const list = (s.affectations && Array.isArray(s.affectations[vehId])) ? s.affectations[vehId] : null;
    if (!list || !list[index]) return;
    if ('debut' in patch) list[index].debut = patch.debut || null;
    if ('fin' in patch) list[index].fin = patch.fin || null;
    if ('conducteur' in patch && this._norm(patch.conducteur)) list[index].conducteur = this._norm(patch.conducteur);
    FP.settings.save(s);
  },
  // Supprime une entrée de l'historique (index dans le tableau stocké).
  removeEntry(vehId, index) {
    const s = FP.settings.get();
    const list = (s.affectations && Array.isArray(s.affectations[vehId])) ? s.affectations[vehId] : null;
    if (!list || !list[index]) return;
    list.splice(index, 1);
    if (!list.length) delete s.affectations[vehId];
    FP.settings.save(s);
  },
  // Ajoute une période à la main (backfill : conducteur connu à une date connue).
  addEntry(vehId, conducteur, debut, fin) {
    const nom = this._norm(conducteur);
    if (!vehId || !nom) return;
    const s = FP.settings.get();
    s.affectations = (s.affectations && typeof s.affectations === 'object') ? s.affectations : {};
    const list = Array.isArray(s.affectations[vehId]) ? s.affectations[vehId] : [];
    list.push({ conducteur: nom, debut: debut || null, fin: fin || null });
    s.affectations[vehId] = list;
    FP.settings.save(s);
  },
  // Renomme un conducteur dans tout l'historique (suit un renommage de fiche).
  rename(oldName, newName) {
    const from = this._norm(oldName).toLowerCase(); const to = this._norm(newName);
    if (!from || !to) return;
    const s = FP.settings.get(); const map = s.affectations; if (!map || typeof map !== 'object') return;
    let touched = false;
    Object.keys(map).forEach(vehId => (Array.isArray(map[vehId]) ? map[vehId] : []).forEach(a => {
      if (this._norm(a.conducteur).toLowerCase() === from) { a.conducteur = to; touched = true; }
    }));
    if (touched) FP.settings.save(s);
  },
};

// ===== LOYERS DE LEASING basés sur l'OFFRE (fixe) + AVENANTS (prorata) =====
// Le loyer d'un contrat vient de l'OFFRE (montant fixe), PAS des factures. Un avenant
// { date, loyer } change le loyer à partir de sa date → le total est recalculé au prorata.
// `c` accepte { debut, dureeMois, loyer, avenants:[{date,loyer}] } (loyer = TTC/mois).
FP.leasingLoyerAt = (c, when) => {
  if (!c) return null;
  let loyer = (c.loyer != null && c.loyer !== '') ? Number(c.loyer) : null;
  const w = when ? new Date(when) : new Date();
  if (Array.isArray(c.avenants)) {
    c.avenants.filter(a => a && a.loyer != null && a.loyer !== '' && a.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .forEach(a => { if (new Date(a.date) <= w) loyer = Number(a.loyer); });
  }
  return Number.isFinite(loyer) ? loyer : null;
};
// Loyer courant (aujourd'hui).
FP.leasingLoyerCourant = (c) => FP.leasingLoyerAt(c, new Date());
// Total réellement dû depuis le début : somme des loyers mois par mois (bascule aux dates
// d'avenant), + PRORATA au jour du mois en cours. Renvoie null si aucun loyer d'offre connu.
FP.leasingTotalVerse = (c, upto) => {
  if (!c || !c.debut) return null;
  const hasLoyer = (c.loyer != null && c.loyer !== '') || (Array.isArray(c.avenants) && c.avenants.some(a => a && a.loyer != null && a.loyer !== ''));
  if (!hasLoyer) return null;
  const start = new Date(c.debut); if (isNaN(start)) return null;
  const end = new Date(start); end.setMonth(end.getMonth() + (Number(c.dureeMois) || 0));
  const now = upto ? new Date(upto) : new Date();
  const stop = now < end ? now : end;
  if (stop <= start) return 0;
  let total = 0, cur = new Date(start), guard = 0;
  while (guard++ < 600) {
    const next = new Date(cur); next.setMonth(next.getMonth() + 1);
    const loyer = FP.leasingLoyerAt(c, cur) || 0;
    if (next <= stop) { total += loyer; cur = next; }
    else { const dInMonth = (next - cur) / 86400000, dDone = Math.max(0, (stop - cur) / 86400000); total += loyer * Math.min(1, dDone / dInMonth); break; }
  }
  return Math.round(total * 100) / 100;
};

// ⚠️ HELPER CANONIQUE — COÛT DE LEASING D'UN VÉHICULE, quelle que soit la provenance du contrat.
// But : quand l'utilisateur ajoute un contrat (peu importe où), le coût se calcule TOUT SEUL dans le
// TCO, sans double comptage. Deux stockages existent :
//   1) contrat « km/forfait » (FP.leasingContrat : LEASING_CONTRATS PXP + overrides éditables) ;
//   2) contrat LLD saisi dans l'app (settings.localeaseContrats, table « Leasing (LLD) » des Contrats).
// Règle anti-double-comptage : UN véhicule = UN SEUL contrat. Priorité au forfait S'IL PORTE UN LOYER
// (offre/override), sinon on prend le contrat LLD retrouvé par la plaque. Si le forfait n'a pas de
// loyer connu (contrats PXP historiques) ET qu'aucun LLD n'existe → null : le TCO retombe alors sur
// les factures 'leasing' (comportement inchangé). Renvoie { loyerMois, contrat, source } ou null.
FP.leasingCoutContrat = (immat) => {
  const norm = s => FP.normImmat ? FP.normImmat(s) : String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const key = norm(immat); if (!key) return null;
  // 1) Forfait avec loyer (offre ou override) → fait foi.
  try {
    const c1 = FP.leasingContrat ? FP.leasingContrat(immat) : null;
    if (c1) { const loyer = FP.leasingLoyerCourant ? FP.leasingLoyerCourant(c1) : (c1.loyer != null ? Number(c1.loyer) : null); if (loyer != null) return { loyerMois: loyer, contrat: c1, source: 'forfait' }; }
  } catch (e) {}
  // 2) Contrat LLD (Localease/Ayvens…) saisi dans l'app, retrouvé par la plaque.
  try {
    const list = FP.settings.get().localeaseContrats;
    if (Array.isArray(list)) {
      const it = list.find(c => norm(c.immat) === key);
      if (it) {
        const contrat = { debut: it.debut || null, dureeMois: Number(it.dureeMois) || 0, loyer: (it.loyerTTC != null && it.loyerTTC !== '') ? Number(it.loyerTTC) : null, avenants: Array.isArray(it.avenants) ? it.avenants : [] };
        const loyer = FP.leasingLoyerCourant ? FP.leasingLoyerCourant(contrat) : contrat.loyer;
        if (loyer != null) return { loyerMois: loyer, contrat, source: 'lld' };
      }
    }
  } catch (e) {}
  return null;
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
  if (FP.horsFlotte(v)) return null; // seulement les véhicules encore en flotte (tolérant casse/accents)
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

// ===== CENTRE DE DÉCISIONS — recommandations automatiques, triées par impact =====
// Ne REMPLACE pas les alertes (factuelles, « il se passe X ») : ici on transforme les
// signaux en DÉCISIONS À PRENDRE, chacune avec une action claire + un impact € estimé,
// classées par priorité. S'appuie UNIQUEMENT sur les helpers canoniques (santeVehicule,
// leasingInfo, montantDu, decoteVehicule…) — aucune donnée recalculée à la main.
//   [{ id, priorite, categorie, icon, titre, detail, action, impact, impactEuro, target }]
FP.recommandations = (data) => {
  data = data || { vehicules: [], amendes: [], factures: [], conducteurs: [] };
  const out = [];
  const enFlotte = (data.vehicules || []).filter(v => !(FP.horsFlotte && FP.horsFlotte(v)));
  // Décompte en jours via le helper canonique (minuit-à-minuit) → même valeur que la fiche véhicule
  // et les Alertes (avant : Math.ceil sur l'instant courant → off-by-one selon l'heure).
  const j = (d) => FP.joursRestants(d);

  // 1) AMENDES — payer AVANT LA MAJORATION (le vrai saut de prix : forfaitaire → majoré).
  // ⚠️ Cohérence échéance/économie : la fenêtre est ancrée sur la date où l'amende devient MAJORÉE
  // (dateLimiteForfaitaire si connue, sinon estimation date + 45 j, 90 j pour un FPS). L'économie
  // chiffrée = montant MAJORÉ − montant dû (le surcoût évité). Ne JAMAIS croiser la date limite du
  // minoré avec l'économie du majoré (surestimerait à la fois l'urgence et le gain — cf. revue de code).
  try {
    const now = new Date();
    const risque = (data.amendes || [])
      .filter(a => a && FP.estAPayer && FP.estAPayer(a) && a.date && !isNaN(new Date(a.date)) && Number(a.montantMajore) > 0)
      .map(a => {
        const base = new Date(a.date);
        const isFps = FP.estFps(a);
        const lim = a.dateLimiteForfaitaire ? new Date(a.dateLimiteForfaitaire) : (() => { const l = new Date(base); l.setDate(l.getDate() + (isFps ? 90 : 45)); return l; })();
        const jours = FP.joursRestants(lim); // minuit-à-minuit, cohérent avec Alertes/fiche
        const du = FP.montantDu ? FP.montantDu(a) : (Number(a.montantTTC) || 0);
        const maj = Number(a.montantMajore) || 0;
        const eco = (maj > du) ? (maj - du) : 0;                // surcoût évité en payant avant la majoration
        return { a, jours, eco };
      })
      .filter(x => x.jours >= 0 && x.jours < 30);                // majoration imminente (< 30 j)
    if (risque.length) {
      const ecoTot = risque.reduce((s, x) => s + x.eco, 0);
      const min = Math.min(...risque.map(x => x.jours));
      out.push({
        id: 'amendes-minore', priorite: min < 7 ? 95 : 80, categorie: 'Amendes', icon: 'alarm-clock',
        titre: `Régler ${risque.length} amende${risque.length > 1 ? 's' : ''} avant la majoration`,
        detail: `La plus urgente : encore ${min} j avant majoration. Passé ce délai, le montant grimpe fortement.`,
        action: 'Payer maintenant', target: 'amendes.html?filtre=apayer',
        impactEuro: ecoTot, impact: ecoTot > 0 ? ('≈ ' + FP.euro(ecoTot) + ' de surcoût évité') : 'éviter la majoration',
      });
    }
  } catch (e) {}

  // 2) LEASING — fin de contrat proche : décider restitution ou renouvellement
  // 3) LEASING — dépassement km projeté : risque de pénalité chiffré
  enFlotte.forEach(v => {
    let l = null; try { l = FP.leasingInfo ? FP.leasingInfo(v) : null; } catch (e) {}
    if (!l) return;
    if (l.finContrat && !isNaN(l.finContrat)) {
      const jf = j(l.finContrat);
      if (jf !== null && jf <= 120) {
        // Progression de la checklist de restitution (remplie sur la page Contrats)
        let coches = 0; try { const cl = (FP.settings.get().restitutionChecklist || {})[v.id] || {}; coches = Object.keys(cl).filter(k => cl[k]).length; } catch (e) {}
        out.push({
          id: 'leasing-fin-' + v.id, priorite: jf < 0 ? 92 : (jf < 60 ? 78 : 62), categorie: 'Leasing', icon: 'calendar-clock',
          titre: `${v.immat} — ${jf < 0 ? 'leasing terminé' : 'fin de leasing dans ' + jf + ' j'}`,
          detail: 'Décider : restituer (préparer l’état des lieux de sortie) ou renouveler / racheter le véhicule.' + (coches ? ` Checklist de restitution : ${coches} point(s) déjà cochés.` : ''),
          action: 'Préparer la restitution', target: 'contrats.html',
          impactEuro: 0, impact: 'décision à prendre',
        });
      }
    }
    if (l.depassementProjete && l.depassementProjete > 0 && l.kmSupp) {
      const penalite = Math.round(l.depassementProjete * l.kmSupp);
      if (penalite >= 100) out.push({
        id: 'leasing-km-' + v.id, priorite: 74, categorie: 'Leasing', icon: 'gauge',
        titre: `${v.immat} — risque de pénalité kilométrique`,
        detail: `Projection ${FP.num(l.depassementProjete)} km au-dessus du forfait. Réduire l’usage, réaffecter, ou négocier un avenant km.`,
        action: 'Voir le contrat', target: 'contrats.html',
        impactEuro: penalite, impact: '≈ ' + FP.euro(penalite) + ' de pénalité évitable',
      });
    }
  });

  // 4) SANTÉ — véhicules critiques : planifier avant la panne / le refus au CT
  enFlotte.forEach(v => {
    let s = null; try { s = FP.santeVehicule ? FP.santeVehicule(v) : null; } catch (e) {}
    if (!s || s.niveau !== 'critique') return;
    out.push({
      id: 'sante-' + v.id, priorite: 70, categorie: 'Entretien', icon: 'heart-pulse',
      titre: `${v.immat} — véhicule fragile (score ${s.score}/100)`,
      detail: (s.raisons || []).slice(0, 3).join(' · ') || 'Plusieurs échéances en retard.',
      action: 'Ouvrir la fiche', target: 'vehicules.html?veh=' + encodeURIComponent(v.id),
      impactEuro: 0, impact: 'à planifier',
    });
  });

  // 5) À VENDRE — véhicules marqués à vendre : valeur estimée, ne pas laisser dormir
  // (on itère TOUS les véhicules : « à vendre » est considéré hors-flotte par FP.horsFlotte,
  //  donc absent de `enFlotte` — mais on veut justement le rappeler à la vente.)
  (data.vehicules || []).forEach(v => {
    const st = (v.statut || '').toLowerCase();
    const aVendre = /vendre/.test(st) || (Array.isArray(v.groupes) && v.groupes.includes('a-vendre'));
    const dejaCede = /vendu|c[ée]d[ée]|hors[\s-]?service|\bhs\b|archiv|restitu/.test(st);
    if (!aVendre || dejaCede) return;
    let dec = null; try { dec = FP.decoteVehicule ? FP.decoteVehicule(v) : null; } catch (e) {}
    out.push({
      id: 'avendre-' + v.id, priorite: 45, categorie: 'À vendre', icon: 'tag',
      titre: `${v.immat} — à vendre`,
      detail: dec ? `Valeur de revente estimée ≈ ${FP.euro(dec.valeur)}. Relancer les acheteurs ou ajuster le prix.` : 'Relancer les acheteurs ou ajuster le prix.',
      action: 'Voir les véhicules à vendre', target: 'a-vendre.html',
      impactEuro: dec ? dec.valeur : 0, impact: dec ? ('≈ ' + FP.euro(dec.valeur) + ' à récupérer') : 'à céder',
    });
  });

  // 6) CARBURANT — usages de carte suspects à vérifier
  try {
    const anoms = FP.cartesAnomalies ? FP.cartesAnomalies(data) : [];
    if (anoms.length) {
      out.push({
        id: 'carte-anomalies', priorite: 66, categorie: 'Carburant', icon: 'credit-card',
        titre: `${anoms.length} usage${anoms.length > 1 ? 's' : ''} de carte carburant à vérifier`,
        detail: 'Pleins multiples le même jour ou montants inhabituels détectés — contrôle qu’il n’y a pas d’erreur ou d’abus.',
        action: 'Voir les anomalies', target: 'contrats.html',
        impactEuro: 0, impact: 'à contrôler',
      });
    }
  } catch (e) {}

  // Tri : priorité décroissante, puis impact € décroissant
  out.sort((a, b) => (b.priorite - a.priorite) || ((b.impactEuro || 0) - (a.impactEuro || 0)));
  return out;
};

// ===== CARTES CARBURANT — détection d'anomalies / fraude =====
// Repère les usages suspects des cartes carburant à partir des factures de carburant :
//  a) plusieurs pleins le MÊME jour sur un même véhicule (carte prêtée / double passage) ;
//  b) plein au montant anormalement élevé (seuil réglable, défaut 300 € ; doublé pour les gros
//     véhicules utilitaires/camions). Retourne [] si aucune donnée. Lecture seule.
//   [{ vehId, immat, type:'doublon-jour'|'plein-eleve', date, montant, label }]
FP.cartesAnomalies = (data) => {
  data = data || {};
  const out = [];
  const vehByImmat = {};
  (data.vehicules || []).forEach(v => { if (v && v.immat) vehByImmat[FP.normImmat(v.immat)] = v; });
  const estCarburant = (f) => { const t = String((f && f.type) || '').toLowerCase(); return t === 'carburant' || (FP.estTotalFleet && FP.estTotalFleet(f) && t !== 'peage'); };
  const carburants = (data.factures || []).filter(f => f && f.vehiculeImmat && f.date && estCarburant(f));
  // a) plusieurs pleins le même jour
  const byVehDay = {};
  carburants.forEach(f => { const k = FP.normImmat(f.vehiculeImmat) + '|' + String(f.date).slice(0, 10); (byVehDay[k] = byVehDay[k] || []).push(f); });
  Object.keys(byVehDay).forEach(k => {
    const list = byVehDay[k]; if (list.length < 2) return;
    const np = k.split('|')[0], day = k.split('|')[1]; const v = vehByImmat[np]; if (!v) return;
    const tot = list.reduce((s, f) => s + (Number(f.montantTTC) || 0), 0);
    out.push({ vehId: v.id, immat: v.immat, type: 'doublon-jour', date: day, montant: tot,
      label: `${list.length} pleins le même jour (${FP.date(day)})${tot ? ' — total ' + FP.euro(tot) : ''}` });
  });
  // b) plein anormalement élevé
  let seuil = 300; try { const s = FP.settings.get(); if (Number(s.pleinSeuilAnormal) > 0) seuil = Number(s.pleinSeuilAnormal); } catch (e) {}
  carburants.forEach(f => {
    const m = Number(f.montantTTC) || 0; if (m < seuil) return;
    const v = vehByImmat[FP.normImmat(f.vehiculeImmat)]; if (!v) return;
    const gros = /utilit|camion|engin|poids/.test(String(v.categorie || '').toLowerCase());
    if (gros && m < seuil * 2) return;               // tolérance gros réservoirs
    out.push({ vehId: v.id, immat: v.immat, type: 'plein-eleve', date: String(f.date).slice(0, 10), montant: m,
      label: `Plein inhabituel de ${FP.euro(m)} le ${FP.date(f.date)} — à vérifier` });
  });
  out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return out;
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
    // Les 3 paliers (rouge / orange / info) se calent sur l'anticipation configurée (ctJours) :
    // info = ctJours (défaut 90), orange = 2/3, rouge = 1/3 → 30/60/90 par défaut.
    const _ctI = FP.notifCfg().ctJours, _ctW = Math.round(_ctI * 2 / 3), _ctD = Math.round(_ctI / 3);
    if (diff < 0)        out.push({ niveau: 'danger', categorie: 'Contrôle technique', message: `CT dépassé de ${-diff}j`, detail: veh, sort: diff, target: tgt, muteKey: mk, vehLabel: veh });
    else if (diff < _ctD) out.push({ niveau: 'danger', categorie: 'Contrôle technique', message: `CT à faire dans ${diff}j`, detail: veh, sort: diff, target: tgt, muteKey: mk, vehLabel: veh });
    else if (diff < _ctW) out.push({ niveau: 'warn',   categorie: 'Contrôle technique', message: `CT à prévoir dans ${diff}j`, detail: veh, sort: diff, target: tgt, muteKey: mk, vehLabel: veh });
    else if (diff < _ctI) out.push({ niveau: 'info', categorie: 'Contrôle technique', message: `CT à venir (${diff}j)`, detail: veh, sort: diff, target: tgt, muteKey: mk, vehLabel: veh });
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
    const _polI = FP.notifCfg().ctJours, _polW = Math.round(_polI * 2 / 3), _polD = Math.round(_polI / 3);
    if (diff < 0)         out.push({ niveau: 'danger', categorie: 'Anti-pollution', message: `Anti-pollution dépassé de ${-diff}j`, detail: veh, sort: diff, target: tgt, muteKey: mk, vehLabel: veh });
    else if (diff < _polD) out.push({ niveau: 'danger', categorie: 'Anti-pollution', message: `Anti-pollution à faire dans ${diff}j`, detail: veh, sort: diff, target: tgt, muteKey: mk, vehLabel: veh });
    else if (diff < _polW) out.push({ niveau: 'warn',   categorie: 'Anti-pollution', message: `Anti-pollution à prévoir dans ${diff}j`, detail: veh, sort: diff, target: tgt, muteKey: mk, vehLabel: veh });
  });

  // --- Relevé kilométrique périodique (rappel tous les X jours, réglable dans Paramètres → Notifications) ---
  // Deux modes :
  //  • SANS date de début → base = date du DERNIER relevé de CHAQUE véhicule (settings.kmMajDates).
  //  • AVEC date de début → cycle GLOBAL : échéances tous les X jours à partir de cette date ;
  //    un véhicule dont le km a été mis à jour APRÈS la dernière échéance est considéré à jour.
  // Dans les deux cas : ignorable PAR véhicule.
  {
    const nc = FP.notifCfg();
    const periodeJ = nc.releveKmJours || 45;
    const debut = (nc.releveKmDebut ? new Date(nc.releveKmDebut) : null);
    const debutOk = debut && !isNaN(debut);
    const kmDates = (function () { try { return FP.settings.get().kmMajDates || {}; } catch (e) { return {}; } })();
    // Dernière échéance globale passée (mode « date de début »)
    let echeance = null, sinceEch = null;
    if (debutOk) {
      const dsStart = Math.floor((today - debut) / 86400000);
      if (dsStart >= 0) {
        const cycles = Math.floor(dsStart / periodeJ);
        echeance = new Date(debut.getTime() + cycles * periodeJ * 86400000);
        sinceEch = Math.floor((today - echeance) / 86400000);
      }
    }
    // ⚠️ Liste potentiellement LONGUE (toute la flotte) → on REGROUPE en une seule alerte
    // dépliable (champ `vehicules` rendu en <details> dans notifications.html), au lieu d'une
    // carte par véhicule. Deux paquets par urgence : « à faire » (warn) et « à renseigner » (info).
    const relKmWarn = [], relKmInfo = [];
    (data.vehicules || []).forEach(v => {
      if (horsFlotte(v)) return;
      const veh = `${v.immat} · ${v.marque} ${v.modele}${v.chauffeur && v.chauffeur !== '—' ? ' (' + v.chauffeur + ')' : ''}`;
      const tgt = 'vehicules.html?veh=' + v.id;
      const last = kmDates[v.immat] ? new Date(kmDates[v.immat]) : null;
      if (debutOk) {
        if (!echeance) return;                       // cycle pas encore commencé
        if (last && last >= echeance) return;        // relevé déjà fait après la dernière échéance
        (sinceEch >= periodeJ * 0.5 ? relKmWarn : relKmInfo).push({ label: `${veh} — échéance il y a ${sinceEch} j`, target: tgt });
        return;
      }
      // Mode par véhicule (pas de date d'ancrage)
      if (!last) { relKmInfo.push({ label: `${veh} — jamais renseigné`, target: tgt }); return; }
      const since = Math.floor((today - last) / 86400000);
      if (since >= periodeJ) {
        (since >= periodeJ * 1.5 ? relKmWarn : relKmInfo).push({ label: `${veh} — dernier il y a ${since} j`, target: tgt });
      }
    });
    if (relKmWarn.length) out.push({ niveau: 'warn', categorie: 'Relevé km', message: `${relKmWarn.length} relevé${relKmWarn.length > 1 ? 's' : ''} km à faire`, detail: 'Kilométrage à mettre à jour (échéance dépassée).', sort: 480, muteKey: 'relevekm-warn', vehicules: relKmWarn });
    if (relKmInfo.length) out.push({ niveau: 'info', categorie: 'Relevé km', message: `${relKmInfo.length} relevé${relKmInfo.length > 1 ? 's' : ''} km à renseigner`, detail: 'Kilométrage jamais saisi ou à rafraîchir.', sort: 1000, muteKey: 'relevekm-info', vehicules: relKmInfo });
  }

  // --- Amendes à payer ---
  const amAPayer = (data.amendes || []).filter(a => FP.estAPayer(a));
  if (amAPayer.length > 0) {
    const totalDu = amAPayer.reduce((s, a) => s + FP.montantDu(a), 0);
    out.push({
      niveau: totalDu > FP.notifCfg().amendeTotalWarn ? 'warn' : 'info',
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
      const sansJustif = (data.amendes || []).filter(a => watchJ.includes(a.id) && FP.estPayee(a) && !a.justifUrl);
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
      .filter(a => a && FP.estAPayer(a) && a.date && !isNaN(new Date(a.date)))
      .map(a => {
        const base = new Date(a.date);
        const isFps = FP.estFps(a);
        const lim = new Date(base); lim.setDate(lim.getDate() + (isFps ? 90 : 45));
        const jours = Math.ceil((lim - maintenant) / 86400000);
        return { a, lim, jours };
      })
      .filter(x => x.jours < FP.notifCfg().amendeMajorationJours) // bientôt majorée (< X j réglable) ou déjà dépassée
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
    const _docW = FP.notifCfg().docAlerteJours, _docD = Math.round(_docW / 2); // orange = X j avant, rouge = moitié
    if (diff < 0)         out.push({ niveau: 'danger', categorie: 'Permis', message: `Permis EXPIRÉ depuis ${-diff}j`, detail, sort: diff, target: tgt, muteKey: mk, vehLabel: who });
    else if (diff < _docD) out.push({ niveau: 'danger', categorie: 'Permis', message: `Permis expire dans ${diff}j`, detail, sort: diff, target: tgt, muteKey: mk, vehLabel: who });
    else if (diff < _docW) out.push({ niveau: 'warn',   categorie: 'Permis', message: `Permis à renouveler (${diff}j)`, detail, sort: diff, target: tgt, muteKey: mk, vehLabel: who });
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
        const _docW = FP.notifCfg().docAlerteJours, _docD = Math.round(_docW / 2);
        if (diff < 0)         out.push({ niveau: 'danger', categorie: "Pièce d'identité", message: `${lib} EXPIRÉE depuis ${-diff}j`, detail, sort: diff, target: tgt, muteKey: mk, vehLabel: who + ' — ' + lib });
        else if (diff < _docD) out.push({ niveau: 'danger', categorie: "Pièce d'identité", message: `${lib} expire dans ${diff}j`, detail, sort: diff, target: tgt, muteKey: mk, vehLabel: who + ' — ' + lib });
        else if (diff < _docW) out.push({ niveau: 'warn',   categorie: "Pièce d'identité", message: `${lib} à renouveler (${diff}j)`, detail, sort: diff, target: tgt, muteKey: mk, vehLabel: who + ' — ' + lib });
      });
    });
  } catch (e) {}

  // --- Révisions constructeur ---
  (data.vehicules || []).forEach(v => {
    if (FP.horsFlotte(v)) return; // on ignore vendus / à vendre / hors service
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
    if (FP.horsFlotte(v)) return;
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
    if (FP.horsFlotte(v)) return;
    const l = FP.leasingInfo(v);
    if (!l || !l.finContrat || isNaN(l.finContrat)) return;
    const diff = days(l.finContrat);
    const veh = `${v.immat} · ${v.marque} ${v.modele}${v.chauffeur && v.chauffeur !== '—' ? ' (' + v.chauffeur + ')' : ''}`;
    const finStr = FP.date(l.finContrat.toISOString());
    // Seuil configurable (Paramètres → Notifications) : « danger » à X mois de la fin (défaut 2),
    // « warn » pendant les 3 mois qui précèdent ce seuil.
    const finMois = FP.notifCfg().leasingFinMois;
    const dangerJ = Math.max(0, finMois) * 30;
    const warnJ = dangerJ + 90;
    let niveau = null, msg = null;
    if (diff < 0)          { niveau = 'danger'; msg = `Leasing terminé depuis ${-diff}j (${finStr})`; }
    else if (diff <= dangerJ) { niveau = 'danger'; msg = `Fin de leasing dans ${diff}j (${finStr})`; }
    else if (diff <= warnJ)   { niveau = 'warn';   msg = `Fin de leasing dans ~${Math.round(diff / 30)} mois (${finStr})`; }
    else return;
    out.push({ niveau, categorie: 'Leasing', message: msg, detail: veh, sort: diff, target: 'contrats.html', muteKey: 'leasingfin|' + v.id + '|' + finStr, vehLabel: veh });
  });

  // (Le « véhicules sans dernière révision » n'est PAS une alerte : véhicules neufs, etc.
  //  → retiré des notifications. L'info reste visible dans la fiche véhicule.)

  // --- Véhicules IMMOBILISÉS depuis trop longtemps (marqués via le dashboard) ---
  try {
    const immo = (FP.settings.get().vehImmobilise) || {};
    const seuilJ = FP.notifCfg().immobiliseJours;
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const items = [];
    (data.vehicules || []).forEach(v => {
      if (FP.horsFlotte(v)) return;
      const im = immo[v.id]; if (!im || !im.since) return;
      const j = Math.floor((t0 - new Date(im.since)) / 86400000);
      if (j >= seuilJ) items.push({ label: `${v.immat} · ${v.marque} ${v.modele} — immobilisé depuis ${j} j`, target: 'vehicules.html' });
    });
    if (items.length) out.push({ niveau: 'warn', categorie: 'Immobilisation', message: `${items.length} véhicule(s) immobilisé(s) depuis + de ${seuilJ} j`, detail: 'Au garage / hors service trop longtemps — à débloquer', sort: 400, vehicules: items });
  } catch (e) {}

  // --- Consommation carburant ANORMALE (dépense d'un mois clos >> moyenne du véhicule) ---
  // Ignorable par véhicule via « masquer » (muteKey conso|<id>) : le gestionnaire peut connaître
  // la raison (gros déplacement, plein exceptionnel…) et couper l'alerte pour ce véhicule.
  try {
    const seuil = 1 + (FP.notifCfg().consoSeuilPct / 100);
    const byVeh = {};
    (data.factures || []).forEach(f => {
      if (!FP.estCarburantPeage(f) || !f.vehiculeImmat) return;
      const ym = (f.date || '').slice(0, 7); if (!/^\d{4}-\d{2}$/.test(ym)) return;
      const im = String(f.vehiculeImmat).toUpperCase();
      (byVeh[im] = byVeh[im] || {})[ym] = (byVeh[im][ym] || 0) + (Number(f.montantTTC) || 0);
    });
    const nowYm = new Date().toISOString().slice(0, 7);
    Object.keys(byVeh).forEach(im => {
      const months = Object.keys(byVeh[im]).sort();
      // On évalue le dernier mois CLOS : le mois courant est incomplet, donc on l'IGNORE au lieu de
      // sauter le véhicule (bug : avec des cartes carburant mensuelles, presque tout véhicule actif a
      // une conso le mois courant → l'alerte ne se déclenchait jamais).
      let idx = months.length - 1;
      if (months[idx] === nowYm) idx--;              // écarte le mois courant incomplet
      if (idx < 3) return;                           // besoin d'au moins 3 mois d'historique avant
      const last = months[idx];
      const prev = months.slice(0, idx);             // les mois antérieurs au mois évalué
      const avg = prev.reduce((s, m) => s + byVeh[im][m], 0) / prev.length;
      const val = byVeh[im][last];
      if (avg <= 0 || val < 50 || val < avg * seuil) return;
      const v = (data.vehicules || []).find(x => FP.normImmat(x.immat) === FP.normImmat(im));
      if (!v || FP.horsFlotte(v)) return;
      const pct = Math.round((val / avg - 1) * 100);
      out.push({ niveau: 'info', categorie: 'Carburant', message: `${im} : carburant +${pct}% en ${last} (${FP.euro(val)} vs moy. ${FP.euro(avg)})`, detail: 'Dépense inhabituelle — vérifie (gros plein, fuite, usage) ou masque si c\'est normal', sort: 350, target: 'factures.html', muteKey: 'conso|' + v.id, vehLabel: `${v.immat} · ${v.marque} ${v.modele}` });
    });
  } catch (e) {}

  // --- Expiration carte carburant / badge télépéage (dates saisies dans la fiche véhicule) ---
  try {
    const st = FP.settings.get();
    const exps = [['vehCarteCarbExp', 'Carte carburant'], ['vehBadgeExp', 'Badge télépéage']];
    const t0e = new Date(); t0e.setHours(0, 0, 0, 0);
    (data.vehicules || []).forEach(v => {
      if (FP.horsFlotte(v)) return;
      exps.forEach(([mapKey, lib]) => {
        const d = (st[mapKey] || {})[v.id]; if (!d) return;
        const dt = new Date(d); if (isNaN(dt)) return;
        const diff = Math.ceil((dt - t0e) / 86400000);
        const veh = `${v.immat} · ${v.marque} ${v.modele}`;
        const mk = 'exp' + mapKey + '|' + v.id;
        if (diff < 0)                              out.push({ niveau: 'danger', categorie: lib, message: `${lib} EXPIRÉE depuis ${-diff}j (${v.immat})`, detail: veh, sort: diff, target: 'vehicules.html', muteKey: mk, vehLabel: veh });
        else if (diff < FP.notifCfg().carteExpJours) out.push({ niveau: 'warn',   categorie: lib, message: `${lib} expire dans ${diff}j (${v.immat})`, detail: veh, sort: diff, target: 'vehicules.html', muteKey: mk, vehLabel: veh });
      });
    });
  } catch (e) {}

  // --- Amende potentiellement PAYÉE EN DOUBLE (même n° d'avis réglé plusieurs fois) ---
  try {
    const byAvis = {};
    (data.amendes || []).forEach(a => { const n = (a.numeroAvis || '').toString().trim().toUpperCase(); if (!n) return; (byAvis[n] = byAvis[n] || []).push(a); });
    const dbl = [];
    Object.keys(byAvis).forEach(n => {
      const payees = byAvis[n].filter(a => FP.estPayee ? FP.estPayee(a) : a.statut === 'payée');
      if (payees.length >= 2) dbl.push({ label: `Avis ${n} — réglé ${payees.length}×`, target: 'amendes.html' });
    });
    if (dbl.length) out.push({ niveau: 'warn', categorie: 'Amendes', message: `${dbl.length} amende(s) peut-être payée(s) en double`, detail: "Même n° d'avis réglé plusieurs fois — vérifie / demande le remboursement", sort: 420, vehicules: dbl });
  } catch (e) {}

  // --- Sinistres en attente de remboursement (rappel de suivi) ---
  const sinStatut = (FP.settings.get().sinistreStatut) || {};
  const sinAttente = (data.factures || []).filter(f => f.type === 'sinistre' && FP.sinistreStatutOf(f) === 'attente');
  if (sinAttente.length) {
    out.push({ niveau: 'warn', categorie: 'Sinistres', message: `${sinAttente.length} sinistre(s) en attente de remboursement`, detail: "Vérifie si l'assureur t'a remboursé", sort: 500,
      vehicules: sinAttente.map(s => ({ label: `${s.vehiculeImmat || '—'} · ${(s.description || 'sinistre').slice(0, 45)}${s.montantTTC ? ' — ' + FP.euro(s.montantTTC) : ''}`, target: 'sinistres.html' })) });
  }

  // --- Sinistres SANS réponse de l'assureur depuis longtemps → relancer l'assureur ---
  // Un incident = une clé de groupe (settings.sinistreGroupes[id] || id). « Pas de réponse » = ni
  // responsabilité, ni date de réponse, ni clôture dans le dossier (settings.sinistreAssurance[clé]).
  try {
    const sinGroupes = (FP.settings.get().sinistreGroupes) || {};
    const sinDoss = (FP.settings.get().sinistreAssurance) || {};
    const gkOf = id => sinGroupes[id] || id;
    const incidents = {};
    (data.factures || []).forEach(f => {
      if (f.type !== 'sinistre') return;
      const k = gkOf(f.id);
      const g = incidents[k] || (incidents[k] = { key: k, rep: f, date: f.date || '', ids: [] });
      g.ids.push(f.id);                                                         // toutes les lignes de l'incident
      if ((f.date || '') && (!g.date || f.date < g.date)) g.date = f.date;      // date de déclaration = plus ancienne
      if ((!g.rep.vehiculeImmat && f.vehiculeImmat) || (!g.rep.description && f.description)) g.rep = f;
    });
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const SIN_RELANCE_J = FP.notifCfg().sinistreRelanceJours; // délai sans réponse → on relance (défaut 21 j)
    // Un statut « remboursé / prise en charge / refusé » = l'assureur A répondu → plus « sans réponse ».
    const RESOLU = new Set(['rembourse', 'pec', 'refuse']);
    const sansReponse = Object.values(incidents).filter(g => {
      const d = sinDoss[g.key] || {};
      // Résolu si : réponse/clôture dans le dossier, OU statut de suivi = remboursé/PEC/refusé
      // (sur n'importe quelle ligne de l'incident), OU un montant remboursé a été saisi.
      const statResolu = RESOLU.has((sinStatut[g.key] || '').toLowerCase()) || (g.ids || []).some(id => RESOLU.has((sinStatut[id] || '').toLowerCase()));
      if (d.resp || d.dateReponse || d.dateCloture || statResolu || (Number(d.rembourse) || 0) > 0) return false;
      const decl = d.dateDeclaration || g.date;
      const dt = decl ? new Date(decl) : null; if (!dt || isNaN(dt)) return false;
      return Math.floor((today0 - dt) / 86400000) >= SIN_RELANCE_J;
    });
    if (sansReponse.length) {
      sansReponse.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      out.push({ niveau: 'warn', categorie: 'Sinistres', message: `${sansReponse.length} sinistre(s) sans réponse de l'assureur`, detail: `Relance l'assureur : responsabilité pas encore reçue (> ${SIN_RELANCE_J} j).`, sort: 490,
        vehicules: sansReponse.map(g => ({ label: `${g.rep.vehiculeImmat || '—'} · déclaré ${g.date ? FP.date(g.date) : '?'}${g.rep.description ? ' — ' + String(g.rep.description).slice(0, 40) : ''}`, target: 'sinistres.html' })) });
    }
  } catch (e) { console.warn('[alerte sinistre relance]', e); }

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

  // --- Factures Total (carburant) SANS PDF stocké (upload raté / bucket bloqué) ---
  // Filet de sécurité : un relevé Total importé doit TOUJOURS avoir son PDF réaffichable.
  // On regroupe en UNE alerte dépliable → on voit tout de suite s'il manque des PDF.
  try {
    const sansPdf = (data.factures || []).filter(f => FP.estTotalFleet(f) && (!f.fileId || /^IMP-/.test(String(f.fileId))));
    if (sansPdf.length) {
      out.push({ niveau: 'info', categorie: 'Factures', message: `${sansPdf.length} facture(s) Total sans PDF stocké`,
        detail: "Le PDF n'a pas pu être enregistré (stockage). Ré-importe les relevés Total pour rattacher les PDF.", sort: 700,
        target: 'factures.html',
        vehicules: sansPdf.slice(0, 100).map(f => ({ label: `${f.numeroFacture || f.id} — ${f.date ? FP.date(f.date) : '—'}${f.montantTTC != null ? ' · ' + FP.euro(f.montantTTC) : ''}`, target: 'factures.html' })) });
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
  // Barème ALIGNÉ sur buildAlertes (< 30 danger, < 60 warn, sinon info) pour qu'une MÊME
  // échéance ait la même couleur/gravité dans « Alertes » et dans « Renouvellements »/calendrier.
  const niv = (dateStr) => {
    // Décompte via le helper canonique (minuit-à-minuit) → MÊME gravité/couleur qu'Alertes pour une
    // même échéance (avant : Math.ceil sur une date parsée en UTC → +1 jour en France, couleurs décalées).
    const diff = FP.joursRestants(dateStr);
    if (diff == null) return 'info';
    if (diff < 30) return 'danger';
    if (diff < 60) return 'warn';
    return 'info';
  };
  const push = (dateStr, categorie, label, detail, target) => {
    const d = iso(dateStr); if (!d) return;
    out.push({ date: d, categorie, label, detail, niveau: niv(d), target });
  };

  (data.vehicules || []).forEach(v => {
    if (FP.horsFlotte && FP.horsFlotte(v)) return; // même règle que les alertes : pas d'échéance sur un véhicule sorti (vendu / à vendre…)
    const veh = `${v.immat} · ${v.marque} ${v.modele}`;
    const tgt = 'vehicules.html?veh=' + v.id;
    if (v.prochainCT && v.prochainCT !== '—' && !FP.ctIgnored(v)) push(v.prochainCT, 'Contrôle technique', 'CT — ' + v.immat, veh, tgt);
    if (FP.concerneAntiPollution(v) && v.antiPollution && v.antiPollution !== '—') push(v.antiPollution, 'Anti-pollution', 'Anti-pollution — ' + v.immat, veh, tgt);
    // Fin de leasing (BPCE forfait) — sinon repli sur le contrat LLD (Localease/Ayvens) saisi dans
    // l'app, dont le coût est déjà compté ailleurs mais dont la date de fin manquait au calendrier
    // (rule 0-source). Un seul contrat par véhicule → on n'ajoute le LLD que si BPCE n'a rien donné.
    const l = FP.leasingInfo && FP.leasingInfo(v);
    if (l && l.finContrat && !isNaN(l.finContrat)) push(l.finContrat.toISOString(), 'Leasing', 'Fin leasing — ' + v.immat, veh, 'contrats.html');
    else {
      try {
        const list = FP.settings.get().localeaseContrats;
        if (Array.isArray(list)) {
          const it = list.find(c => FP.normImmat(c.immat) === FP.normImmat(v.immat));
          if (it && it.debut && Number(it.dureeMois) > 0) {
            const fin = new Date(it.debut);
            if (!isNaN(fin)) { fin.setMonth(fin.getMonth() + Number(it.dureeMois)); push(fin.toISOString(), 'Leasing', 'Fin leasing — ' + v.immat, veh, 'contrats.html'); }
          }
        }
      } catch (e) {}
    }
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
  // Coût du mois = coût d'EXPLOITATION (hors leasing/sinistre/achat/cession) — MÊME règle que le
  // dashboard et l'écran mural, sinon le rapport annonçait un montant gonflé par un achat de véhicule.
  const coutMois = facts.filter(f => (f.date || '').slice(0, 7) === ym && FP.coutFactureExploit(f)).reduce((s, f) => s + (+f.montantTTC || 0), 0);
  // 12 mois glissants = coût d'EXPLOITATION (même filtre que coutMois) — sinon gonflé par un achat de véhicule/sinistre.
  const cout12 = facts.filter(f => (f.date || '').slice(0, 7) >= y12 && FP.coutFactureExploit(f)).reduce((s, f) => s + (+f.montantTTC || 0), 0);

  const byVeh = {};
  facts.filter(f => (f.date || '').slice(0, 7) >= y12 && FP.coutFactureExploit(f)).forEach(f => { const k = f.vehiculeImmat || '—'; byVeh[k] = (byVeh[k] || 0) + (+f.montantTTC || 0); });
  const topCouts = Object.entries(byVeh).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topMax = topCouts.length ? topCouts[0][1] : 0;

  const tvsTotal = actifs.reduce((s, v) => { const d = FP.tvsDetail ? FP.tvsDetail(v) : null; return s + (d && d.applicable && d.total != null ? d.total : 0); }, 0);
  let co2G = 0; actifs.forEach(v => { const carb = (v.carburant || '').toLowerCase(); if (/lectri|hydrog/.test(carb)) return; const c = Number(v.co2); if (Number.isFinite(c) && c > 0) co2G += c * 15000; });
  const co2T = co2G / 1e6;
  const nbElec = actifs.filter(v => /lectri|hydrog|hybrid/.test((v.carburant || '').toLowerCase())).length;

  const am = (data.amendes || []);
  const amTot = am.reduce((s, a) => s + FP.montantDu(a), 0); // source unique (majoré + montant réellement payé)

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
  // Croix pour fermer soi-même (utile surtout sur téléphone, où le pop-up gêne).
  if (opts.closable !== false) {
    const x = document.createElement('button');
    x.setAttribute('aria-label', 'Fermer'); x.textContent = '✕';
    x.style.cssText = 'background:transparent;color:rgba(255,255,255,.7);border:none;font-size:1rem;line-height:1;cursor:pointer;flex-shrink:0;padding:.15rem .2rem;margin-left:.1rem';
    x.onclick = close;
    el.appendChild(x);
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

// ── Fenêtres modales « à la sauce Parc Pilot » — remplacent les pop-ups natives ──
// alert()/confirm()/prompt() du navigateur (moches, hors charte). Promesse en retour :
//   await FP.confirm('Supprimer ?')  → true/false   ·   await FP.prompt('Nom ?', 'défaut') → texte/null
//   FP.alert('Fait !')  (et window.alert est remplacé en drop-in, aucun changement d'appel requis).
FP.dialog = function (opts) {
  opts = opts || {};
  const type = opts.type || 'confirm';                 // 'confirm' | 'alert' | 'prompt'
  const danger = !!opts.danger;
  const msg = opts.message == null ? '' : String(opts.message);
  const title = opts.title != null ? opts.title
    : (type === 'alert' ? 'Information' : (type === 'prompt' ? 'Saisie' : 'Confirmation'));
  const okText = opts.okText || (type === 'alert' ? 'OK' : (danger ? 'Supprimer' : 'Confirmer'));
  const cancelText = opts.cancelText || 'Annuler';

  if (!document.getElementById('fp-dlg-style')) {
    const st = document.createElement('style'); st.id = 'fp-dlg-style';
    st.textContent = [
      // Boîte de dialogue ancrée VERS LE HAUT (plus agréable qu\'en plein milieu d\'écran), et
      // défilable si le message est long (téléphone).
      '.fp-dlg-backdrop{position:fixed;inset:0;z-index:100000;display:flex;align-items:flex-start;justify-content:center;padding:1.25rem;padding-top:7vh;overflow-y:auto;',
      'background:rgba(11,18,32,.55);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);animation:fp-dlg-fade .16s ease}',
      '.fp-dlg-card{width:100%;max-width:430px;background:#fff;border:1px solid var(--fp-border,#E3E8F0);border-radius:16px;',
      'box-shadow:0 30px 70px -20px rgba(11,18,32,.5);padding:1.4rem 1.4rem 1.15rem;animation:fp-dlg-pop .22s cubic-bezier(.16,1,.3,1)}',
      '.fp-dlg-top{display:flex;gap:.85rem;align-items:flex-start}',
      '.fp-dlg-icon{flex:none;width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:rgba(249,115,22,.12);color:var(--fp-accent,#F97316)}',
      '.fp-dlg-icon.danger{background:rgba(239,68,68,.12);color:var(--fp-danger,#EF4444)}',
      '.fp-dlg-icon svg{width:22px;height:22px}',
      '.fp-dlg-body{flex:1;min-width:0}',
      '.fp-dlg-title{font-weight:800;font-size:1.08rem;color:var(--fp-primary,#0B1220);margin-bottom:.2rem;line-height:1.25}',
      '.fp-dlg-msg{font-size:.92rem;color:#475569;line-height:1.5;white-space:pre-line;word-wrap:break-word}',
      '.fp-dlg-input{width:100%;margin-top:.9rem;padding:.6rem .75rem;border:1px solid var(--fp-border,#E3E8F0);border-radius:9px;font-size:.95rem;color:var(--fp-primary,#0B1220);font-family:inherit}',
      '.fp-dlg-input:focus{outline:none;border-color:var(--fp-accent,#F97316);box-shadow:0 0 0 3px rgba(249,115,22,.15)}',
      '.fp-dlg-actions{display:flex;gap:.6rem;justify-content:flex-end;margin-top:1.25rem;flex-wrap:wrap}',
      '.fp-dlg-btn{border:none;border-radius:9px;padding:.6rem 1.1rem;font-weight:700;font-size:.9rem;cursor:pointer;font-family:inherit;transition:transform .12s,filter .15s,background .15s}',
      '.fp-dlg-btn:active{transform:translateY(1px)}',
      '.fp-dlg-cancel{background:#EEF1F6;color:var(--fp-primary,#0B1220)}',
      '.fp-dlg-cancel:hover{background:#E3E8F0}',
      '.fp-dlg-ok{background:var(--fp-accent,#F97316);color:#fff;box-shadow:0 10px 22px -10px rgba(249,115,22,.7)}',
      '.fp-dlg-ok:hover{filter:brightness(1.05)}',
      '.fp-dlg-ok.danger{background:var(--fp-danger,#EF4444);box-shadow:0 10px 22px -10px rgba(239,68,68,.7)}',
      '@keyframes fp-dlg-fade{from{opacity:0}to{opacity:1}}',
      '@keyframes fp-dlg-pop{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:none}}',
      '@media (prefers-reduced-motion:reduce){.fp-dlg-backdrop,.fp-dlg-card{animation:none}}'
    ].join('');
    document.head.appendChild(st);
  }

  return new Promise((resolve) => {
    const iconName = danger ? 'trash-2' : (type === 'alert' ? 'info' : (type === 'prompt' ? 'pencil' : 'help-circle'));
    const back = document.createElement('div'); back.className = 'fp-dlg-backdrop';
    const card = document.createElement('div'); card.className = 'fp-dlg-card';
    card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true');

    const top = document.createElement('div'); top.className = 'fp-dlg-top';
    const ic = document.createElement('div'); ic.className = 'fp-dlg-icon' + (danger ? ' danger' : '');
    ic.innerHTML = '<i data-lucide="' + iconName + '"></i>';
    const body = document.createElement('div'); body.className = 'fp-dlg-body';
    if (title) { const t = document.createElement('div'); t.className = 'fp-dlg-title'; t.textContent = title; body.appendChild(t); }
    const m = document.createElement('div'); m.className = 'fp-dlg-msg'; m.textContent = msg; body.appendChild(m);
    let input = null;
    if (type === 'prompt') {
      input = document.createElement('input'); input.className = 'fp-dlg-input'; input.type = 'text';
      input.value = opts.defaultValue != null ? String(opts.defaultValue) : '';
      if (opts.placeholder) input.placeholder = opts.placeholder;
      body.appendChild(input);
    }
    top.appendChild(ic); top.appendChild(body); card.appendChild(top);

    const actions = document.createElement('div'); actions.className = 'fp-dlg-actions';
    let cancelBtn = null;
    if (type !== 'alert') {
      cancelBtn = document.createElement('button');
      cancelBtn.className = 'fp-dlg-btn fp-dlg-cancel'; cancelBtn.textContent = cancelText;
      actions.appendChild(cancelBtn);
    }
    const okBtn = document.createElement('button');
    okBtn.className = 'fp-dlg-btn fp-dlg-ok' + (danger ? ' danger' : ''); okBtn.textContent = okText;
    actions.appendChild(okBtn);
    card.appendChild(actions);
    back.appendChild(card);
    document.body.appendChild(back);
    try { if (window.lucide && lucide.createIcons) lucide.createIcons(); } catch (e) {}

    const prevFocus = document.activeElement;
    const cleanup = () => {
      document.removeEventListener('keydown', onKey, true);
      back.style.opacity = '0'; back.style.transition = 'opacity .15s';
      setTimeout(() => { try { back.remove(); } catch (e) {} }, 150);
      try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch (e) {}
    };
    const done = (val) => { cleanup(); resolve(val); };
    const onOk = () => done(type === 'prompt' ? (input ? input.value : '') : true);
    const onCancel = () => done(type === 'prompt' ? null : (type === 'alert' ? undefined : false));
    okBtn.addEventListener('click', onOk);
    if (cancelBtn) cancelBtn.addEventListener('click', onCancel);
    back.addEventListener('click', (e) => { if (e.target === back) onCancel(); });
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      else if (e.key === 'Enter' && (type === 'alert' || type === 'prompt' || e.target !== cancelBtn)) { e.preventDefault(); onOk(); }
    };
    document.addEventListener('keydown', onKey, true);
    setTimeout(() => { try { (input || okBtn).focus(); } catch (e) {} }, 40);
  });
};
// Confirmation : détecte automatiquement les suppressions → bouton rouge « Supprimer ».
FP.confirm = (message, opts) => {
  opts = opts || {};
  const auto = /supprim|effacer|d[ée]finit|irr[ée]vers|retirer|vider/i.test(String(message == null ? '' : message));
  return FP.dialog(Object.assign({ type: 'confirm', message, danger: auto }, opts));
};
FP.alert  = (message, opts) => FP.dialog(Object.assign({ type: 'alert',  message: message }, opts || {}));
FP.prompt = (message, defaultValue, opts) => FP.dialog(Object.assign({ type: 'prompt', message: message, defaultValue: defaultValue }, opts || {}));
// Remplace la pop-up native alert() par la version stylée (DROP-IN : aucun appel à changer).
try { window.alert = function (m) { FP.alert(m); }; } catch (e) {}

// ── Infobulles « à la sauce Parc Pilot » — remplacent les tooltips gris natifs (title=) ──
// À la 1re survol d'un élément portant `title`, on déplace le texte dans `data-fp-tip` et on
// retire `title` (→ plus de bulle native), puis on affiche une infobulle stylée. Fonctionne
// aussi sur le contenu ajouté dynamiquement (tables re-rendues) — aucune passe initiale requise.
(function () {
  let tip = null, scheduled = 0;
  const ensure = () => { if (tip) return tip; tip = document.createElement('div'); tip.className = 'fp-tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); return tip; };
  const textOf = (el) => {
    if (el.hasAttribute && el.hasAttribute('title')) { const v = el.getAttribute('title'); el.setAttribute('data-fp-tip', v); el.removeAttribute('title'); }
    return el.getAttribute ? el.getAttribute('data-fp-tip') : '';
  };
  const show = (el) => {
    const txt = textOf(el); if (!txt) return;
    const t = ensure(); t.textContent = txt; t.style.opacity = '0'; t.classList.add('on');
    // mesure puis positionne (au-dessus, centré ; sinon en dessous)
    const r = el.getBoundingClientRect(); const tw = t.offsetWidth, th = t.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2, y = r.top - th - 9;
    if (y < 6) y = r.bottom + 9;
    x = Math.max(6, Math.min(x, (window.innerWidth || 0) - tw - 6));
    t.style.left = x + 'px'; t.style.top = y + 'px'; t.style.opacity = '1';
  };
  const hide = () => { if (tip) { tip.classList.remove('on'); tip.style.opacity = '0'; } };
  const target = (e) => { const n = e.target; return (n && n.closest) ? n.closest('[title],[data-fp-tip]') : null; };
  document.addEventListener('mouseover', (e) => { const el = target(e); if (el) show(el); }, true);
  document.addEventListener('mouseout',  (e) => { const el = target(e); if (!el) return; const to = e.relatedTarget; if (to && el.contains(to)) return; hide(); }, true);
  document.addEventListener('focusin',   (e) => { const el = target(e); if (el) show(el); });
  document.addEventListener('focusout', hide);
  window.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide);
})();

// ── Validation de formulaire « à la sauce Parc Pilot » — remplace la bulle native ──
// ("Veuillez remplir ce champ."). On intercepte l'événement `invalid` (capture) : on empêche
// la bulle native, on surligne le champ en rouge, on affiche UN message (toast) et on focus le 1er.
(function () {
  let salve = false;
  document.addEventListener('invalid', function (e) {
    const el = e.target; if (!el || !el.classList) return;
    e.preventDefault();
    el.classList.add('fp-invalid');
    const clear = () => el.classList.remove('fp-invalid');
    el.addEventListener('input', clear, { once: true });
    el.addEventListener('change', clear, { once: true });
    if (!salve) {
      salve = true;
      try { el.focus({ preventScroll: false }); } catch (_) { try { el.focus(); } catch (e2) {} }
      const v = el.validity || {};
      const msg = v.valueMissing ? 'Merci de remplir ce champ.'
        : v.typeMismatch ? (el.type === 'email' ? 'Adresse e-mail invalide.' : 'Format invalide.')
        : (v.patternMismatch || v.tooShort || v.tooLong) ? 'Format invalide.'
        : v.rangeUnderflow || v.rangeOverflow || v.stepMismatch ? 'Valeur invalide.'
        : (el.validationMessage || 'Merci de vérifier ce champ.');
      if (FP.toast) FP.toast(msg); else if (FP.alert) FP.alert(msg);
      setTimeout(function () { salve = false; }, 60);
    }
  }, true);
})();

// ── Squelettes de chargement (shimmer) — remplacent « Chargement… » ──
// FP.skeletonHTML(opts) → chaîne HTML ; FP.skeleton(el, opts) → l'injecte dans un conteneur.
//   type: 'lines' (défaut) | 'rows' (lignes de tableau) | 'table' (dans un <tbody>)
FP.skeletonHTML = function (opts) {
  opts = opts || {};
  const n = opts.count || 5;
  const type = opts.type || 'lines';
  const widths = ['92%', '68%', '84%', '54%', '76%', '88%', '61%'];
  let out = '';
  if (type === 'table') {
    const cols = opts.cols || 6;
    for (let i = 0; i < n; i++) {
      let tds = '';
      for (let c = 0; c < cols; c++) tds += '<td class="p-2"><div class="fp-skel fp-skel-line" style="width:' + widths[(i + c) % widths.length] + '"></div></td>';
      out += '<tr>' + tds + '</tr>';
    }
    return out;
  }
  if (type === 'rows') {
    for (let i = 0; i < n; i++) {
      out += '<div class="fp-skel-row"><div class="fp-skel fp-skel-chip"></div><div class="fp-skel fp-skel-line" style="width:' + widths[i % widths.length] + '"></div></div>';
    }
    return out;
  }
  for (let i = 0; i < n; i++) out += '<div class="fp-skel fp-skel-line" style="width:' + widths[i % widths.length] + '"></div>';
  return out;
};
FP.skeleton = function (el, opts) {
  const node = typeof el === 'string' ? document.getElementById(el) : el;
  if (node) node.innerHTML = FP.skeletonHTML(opts);
  return node;
};

// ── États vides designés (icône + titre + message + action) ──
// FP.emptyHTML({icon,title,text,actionLabel,href}) → HTML ; FP.emptyState(el, opts) → l'injecte.
FP.emptyHTML = function (opts) {
  opts = opts || {};
  const icon = opts.icon || 'inbox';
  const esc = FP.esc || (s => String(s == null ? '' : s));
  let btn = '';
  if (opts.actionLabel) {
    const inner = '<i data-lucide="' + esc(opts.actionIcon || 'plus') + '"></i> ' + esc(opts.actionLabel);
    btn = opts.href
      ? '<a class="fp-empty-btn" href="' + esc(opts.href) + '">' + inner + '</a>'
      : '<button type="button" class="fp-empty-btn" ' + (opts.actionId ? 'id="' + esc(opts.actionId) + '"' : '') + '>' + inner + '</button>';
  }
  return '<div class="fp-empty">'
    + '<div class="fp-empty-ic"><i data-lucide="' + esc(icon) + '"></i></div>'
    + (opts.title ? '<div class="fp-empty-title">' + esc(opts.title) + '</div>' : '')
    + (opts.text ? '<div class="fp-empty-text">' + esc(opts.text) + '</div>' : '')
    + btn + '</div>';
};
FP.emptyState = function (el, opts) {
  const node = typeof el === 'string' ? document.getElementById(el) : el;
  if (node) { node.innerHTML = FP.emptyHTML(opts); try { if (window.lucide && lucide.createIcons) lucide.createIcons(); } catch (e) {} }
  return node;
};

// ── Piège de focus (focus-trap) global — garde la tabulation DANS la fenêtre ouverte ──
// Couvre toutes les modales/tiroirs du site (.modal-backdrop / .drawer-backdrop) + les dialogues
// stylés (.fp-dlg-backdrop) et la modale prospect de l'accueil (#pp-backdrop). Aucune modif par page.
(function () {
  const MODAL_SEL = '.modal-backdrop, .drawer-backdrop, .fp-dlg-backdrop, #pp-backdrop, #prospect-backdrop';
  const FOCUS_SEL = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const visible = (el) => {
    if (!el) return false;
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity || '1') === 0) return false;
    return el.getClientRects().length > 0;
  };
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    const open = Array.from(document.querySelectorAll(MODAL_SEL)).filter(visible);
    if (!open.length) return;
    const modal = open[open.length - 1]; // la dernière ouverte = au-dessus
    const list = Array.from(modal.querySelectorAll(FOCUS_SEL)).filter(visible);
    if (!list.length) return;
    const first = list[0], last = list[list.length - 1];
    const active = document.activeElement;
    if (!modal.contains(active)) { e.preventDefault(); first.focus(); return; }
    if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  }, true);
})();

// ── Échap ferme le tiroir/la fenêtre ouverte — partout, un seul mécanisme ──
// (Les dialogues stylés FP.dialog gèrent déjà leur propre Échap ; on les laisse passer.)
(function () {
  const vis = (el) => { if (!el) return false; const st = getComputedStyle(el); return st.display !== 'none' && st.visibility !== 'hidden' && el.getClientRects().length > 0; };
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (document.querySelector('.fp-dlg-backdrop, .pp-dlg-bk')) return;      // un dialogue stylé est au-dessus → il gère
    const overlays = Array.from(document.querySelectorAll('.drawer.open, .fiche-ov.open, .modal.open, .modal-backdrop.open, .drawer-backdrop.open, [id="drawer"].open')).filter(vis);
    if (!overlays.length) return;
    const top = overlays[overlays.length - 1];
    // 1) bouton de fermeture (id se terminant par "close", data-close, aria-label Fermer)
    const btn = top.querySelector('[id$="close"], [id*="-close"], [data-close], [aria-label*="ermer"]')
      || document.querySelector('#drawer.open [id$="close"], .fiche-ov.open [id$="close"], .modal.open [id$="close"]');
    if (btn) { e.preventDefault(); btn.click(); return; }
    // 2) repli : clic sur le fond (souvent câblé pour fermer) puis retrait de .open
    e.preventDefault();
    if (/backdrop/.test(top.className)) { top.click(); }
    top.classList.remove('open');
    const bd = document.querySelector('.modal-backdrop.open, .drawer-backdrop.open'); if (bd) bd.classList.remove('open');
  }, true);
})();

// ── Copier en 1 clic (helper réutilisable, sans conflit avec les data-copy-val existants) ──
// FP.copy(txt) → copie + toast « Copié ✓ ». Boutons : classe .fp-copy + data-fp-copy="valeur".
FP.copy = function (txt) {
  txt = String(txt == null ? '' : txt);
  const ok = () => { if (FP.toast) FP.toast('Copié ✓'); };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok).catch(() => { try { window.prompt('Copier :', txt); } catch (e) {} });
    else { window.prompt('Copier :', txt); }
  } catch (e) { try { window.prompt('Copier :', txt); } catch (e2) {} }
};
document.addEventListener('click', function (e) {
  const c = e.target.closest && e.target.closest('.fp-copy, [data-fp-copy]');
  if (!c) return;
  e.preventDefault(); e.stopPropagation();
  FP.copy(c.getAttribute('data-fp-copy') || c.textContent || '');
});

// ── Bouton « Remonter en haut » — apparaît après avoir descendu, sur toutes les pages ──
(function () {
  if (typeof window === 'undefined') return;
  const make = () => {
    if (document.getElementById('fp-totop')) return;
    const b = document.createElement('button');
    b.id = 'fp-totop'; b.type = 'button'; b.setAttribute('aria-label', 'Remonter en haut'); b.title = 'Remonter en haut';
    b.innerHTML = '<i data-lucide="arrow-up"></i>';
    const mainEl = () => document.querySelector('main');
    const curScroll = () => {
      const se = document.scrollingElement || document.documentElement;
      let t = Math.max(se.scrollTop || 0, window.scrollY || 0, document.body.scrollTop || 0);
      const m = mainEl(); if (m && m.scrollTop > t) t = m.scrollTop;   // certaines mises en page scrollent <main>
      return t;
    };
    b.addEventListener('click', () => {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
      const m = mainEl(); if (m) { try { m.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { m.scrollTop = 0; } }
    });
    document.body.appendChild(b);
    try { if (window.lucide && lucide.createIcons) lucide.createIcons(); } catch (e) {}
    let ticking = false;
    const onScroll = () => {
      if (ticking) return; ticking = true;
      requestAnimationFrame(() => { b.classList.toggle('on', curScroll() > 420); ticking = false; });
    };
    // capture:true → capte aussi le scroll d'un conteneur interne (main/body), pas seulement window
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  };
  if (document.body) make(); else document.addEventListener('DOMContentLoaded', make);
})();

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

// Densité d'affichage : bascule compact/confortable — SYNCHRONISÉE (règle 0-sync) via FP.pref
// (FP.settings → app_settings) + cache local rapide (relu par l'IIFE applyDensity au 1er paint).
FP.getDensity = () => { try { return FP.pref.get('fp_density', 'confort') === 'compact' ? 'compact' : 'confort'; } catch (e) { return 'confort'; } };
FP.setDensity = (compact) => {
  try { FP.pref.set('fp_density', compact ? 'compact' : 'confort'); } catch (e) {}
  document.documentElement.classList.toggle('fp-compact', !!compact);
};
// Ré-applique la densité quand les réglages arrivent d'un autre appareil (fp:data-ready / fp:settings-synced).
FP.applyDensity = () => { try { document.documentElement.classList.toggle('fp-compact', FP.getDensity() === 'compact'); } catch (e) {} };
try { window.addEventListener('fp:data-ready', function () { FP.applyDensity(); if (FP.settings && FP.settings.applyTheme) FP.settings.applyTheme(); }); } catch (e) {}

// ===== CORBEILLE — restaurer un élément supprimé (véhicule, amende, conducteur, contrat leasing…) =====
// Chaque suppression peut déposer une COPIE ici (via FP.persist.delete(table,id,record) ou FP.trash.add
// direct). Stockée par société dans les réglages (settings.corbeille) → SYNCHRONISÉE sur tous les appareils.
// Restaurer = ré-insérer l'élément dans sa table (ou dans les contrats leasing). Plafonné à 300 entrées.
FP.trash = {
  MAX: 300,
  // Libellés lisibles par table (pour l'affichage dans Paramètres → Corbeille).
  typeLabel(t) { return ({ vehicules:'Véhicule', amendes:'Amende', conducteurs:'Conducteur', factures:'Facture', documents:'Document', emprunts:'Emprunt', leasing:'Contrat leasing', sinistres:'Sinistre' })[t] || t; },
  // ⚠️ FILET DE SÉCURITÉ LOCAL (par société) : la corbeille synchronisée (app_settings) est écrite en
  // ASYNCHRONE ; si on recharge juste après une suppression, la synchro peut ne pas être partie → l'élément
  // serait perdu. On garde donc EN PLUS une copie locale IMMÉDIATE (localStorage), qui survit au rechargement.
  // La liste affichée = fusion des deux (dédup par id) → une suppression est TOUJOURS récupérable.
  _lkey() { try { return 'fp_trash_' + (((FP.activeSociete && FP.activeSociete()) || 'default') + '').toLowerCase(); } catch (e) { return 'fp_trash_default'; } },
  _local() { try { const a = JSON.parse(localStorage.getItem(this._lkey())); return Array.isArray(a) ? a : []; } catch (e) { return []; } },
  _saveLocal(arr) { try { localStorage.setItem(this._lkey(), JSON.stringify((arr || []).slice(0, this.MAX))); } catch (e) {} },
  _synced() { try { const a = FP.settings.get().corbeille; return Array.isArray(a) ? a : []; } catch (e) { return []; } },
  _all() {
    const byId = {}; const out = [];
    [].concat(this._synced(), this._local()).forEach(e => { if (e && e.id && !byId[e.id]) { byId[e.id] = 1; out.push(e); } });
    return out.sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, this.MAX);
  },
  // Fabrique un libellé court à partir de l'enregistrement (immat, prénom, n° d'avis…).
  _label(type, rec) {
    try {
      if (!rec || typeof rec !== 'object') return '';
      if (type === 'vehicules') return [rec.immat, rec.marque, rec.modele].filter(Boolean).join(' ');
      if (type === 'amendes') return [rec.prenom || rec.conducteur, rec.numeroAvis || rec.avis, (rec.montant != null ? rec.montant : rec.montantTTC) != null ? (rec.montant != null ? rec.montant : rec.montantTTC) + ' €' : ''].filter(Boolean).join(' · ');
      if (type === 'conducteurs') return rec.name || rec.nom || [rec.prenom, rec.nom].filter(Boolean).join(' ') || rec.key || '';
      if (type === 'leasing') return [rec.conducteur, rec.immat, rec.marque, rec.modele].filter(Boolean).join(' ');
      if (type === 'factures') return [rec.fournisseur, rec.numeroFacture || rec.numero, rec.montantTTC != null ? rec.montantTTC + ' €' : ''].filter(Boolean).join(' · ');
      return rec.immat || rec.nom || rec.name || rec.label || rec.id || '';
    } catch (e) { return ''; }
  },
  add(type, rec, label) {
    if (!rec) return;
    const entry = { id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), type: String(type), rec: JSON.parse(JSON.stringify(rec)), label: String(label || this._label(type, rec) || ''), ts: Date.now() };
    // 1) Copie locale IMMÉDIATE (garantie même si on recharge tout de suite).
    try { const l = this._local(); l.unshift(entry); this._saveLocal(l); } catch (e) {}
    // 2) Copie synchronisée (cross-appareils) — asynchrone, best effort.
    try { const s = FP.settings.get(); const list = Array.isArray(s.corbeille) ? s.corbeille : []; list.unshift(entry); s.corbeille = list.slice(0, this.MAX); FP.settings.save(s); } catch (e) {}
  },
  list() { return this._all(); },
  remove(id) {
    try { this._saveLocal(this._local().filter(x => x.id !== id)); } catch (e) {}
    try { const s = FP.settings.get(); s.corbeille = this._synced().filter(x => x.id !== id); FP.settings.save(s); } catch (e) {}
  },
  clear() {
    try { this._saveLocal([]); } catch (e) {}
    try { const s = FP.settings.get(); s.corbeille = []; FP.settings.save(s); } catch (e) {}
  },
  // Restaure l'élément dans sa table (ou dans les contrats leasing) puis le retire de la Corbeille.
  async restore(id) {
    const e = this._all().find(x => x.id === id); if (!e) return false;
    try {
      if (e.type === 'leasing') {
        const s = FP.settings.get(); const list = Array.isArray(s.localeaseContrats) ? s.localeaseContrats : [];
        list.push(e.rec); s.localeaseContrats = list; FP.settings.save(s);
      } else {
        if (FP.persist && FP.persist.insert) FP.persist.insert(e.type, e.rec);
        else if (FP.db && FP.db.insert) await FP.db.insert(e.type, e.rec);
      }
      this.remove(id);
      return true;
    } catch (err) { console.warn('[trash restore]', err); return false; }
  },
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
  // record (optionnel) = copie complète de l'élément supprimé → déposée dans la Corbeille (FP.trash)
  // pour pouvoir le RESTAURER depuis Paramètres. Rétro-compatible : sans record, aucune capture.
  async delete(table, id, record) {
    try { if (record && FP.trash) FP.trash.add(table, record); } catch (e) {}
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
  b.addEventListener('click', async () => {
    const echecs = FP.persist.failedCount();
    if (echecs > 0) {
      const detail = FP.persist._resumeEchecs();
      const ok = await FP.confirm(
        `${echecs} modification(s) n'ont PAS pu être enregistrées dans la base :\n\n${detail}\n\n`
        + `Ce sont souvent des erreurs de structure (colonne manquante) qui ne se résoudront pas toutes seules.\n\n`
        + `• OK = réessayer maintenant\n• Annuler = abandonner ces modifications`,
        { okText: 'Réessayer', cancelText: 'Abandonner' }
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
  "fournisseur : pour une facture, la RAISON SOCIALE de la societe qui EMET la facture (le prestataire/vendeur/garage/loueur). Confirme-la de preference par le SIREN, SIRET, n° de TVA ou les mentions legales en bas de page. Si une MARQUE COMMERCIALE (enseigne) differe de la raison sociale (ex enseigne 'Speedy' / raison sociale 'SLV AUTOMOBILE'), donne la RAISON SOCIALE. NE prends JAMAIS comme fournisseur le CLIENT facture (= la societe qui utilise Parc Pilot, celle dont l adresse figure en 'Facture a'/'Client'/'Livre a') : le fournisseur est l EMETTEUR, jamais le destinataire.",
  "numeroFacture, vehiculeImmat (plaque francaise AB-123-CD), km (entier sans espaces).",
  "montantHT, montantTVA, montantTTC (nombres a point decimal).",
  "description : tres courte, max 60 caracteres, style 'Revision complete', 'Vidange + filtres', 'Revision + pneus AV', 'Remplacement plaquettes AV', 'Reparation pare-chocs AR', 'Franchise sinistre carrosserie', 'Remplacement pare-brise', 'Diagnostic moteur', 'Loyer LLD - aout 2026'.",
  "factureType : POUR UNE FACTURE UNIQUEMENT, classe-la dans UN type (un parmi : entretien, reparation, achat, leasing, cession, sinistre, autre). Ne mets JAMAIS 'entretien' par defaut : lis vraiment les prestations et applique ces regles :",
  "- leasing : loyer d un organisme de credit-bail, LLD (location longue duree) ou LOA (location avec option d achat) (ex BPCE CAR LEASE, ARVAL, ALD, LEASEPLAN) avec 'Loyer', 'Redevance', 'Services', 'Location', ou une 'Periode' mensuelle. LLD comme LOA -> type leasing.",
  "- entretien : operations PERIODIQUES ou PREVENTIVES (planifiees ou kilometriques) : revision constructeur, vidange, filtres, liquides, bougies, courroie/kit de distribution a l entretien, balais d essuie-glace, PNEUMATIQUES d usure (le remplacement de pneus est un entretien, pas une reparation), geometrie/parallelisme, recharge de climatisation, presentation au controle technique.",
  "- reparation : suite a une PANNE, un diagnostic de dysfonctionnement ou une piece DEFECTUEUSE. Inclut la MECANIQUE (voyant moteur, recherche de panne, faisceau, bloc optique/phare, batterie HS, demarreur, alternateur, embrayage, suspension/direction : biellettes, rotules, amortisseurs, plaquettes/disques) ET la CARROSSERIE hors accident (pare-chocs, aile, retroviseur, peinture, debosselage). Une facture de CARROSSERIE n est PAS automatiquement un sinistre : sans marqueur de sinistre (voir ci-dessous), une reparation de carrosserie reste 'reparation'.",
  "- sinistre : UNIQUEMENT si la facture porte un MARQUEUR de sinistre : numero de sinistre/dossier, nom d une compagnie d ASSURANCE, mention d EXPERTISE/expert, FRANCHISE, TIERS implique, ou PRISE EN CHARGE assurance. Un simple bris de glace/pare-brise ou une carrosserie SANS ces marqueurs = 'reparation', pas 'sinistre'.",
  "- achat : ACHAT / acquisition d un vehicule (bon de commande, facture d achat d un vehicule neuf ou d occasion).",
  "- cession : VENTE / reprise / cession d un vehicule.",
  "- autre : frais annexes HORS mecanique et HORS detention directe : debours contravention (amende refacturee), demarches administratives (changement d adresse carte grise), location ponctuelle d un utilitaire (ex location camion 20m3), fournitures diverses. Range aussi ici le CARBURANT et les PEAGES (geres par des imports dedies dans l app : ne les compte pas comme entretien).",
  "- DEVIS / PROFORMA / ESTIMATION (pas une vraie facture payee) : garde le type reel de la prestation (souvent reparation/sinistre) et commence la description par 'Devis - ' (l app exclut les devis des couts).",
  "- AVOIR / NOTE DE CREDIT / montant NEGATIF (remboursement du fournisseur) : garde le type reel de la prestation d origine, commence la description par 'Avoir - ' et mets les montants en NEGATIF (montantTTC/HT/TVA precedes d un signe moins).",
  "En cas de doute entre entretien et reparation : operation planifiee/kilometrique/pneus -> entretien ; depannage/remplacement d une piece tombee en panne -> reparation. Choisis TOUJOURS un type ; si vraiment indeterminable, mets 'autre' (jamais null pour une facture).",
  "AMENDE / AVIS DE CONTRAVENTION / PV - repere precisement :",
  "- numeroAvis : le numero de l avis, libelle 'Numero de l avis de contravention', en general EN HAUT A GAUCHE, ~10 chiffres. Recopie CHAQUE chiffre exactement (ne confonds pas 3 et 8, 0 et 6, 1 et 7).",
  "- CAS PARTICULIER FPS (Forfait de Post-Stationnement = 'Avis de paiement / Forfait de post-stationnement (FPS)', amende de stationnement) : le numero est sur la ligne 'Numero de l avis de paiement' sous la forme [longue reference 14 chiffres en bloc] [numero d avis en cases groupees NN N NNN NNN NNN] [Cle 2 chiffres]. Ex : '21590350100017  26 1 163 072 245  Cle 37'. Pour numeroAvis, prends le bloc en cases groupees SUIVI de la Cle, en CONSERVANT LES ESPACES tels quels -> '26 1 163 072 245 37' (mais SANS le long prefixe '21590350100017'). Mets aussi la Cle seule ('37') dans le champ cle. Pour un FPS : motif = 'Stationnement', points = 0 (un FPS ne retire jamais de point), et montant = 'Le montant du FPS du est egal a : XX euros'.",
  "- motif : nature de l infraction (ex Exces de vitesse, Stationnement, Feu rouge, Telephone au volant, Ceinture).",
  "- points : LIS EN PRIORITE la section 'Effet(s) sur le permis de conduire' de l avis. Si elle indique que l infraction 'n entraine pas de retrait de point' -> renvoie 0. Si elle indique un nombre de points retires -> ce nombre. SEULEMENT si cette section est absente, estime via le bareme (exces de vitesse selon le depassement RETENU : <20=1, 20 a 29=2, 30 a 39=3, 40 a 49=4, >=50=6 ; telephone tenu en main=3 ; feu rouge=4 ; stop=4 ; ceinture=3 ; distance de securite=3 ; sens interdit=4 ; stationnement/voie de bus=0). En cas de doute, mets null.",
  "- vitesseRetenue : la VITESSE RETENUE apres marge technique, souvent ecrite 'la vitesse retenue est de : XX km/h' EN BAS de la description. C est ELLE qui compte, PAS la vitesse mesuree par le radar. vitesseLimite : la vitesse maximale autorisee. Ex : radar 96 km/h, 'vitesse retenue est de 91 km/h', limite 90 -> vitesseRetenue 91, vitesseLimite 90. Nombres sans 'km/h'.",
  "- date : la DATE DE L AVIS de contravention = sa date d edition / d envoi (souvent en haut a droite, 'le JJ/MM/AAAA' ou 'Avis edite le'). Ce n est PAS la date de l infraction, ni la date du jour.",
  "- AMENDE — LES TROIS MONTANTS (RÈGLE ABSOLUE : lis-les tous les trois, ne prends JAMAIS le plus gros par defaut). La section 'Montant de l amende' presente en general 3 montants : le MINORE (paiement rapide, le PLUS PETIT, ex 45), le FORFAITAIRE (ex 68), et le MAJORE (le PLUS GROS, ex 180). Renseigne-les SEPAREMENT dans : montantMinore, montantForfaitaire, montantMajore (nombres, sans euro, null si absent).",
  "- dateLimiteMinore : date limite pour payer au tarif MINORE. dateLimiteForfaitaire : date limite du tarif FORFAITAIRE (au-dela = majore). Format AAAA-MM-JJ, null si absentes (souvent au dos / sur la notice de paiement).",
  "- montantTTC : le montant A PAYER = le MINORE s il existe, sinon le FORFAITAIRE. NE mets JAMAIS le montant MAJORE dans montantTTC : le majore ne s applique que si les dates limites sont DEPASSEES, et c est l APPLICATION (qui connait la date du jour) qui le determinera, PAS toi. En cas de doute, prends le plus petit des montants, JAMAIS le plus gros. C est un PETIT montant (11 a 1500 euros). NE prends JAMAIS comme montant un numero d avis, de telepaiement, de telephone, une reference, un code, une annee ou un code postal.",
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
  "carburant : type d energie, champ P.3. Renvoie EXACTEMENT l un de ces libelles (jamais un autre) : 'Essence', 'Diesel', 'Electrique', 'Essence / Hybride', 'Diesel / Hybride', 'GPL', 'GNV', 'Superethanol E85', 'Hydrogene'. Correspondance des codes P.3 : ES = Essence ; GO ou gazole = Diesel ; EL = Electrique ; EE / EH / EM / EN (essence + electricite) = 'Essence / Hybride' ; GH / GL (gazole + electricite) = 'Diesel / Hybride' ; GP = GPL ; GN = GNV ; FE = 'Superethanol E85' ; toute mention hybride essence = 'Essence / Hybride'. IMPORTANT : deux vehicules de meme modele ont TOUJOURS le meme carburant.",
  "co2 : emissions de CO2 en g/km, champ V.7, entier.",
  "masse : masse en ordre de marche en kg, champ G, entier (PAS la masse en charge G.1).",
  "prochainCT : date du prochain controle technique, champ X.1 (souvent ecrit 'X.1' ou 'Visite technique avant le' / 'Visite avant le' ou 'Date limite de validite'). Format AAAA-MM-JJ (date FUTURE). Si le champ X.1 est absent (vehicule neuf jamais controle), mets null.",
  "categorie : d apres le genre national J.1 et la carrosserie, renvoie une categorie SIMPLE parmi : Citadine, Berline, Break, SUV, Monospace, Utilitaire ; sinon null.",
  "IMPORTANT : ne devine ni n invente aucune valeur ; un champ illisible = null. Dates au format europeen jour/mois/annee (ex 05.11.2021 = 2021-11-05).",
].join("\n");

// ---- ALERTE « INFOS MANQUANTES À L'IMPORT » (toute la plateforme) ----
// Consigne : à chaque import (carte grise, facture, permis, état de parc…), si une info dont le
// site a besoin n'a PAS pu être lue, on le signale TOUT DE SUITE à l'utilisateur (+ rappel dans
// l'onglet Alertes → « À compléter »). Champs attendus par type de document :
FP.IMPORT_FIELDS = {
  'carte-grise': [ { k:'immat', l:'Immatriculation' }, { k:'marque', l:'Marque' }, { k:'modele', l:'Modèle' }, { k:'vin', l:'VIN' }, { k:'dateMiseEnCirculation', l:'1re mise en circulation' }, { k:'co2', l:'CO₂' }, { k:'puissanceFiscale', l:'Puissance fiscale' }, { k:'carburant', l:'Carburant' } ],
  'facture':     [ { k:'date', l:'Date' }, { k:'fournisseur', l:'Fournisseur' }, { k:'montantTTC', l:'Montant TTC' } ],
  'permis':      [ { k:'permisNumero', l:'N° de permis' }, { k:'permisType', l:'Catégories' }, { k:'permisObtention', l:"Date d'obtention" }, { k:'permisExpiration', l:"Date d'expiration" } ],
  'amende':      [ { k:'numeroAvis', l:"N° d'avis" }, { k:'montant', l:'Montant' }, { k:'date', l:"Date de l'infraction" } ],
  'leasing':     [ { k:'loyerTTC', l:'Loyer TTC/mois' }, { k:'dureeMois', l:'Durée' }, { k:'kmTotal', l:'Km total' } ],
};
FP.importMissing = function (docType, rec, extra) {
  const defs = (FP.IMPORT_FIELDS[docType] || []).concat(Array.isArray(extra) ? extra : []);
  const empty = v => v == null || v === '' || (Array.isArray(v) && !v.length);
  return defs.filter(d => empty(rec ? rec[d.k] : null));
};
// Signale les infos manquantes après un import. Renvoie la liste des manquants (vide = tout est là).
FP.importAlert = function (docType, rec, opts) {
  opts = opts || {};
  const miss = FP.importMissing(docType, rec, opts.extra);
  if (!miss.length) return miss;
  const labels = miss.map(m => m.l).join(', ');
  const where = opts.where ? (' (à compléter dans ' + opts.where + ')') : ' — complète-les à la main.';
  const msg = '⚠️ ' + (opts.prefix || 'Import') + ' : information(s) non lue(s) → ' + labels + where;
  try { if (FP.toast) FP.toast(msg); else alert(msg.replace(/^⚠️ /, '')); } catch (e) { try { alert(labels); } catch (_) {} }
  return miss;
};

// ---- CARBURANT : libellés CANONIQUES + normaliseur central ----
// Un seul jeu de libellés pour toute la plateforme, pour que deux véhicules identiques n'aient
// JAMAIS deux libellés différents (ex. « Hybride » vs « Essence / Hybride »). Tout carburant
// lu (IA, OCR, import CSV, saisie) DOIT passer par FP.normCarburant avant d'être enregistré.
FP.CARBURANTS = ['Essence', 'Diesel', 'Électrique', 'Essence / Hybride', 'Diesel / Hybride', 'GPL', 'GNV', 'Superéthanol E85', 'Hydrogène'];
FP.normCarburant = function (raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const u = s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const tok = ' ' + u.replace(/[^A-Z0-9]+/g, ' ').trim() + ' '; // codes P.3 isolés (ex " EH ")
  const code = re => re.test(tok);   // code P.3 en jeton isolé
  const kw   = re => re.test(u);     // mot-clé n'importe où
  if (kw(/HYDROG/)) return 'Hydrogène';
  // Hybride diesel (gazole + électricité) — codes GH / GL
  if (kw(/GAZOLE.?ELEC|DIESEL.?(HYBRID|ELEC)/) || code(/ GH | GL /)) return 'Diesel / Hybride';
  // Hybride essence (essence + électricité) — codes EE/EH/EM/EN, ou mot « hybride »
  if (kw(/HYBRID|HEV|PHEV|ESSENCE.?ELEC/) || code(/ EE | EH | EM | EN | EP /)) return 'Essence / Hybride';
  // Électrique pur
  if (kw(/ELECTRI/) || code(/ EL | BEV /)) return 'Électrique';
  // Superéthanol / E85
  if (kw(/ETHANOL|SUPERETH|E85/) || code(/ FE /)) return 'Superéthanol E85';
  // GPL / GNV
  if (kw(/GPL|LPG/) || code(/ GP /)) return 'GPL';
  if (kw(/GNV|GAZ NATUREL|CNG/) || code(/ GN /)) return 'GNV';
  // Diesel
  if (kw(/DIESEL|GAZOLE|GASOIL/) || code(/ GO /)) return 'Diesel';
  // Essence
  if (kw(/ESSENCE|SANS PLOMB|SP95|SP98|PETROL/) || code(/ ES /)) return 'Essence';
  // Repli : on garde la valeur (proprement capitalisée) plutôt que de perdre l'info.
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// Lecture IA d'un document via l'Edge Function sécurisée « scan-doc » (Haiku).
// Renvoie un objet de champs { date, fournisseur, numeroFacture, vehiculeImmat, km,
// montantHT, montantTVA, montantTTC, description } ou null si indisponible/échec
// (dans ce cas l'appelant retombe sur le lecteur local). La clé API reste côté
// serveur : on n'envoie que le fichier + le type de document.
// Prompt IA pour lire un CONSTAT AMIABLE (ou courrier d'assurance) et PROPOSER la responsabilité de
// NOTRE véhicule. On injecte la plaque de l'incident pour que l'IA sache lequel des 2 véhicules est le
// nôtre. L'IA PROPOSE seulement — l'utilisateur confirme (jamais d'enregistrement automatique).
FP.constatPrompt = function (plaque) {
  const p = (plaque ? String(plaque) : '').trim() || '(plaque inconnue)';
  return [
    'Tu analyses un CONSTAT AMIABLE d\'accident automobile (ou un courrier d\'assurance) pour déterminer',
    'la RESPONSABILITÉ de NOTRE véhicule, dont la plaque d\'immatriculation est « ' + p + ' ».',
    'Un constat oppose deux véhicules (A et B). Repère lequel est le NÔTRE grâce à cette plaque (tolère',
    'espaces/tirets/casse). D\'après les cases cochées, le croquis, les circonstances et les déclarations,',
    'détermine si NOTRE conducteur est en tort.',
    'Réponds UNIQUEMENT en JSON strict, sans texte autour :',
    '{',
    '  "responsabilite": "responsable" | "non-responsable" | "partagee" | "inconnu",',
    '  "justification": "<une phrase courte en français, ce qui te fait conclure>",',
    '  "autrePlaque": "<plaque de l\'autre véhicule si lisible, sinon chaîne vide>"',
    '}',
    'Définitions : "responsable" = NOTRE véhicule est en tort ; "non-responsable" = l\'AUTRE véhicule',
    'est en tort ; "partagee" = torts partagés. Mets "inconnu" si le document ne permet pas de trancher',
    '(illisible, plaque absente, ce n\'est pas un constat). En cas de doute, réponds "inconnu" —',
    'ne DEVINE JAMAIS une responsabilité que le document n\'établit pas clairement.',
  ].join('\n');
};
// Prompt IA pour le COURRIER DE L'ASSUREUR (réponse après déclaration de sinistre) : en plus de la
// responsabilité, on lit le n° de dossier et la date du courrier pour remplir le dossier tout seul.
FP.courrierAssureurPrompt = function (plaque) {
  const p = (plaque ? String(plaque) : '').trim() || '(plaque inconnue)';
  return [
    'Tu analyses un COURRIER D\'ASSURANCE reçu après la déclaration d\'un sinistre automobile, concernant',
    'NOTRE véhicule dont la plaque est « ' + p +' ». Ce courrier indique généralement la RESPONSABILITÉ',
    '(qui est en tort), un NUMÉRO DE DOSSIER / SINISTRE, et une DATE.',
    'Réponds UNIQUEMENT en JSON strict, sans texte autour :',
    '{',
    '  "responsabilite": "responsable" | "non-responsable" | "partagee" | "inconnu",',
    '  "numeroDossier": "<référence du dossier/sinistre si présente, sinon chaîne vide>",',
    '  "dateCourrier": "<date du courrier au format AAAA-MM-JJ si présente, sinon chaîne vide>",',
    '  "justification": "<une phrase courte en français expliquant la conclusion>"',
    '}',
    'Définitions : "responsable" = NOTRE véhicule/conducteur est en tort ; "non-responsable" = l\'autre',
    'partie est en tort ; "partagee" = torts partagés. Mets "inconnu" si le courrier ne tranche pas',
    'clairement. Ne DEVINE JAMAIS : en cas de doute, réponds "inconnu".',
  ].join('\n');
};
FP.scanIA = async function (file, docType, promptOverride, opts) {
  opts = opts || {};
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
    // Grandes extractions (tableaux : état de parc → une prime par véhicule) : autoriser plus de
    // jetons en sortie pour ne pas tronquer le JSON (repli serveur = 1024 si non transmis).
    if (opts.maxTokens) payload.maxTokens = opts.maxTokens;
    // Le nom de l'Edge Function est sensible à la casse côté serveur. On essaie les variantes
    // courantes (elle est déployée en « Scan-doc »). On teste EN PREMIER le nom qui a déjà marché
    // dans la session (FP._scanFn) → plus d'appel 404 inutile à chaque scan.
    const names = [...new Set([FP._scanFn, 'Scan-doc', 'scan-doc'].filter(Boolean))];
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
// === AGENT IA (tableau de bord) ============================================
// Construit un résumé COMPACT de la flotte (chiffres agrégés + listes bornées)
// à partir de FP_DATA et des helpers canoniques. Ce contexte est envoyé à l'IA
// pour qu'elle réponde aux questions de l'utilisateur AVEC ses vraies données.
// ⚠️ Tourne côté client, après login (données déjà chargées) — ce n'est PAS data.js
// (le public) : on peut donc utiliser les vraies valeurs d'exploitation. On évite
// quand même les PII lourdes inutiles (n° de permis, adresses) pour rester sobre.
FP.aiContext = function (data) {
  data = data || (window.FP_DATA || {});
  const euro = (n) => (FP.euro ? FP.euro(n) : (Math.round(Number(n) || 0) + ' €'));
  const lines = [];
  let soc = 'PXP';
  try { soc = localStorage.getItem('fp_societe') || 'PXP'; if (soc === '__all__') soc = 'Toutes sociétés'; } catch (e) {}
  const now = new Date();
  const ym = now.toISOString().slice(0, 7);
  lines.push('SOCIÉTÉ : ' + soc);
  lines.push('DATE DU JOUR : ' + now.toISOString().slice(0, 10));

  const vehs = (data.vehicules || []);
  const actifs = vehs.filter(v => !FP.estVendu(v));
  const kmTotal = actifs.reduce((s, v) => s + (Number(v.km) || 0), 0);
  const valeur = actifs.reduce((s, v) => s + (Number(v.valeurAchat) || Number(v.prix) || 0), 0);
  lines.push('');
  lines.push('=== PARC ===');
  lines.push('Véhicules dans la flotte active : ' + actifs.length + ' (total possédés : ' + vehs.length + ')');
  lines.push('Kilométrage total : ' + (FP.num ? FP.num(kmTotal) : kmTotal) + ' km');
  if (valeur) lines.push('Valeur estimée du parc : ' + euro(valeur));
  // Liste des véhicules (bornée) : immat, marque/modèle, km, statut, chauffeur, prochain CT
  lines.push('Détail des véhicules :');
  actifs.slice(0, 80).forEach(v => {
    const parts = [
      (v.immat || '?'),
      [v.marque, v.modele].filter(Boolean).join(' '),
    ];
    if (v.km) parts.push((FP.num ? FP.num(v.km) : v.km) + ' km');
    if (v.chauffeur) parts.push('conducteur ' + v.chauffeur);
    if (v.pool) parts.push('groupe ' + v.pool);
    if (v.prochainCT && v.prochainCT !== '—') parts.push('CT ' + v.prochainCT);
    lines.push('- ' + parts.join(' · '));
  });

  // Amendes à payer
  const amendes = (data.amendes || []);
  const aPayer = amendes.filter(a => FP.estAPayer && FP.estAPayer(a));
  const duTotal = aPayer.reduce((s, a) => s + (FP.montantDu ? FP.montantDu(a) : (Number(a.montant) || 0)), 0);
  lines.push('');
  lines.push('=== AMENDES ===');
  lines.push('Amendes à payer : ' + aPayer.length + ' · total dû ' + euro(duTotal));
  aPayer.slice()
    .sort((a, b) => (FP.montantDu(b) - FP.montantDu(a)))
    .slice(0, 15)
    .forEach(a => {
      const who = a.prenom || a.conducteur || '';
      lines.push('- ' + [a.immat, who, a.date, euro(FP.montantDu(a))].filter(Boolean).join(' · '));
    });

  // Coûts (mois courant + 12 mois glissants)
  lines.push('');
  lines.push('=== COÛTS ===');
  try { lines.push('Coût du mois en cours (' + ym + ') : ' + euro(FP.coutMois(data, ym))); } catch (e) {}
  try {
    let tot12 = 0;
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      tot12 += FP.coutMois(data, d.toISOString().slice(0, 7));
    }
    lines.push('Coût d\'exploitation sur 12 mois glissants : ' + euro(tot12));
  } catch (e) {}

  // Échéances à venir (90 j)
  try {
    const ech = (FP.buildEcheances ? FP.buildEcheances(data) : []).filter(e => {
      const diff = Math.ceil((new Date(e.date) - now) / 86400000);
      return diff <= 90;
    });
    lines.push('');
    lines.push('=== ÉCHÉANCES (90 prochains jours) ===');
    if (!ech.length) lines.push('Aucune échéance dans les 90 jours.');
    ech.slice(0, 25).forEach(e => lines.push('- ' + e.date + ' · ' + e.categorie + ' · ' + (e.label || e.detail || '')));
  } catch (e) {}

  // Alertes en cours (résumé)
  try {
    const al = (FP.buildAlertes ? FP.buildAlertes(data) : []);
    const nb = { danger: 0, warn: 0, info: 0 };
    al.forEach(a => { if (nb[a.niveau] != null) nb[a.niveau]++; });
    lines.push('');
    lines.push('=== ALERTES ===');
    lines.push('Urgentes : ' + nb.danger + ' · à prévoir : ' + nb.warn + ' · info : ' + nb.info);
    al.slice(0, 12).forEach(a => lines.push('- [' + a.niveau + '] ' + a.categorie + ' : ' + a.message + ' (' + (a.detail || '') + ')'));
  } catch (e) {}

  return lines.join('\n');
};

// Pose une question en langage naturel à l'IA, en s'appuyant sur le résumé de la
// flotte (FP.aiContext). Astuce : le relais « scan-doc » attend une IMAGE ; on lui
// envoie donc un PNG 1×1 transparent + tout le raisonnement dans le prompt texte,
// sans rien changer côté serveur. Renvoie une string (la réponse) ou null.
FP._AI_PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
FP.askIA = async function (question, opts) {
  opts = opts || {};
  question = String(question || '').trim();
  if (!question) return null;
  if (!(FP.supabase && FP.supabase.functions)) return null;
  const ctx = opts.context || FP.aiContext();
  const prompt = [
    'Tu es l\'assistant de gestion de flotte « Parc Pilot ». Tu réponds à la question du',
    'gestionnaire en te basant UNIQUEMENT sur les données de sa flotte fournies ci-dessous.',
    'Réponds en FRANÇAIS, de façon claire, courte et directe (l\'utilisateur n\'est pas informaticien).',
    'Donne des chiffres précis quand c\'est pertinent. Si l\'information demandée n\'est PAS dans les',
    'données, dis-le simplement (« Je n\'ai pas cette information dans tes données ») — n\'INVENTE JAMAIS',
    'un chiffre, un véhicule, un conducteur ou un montant. N\'ignore pas l\'image jointe : elle est vide',
    'volontairement, tout est dans ce texte.',
    '',
    '===== DONNÉES DE LA FLOTTE =====',
    ctx,
    '===== FIN DES DONNÉES =====',
    '',
    'QUESTION DU GESTIONNAIRE : ' + question,
    '',
    'Réponds STRICTEMENT en JSON, sans texte autour, au format :',
    '{ "reponse": "<ta réponse en français>" }',
  ].join('\n');
  const payload = { fileBase64: FP._AI_PIXEL, mediaType: 'image/png', docType: 'question', prompt, maxTokens: opts.maxTokens || 900 };
  const names = [...new Set([FP._scanFn, 'Scan-doc', 'scan-doc'].filter(Boolean))];
  for (const name of names) {
    try {
      const { data, error } = await FP.supabase.functions.invoke(name, { body: payload });
      if (!error && data && data.ok && data.fields) {
        FP._scanFn = name;
        const f = data.fields;
        if (typeof f === 'string') return f;
        return f.reponse || f.answer || f.text || (typeof f === 'object' ? JSON.stringify(f) : String(f));
      }
    } catch (_) { /* essaie le nom suivant */ }
  }
  return null;
};

// ================= SANTÉ DU SERVICE IA (auto-diagnostic) =================
// But : ne plus jamais échouer EN SILENCE. FP.aiHealth() envoie un mini-appel de test au relais
// « scan-doc » et renvoie { ok, model, reason }. Sert au bandeau d'alerte (dashboard) et au bouton
// « Tester l'IA » (Paramètres). FP.aiHealthLabel() traduit la panne en message clair + piste de fix.
FP._aiErrText = async function (error) {
  try { if (error && error.context && typeof error.context.json === 'function') { const j = await error.context.json(); if (j && (j.error || j.message)) return j.error || j.message; } } catch (_) {}
  try { if (error && error.context && typeof error.context.text === 'function') { const t = await error.context.text(); if (t) return String(t).slice(0, 200); } } catch (_) {}
  return (error && error.message) || 'Erreur du service IA.';
};
FP.aiHealth = async function () {
  if (!(FP.supabase && FP.supabase.functions)) return { ok: false, reason: 'Connexion au serveur indisponible (non connecté ?).' };
  const payload = { fileBase64: FP._AI_PIXEL, mediaType: 'image/png', docType: 'ping',
    prompt: 'Test de disponibilité. Ignore l\'image (volontairement vide). Réponds STRICTEMENT en JSON : { "reponse": "ok" }.', maxTokens: 40 };
  const names = [...new Set([FP._scanFn, 'Scan-doc', 'scan-doc'].filter(Boolean))];
  let reason = 'Fonction IA « scan-doc » introuvable côté serveur.';
  for (const name of names) {
    try {
      const { data, error } = await FP.supabase.functions.invoke(name, { body: payload });
      if (error) { reason = await FP._aiErrText(error); continue; }
      if (data && data.ok) { FP._scanFn = name; return { ok: true, model: data.model || null }; }
      if (data && data.error) { reason = data.error; continue; }
      reason = 'Réponse inattendue du service IA.';
    } catch (e) { reason = (e && e.message) || String(e); }
  }
  return { ok: false, reason };
};
// Traduit un résultat de FP.aiHealth() en { level, msg, hint } compréhensible (admin).
FP.aiHealthLabel = function (r) {
  if (!r) return { level: 'err', msg: 'IA : état inconnu.' };
  if (r.ok) return { level: 'ok', msg: 'IA opérationnelle' + (r.model ? ' — modèle ' + r.model : '') + '.' };
  const s = (r.reason || '').toLowerCase();
  if (/model|modèle|modele|not_found|not found|404|does not exist|unknown model/.test(s))
    return { level: 'err', msg: 'Modèle Claude invalide ou retiré.', hint: 'Corrige `MODEL` (ou le secret ANTHROPIC_MODEL) dans la fonction scan-doc, puis redéploie.', reason: r.reason };
  if (/api[_ ]?key|x-api-key|authentication|invalid.*key|unauthorized|401|manquante|permission/.test(s))
    return { level: 'err', msg: 'Clé API Anthropic manquante ou invalide.', hint: 'Vérifie le secret ANTHROPIC_API_KEY dans Supabase → Edge Functions → Secrets.', reason: r.reason };
  if (/quota|rate.?limit|overloaded|credit|billing|429|insufficient|exceeded/.test(s))
    return { level: 'err', msg: 'Quota / crédit Anthropic épuisé (ou surcharge).', hint: 'Vérifie le solde / les limites de ton compte Anthropic.', reason: r.reason };
  if (/connexion|serveur indisponible|non connecté/.test(s))
    return { level: 'warn', msg: r.reason };
  return { level: 'err', msg: 'Service IA indisponible.', hint: r.reason, reason: r.reason };
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
  // ⚠️ Sauvegarde complète RÉSERVÉE AU CEO (consigne explicite) — verrou côté fonction,
  // en plus du masquage de l'interface. Personne d'autre ne peut sauvegarder les données.
  if (!(FP.isCEO && FP.isCEO())) { alert('La sauvegarde complète est réservée au CEO.'); return; }
  if (!(FP.supabase && FP.db)) { alert('Connexion requise pour exporter.'); return; }
  // Toutes les tables de données (RLS → seules les lignes de ta/tes société(s) sont renvoyées).
  const tables = ['vehicules', 'amendes', 'factures', 'conducteurs', 'documents', 'emprunts', 'total_conso', 'ulys_conso', 'app_settings'];
  const out = { app: 'Parc Pilot', type: 'sauvegarde-complete', exportedAt: new Date().toISOString(), counts: {} };
  for (const t of tables) {
    try { const r = await FP.supabase.from(t).select('*'); out[t] = (r && r.data) || []; out.counts[t] = out[t].length; }
    catch (e) { out[t] = []; out.counts[t] = 0; }
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
// Extrait { bucket, path } de N'IMPORTE QUELLE URL Supabase Storage
// (…/storage/v1/object/(public|sign|authenticated)/<bucket>/<path>), ou du repli legacy « /scans/… ».
// Renvoie null si l'URL n'est pas un objet Storage (Drive, http externe…). Généralise l'ancien
// FP.scanPath (limité au bucket « scans ») → gère aussi les factures d'un autre bucket.
FP._storageRef = (url) => {
  const s = String(url || '');
  let m = s.match(/\/storage\/v1\/object\/(?:public\/|sign\/|authenticated\/)?([^/?]+)\/([^?#]+)/);
  if (m) return { bucket: decodeURIComponent(m[1]), path: decodeURIComponent(m[2]) };
  m = s.match(/\/scans\/([^?#]+)/);
  if (m) return { bucket: FP.SCAN_BUCKET, path: decodeURIComponent(m[1]) };
  return null;
};
FP.scanPath = (url) => { const r = FP._storageRef(url); return r ? r.path : null; };
FP.signedScanUrl = async (url, expires) => {
  try {
    const r = FP._storageRef(url);
    if (!r || !(FP.supabase && FP.supabase.storage)) return url;
    const { data, error } = await FP.supabase.storage.from(r.bucket).createSignedUrl(r.path, expires || 180);
    return (error || !data || !data.signedUrl) ? url : data.signedUrl;
  } catch (e) { return url; }
};
// Variante STRICTE : sert à savoir si le document EXISTE VRAIMENT (pour ne pas afficher l'erreur
// brute « Bucket not found » dans un aperçu). Renvoie : le lien SIGNÉ si l'objet existe ; `null` si
// l'objet/bucket est INTROUVABLE (erreur createSignedUrl) ; l'URL d'origine si on ne peut pas trancher
// (Supabase pas encore prêt, ou URL hors bucket « scans »).
FP.signedScanUrlStrict = async (url, expires) => {
  try {
    const r = FP._storageRef(url);
    if (!r) return url;                                      // pas un fichier Storage → on ne juge pas
    if (!(FP.supabase && FP.supabase.storage)) return url;   // pas encore prêt → repli, pas d'erreur
    const { data, error } = await FP.supabase.storage.from(r.bucket).createSignedUrl(r.path, expires || 3600);
    if (error || !data || !data.signedUrl) return null;      // objet/bucket manquant → aperçu impossible
    return data.signedUrl;
  } catch (e) { return null; }
};
// Ouvre un document : lien signé si c'est un fichier du bucket, sinon ouverture normale.
FP.openScan = (url) => {
  if (!url) return;
  if (!/\/scans\//.test(url)) { window.open(url, '_blank', 'noopener'); return; }
  const w = window.open('', '_blank'); // ouvert TOUT DE SUITE (dans le geste de clic → pas bloqué)
  FP.signedScanUrl(url).then(u => { if (w) { try { w.opener = null; } catch (e) {} w.location = u; } else { location.href = u; } });
};
// ⚠️ SOURCE UNIQUE — Ouvre DIRECTEMENT le PDF/document concerné (jamais un aperçu intégré).
// Accepte : une URL http(s), un chemin du bucket « scans » (→ lien signé), ou un ID Google Drive
// (→ page /view). TOUT bouton « Voir » de la plateforme DOIT passer par ici pour un comportement
// identique partout. Ouvre l'onglet DANS le geste de clic (sinon bloqué par le navigateur).
FP.openPdf = function (ref, emptyMsg) {
  const raw = String(ref == null ? '' : ref).trim();
  if (!raw || /^IMP-/i.test(raw)) { if (FP.toast) FP.toast(emptyMsg || 'Aucun PDF disponible'); return false; }
  const toFinal = (u) => /^https?:\/\//.test(u) ? u : ('https://drive.google.com/file/d/' + u + '/view');
  const needSign = (/\/scans\//.test(raw) || /\/storage\/v1\/object\//.test(raw)) && FP.signedScanUrl;
  if (!needSign) { window.open(toFinal(raw), '_blank', 'noopener'); return true; }
  const w = window.open('', '_blank');
  FP.signedScanUrl(raw, 600).then(u => { const f = toFinal(u || raw); if (w) { try { w.opener = null; } catch (e) {} w.location = f; } else { window.open(f, '_blank', 'noopener'); } })
    .catch(() => { const f = toFinal(raw); if (w) w.location = f; else window.open(f, '_blank', 'noopener'); });
  return true;
};
// ⚠️ SOURCE UNIQUE — Génère un VRAI fichier Excel (.xlsx) et le télécharge. Colonnes propres,
// encodage UTF-8 correct (é, €… sans « signes bizarres »), montants NUMÉRIQUES (typeof number →
// vraie cellule chiffre). Aucune dépendance : ZIP « store » + CRC32 écrits à la main.
//   FP.downloadXlsx(nomFichier, entetes[], lignes[][], { sheet })  — une valeur number = cellule
//   numérique ; sinon texte. À utiliser PARTOUT à la place des exports CSV « moches ».
FP._xlsxCRC = (() => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
FP.buildXlsx = function (headers, rows, sheetName) {
  const CT = FP._xlsxCRC, te = new TextEncoder();
  const crc32 = (b) => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CT[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const enc = (s) => te.encode(s);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const colL = (i) => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = (i - (m + 1)) / 26; } return s; };
  const sheetRows = [];
  sheetRows.push('<row r="1">' + (headers || []).map((h, c) => `<c r="${colL(c)}1" t="inlineStr" s="1"><is><t xml:space="preserve">${esc(h)}</t></is></c>`).join('') + '</row>');
  (rows || []).forEach((row, ri) => { const r = ri + 2;
    sheetRows.push(`<row r="${r}">` + row.map((v, c) => { const ref = colL(c) + r;
      if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    }).join('') + '</row>');
  });
  const nm = String(sheetName || 'Feuille1').replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 31) || 'Feuille1';
  const sheetXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + sheetRows.join('') + '</sheetData></worksheet>';
  const files = [
    { name: '[Content_Types].xml', bytes: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>') },
    { name: '_rels/.rels', bytes: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') },
    { name: 'xl/workbook.xml', bytes: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' + esc(nm) + '" sheetId="1" r:id="rId1"/></sheets></workbook>') },
    { name: 'xl/_rels/workbook.xml.rels', bytes: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>') },
    { name: 'xl/styles.xml', bytes: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>') },
    { name: 'xl/worksheets/sheet1.xml', bytes: enc(sheetXml) },
  ];
  // ZIP « store » (aucune compression) + répertoire central + EOCD.
  const chunks = [], central = []; let off = 0;
  const u16 = (n) => [n & 255, (n >> 8) & 255], u32 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255];
  for (const f of files) {
    const nameB = enc(f.name), crc = crc32(f.bytes), sz = f.bytes.length;
    const lh = [].concat(u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(sz), u32(sz), u16(nameB.length), u16(0));
    chunks.push(Uint8Array.from(lh), nameB, f.bytes);
    const ch = [].concat(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(sz), u32(sz), u16(nameB.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off));
    central.push(Uint8Array.from(ch), nameB);
    off += lh.length + nameB.length + sz;
  }
  let csize = 0; central.forEach(c => csize += c.length);
  const eocd = [].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(csize), u32(off), u16(0));
  const all = chunks.concat(central, [Uint8Array.from(eocd)]);
  let tot = 0; all.forEach(a => tot += a.length); const out = new Uint8Array(tot); let p = 0; all.forEach(a => { out.set(a, p); p += a.length; });
  return out;
};
FP.downloadXlsx = function (filename, headers, rows, opts) {
  opts = opts || {};
  try {
    const bytes = FP.buildXlsx(headers, rows, opts.sheet);
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob); const el = document.createElement('a');
    el.href = url; el.download = String(filename || 'export').replace(/\.xlsx$/i, '') + '.xlsx';
    document.body.appendChild(el); el.click(); el.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
  } catch (e) { console.warn('[downloadXlsx]', e); if (FP.toast) FP.toast('Export Excel impossible.'); return false; }
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

// === Images / iframes de documents privés : SIGNATURE AUTOMATIQUE ===
// Le bucket "scans" peut être privé (RGPD) : tout <img>/<iframe>/<embed> qui pointe vers un
// fichier stocké doit alors être servi via un lien SIGNÉ. On le fait AUTOMATIQUEMENT (comme le
// clic sur les liens) grâce à un MutationObserver → aucune page à modifier, présentes et futures.
// (Lien plus long, 1 h, car une image reste affichée un moment ; repli sur l'URL d'origine si le
//  bucket est resté public → aucune coupure.)
FP._signMedia = function (el) {
  try {
    const cur = el.getAttribute('src') || '';
    // Tout objet Supabase Storage (n'importe quel bucket), pas seulement « /scans/ » (ex. factures).
    if (!cur || !(/\/scans\//.test(cur) || /\/storage\/v1\/object\//.test(cur))) return;
    if (el.dataset.scanSigned === '1') return;
    el.dataset.scanSigned = '1';
    if (/\/object\/sign\//.test(cur)) return; // déjà un lien signé
    FP.signedScanUrlStrict(cur, 3600).then(u => {
      if (u === null) {
        // Document INTROUVABLE (objet/bucket manquant) : au lieu de laisser l'iframe afficher l'erreur
        // brute « Bucket not found » (JSON illisible), on remplace par un message propre. Vaut pour
        // TOUTES les pages (amendes, factures, sinistres, conducteurs…) via le MutationObserver global.
        const msg = document.createElement('div');
        msg.className = 'scan-missing';
        msg.style.cssText = 'padding:1.1rem;text-align:center;color:var(--fp-muted,#64748b);font-size:.85rem;line-height:1.5;border:1px dashed var(--fp-border);border-radius:.55rem;background:var(--fp-surface,#f8fafc)';
        msg.innerHTML = '📄 Aperçu indisponible — ce document n\'a pas pu être chargé (fichier introuvable). Réimporte-le, ou ouvre-le via « Ouvrir en grand ».';
        if (el.parentNode) el.parentNode.replaceChild(msg, el);
        return;
      }
      if (u && u !== cur) el.setAttribute('src', u);
    });
  } catch (e) {}
};
FP.hydrateScanMedia = function (root) {
  const scope = (root && root.querySelectorAll) ? root : document;
  try { scope.querySelectorAll('img[src*="/scans/"],iframe[src*="/scans/"],embed[src*="/scans/"],img[src*="/storage/v1/object/"],iframe[src*="/storage/v1/object/"],embed[src*="/storage/v1/object/"]').forEach(FP._signMedia); } catch (e) {}
};
try {
  const _isMedia = (n) => n && (n.tagName === 'IMG' || n.tagName === 'IFRAME' || n.tagName === 'EMBED');
  const _mo = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'attributes' && _isMedia(m.target)) FP._signMedia(m.target);
      if (m.addedNodes) m.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (_isMedia(n)) FP._signMedia(n);
        if (n.querySelectorAll) FP.hydrateScanMedia(n);
      });
    }
  });
  _mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });
  if (document.readyState !== 'loading') FP.hydrateScanMedia(document);
  else document.addEventListener('DOMContentLoaded', () => FP.hydrateScanMedia(document));
} catch (e) {}

// === GLISSER-DÉPOSER GLOBAL de fichiers ==============================
// Partout dans la plateforme : glisser un fichier sur une zone contenant un champ d'upload
// (input[type=file]) le remplit et déclenche le traitement habituel (scan IA, etc.). Aucune
// page à modifier : ça vaut pour tous les formulaires/modales, présents ET futurs.
// Ne se déclenche QUE pour un vrai fichier venu du bureau (dataTransfer.files) → n'interfère
// jamais avec les glisser-déposer internes (réorganisation de colonnes/lignes, déplacement de
// documents entre dossiers, qui n'ont pas de « files »). Opt-out : attribut data-no-fp-drop.
(function globalFileDrop() {
  try {
    let hi = null;
    const setHi = (el) => { if (hi === el) return; if (hi) hi.classList.remove('fp-drop-hi'); hi = el; if (hi) hi.classList.add('fp-drop-hi'); };
    // Champ fichier de la zone survolée : on remonte au 1er conteneur qui contient un input file.
    function hitFor(target) {
      for (let n = target; n && n.nodeType === 1 && n !== document.documentElement; n = n.parentElement) {
        if (n.getAttribute && n.getAttribute('data-no-fp-drop') != null) return null;
        let ins = null; try { ins = n.querySelectorAll('input[type="file"]:not([disabled])'); } catch (e) {}
        if (ins && ins.length) return { input: ins[0], zone: n };
      }
      return null;
    }
    // Filtre les fichiers déposés selon l'attribut accept du champ (extension ou type MIME).
    function allowed(input, fileList) {
      const acc = (input.getAttribute('accept') || '').trim().toLowerCase();
      const files = Array.from(fileList);
      if (!acc) return files;
      const types = acc.split(',').map(s => s.trim()).filter(Boolean);
      return files.filter(f => types.some(t => {
        if (t.startsWith('.')) return f.name.toLowerCase().endsWith(t);
        if (t.endsWith('/*')) return (f.type || '').toLowerCase().startsWith(t.slice(0, -1));
        return (f.type || '').toLowerCase() === t;
      }));
    }
    const hasFiles = (e) => { try { return Array.from((e.dataTransfer && e.dataTransfer.types) || []).indexOf('Files') !== -1; } catch (_) { return false; } };
    document.addEventListener('dragover', (e) => {
      if (!hasFiles(e)) return;
      const hit = hitFor(e.target);
      if (!hit) { setHi(null); return; }
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'copy'; } catch (_) {}
      setHi(hit.zone);
    });
    document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) setHi(null); });
    window.addEventListener('dragend', () => setHi(null));
    document.addEventListener('drop', (e) => {
      if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) { setHi(null); return; }
      const hit = hitFor(e.target);
      setHi(null);
      if (!hit) return;
      const files = allowed(hit.input, e.dataTransfer.files);
      e.preventDefault();
      if (!files.length) { try { FP.toast && FP.toast("Ce type de fichier n'est pas accepté ici."); } catch (_) {} return; }
      try {
        const dt = new DataTransfer();
        (hit.input.multiple ? files : [files[0]]).forEach(f => dt.items.add(f));
        hit.input.files = dt.files;
        hit.input.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (err) { console.warn('[drop fichier]', err); }
    });
  } catch (e) {}
})();

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

// ================= FACTURES ULYS (péages VINCI) — lecture précise PARTAGÉE =================
// SOURCE DE VÉRITÉ UNIQUE pour lire un relevé Ulys (règle « une seule source ») : le PDF a une
// couche texte, mais une lecture standard MÉLANGE les colonnes → montants/prénoms faux. On
// reconstruit donc les lignes en triant les fragments PAR POSITION (y décroissant puis x), puis on
// ancre le détail par collaborateur sur le N° DE BADGE. Utilisé par la page Factures (import) ET
// par le scanner unifié (pages/scanner.html). Ne JAMAIS réimplémenter ailleurs.
FP.ulys = {
  MOIS_FR: { janvier:'01',fevrier:'02',mars:'03',avril:'04',mai:'05',juin:'06',juillet:'07',aout:'08',septembre:'09',octobre:'10',novembre:'11',decembre:'12' },
  num(s){ return parseFloat(String(s).replace(/\s/g,'').replace(',','.')) || 0; },
  norm(s){ return (s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase(); },
  slug(s){ return (s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,''); },
  moisLabel(m){ const [y,mo]=(m||'').split('-'); const N=['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']; return mo?`${N[+mo]} ${y}`:m; },
  // Reconstruit le texte du PDF EN LIGNES (tri par position). Repli sur OCR image si pas de couche texte.
  async pdfToText(file){
    try {
      await FP.ocr.loadScript(FP.ocr.PDFJS_CDN);
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = FP.ocr.PDFJS_WORKER;
      const buf = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
      let text = '';
      for (let pg=1; pg<=pdf.numPages; pg++){
        const page = await pdf.getPage(pg);
        const tc = await page.getTextContent();
        const items = tc.items.filter(i => i.str && i.str.trim() !== '')
          .map(i => ({ x: i.transform[4], y: i.transform[5], s: i.str.trim() }));
        items.sort((a,b) => (b.y - a.y) || (a.x - b.x));   // haut→bas puis gauche→droite
        const lines = []; let cur = null;
        for (const it of items){
          if (!cur || Math.abs(it.y - cur.y) > 2){ cur = { y: it.y, parts: [it] }; lines.push(cur); }
          else cur.parts.push(it);
        }
        for (const ln of lines){ ln.parts.sort((a,b)=>a.x-b.x); text += ln.parts.map(p=>p.s).join(' ') + '\n'; }
        text += '\n';
      }
      return text;
    } catch(e){ console.warn('[FP.ulys.pdfToText]', e); return ''; }
  },
  // Extrait n° / date / période / HT / TVA / TTC + détail par collaborateur (ancré sur le badge).
  parse(text){
    const t = String(text || '').replace(/[\u00a0\u202f\u2009]/g, ' ');   // normalise les espaces insecables
    const N = (s) => this.num(s);
    const mNum = t.match(/Facture\s*n[°ºo]\s*([A-Z]{1,3}\d{6,})/i);
    const mEm  = t.match(/[ÉE]mise?\s*le\s*(\d{2})\/(\d{2})\/(\d{4})/i);
    const numero = mNum ? mNum[1] : null;
    const emise = mEm ? `${mEm[3]}-${mEm[2]}-${mEm[1]}` : '';
    let mois = '';
    const mPer = t.match(/Facture\s+(?:de|d['’])\s*([a-zA-ZéèûôA-ZÀ-Ý]+)\s*(\d{4})/);
    if (mPer){ const mm = this.MOIS_FR[this.norm(mPer[1])]; if (mm) mois = mPer[2] + '-' + mm; }
    if (!mois && emise){ const d = new Date(emise); d.setMonth(d.getMonth()-1); mois = d.toISOString().slice(0,7); }
    // Date de la facture = 1er jour de la PÉRIODE (sinon « janvier » s'afficherait en février).
    const date = mois ? (mois + '-01') : emise;
    // Montants : TTC = « NET A PAYER TTC » imprimé avec € ; TVA = 20 % d'une base du récap 1re page ; HT = TTC − TVA.
    let ht=null, tva=null, ttc=null;
    const toNums = (s) => (String(s||'').match(/\d[\d\s]*,\d{2}/g)||[]).map(N);
    const afterNet = t.split(/NET\s*A\s*PAYER\s*TTC/i).slice(1).join(' ') || t;
    const mTtc = afterNet.match(/(\d[\d\s]*,\d{2})\s*€/) || t.match(/(\d[\d\s]*,\d{2})\s*€/);
    if (mTtc) ttc = N(mTtc[1]);
    const page1 = t.split(/Badge n[°ºo]/)[0];
    const p1nums = toNums(page1);
    if (ttc == null && p1nums.length) ttc = Math.max.apply(null, p1nums);
    if (ttc != null){
      let best = null;
      for (const b of p1nums) for (const tv of p1nums){
        if (tv > 0 && Math.abs(b * 0.20 - tv) <= 0.02 && b + tv <= ttc + 0.05){ if (!best || b > best.b) best = { b, tv }; }
      }
      if (best){ tva = best.tv; ht = +(ttc - tva).toFixed(2); }
      else { ht = +(ttc / 1.2).toFixed(2); tva = +(ttc - ht).toFixed(2); }
    }
    // Détail par collaborateur, ancré sur le N° DE BADGE (l'ordre des prénoms n'est PAS fiable).
    const badgeSuffix = (x) => String(x).replace(/\D/g,'').slice(-5);
    const nameByBadge = {};
    { const rx = /Badge\s*n[°ºo]\s+([\d ]+\d)\s+([A-Za-zÀ-ÿ][^\n]*?)\s*$/gim; let m;
      while ((m = rx.exec(t))){ const suf = badgeSuffix(m[1]); const nm = m[2].trim();
        if (suf && nm && !nameByBadge[suf]) nameByBadge[suf] = nm; } }
    const conso = [];
    { const rx = /Total\s+Badge\s+([\d ]+?\d)\s+(\d+)\s*consommation\(s\)\s*([\d\s.,]+?)\s*€\s*TTC\s*([\d\s.,]+?)\s*km/gi; let m;
      const seenB = new Set();
      while ((m = rx.exec(t))){
        const badgeFull = m[1]; const suf = badgeSuffix(badgeFull); if (seenB.has(suf)) continue; seenB.add(suf);
        // Priorité : conducteur enregistré avec CE badge (fiable) > nom lu à côté sur le PDF > « Badge <suf> ».
        let cond = null;
        try { const rc = FP.conducteurParBadgeUlys && FP.conducteurParBadgeUlys(badgeFull); if (rc && rc.name) cond = rc.name; } catch (e) {}
        conso.push({ conducteur: cond || nameByBadge[suf] || ('Badge ' + suf), nb: parseInt(m[2],10)||0, ttc: N(m[3]), km: N(m[4]) });
      }
    }
    // Détail DATÉ transaction par transaction : le relevé Ulys porte une COLONNE DATE par consommation.
    // Défensif & indépendant des colonnes : dans le bloc de CHAQUE badge (entre « Badge n° … » et son
    // « Total Badge »), toute ligne contenant une date JJ/MM/AAAA = une conso ce jour-là (montant =
    // dernier nombre à 2 décimales de la ligne, best-effort). Sert à repérer une conso pendant un congé.
    const txConso = [];
    {
      const heads = []; const rxHead = /Badge\s*n[°ºo]\s+([\d ]+\d)\s+([A-Za-zÀ-ÿ][^\n]*?)\s*$/gim; let hm;
      while ((hm = rxHead.exec(t))) heads.push({ end: rxHead.lastIndex, badge: hm[1], nom: hm[2].trim(), i: hm.index });
      for (let k = 0; k < heads.length; k++){
        const h = heads[k];
        let end = (k + 1 < heads.length) ? heads[k + 1].i : t.length;
        const totIdx = t.indexOf('Total Badge', h.end); if (totIdx >= 0 && totIdx < end) end = totIdx;
        const block = t.slice(h.end, end);
        const suf = badgeSuffix(h.badge);
        let cond = null; try { const rc = FP.conducteurParBadgeUlys && FP.conducteurParBadgeUlys(h.badge); if (rc && rc.name) cond = rc.name; } catch (e) {}
        cond = cond || nameByBadge[suf] || h.nom || ('Badge ' + suf);
        // Chaque transaction commence par une date JJ/MM/AAAA. On lit le SEGMENT jusqu'à la date
        // suivante (robuste au retour à la ligne « entrée / sortie » du péage). Colonnes réelles Ulys :
        //   … Classe | Tarif € HT | Tarif € TTC | TVA | Km — donc le TTC = le 2e nombre à 2 décimales
        // (le 1er = HT). Le Km (ex. « 24,6 ») n'a qu'UNE décimale → il n'est pas capté. Pas de « € » sur la ligne.
        const dre = /(\d{2})\/(\d{2})\/(\d{2,4})/g; const dpos = []; let dm2;
        while ((dm2 = dre.exec(block))) dpos.push({ i: dm2.index, m: dm2 });
        for (let j = 0; j < dpos.length; j++) {
          const m = dpos[j].m; const mo = +m[2], da = +m[1]; if (mo < 1 || mo > 12 || da < 1 || da > 31) continue;
          let yy = m[3]; if (yy.length === 2) yy = '20' + yy;
          const dateIso = yy + '-' + m[2] + '-' + m[1];
          const seg = block.slice(dpos[j].i, (j + 1 < dpos.length ? dpos[j + 1].i : block.length));
          const amts = (seg.match(/\d[\d\s]*,\d{2}(?!\d)/g) || []).map(N);
          const montant = amts.length >= 2 ? amts[1] : (amts.length === 1 ? amts[0] : null);
          txConso.push({ date: dateIso, conducteur: cond, badge: suf, montant });
        }
      }
    }
    return { numero, date, mois, ht, tva, ttc, conso, txConso };
  },
  // Enregistrements prêts pour la base — MÊMES ids/formats que l'import de la page Factures.
  factureRecord(p){ return { id:'ULYS-'+p.numero, date:p.date||null, vehiculeImmat:null, fournisseur:'Ulys', numeroFacture:p.numero, description:'Péages Ulys — '+this.moisLabel(p.mois), type:'peage', montantHT:p.ht, montantTVA:p.tva, montantTTC:p.ttc }; },
  consoRecord(c, societe){ return { id:'ULYSC-'+c.mois+'-'+this.slug(c.conducteur), mois:c.mois, conducteur:c.conducteur, nbTrajets:c.nb, km:c.km, totalTtc:c.ttc, numeroFacture:c.numero, societe: societe||'PXP' }; }
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
  _amtEq(a, b){ const x = this._num(a), y = this._num(b); return x != null && y != null && Math.abs(x - y) <= 0.02; },
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
        // Doublon d'amende = UNIQUEMENT même n° d'avis (clé unique). On ne flague JAMAIS sur
        // prénom+date+montant : deux amendes distinctes du même conducteur (même jour/montant) sont
        // légitimes (ex. 2 stationnements) — c'était la cause des faux doublons.
        const av = n(rec.numeroAvis), mt = this._num(rec.montant);
        if (!(av && av.length >= 4)) return null;
        return list.find(a => notSelf(a) && n(a.numeroAvis) === av
          && (mt == null || a.montant == null || this._amtEq(a.montant, mt))) || null;
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
  // (Version simple OK/Annuler — conservée pour les points d'ajout qui ne gèrent PAS la fusion.)
  async confirmAdd(table, rec, list){
    const d = this.find(table, rec, list);
    if (!d) return true;
    const extra = d.montantTTC != null ? ' · ' + FP.euro(d.montantTTC) : d.montant != null ? ' · ' + FP.euro(d.montant) : '';
    return await FP.confirm(`⚠️ Doublon possible\n\n${this._label(table)} identique semble déjà exister (${this._tag(d).trim()}${extra}).\n\nL'ajouter quand même ?`, { okText: 'Ajouter quand même', cancelText: 'Annuler', danger: false });
  },
  // ---- FUSION ----
  // Une valeur est « vide » (donc remplaçable par la fusion) si null/''/[] ou, pour les groupes,
  // uniquement « non-classe ». On ne remplace JAMAIS une valeur déjà saisie par l'utilisateur.
  _empty(k, v){
    if (v == null || v === '') return true;
    if (Array.isArray(v)) { if (v.length === 0) return true; if (k === 'groupes' && v.length === 1 && v[0] === 'non-classe') return true; return false; }
    return false;
  },
  // Calcule les champs que la FUSION copierait depuis `rec` (nouveau/scanné) vers `existing`
  // (existant) : présents dans rec, absents/vides dans existing. Renvoie { patch, labels[] }.
  mergePatch(table, existing, rec){
    const patch = {}; const labels = [];
    if (!existing || !rec) return { patch, labels };
    const LBL = {
      immat:'Immatriculation', marque:'Marque', modele:'Modèle', vin:'VIN', co2:'CO₂', puissanceFiscale:'Puissance fiscale',
      puissance:'Puissance', carburant:'Carburant', dateImmat:'1re immatriculation', prochainCT:'Prochain CT', controleTechniqueProchain:'Prochain CT',
      km:'Kilométrage', couleur:'Couleur', proprietaire:'Propriétaire', statut:'Statut', groupes:'Groupes', pool:'Groupe',
      numeroFacture:'N° facture', fournisseur:'Fournisseur', montantHT:'Montant HT', montantTVA:'TVA', montantTTC:'TTC', date:'Date', description:'Description',
      numeroAvis:'N° avis', montant:'Montant', motif:'Motif', points:'Points', prenom:'Conducteur',
      name:'Nom', nom:'Nom', tel:'Téléphone', email:'E-mail',
    };
    Object.keys(rec).forEach(k => {
      if (k === 'id') return;
      const nv = rec[k];
      if (nv == null || nv === '' || (Array.isArray(nv) && nv.length === 0)) return;
      if (k === 'groupes' && Array.isArray(nv) && nv.length === 1 && nv[0] === 'non-classe') return;
      if (this._empty(k, existing[k])) { patch[k] = nv; labels.push(LBL[k] || k); }
    });
    return { patch, labels };
  },
  // Applique la fusion sur l'objet existant (mutation) et renvoie le patch appliqué.
  applyMerge(table, existing, rec){
    const { patch } = this.mergePatch(table, existing, rec);
    Object.assign(existing, patch);
    return patch;
  },
  // Petite modale à 3 choix (au style du site) → résout 'merge' | 'add' | 'cancel'.
  _choiceModal({ title, html, buttons }){
    return new Promise(resolve => {
      const ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.55);backdrop-filter:blur(2px);padding:16px;';
      const box = document.createElement('div');
      box.style.cssText = 'background:var(--fp-surface,#fff);color:var(--fp-text,#111A2B);max-width:460px;width:100%;border-radius:16px;box-shadow:var(--fp-shadow-lg,0 20px 60px rgba(0,0,0,.35));padding:20px 22px;font-family:inherit;';
      box.innerHTML = `<div style="font-size:16px;font-weight:700;margin-bottom:8px;">${title}</div><div style="font-size:13.5px;line-height:1.5;color:var(--fp-muted,#5A6577);">${html}</div>`;
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:18px;';
      const done = (val) => { try { document.removeEventListener('keydown', onKey); } catch(e){} ov.remove(); resolve(val); };
      buttons.forEach(b => {
        const btn = document.createElement('button');
        btn.textContent = b.label;
        const base = 'padding:9px 14px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid transparent;transition:filter .15s;';
        const styles = {
          primary: base + 'background:var(--fp-accent,#F97316);color:#fff;',
          neutral: base + 'background:transparent;color:var(--fp-text,#111A2B);border-color:var(--fp-border,#E3E8F0);',
          danger:  base + 'background:transparent;color:#b91c1c;border-color:#fca5a5;',
        };
        btn.style.cssText = styles[b.kind || 'neutral'];
        btn.onmouseenter = () => btn.style.filter = 'brightness(.94)';
        btn.onmouseleave = () => btn.style.filter = '';
        btn.onclick = () => done(b.value);
        row.appendChild(btn);
      });
      box.appendChild(row); ov.appendChild(box); document.body.appendChild(ov);
      // Accessibilité : focus sur le 1er bouton (l'action recommandée) → Entrée le déclenche.
      try { const first = row.querySelector('button'); if (first) first.focus(); } catch (e) {}
      const onKey = (e) => { if (e.key === 'Escape') done('cancel'); };
      document.addEventListener('keydown', onKey);
      ov.addEventListener('click', e => { if (e.target === ov) done('cancel'); });
    });
  },
  // Garde AVANT insertion, AVEC option de FUSION. Renvoie une Promise :
  //   { action:'add' }                        → pas de doublon, ou l'utilisateur ajoute quand même
  //   { action:'merge', existing, patch }      → fusionner : `existing` a déjà reçu les champs manquants
  //   { action:'cancel' }                      → annuler
  // Utiliser là où on sait ré-enregistrer l'existant fusionné (véhicules notamment).
  async guard(table, rec, list){
    const d = this.find(table, rec, list);
    if (!d) return { action: 'add' };
    const { patch, labels } = this.mergePatch(table, d, rec);
    const extra = d.montantTTC != null ? ' · ' + FP.euro(d.montantTTC) : d.montant != null ? ' · ' + FP.euro(d.montant) : '';
    const canMerge = labels.length > 0;
    const fillLine = canMerge
      ? `<div style="margin-top:12px;padding:10px 12px;background:rgba(249,115,22,.10);border-radius:10px;"><b>Fusionner</b> complétera les champs vides de l'existant :<br><span style="color:var(--fp-text,#111A2B);font-weight:600;">${labels.join(', ')}</span></div>`
      : `<div style="margin-top:12px;padding:10px 12px;background:rgba(148,163,184,.12);border-radius:10px;color:var(--fp-muted,#5A6577);">Le document scanné n'apporte aucun champ manquant : rien à fusionner.</div>`;
    const buttons = [];
    if (canMerge) buttons.push({ label: '🔗 Fusionner avec l\'existant', value: 'merge', kind: 'primary' });
    buttons.push({ label: 'Ajouter quand même', value: 'add', kind: 'neutral' });
    buttons.push({ label: 'Annuler', value: 'cancel', kind: 'danger' });
    const choice = await this._choiceModal({
      title: '⚠️ Doublon possible',
      html: `${this._label(table)} identique semble déjà exister (<b>${this._tag(d).trim()}${extra}</b>).${fillLine}`,
      buttons,
    });
    if (choice === 'merge') { Object.assign(d, patch); return { action: 'merge', existing: d, patch }; }
    if (choice === 'add')   return { action: 'add' };
    return { action: 'cancel' };
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
  TABLE: 'audit_log',      // historique PARTAGÉ (Supabase) — cf. supabase/audit-log.sql
  MAX: 800,
  _remote: null,           // cache mémoire de l'historique partagé (null = pas encore chargé)
  TABLE_LABEL: { vehicules: 'Véhicule', amendes: 'Amende', factures: 'Facture', conducteurs: 'Conducteur', emprunts: 'Emprunt', documents: 'Document' },
  get() { try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); } catch (e) { return []; } },
  // Source AFFICHÉE : l'historique partagé s'il est chargé, sinon le cache local (hors-ligne).
  list() { return Array.isArray(this._remote) ? this._remote : this.get(); },
  _save(arr) { try { localStorage.setItem(this.KEY, JSON.stringify(arr.slice(0, this.MAX))); } catch (e) {} },
  log(entry) {
    const full = { ts: new Date().toISOString(), user: FP._userEmail || (function () { try { return localStorage.getItem('auto_flotte_last_user'); } catch (e) { return null; } })() || 'inconnu', ...entry };
    const arr = this.get(); arr.unshift(full); this._save(arr);
    if (Array.isArray(this._remote)) this._remote.unshift(full);
    try { document.dispatchEvent(new CustomEvent('fp:audit')); } catch (e) {}
    this._remoteInsert(full); // fire-and-forget → historique partagé entre tous les postes
  },
  // Écriture dans Supabase EN DIRECT (client brut, PAS via FP.db pour éviter de se journaliser soi-même).
  _remoteInsert(full) {
    try {
      if (!(FP.supabase && FP.supabase.from)) return;
      let soc = (FP.activeSociete ? FP.activeSociete() : 'PXP') || 'PXP';
      if (soc === '__all__') soc = 'PXP';
      FP.supabase.from(this.TABLE).insert({
        user_email: full.user || null,
        action: full.action || null,
        entity: full.table || null,
        rec_id: (full.id != null && full.id !== '') ? String(full.id) : null,
        label: full.label || null,
        champs: full.champs || null,
        societe: soc,
      }).then(function () {}, function () {}); // silencieux : le local reste la source de secours
    } catch (e) {}
  },
  // Charge l'historique partagé (filtré par la RLS selon la société) → alimente l'affichage.
  async loadRemote(limit) {
    try {
      if (!(FP.supabase && FP.supabase.from)) return this.get();
      const { data, error } = await FP.supabase.from(this.TABLE).select('*').order('ts', { ascending: false }).limit(limit || this.MAX);
      if (error || !Array.isArray(data)) return this.get();
      this._remote = data.map(r => ({ ts: r.ts, user: r.user_email, action: r.action, table: r.entity, id: r.rec_id, label: r.label, champs: r.champs, societe: r.societe }));
      try { document.dispatchEvent(new CustomEvent('fp:audit')); } catch (e) {}
      return this._remote;
    } catch (e) { return this.get(); }
  },
  async clear() {
    try { localStorage.removeItem(this.KEY); } catch (e) {}
    // Efface aussi l'historique partagé de la société active (la RLS n'autorise que les admins/CEO).
    try {
      if (FP.supabase && FP.supabase.from) {
        const soc = (FP.activeSociete ? FP.activeSociete() : 'PXP');
        if (soc && soc !== '__all__') await FP.supabase.from(this.TABLE).delete().eq('societe', soc);
      }
    } catch (e) {}
    if (Array.isArray(this._remote)) this._remote = [];
    try { document.dispatchEvent(new CustomEvent('fp:audit')); } catch (e) {}
  },
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
    // État AVANT restauration (en mémoire) → sert à RÉCONCILIER la base : on ne pousse
    // que ce qui change réellement (aucune écriture inutile).
    const snapArr = (a) => (Array.isArray(a) ? JSON.parse(JSON.stringify(a)) : []);
    const before = {
      vehicules: (window.FP_DATA && window.FP_DATA.vehicules) ? snapArr(window.FP_DATA.vehicules) : [],
      amendes:   (window.FP_DATA && window.FP_DATA.amendes)   ? snapArr(window.FP_DATA.amendes)   : [],
    };
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
    // ⚠️ PERSISTER l'annulation/rétablissement DANS SUPABASE (sinon la modif « annulée »
    // revient au rechargement / sur les autres postes). On pousse les réglages (delta) et on
    // réconcilie les tables suivies (véhicules, amendes) : upsert des lignes restaurées/modifiées,
    // suppression des lignes que l'annulation retire. Rien n'est envoyé si Supabase est absent
    // (mode hors-ligne) — la file FP.persist rejouera plus tard.
    try { if (FP.settings && FP.settings._pushSettings) FP.settings._pushSettings(snap.settings); } catch (e) {}
    try { this._persistRestore(before, (snap.fpData || {})); } catch (e) { console.warn('[history._persistRestore]', e); }
  },

  // Aligne Supabase sur l'état restauré, table par table, SANS écriture inutile :
  // - ligne présente après mais absente/différente avant → upsert (l'upsert ne touche
  //   que les colonnes fournies, il n'efface pas les colonnes non mappées) ;
  // - ligne présente avant mais absente après → delete (annulation d'un ajout).
  _persistRestore(before, after) {
    if (!(FP.persist && FP.persist.upsert && FP.persist.delete)) return;
    const idMap = (arr) => { const m = {}; (arr || []).forEach(x => { if (x && x.id != null) m[x.id] = x; }); return m; };
    ['vehicules', 'amendes'].forEach((tbl) => {
      const bMap = idMap(before[tbl]);
      const aArr = Array.isArray(after[tbl]) ? after[tbl] : null;
      if (!aArr) return; // table non incluse dans ce snapshot → on n'y touche pas
      const aMap = idMap(aArr);
      // Ajouts / modifications à repousser
      aArr.forEach((row) => {
        if (!row || row.id == null) return;
        const prev = bMap[row.id];
        if (!prev || JSON.stringify(prev) !== JSON.stringify(row)) {
          try { FP.persist.upsert(tbl, row); } catch (e) {}
        }
      });
      // Lignes retirées par l'annulation → suppression (sans dépôt Corbeille : c'est un undo)
      Object.keys(bMap).forEach((id) => {
        if (!aMap[id]) { try { FP.persist.delete(tbl, id); } catch (e) {} }
      });
    });
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

// === Écran de transition « hyperspace » (réutilisable : déconnexion, etc.) ===
// Crée un overlay plein écran autonome (CSS + DOM + animation) au-dessus de la page.
FP.warp = function (caption) {
  try {
    if (document.getElementById('fp-warp')) return;
    if (!document.getElementById('fp-warp-css')) {
      var st = document.createElement('style'); st.id = 'fp-warp-css';
      st.textContent =
        '#fp-warp{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:#05070D;background-image:radial-gradient(circle at 50% 50%,#0A1428 0%,#05070D 72%);opacity:0;transition:opacity .4s ease}'
      + '#fp-warp.on{opacity:1}'
      + '#fp-warp canvas{position:absolute;inset:0;width:100%;height:100%}'
      + '#fp-warp .wc{position:relative;z-index:3;display:flex;flex-direction:column;align-items:center;gap:22px;animation:fpWarpIn 1s cubic-bezier(.16,1,.3,1) both}'
      + '#fp-warp .wl{filter:drop-shadow(0 0 36px rgba(249,115,22,.6))}'
      + '#fp-warp .wt{font-family:"Space Mono",ui-monospace,monospace;letter-spacing:.34em;text-transform:uppercase;font-size:13px;color:#EAF1FB;padding-left:.34em;animation:fpWarpBlink 1.6s ease-in-out infinite}'
      + '#fp-warp .wt b{color:#FB923C}'
      + '#fp-warp .hb{position:absolute;width:48px;height:48px;z-index:2}'
      + '#fp-warp .hb::before,#fp-warp .hb::after{content:"";position:absolute;background:rgba(249,115,22,.6)}'
      + '#fp-warp .hb::before{width:100%;height:2px}#fp-warp .hb::after{width:2px;height:100%}'
      + '#fp-warp .hb.tl{top:26px;left:26px}#fp-warp .hb.tr{top:26px;right:26px}#fp-warp .hb.bl{bottom:26px;left:26px}#fp-warp .hb.br{bottom:26px;right:26px}'
      + '#fp-warp .hb.tr::before,#fp-warp .hb.tr::after{right:0}#fp-warp .hb.bl::before{bottom:0}#fp-warp .hb.br::before,#fp-warp .hb.br::after{right:0}#fp-warp .hb.br::before{bottom:0}'
      + '@keyframes fpWarpBlink{50%{opacity:.4}}@keyframes fpWarpIn{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:none}}';
      document.head.appendChild(st);
    }
    var ov = document.createElement('div'); ov.id = 'fp-warp'; ov.setAttribute('aria-hidden', 'true');
    ov.innerHTML =
      '<canvas></canvas>'
    + '<div class="hb tl"></div><div class="hb tr"></div><div class="hb bl"></div><div class="hb br"></div>'
    + '<div class="wc"><svg class="wl" width="320" viewBox="0 0 154 36" xmlns="http://www.w3.org/2000/svg" style="overflow:visible"><line x1="2" y1="10" x2="24" y2="10" stroke="#FB923C" stroke-width="3" stroke-linecap="round"/><line x1="0" y1="18" x2="28" y2="18" stroke="#F97316" stroke-width="3" stroke-linecap="round"/><line x1="6" y1="26" x2="22" y2="26" stroke="#FB923C" stroke-width="3" stroke-linecap="round"/><text x="34" y="26" font-size="20" font-weight="900" font-style="italic"><tspan fill="#EAF1FB">Parc</tspan><tspan fill="#F97316">Pilot</tspan></text></svg>'
    + '<div class="wt">' + (FP.esc ? FP.esc(caption || 'Chargement') : (caption || 'Chargement')) + '<b>…</b></div></div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('on'); });
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var cv = ov.querySelector('canvas'), ctx = cv.getContext('2d'), DPR = Math.min(2, window.devicePixelRatio || 1), W, H, cx, cy, MAX, stt = [];
    W = cv.width = innerWidth * DPR; H = cv.height = innerHeight * DPR; cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px'; cx = W / 2; cy = H / 2; MAX = Math.hypot(W, H) / 2;
    function star() { return { a: Math.random() * 6.283, r: Math.random() * 30 * DPR + 6, pr: 0, sp: Math.random() * 0.032 + 0.016, col: Math.random() < 0.7 ? '251,146,60' : '56,189,248' }; }
    for (var i = 0; i < 280; i++) { var s = star(); s.r = Math.random() * MAX; stt.push(s); }
    (function loop() {
      ctx.fillStyle = 'rgba(5,7,13,.32)'; ctx.fillRect(0, 0, W, H);
      for (var i = 0; i < stt.length; i++) {
        var s = stt[i]; s.pr = s.r; s.r *= (1 + s.sp); s.r += 1.4 * DPR;
        var ca = Math.cos(s.a), sa = Math.sin(s.a), x = cx + ca * s.r, y = cy + sa * s.r, px = cx + ca * s.pr, py = cy + sa * s.pr, f = Math.min(1, s.r / MAX), al = f * f * 1.05;
        if (al >= 0.02) { ctx.strokeStyle = 'rgba(' + s.col + ',' + Math.min(1, al) + ')'; ctx.lineWidth = (0.4 + f * 2.8) * DPR; ctx.lineCap = 'round'; ctx.shadowColor = 'rgba(' + s.col + ',.7)'; ctx.shadowBlur = 7 * DPR; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke(); }
        if (s.r > MAX) stt[i] = star();
      }
      ctx.shadowBlur = 0; ov._raf = requestAnimationFrame(loop);
    })();
  } catch (e) {}
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
        <i data-lucide="power" class="fp-logout-power" style="width:16px;height:16px;flex-shrink:0;margin-left:.4rem;opacity:.85" title="Se déconnecter"></i>
      </button>
      <div class="fp-user-role" style="margin-top:.4rem; font-size:.62rem; letter-spacing:.04em; text-transform:uppercase; color:rgba(255,255,255,.4); padding-left:.85rem;"></div>
    `;
    sb.appendChild(div);
    if (window.lucide && lucide.createIcons) { try { lucide.createIcons(); } catch (e) {} } // rend l'icône « power »
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
    if (has('vehicule', 'voiture')) { const n = vehs.filter(v => !FP.estVendu(v)).length; out.push({ icon: '💡', label: `${n} véhicules actifs`, sub: 'dans la flotte', url: pref + 'vehicules.html' }); }
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
  if (has('co2', 'carbone', 'emission')) { let g = 0; vehs.forEach(v => { const cat = (v.categorie || '').toLowerCase(); if (/moto|utilit|engin|remorque/.test(cat) || FP.estVendu(v)) return; const c = Number(v.co2); if (/lectri|hydrog/.test((v.carburant || '').toLowerCase())) return; if (Number.isFinite(c) && c > 0) g += c * 15000; }); out.push({ icon: '🌱', label: `${(Math.round(g / 1e5) / 10).toLocaleString('fr-FR')} t CO₂/an`, sub: 'estimation (15 000 km/an)', url: pref + 'statistiques.html' }); }

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
        <div class="fp-exp-div"></div>
        <button type="button" class="fp-exp-it" data-exp="mail"><i data-lucide="mail" class="w-4 h-4" style="color:#2563eb"></i> Envoyer par mail…</button>
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
    menu.addEventListener('click', async (e) => {
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
      // Envoi par mail : un site statique ne peut pas JOINDRE un fichier tout seul (pas de serveur
      // mail). On télécharge le CSV puis on ouvre le client mail pré-rempli — l'utilisateur joint le
      // fichier (qui vient d'être téléchargé) et envoie. Fonctionne partout, sans backend.
      if (kind === 'mail') {
        const last = (function () { try { return localStorage.getItem('fp_export_mail') || ''; } catch (e) { return ''; } })();
        const to = await FP.prompt('Envoyer l\'export à quelle adresse e-mail ?', last);
        if (to == null || !to.trim()) return;
        const addr = to.trim();
        try { localStorage.setItem('fp_export_mail', addr); } catch (e) {}
        const fname = nameOf() + suffix + '.csv';
        FP.exportRows(nameOf() + suffix, opts.columns, rows, 'csv', { total: opts.total, sheetName: opts.sheetName });
        const subject = encodeURIComponent('Export ' + (opts.sheetName || nameOf()) + ' — ' + rows.length + ' ligne(s)');
        const body = encodeURIComponent(
          'Bonjour,\n\nVeuillez trouver l\'export « ' + fname + ' » (' + rows.length + ' ligne(s)).\n\n' +
          '⚠️ Le fichier vient d\'être téléchargé sur cet ordinateur : merci de le JOINDRE à cet e-mail avant l\'envoi.\n\n' +
          'Cordialement,');
        window.location.href = 'mailto:' + encodeURIComponent(addr) + '?subject=' + subject + '&body=' + body;
        if (FP.toast) FP.toast('Fichier téléchargé — joins-le à l\'e-mail qui vient de s\'ouvrir.');
        return;
      }
      FP.exportRows(nameOf() + suffix, opts.columns, rows, kind, { total: opts.total, sheetName: opts.sheetName });
      if (FP.toast) FP.toast(`${rows.length} ligne(s) exportée(s) en ${kind === 'csv' ? 'CSV' : 'Excel'}`);
    });
    return { el: wrap };
  };

})();

// ============================================================
// FP.fiche — Générateur de fiche imprimable RÉUTILISABLE (PDF net via jsPDF + impression HTML).
//   FP.fiche.open({ key, title, cols:[{id,label,def,align,mono,get(row)}], rows:[...] })
// La modale (choix des colonnes) est injectée à la volée. Le PDF nécessite jsPDF + autotable
// chargés sur la page (assets/js/vendor/jspdf*). L'impression HTML fonctionne partout.
// ============================================================
(function () {
  const SPACE_RE = /[\u00A0\u2000-\u200B\u202F\u205F\u2060\u3000]/g;
  const clean = (s) => String(s == null ? '' : s).replace(SPACE_RE, ' ').replace(/₂/g, '2');
  const escH = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  const LOGO = '<svg width="118" height="27" viewBox="0 0 154 36" xmlns="http://www.w3.org/2000/svg"><line x1="2" y1="10" x2="24" y2="10" stroke="#FB923C" stroke-width="3" stroke-linecap="round"/><line x1="0" y1="18" x2="28" y2="18" stroke="#F97316" stroke-width="3" stroke-linecap="round"/><line x1="6" y1="26" x2="22" y2="26" stroke="#FB923C" stroke-width="3" stroke-linecap="round"/><text x="34" y="26" font-size="20" font-weight="900" font-style="italic" fill="#fff">Parc</text><text x="86" y="26" font-size="20" font-weight="900" font-style="italic" fill="#F97316">Pilot</text></svg>';
  let modal = null, prev = null, cur = null, curDoc = null, curName = '';

  function build() {
    if (modal) return;
    // --- Modale 1 : choix des colonnes ---
    const el = document.createElement('div');
    el.id = 'fp-fiche-ov';
    el.style.cssText = 'display:none;position:fixed;inset:0;z-index:80;background:rgba(15,23,42,.45);align-items:center;justify-content:center;padding:20px';
    el.innerHTML = '<div style="background:#fff;border-radius:16px;padding:22px 24px;width:100%;max-width:480px;box-shadow:0 20px 50px rgba(15,23,42,.3);max-height:88vh;overflow:auto">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px"><div>'
      + '<h3 id="fp-fiche-h" style="font-size:18px;font-weight:800;margin:0;color:#0f172a">Fiche à imprimer</h3>'
      + '<p style="font-size:13px;color:#64748b;margin:3px 0 0">Choisis les colonnes — <b id="fp-fiche-scope" style="color:#f97316">0</b></p></div>'
      + '<button id="fp-fiche-x" style="background:none;border:none;font-size:24px;color:#94a3b8;cursor:pointer;line-height:1">&times;</button></div>'
      + '<label style="display:block;font-size:12px;font-weight:600;color:#64748b;margin:14px 0 4px">Titre de la fiche</label>'
      + '<input id="fp-fiche-title" type="text" style="width:100%;border:1px solid #e2e8f0;border-radius:9px;padding:8px 11px;font-size:14px;color:#0f172a">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin:14px 0 6px"><span style="font-size:12px;font-weight:600;color:#64748b">Colonnes</span>'
      + '<span style="font-size:12px"><button id="fp-fiche-all" style="background:none;border:none;color:#f97316;font-weight:600;cursor:pointer">Tout</button> · <button id="fp-fiche-none" style="background:none;border:none;color:#64748b;font-weight:600;cursor:pointer">Rien</button></span></div>'
      + '<div id="fp-fiche-cols" style="display:grid;grid-template-columns:1fr 1fr;gap:5px 14px"></div>'
      + '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px;flex-wrap:wrap">'
      + '<button id="fp-fiche-cancel" class="btn btn-outline text-sm">Annuler</button>'
      + '<button id="fp-fiche-apercu" class="btn btn-dark text-sm"><i data-lucide="eye" class="w-4 h-4"></i> Aperçu</button></div></div>';
    document.body.appendChild(el);
    modal = el;
    const close = () => { el.style.display = 'none'; };
    el.querySelector('#fp-fiche-x').onclick = close;
    el.querySelector('#fp-fiche-cancel').onclick = close;
    el.addEventListener('click', e => { if (e.target === el) close(); });
    el.querySelector('#fp-fiche-all').onclick = () => el.querySelectorAll('#fp-fiche-cols input').forEach(i => { i.checked = true; });
    el.querySelector('#fp-fiche-none').onclick = () => el.querySelectorAll('#fp-fiche-cols input').forEach(i => { i.checked = false; });
    el.querySelector('#fp-fiche-apercu').onclick = openPreview;

    // --- Modale 2 : aperçu PDF plein écran ---
    const pv = document.createElement('div');
    pv.id = 'fp-fiche-prev';
    pv.style.cssText = 'display:none;position:fixed;inset:0;z-index:81;background:rgba(15,23,42,.6);align-items:center;justify-content:center;padding:16px';
    pv.innerHTML = '<div style="background:#fff;border-radius:16px;width:96vw;max-width:1400px;height:94vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(15,23,42,.4);overflow:hidden">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;padding:13px 18px;border-bottom:1px solid #eef2f7">'
      + '<div style="font-weight:800;color:#0f172a;font-size:15px">Aperçu <span id="fp-prev-sub" style="color:#64748b;font-weight:500;font-size:13px"></span></div>'
      + '<button id="fp-prev-x" style="background:none;border:none;font-size:24px;color:#94a3b8;cursor:pointer;line-height:1">&times;</button></div>'
      + '<iframe id="fp-prev-frame" title="Aperçu de la fiche" style="flex:1;border:0;width:100%;background:#525659"></iframe>'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 18px;border-top:1px solid #eef2f7;flex-wrap:wrap">'
      + '<button id="fp-prev-back" class="btn btn-outline text-sm">← Modifier les colonnes</button>'
      + '<div style="display:flex;gap:8px"><button id="fp-prev-print" class="btn btn-outline text-sm"><i data-lucide="printer" class="w-4 h-4"></i> Imprimer</button>'
      + '<button id="fp-prev-dl" class="btn btn-dark text-sm"><i data-lucide="download" class="w-4 h-4"></i> Télécharger le PDF</button></div></div></div>';
    document.body.appendChild(pv);
    prev = pv;
    const pClose = () => { pv.style.display = 'none'; const f = pv.querySelector('#fp-prev-frame'); try { if (f.src && f.src.indexOf('blob:') === 0) URL.revokeObjectURL(f.src); } catch (e) {} f.src = 'about:blank'; };
    pv.querySelector('#fp-prev-x').onclick = pClose;
    pv.addEventListener('click', e => { if (e.target === pv) pClose(); });
    pv.querySelector('#fp-prev-back').onclick = () => { pClose(); modal.style.display = 'flex'; };
    pv.querySelector('#fp-prev-dl').onclick = () => { if (curDoc) curDoc.save(curName); };
    pv.querySelector('#fp-prev-print').onclick = () => { const f = pv.querySelector('#fp-prev-frame'); try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { if (f.src) window.open(f.src); } };
  }

  function ctx() {
    const ids = Array.from(modal.querySelectorAll('#fp-fiche-cols input:checked')).map(i => i.value);
    if (!ids.length) { alert('Choisis au moins une colonne.'); return null; }
    try { const s = FP.settings.get(); s.ficheCols = s.ficheCols || {}; s.ficheCols[cur.key] = ids; FP.settings.save(s); } catch (e) {}
    return {
      cols: cur.cols.filter(c => ids.includes(c.id)),
      title: (modal.querySelector('#fp-fiche-title').value || '').trim() || cur.title,
      rows: cur.rows,
      today: new Date().toLocaleDateString('fr-FR'),
    };
  }

  // Construit le PDF « à la sauce Parc Pilot » (bandeau arrondi, logo, accent, statuts colorés).
  function makeDoc(c) {
    const { cols, title, rows, today } = c;
    const jsPDF = window.jspdf.jsPDF;
    const doc = new jsPDF({ orientation: cols.length > 6 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const drawHeader = () => {
      doc.setFillColor(15, 30, 61); doc.roundedRect(10, 10, pageW - 20, 20, 3, 3, 'F');
      doc.setFillColor(249, 115, 22); doc.rect(10, 12, 2.4, 16, 'F');       // accent orange à gauche
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(clean(title), 16, 20);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(199, 210, 230);
      doc.text('Édité le ' + today + '   ·   ' + rows.length + ' ligne' + (rows.length > 1 ? 's' : ''), 16, 26);
      doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(14);
      const pw = doc.getTextWidth('Pilot'), rw = doc.getTextWidth('Parc');
      doc.setTextColor(255, 255, 255); doc.text('Parc', pageW - 16 - pw - rw, 19);
      doc.setTextColor(249, 115, 22); doc.text('Pilot', pageW - 16 - pw, 19);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(148, 163, 184);
      const g = 'GESTION DE FLOTTE'; doc.text(g, pageW - 16 - doc.getTextWidth(g), 24);
    };
    // Mise à l'échelle selon le NOMBRE de colonnes : avec « toutes les colonnes » (≈20), une police
    // de 9 pt se replie sur plusieurs lignes et devient illisible. On réduit progressivement police
    // + marges pour que chaque cellule tienne sur une ligne, tout en restant net pour peu de colonnes.
    const _nc = cols.length + 1;
    const _fs = _nc > 16 ? 6 : _nc > 13 ? 6.6 : _nc > 10 ? 7.3 : _nc > 7 ? 8.2 : 9;
    const _pad = _nc > 13 ? 1.5 : _nc > 10 ? 2 : _nc > 7 ? 2.3 : 2.6;
    const columnStyles = { 0: { halign: 'left', textColor: [148, 163, 184], cellWidth: _nc > 13 ? 9 : 12, cellPadding: { top: _pad, right: 1.2, bottom: _pad, left: 1.6 }, overflow: 'visible' } };
    cols.forEach((col, idx) => { columnStyles[idx + 1] = { halign: col.align === 'right' ? 'right' : 'left', font: col.mono ? 'courier' : 'helvetica' }; });
    // Ligne de total (si au moins une colonne a une fonction `sum`) → pied de tableau « TOTAL ».
    let foot = null;
    if (cols.some(c => typeof c.sum === 'function')) {
      // ⚠️ Le libellé « TOTAL » ne doit PAS aller dans la colonne « # » (8 mm) : il s'y afficherait
      // à la VERTICALE (une lettre par ligne). On le met dans une cellule FUSIONNÉE (colSpan) qui
      // couvre le « # » + toutes les colonnes AVANT le 1er total, alignée à droite → il a la place.
      const firstSumCol = cols.findIndex(c => typeof c.sum === 'function');   // index dans `cols`
      const span = firstSumCol < 0 ? 1 : firstSumCol + 1;                      // +1 pour la colonne « # »
      const footRow = [{ content: 'TOTAL', colSpan: span, styles: { halign: 'right', fontStyle: 'bold' } }];
      cols.forEach((c, idx) => {
        if (idx < firstSumCol) return;   // déjà couvert par le colSpan du libellé
        if (typeof c.sum === 'function') {
          const t = rows.reduce((s, r) => { const n = Number(c.sum(r)); return s + (isFinite(n) ? n : 0); }, 0);
          footRow.push({ content: clean(c.fmt ? c.fmt(t) : FP.euro(t)), styles: { halign: c.align === 'right' ? 'right' : 'left' } });
        } else footRow.push('');
      });
      foot = [footRow];
    }
    doc.autoTable({
      head: [['#'].concat(cols.map(c2 => clean(c2.label)))],
      body: rows.map((r, i) => [String(i + 1)].concat(cols.map(c2 => clean(c2.get(r))))),
      foot: foot || undefined,
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 30, 61], fontStyle: 'bold', fontSize: 9, lineColor: [203, 213, 225], lineWidth: 0.1 },
      startY: 36, margin: { top: 36, left: 10, right: 10 }, tableWidth: pageW - 20, theme: 'grid',
      styles: { fontSize: _fs, cellPadding: { top: _pad, right: _pad + 0.4, bottom: _pad, left: _pad + 0.4 }, textColor: [30, 41, 59], lineColor: [233, 238, 245], lineWidth: 0.1, valign: 'middle', overflow: 'linebreak' },
      headStyles: { fillColor: [15, 30, 61], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: Math.max(6, _fs - 0.5), lineColor: [15, 30, 61], lineWidth: 0, cellPadding: { top: _pad + 0.4, right: _pad + 0.4, bottom: _pad + 0.4, left: _pad + 0.4 } },
      alternateRowStyles: { fillColor: [247, 249, 252] },
      columnStyles: columnStyles,
      didParseCell: (data) => {
        if (data.section !== 'body' || data.column.index === 0) return;
        const col = cols[data.column.index - 1];
        if (col && col.tint) { const t = col.tint(String(data.cell.raw || '')); if (t) { data.cell.styles.textColor = t; data.cell.styles.fontStyle = 'bold'; } }
      },
      didDrawPage: (d) => {
        drawHeader();
        const h = doc.internal.pageSize.getHeight();
        doc.setDrawColor(233, 238, 245); doc.line(10, h - 9, pageW - 10, h - 9);
        doc.setFontSize(7.5); doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'normal');
        doc.text('Parc Pilot — gestion de flotte', 10, h - 5);
        doc.text('Page ' + d.pageNumber, pageW - 10, h - 5, { align: 'right' });
      },
    });
    const safe = clean(title).replace(/[^\wÀ-ÿ \-]+/g, '').trim().replace(/\s+/g, '-') || 'fiche';
    return { doc: doc, filename: safe + '_' + today.split('/').reverse().join('-') + '.pdf' };
  }

  function openPreview() {
    const c = ctx(); if (!c) return;
    if (!(window.jspdf && window.jspdf.jsPDF)) { FP.ensureJsPDF().then(openPreview).catch(() => alert('La librairie PDF n\'a pas pu être chargée.')); return; }
    const made = makeDoc(c);
    curDoc = made.doc; curName = made.filename;
    // #view=FitH → le PDF s'ouvre ajusté à la LARGEUR (lisible d'emblée, plus le mini-aperçu à 27 %) ;
    // navpanes=0 masque le volet de vignettes à gauche → on voit le document en grand.
    const url = curDoc.output('bloburl') + '#toolbar=1&navpanes=0&view=FitH';
    prev.querySelector('#fp-prev-frame').src = url;
    prev.querySelector('#fp-prev-sub').textContent = '· ' + c.rows.length + ' ligne(s)';
    modal.style.display = 'none';
    prev.style.display = 'flex';
  }

  FP.fiche = {
    open(config) {
      build();
      cur = { key: config.key || 'fiche', cols: config.cols || [], rows: config.rows || [], title: config.title || 'Fiche' };
      if (!cur.rows.length) { alert('Aucune ligne à imprimer (vérifie les filtres / la sélection).'); return; }
      let saved; try { saved = (FP.settings.get().ficheCols || {})[cur.key]; } catch (e) {}
      if (!saved || !saved.length) saved = cur.cols.filter(c => c.def).map(c => c.id);
      modal.querySelector('#fp-fiche-cols').innerHTML = cur.cols.map(c =>
        '<label style="display:flex;align-items:center;gap:7px;font-size:14.5px;color:#334155;padding:5px 6px;border-radius:6px;cursor:pointer"><input type="checkbox" value="' + c.id + '"' + (saved.indexOf(c.id) >= 0 ? ' checked' : '') + ' style="width:16px;height:16px;accent-color:#f97316"> ' + escH(c.label) + '</label>').join('');
      modal.querySelector('#fp-fiche-scope').textContent = cur.rows.length + ' ligne(s)';
      modal.querySelector('#fp-fiche-h').textContent = cur.title;
      modal.querySelector('#fp-fiche-title').value = cur.title;
      modal.style.display = 'flex';
      if (window.lucide) try { lucide.createIcons(); } catch (e) {}
    },
  };
})();

// Aperçu PDF générique (réutilisable par n'importe quelle page) : montre un doc jsPDF dans une
// iframe, avec Télécharger (un clic) + Imprimer + Fermer. Usage : FP.pdfPreview(doc, 'fichier.pdf', 'sous-titre').
FP.pdfPreview = function (doc, filename, subtitle) {
  let ov = document.getElementById('fp-pdfprev-ov');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'fp-pdfprev-ov';
    ov.style.cssText = 'display:none;position:fixed;inset:0;z-index:90;background:rgba(15,23,42,.6);align-items:center;justify-content:center;padding:16px';
    ov.innerHTML = '<div style="background:#fff;border-radius:16px;width:96vw;max-width:1400px;height:94vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(15,23,42,.4);overflow:hidden">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;padding:13px 18px;border-bottom:1px solid #eef2f7">'
      + '<div style="font-weight:800;color:#0f172a;font-size:15px">Aperçu <span id="fp-pdfprev-sub" style="color:#64748b;font-weight:500;font-size:13px"></span></div>'
      + '<button id="fp-pdfprev-x" style="background:none;border:none;font-size:24px;color:#94a3b8;cursor:pointer;line-height:1">&times;</button></div>'
      + '<iframe id="fp-pdfprev-frame" title="Aperçu PDF" style="flex:1;border:0;width:100%;background:#525659"></iframe>'
      + '<div style="display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid #eef2f7">'
      + '<button id="fp-pdfprev-close" class="btn btn-outline text-sm">Fermer</button>'
      + '<button id="fp-pdfprev-print" class="btn btn-outline text-sm"><i data-lucide="printer" class="w-4 h-4"></i> Imprimer</button>'
      + '<button id="fp-pdfprev-dl" class="btn btn-dark text-sm"><i data-lucide="download" class="w-4 h-4"></i> Télécharger le PDF</button></div></div>';
    document.body.appendChild(ov);
    const close = () => { ov.style.display = 'none'; const f = ov.querySelector('#fp-pdfprev-frame'); try { if (f.src && f.src.indexOf('blob:') === 0) URL.revokeObjectURL(f.src); } catch (e) {} f.src = 'about:blank'; };
    ov.querySelector('#fp-pdfprev-x').onclick = close;
    ov.querySelector('#fp-pdfprev-close').onclick = close;
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    ov.querySelector('#fp-pdfprev-dl').onclick = () => { if (ov._doc) ov._doc.save(ov._name || 'document.pdf'); };
    ov.querySelector('#fp-pdfprev-print').onclick = () => { const f = ov.querySelector('#fp-pdfprev-frame'); try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { if (f.src) window.open(f.src); } };
  }
  ov._doc = doc; ov._name = filename || 'document.pdf';
  ov.querySelector('#fp-pdfprev-sub').textContent = subtitle || '';
  ov.querySelector('#fp-pdfprev-frame').src = doc.output('bloburl') + '#toolbar=1&navpanes=0&view=FitH';
  ov.style.display = 'flex';
  if (window.lucide) try { lucide.createIcons(); } catch (e) {}
};

// IMPORT PAR COLLAGE EXCEL (ou fichier CSV) — bouton monté dans le repère [data-data-io].
// Complète l'import par scan de document : ici on COLLE un tableau (immat, marque, km, chauffeur…)
// copié depuis Excel / Google Sheets, et la plateforme crée/complète les fiches d'un coup — idéal
// pour rattacher un nouveau client dont on a déjà les données. La création réelle, l'ANTI-DOUBLON
// (FP.dupe) et le tag société sont délégués à cfg.onImport (fourni par chaque page). L'export reste
// géré à part par FP.makeExportMenu.
FP.injectDataIO = function (cfg) {
  cfg = cfg || {};
  const cols = (cfg.columns || []).filter(c => c && c.key && !c.readonly);
  // Deux capacités indépendantes : IMPORT (si onImport) et EXPORT Excel (si getRows).
  // ⚠️ RÈGLE PROJET « tout en Excel » : dès qu'une page fournit getRows, injectDataIO
  // pose AUTOMATIQUEMENT un bouton « Exporter (Excel) » (.xlsx), partout, pareil.
  const canImport = typeof cfg.onImport === 'function' && cols.length > 0 && cfg.exportOnly !== true;
  const canExport = typeof cfg.getRows === 'function' && cfg.export !== false && (cfg.columns || []).length > 0;
  if (!canImport && !canExport) return;
  const mount = document.querySelector('[data-data-io]');
  if (!mount || mount.dataset.ioReady === '1') return;
  mount.dataset.ioReady = '1';
  const esc = FP.esc || (s => String(s == null ? '' : s));
  // Normalise un en-tête pour le mapping (sans accents / casse / ponctuation).
  const norm = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const colByHeader = {};
  cols.forEach(c => { colByHeader[norm(c.label)] = c; colByHeader[norm(c.key)] = c; });

  // Découpe un texte CSV/TSV en lignes de cellules, en respectant les guillemets et en
  // détectant le séparateur (TAB pour un collage Excel, sinon ; ou ,).
  function splitRows(text) {
    text = String(text || '').replace(/\r\n?/g, '\n').replace(/\n+$/, '');
    if (!text.trim()) return [];
    const firstLine = text.split('\n')[0];
    const sep = firstLine.indexOf('\t') >= 0 ? '\t'
      : (firstLine.split(';').length > firstLine.split(',').length ? ';' : ',');
    const rows = []; let row = [], field = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += ch;
      } else if (ch === '"') q = true;
      else if (ch === sep) { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += ch;
    }
    row.push(field); rows.push(row);
    return rows;
  }

  function parseText(text) {
    const rows = splitRows(text);
    if (!rows.length) return { records: [], mapped: [], ignored: [] };
    const header = rows[0].map(h => (h || '').trim());
    const map = header.map(h => colByHeader[norm(h)] || null);
    const mapped = [], ignored = [];
    header.forEach((h, i) => { if (map[i]) mapped.push(map[i].label); else if (h) ignored.push(h); });
    const records = [];
    for (let r = 1; r < rows.length; r++) {
      const cells = rows[r];
      if (!cells.some(c => (c || '').trim() !== '')) continue; // saute les lignes vides
      const rec = {};
      cells.forEach((cell, i) => {
        const col = map[i]; if (!col) return;
        let val = (cell == null ? '' : String(cell)).trim();
        if (col.parse) { try { val = col.parse(val); } catch (e) {} }
        rec[col.key] = val;
      });
      if (Object.keys(rec).length) records.push(rec);
    }
    return { records, mapped, ignored };
  }

  // --- Bouton EXPORT (Excel .xlsx) — même standard partout (montants = vraies cellules
  //     numériques, encodage propre, plus de « signes bizarres » du CSV). ---
  if (canExport) {
    const numFmt = (FP.csv && FP.csv.numFormat) || null;
    const expColDefs = (cfg.columns || []).map(c => {
      const isNum = c.number === true || (numFmt && c.format === numFmt);
      return {
        label: c.label, number: isNum, noTotal: c.noTotal === true,
        value: (r) => {
          let v = r[c.key];
          if (isNum) { const n = Number(v); return (v === '' || v == null || !isFinite(n)) ? '' : n; }
          if (c.format && (!numFmt || c.format !== numFmt)) { try { v = c.format(v, r); } catch (e) {} }
          if (Array.isArray(v)) v = v.join(', ');
          return v == null ? '' : v;
        },
      };
    });
    const expBtn = document.createElement('button');
    expBtn.type = 'button';
    expBtn.className = 'btn btn-outline text-sm';
    expBtn.innerHTML = '<i data-lucide="sheet" class="w-4 h-4"></i> Exporter (Excel)';
    expBtn.addEventListener('click', () => {
      let rows = [];
      try { rows = (cfg.getRows() || []).slice(); } catch (e) { rows = []; }
      if (!rows.length) { if (FP.toast) FP.toast('Aucune ligne à exporter (vérifie les filtres).'); return; }
      const baseName = String(cfg.baseName || cfg.filename || 'export').replace(/\.(csv|xlsx|xls)$/i, '');
      if (FP.exportRows) FP.exportRows(baseName, expColDefs, rows, 'xlsx', { sheetName: cfg.sheetName || 'Export', total: !!cfg.total });
      else if (FP.toast) FP.toast('Export Excel indisponible.');
    });
    mount.appendChild(expBtn);
  }

  // --- Bouton IMPORT + modale (uniquement si la page fournit onImport) ---
  if (!canImport) { if (window.lucide) try { lucide.createIcons(); } catch (e) {} return; }
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-outline text-sm';
  btn.innerHTML = '<i data-lucide="clipboard-paste" class="w-4 h-4"></i> Importer (Excel)';
  mount.appendChild(btn);
  if (window.lucide) try { lucide.createIcons(); } catch (e) {}

  const headerModel = cols.map(c => c.label).join('\t');
  let ov = null, parsed = { records: [], mapped: [], ignored: [] };

  function render() {
    const nMap = parsed.mapped.length, nRec = parsed.records.length;
    const prev = ov.querySelector('#fp-io-preview');
    if (!nRec) {
      prev.innerHTML = '<div style="color:#94A3B8;font-size:13px;padding:10px 0">Colle tes cellules ci-dessus (avec la ligne d\'en-têtes) pour voir l\'aperçu.</div>';
    } else {
      const sample = parsed.records.slice(0, 4);
      const rowsHtml = sample.map(r => '<tr>' + parsed.mapped.map(lbl => {
        const col = cols.find(c => c.label === lbl);
        let v = col ? r[col.key] : '';
        if (Array.isArray(v)) v = v.join(', ');
        return '<td style="padding:3px 8px;border-bottom:1px solid #EEF2F7;white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis">' + esc(v == null ? '' : v) + '</td>';
      }).join('') + '</tr>').join('');
      prev.innerHTML =
        '<div style="font-size:13px;color:#334155;margin-bottom:6px"><b>' + nRec + '</b> ligne(s) · <b>' + nMap + '</b> colonne(s) reconnue(s)'
        + (parsed.ignored.length ? ' · <span style="color:#B45309">ignorée(s) : ' + esc(parsed.ignored.join(', ')) + '</span>' : '') + '</div>'
        + (nMap ? '<div style="overflow:auto;border:1px solid #E2E8F0;border-radius:8px"><table style="font-size:12px;border-collapse:collapse;min-width:100%"><thead><tr>'
          + parsed.mapped.map(l => '<th style="text-align:left;padding:4px 8px;background:#F8FAFC;border-bottom:1px solid #E2E8F0;white-space:nowrap">' + esc(l) + '</th>').join('')
          + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div>'
          + (nRec > sample.length ? '<div style="font-size:11px;color:#94A3B8;margin-top:4px">… et ' + (nRec - sample.length) + ' de plus</div>' : '')
          : '<div style="color:#B91C1C;font-size:13px">Aucune colonne reconnue. Vérifie que la 1re ligne contient bien les en-têtes (ex. « Immat. », « Marque »…).</div>');
    }
    const imp = ov.querySelector('#fp-io-import');
    imp.disabled = !nMap || !nRec;
    imp.style.opacity = imp.disabled ? '.5' : '';
    imp.textContent = nRec && nMap ? ('Importer ' + nRec + ' ligne(s)') : 'Importer';
  }

  function open() {
    if (!ov) {
      ov = document.createElement('div');
      ov.setAttribute('style', 'position:fixed;inset:0;z-index:90;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.55);padding:16px');
      ov.innerHTML =
        '<div style="background:#fff;border-radius:16px;max-width:720px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);display:flex;flex-direction:column;max-height:90vh">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #E2E8F0">'
        + '<div style="font-weight:800;color:var(--fp-primary,#0f1d3d)"><i data-lucide="clipboard-paste" class="w-4 h-4" style="display:inline;vertical-align:-2px"></i> Importer par collage (Excel / Google Sheets)</div>'
        + '<button id="fp-io-close" style="border:none;background:transparent;cursor:pointer;color:#94A3B8;font-size:20px;line-height:1">&times;</button></div>'
        + '<div style="padding:18px;overflow:auto">'
        + '<p style="font-size:13px;color:#475569;margin-bottom:8px">Dans Excel/Sheets, sélectionne les cellules <b>avec la ligne d\'en-têtes</b>, copie (Ctrl+C) puis colle ici (Ctrl+V). Colonnes reconnues : <b>' + esc(cols.map(c => c.label).join(' · ')) + '</b>. <button id="fp-io-tpl" type="button" style="border:none;background:transparent;color:var(--fp-accent,#F97316);font-weight:700;cursor:pointer;padding:0">Copier la ligne d\'en-têtes</button></p>'
        + '<textarea id="fp-io-text" placeholder="Colle ici tes cellules…" style="width:100%;min-height:120px;border:1px solid #CBD5E1;border-radius:8px;padding:8px 10px;font-family:ui-monospace,monospace;font-size:12px;resize:vertical"></textarea>'
        + '<div style="display:flex;align-items:center;gap:10px;margin:8px 0 12px"><label style="font-size:12px;color:#64748b;cursor:pointer;display:inline-flex;align-items:center;gap:6px"><i data-lucide="file-up" class="w-4 h-4"></i> …ou charger un fichier CSV <input id="fp-io-file" type="file" accept=".csv,text/csv,text/plain" style="display:none"></label></div>'
        + '<div id="fp-io-preview"></div>'
        + '</div>'
        + '<div style="display:flex;gap:10px;padding:14px 18px;border-top:1px solid #E2E8F0">'
        + '<button id="fp-io-cancel" class="btn btn-outline text-sm" style="flex:1;justify-content:center">Annuler</button>'
        + '<button id="fp-io-import" class="btn btn-dark text-sm" style="flex:1;justify-content:center" disabled><i data-lucide="check" class="w-4 h-4"></i> <span>Importer</span></button>'
        + '</div></div>';
      document.body.appendChild(ov);
      if (window.lucide) try { lucide.createIcons(); } catch (e) {}
      const close = () => { ov.style.display = 'none'; };
      ov.querySelector('#fp-io-close').onclick = close;
      ov.querySelector('#fp-io-cancel').onclick = close;
      const ta = ov.querySelector('#fp-io-text');
      const reparse = () => { parsed = parseText(ta.value); render(); };
      ta.addEventListener('input', reparse);
      ov.querySelector('#fp-io-tpl').onclick = () => {
        try { navigator.clipboard && navigator.clipboard.writeText(headerModel); } catch (e) {}
        if (FP.toast) FP.toast('✓ Ligne d\'en-têtes copiée — colle-la en 1re ligne de ton tableau si besoin');
      };
      ov.querySelector('#fp-io-file').addEventListener('change', (e) => {
        const f = (e.target.files || [])[0]; if (!f) return;
        const rd = new FileReader();
        rd.onload = () => { ta.value = String(rd.result || ''); reparse(); };
        rd.readAsText(f, 'utf-8');
      });
      ov.querySelector('#fp-io-import').onclick = async () => {
        if (!parsed.records.length) return;
        const imp = ov.querySelector('#fp-io-import');
        imp.disabled = true; imp.style.opacity = '.6';
        try { await cfg.onImport(parsed.records.slice()); } catch (err) { console.error('[injectDataIO onImport]', err); if (FP.toast) FP.toast('Import : une erreur est survenue (voir console).'); }
        close();
        ta.value = ''; parsed = { records: [], mapped: [], ignored: [] };
      };
    }
    ov.querySelector('#fp-io-text').value = '';
    parsed = { records: [], mapped: [], ignored: [] };
    render();
    ov.style.display = 'flex';
    setTimeout(() => { try { ov.querySelector('#fp-io-text').focus(); } catch (e) {} }, 30);
  }

  btn.addEventListener('click', open);
};

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

// =====================================================================
// === Confort transversal : Annuler (undo), contacts cliquables, bouton +, tour, vue mobile ===
// =====================================================================

// ⚠️ RÈGLE PROJET — après une SUPPRESSION, proposer « Annuler » via ce helper.
// FP.undoToast(message, onUndo) : toast avec bouton « ↶ Annuler » qui restaure. onUndo DOIT
// ré-insérer la donnée (tableau EN MÉMOIRE + FP.persist.insert) — cf. usages factures/amendes/sinistres.
FP.undoToast = (message, onUndo, opts) =>
  FP.toast(message, Object.assign({ actionLabel: '↶ Annuler', onAction: onUndo, duration: 7000 }, opts || {}));

// Coordonnées d'un conducteur (par nom/prénom) → { tel, email } depuis la table conducteurs.
FP.conducteurContact = (name) => {
  try {
    const norm = (x) => FP.normPrenom ? FP.normPrenom(x) : String(x || '').toLowerCase().trim();
    const n = norm(name); if (!n) return {};
    const list = (window.FP_DATA && Array.isArray(FP_DATA.conducteurs)) ? FP_DATA.conducteurs : [];
    const c = list.find(c => [c.name, c.prenom, c.key, c.nom].filter(Boolean).map(norm).includes(n));
    return c ? { tel: c.tel || '', email: c.email || '' } : {};
  } catch (e) { return {}; }
};
// Puces cliquables tel:/mailto: + bouton copier — réutilisable partout où un conducteur apparaît.
FP.contactChips = (name) => {
  const { tel, email } = FP.conducteurContact(name);
  if (!tel && !email) return '';
  const esc = FP.esc || (x => x);
  const chip = (href, icon, txt, lbl) =>
    `<a href="${href}" class="fp-contact-chip"><i data-lucide="${icon}" style="width:13px;height:13px"></i> ${esc(txt)}</a>`
    + `<button type="button" class="fp-contact-copy" data-copy="${esc(txt)}" title="Copier ${lbl}"><i data-lucide="copy" style="width:12px;height:12px"></i></button>`;
  let out = '<span class="fp-contact-wrap">';
  if (tel) out += chip('tel:' + String(tel).replace(/\s+/g, ''), 'phone', tel, 'le téléphone');
  if (email) out += chip('mailto:' + email, 'mail', email, "l'e-mail");
  return out + '</span>';
};
// Écoute globale du « copier » des contacts (délégué au document).
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('.fp-contact-copy'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const v = b.getAttribute('data-copy') || '';
  try { if (FP.copy) FP.copy(v); else if (navigator.clipboard) navigator.clipboard.writeText(v); } catch (_) {}
  if (FP.toast) FP.toast('✓ Copié : ' + v);
});

// Bouton « + » flottant (quick-add) : accès rapide aux ajouts fréquents depuis n'importe quelle page
// applicative. Chaque lien pointe vers la page cible + hash #add ; la page ouvre alors son formulaire
// « Nouveau… » via l'élément portant l'attribut data-quickadd (géré ci-dessous).
FP.injectQuickAdd = () => {
  try {
    if (document.getElementById('fp-fab') || !document.body) return;
    const path = location.pathname;
    // Pas de FAB sur login / pages publiques / supports de vente / pages de lecture seule.
    if (/login|brochure|prix|logos|carte|avis|demo|kit-commercial|guide|manuel|aide|ecran/i.test(path)) return;
    const inPages = /\/pages\//.test(path);
    const pref = inPages ? '' : 'pages/';
    const items = [
      { label: 'Nouveau véhicule', icon: 'car',           href: 'vehicules.html#add' },
      { label: 'Nouvelle amende',  icon: 'ticket',        href: 'amendes.html#add' },
      { label: 'Nouvelle facture', icon: 'receipt',       href: 'factures.html#add' },
      { label: 'Nouveau sinistre', icon: 'alert-octagon', href: 'sinistres.html#add' },
    ];
    const fab = document.createElement('div');
    fab.id = 'fp-fab';
    fab.innerHTML =
      `<div class="fp-fab-menu" id="fp-fab-menu">${items.map(i => `<a href="${pref}${i.href}" class="fp-fab-item"><i data-lucide="${i.icon}"></i> ${i.label}</a>`).join('')}</div>`
      + `<button type="button" class="fp-fab-btn" id="fp-fab-btn" title="Ajouter" aria-label="Ajouter rapidement"><i data-lucide="plus"></i></button>`;
    document.body.appendChild(fab);
    const btn = fab.querySelector('#fp-fab-btn');
    btn.addEventListener('click', (e) => { e.stopPropagation(); fab.classList.toggle('open'); });
    document.addEventListener('click', () => fab.classList.remove('open'));
    if (window.lucide) lucide.createIcons();
  } catch (e) {}
};
// Ouverture directe d'un formulaire « Nouveau… » quand on arrive avec #add (depuis le bouton +).
// La page doit poser l'attribut data-quickadd sur son bouton « Nouveau… ».
FP.handleQuickAddHash = () => {
  try {
    if (location.hash !== '#add') return;
    const trigger = () => { const el = document.querySelector('[data-quickadd]'); if (el) { el.click(); return true; } return false; };
    if (!trigger()) document.addEventListener('fp:data-ready', () => setTimeout(trigger, 60), { once: true });
    // Nettoie le hash pour ne pas rouvrir au rechargement
    try { history.replaceState(null, '', location.pathname + location.search); } catch (_) {}
  } catch (e) {}
};

// Vue mobile « en cartes » : sur petit écran, chaque ligne de .fp-table devient une carte, avec le
// libellé de colonne à gauche de la valeur. On copie les en-têtes du <thead> dans data-label des <td>
// (le CSS fait le reste). Générique → s'applique à TOUS les tableaux du site, sans les réécrire.
FP.mobileCardify = (root) => {
  try {
    if (!window.matchMedia || !matchMedia('(max-width: 640px)').matches) return;
    (root || document).querySelectorAll('table.fp-table').forEach(tbl => {
      const ths = [...tbl.querySelectorAll('thead th')].map(th => (th.textContent || '').trim());
      if (!ths.length) return;
      tbl.querySelectorAll('tbody tr').forEach(tr => {
        [...tr.children].forEach((td, i) => { if (td.tagName === 'TD' && ths[i] && !td.hasAttribute('data-label')) td.setAttribute('data-label', ths[i]); });
      });
    });
  } catch (e) {}
};

// Petit tour guidé à la 1re visite (dashboard). Ignorable ; « ne plus afficher » mémorisé en local.
FP.injectTour = (force) => {
  try {
    if (!document.body) return;
    const KEY = 'fp_tour_v1_done';
    if (!force) { if (!/dashboard/i.test(location.pathname)) return; if (localStorage.getItem(KEY) === '1') return; }
    if (document.getElementById('fp-tour')) return;
    const steps = [
      { t: 'Bienvenue sur Parc Pilot 👋', d: "Voici un tour express (30 s) des grands repères. Vous pourrez le revoir depuis le Manuel." },
      { t: '📊 Tableau de bord', d: "Vos chiffres clés en un coup d'œil : véhicules, coûts du mois, amendes à payer, alertes." },
      { t: '🔔 Suivi & alertes', d: "Tout ce qui arrive à échéance (contrôle technique, assurance, révision, fin de leasing) et un onglet « À compléter » qui liste ce qui reste à renseigner." },
      { t: '🚗 Vos véhicules', d: "Une fiche par véhicule : documents, coûts, €/km, leasing, journal. Épinglez vos favoris avec l'étoile ⭐." },
      { t: '➕ Bouton d\'ajout rapide', d: "En bas à droite, le bouton « + » ajoute un véhicule, une amende, une facture ou un sinistre depuis n'importe quelle page." },
      { t: '🔎 Recherche & aide', d: "La barre de recherche (en haut de la colonne de gauche, ou Ctrl+K) trouve tout. Le Manuel explique chaque écran en détail." },
    ];
    let i = 0;
    const ov = document.createElement('div'); ov.id = 'fp-tour';
    ov.innerHTML =
      `<div class="fp-tour-card">
         <button type="button" class="fp-tour-skip" title="Fermer">✕</button>
         <div class="fp-tour-title"></div>
         <div class="fp-tour-desc"></div>
         <div class="fp-tour-dots"></div>
         <div class="fp-tour-actions">
           <label class="fp-tour-never"><input type="checkbox" class="fp-tour-never-cb"> Ne plus afficher</label>
           <div style="display:flex;gap:.5rem;margin-left:auto">
             <button type="button" class="fp-tour-btn fp-tour-prev">Précédent</button>
             <button type="button" class="fp-tour-btn primary fp-tour-next">Suivant</button>
           </div>
         </div>
       </div>`;
    document.body.appendChild(ov);
    const q = (s) => ov.querySelector(s);
    const render = () => {
      q('.fp-tour-title').textContent = steps[i].t;
      q('.fp-tour-desc').textContent = steps[i].d;
      q('.fp-tour-dots').innerHTML = steps.map((_, k) => `<span class="fp-tour-dot${k === i ? ' on' : ''}"></span>`).join('');
      q('.fp-tour-prev').style.visibility = i === 0 ? 'hidden' : 'visible';
      q('.fp-tour-next').textContent = i === steps.length - 1 ? 'Terminer' : 'Suivant';
    };
    const close = () => { if (q('.fp-tour-never-cb').checked || i >= steps.length - 1) { try { localStorage.setItem(KEY, '1'); } catch (_) {} } ov.remove(); };
    q('.fp-tour-skip').addEventListener('click', () => { try { localStorage.setItem(KEY, '1'); } catch (_) {} ov.remove(); });
    q('.fp-tour-prev').addEventListener('click', () => { if (i > 0) { i--; render(); } });
    q('.fp-tour-next').addEventListener('click', () => { if (i < steps.length - 1) { i++; render(); } else close(); });
    ov.addEventListener('click', (e) => { if (e.target === ov) { /* clic hors carte = ne ferme pas (évite fermeture accidentelle) */ } });
    render();
  } catch (e) {}
};

// Pop « nouveauté » (feature discovery) : présente UNE fonctionnalité à la fois (dashboard), avec
// « Ne plus proposer ». Idéal pour un nouveau client (ou soi-même) qui découvre la plateforme.
FP.featureTip = () => {
  try {
    if (!document.body || !/dashboard/i.test(location.pathname)) return;
    if (document.getElementById('fp-tour') || document.getElementById('fp-nf')) return; // pas en même temps que le tour
    const TIPS = [
      { id: 'shortcuts', t: 'Personnalise tes raccourcis', m: 'Le bouton « ⚡ Raccourcis » en haut : choisis les actions à afficher (km, immobilisé, scan…).' },
      { id: 'favoris',   t: 'Épingle tes véhicules',       m: "Clique l'étoile ⭐ au bout d'une ligne véhicule pour la remonter en tête de liste." },
      { id: 'compare',   t: 'Compare 2 véhicules',         m: 'Onglet Véhicules → bouton « Comparer » : coûts, €/km, TVS, leasing côte à côte.' },
      { id: 'kmphoto',   t: 'Relève le km en photo',       m: 'Raccourcis → « Km par photo » : tu photographies le compteur, l\'IA lit le kilométrage.' },
      { id: 'fab',       t: 'Ajout rapide partout',        m: 'Le bouton « + » en bas à droite ajoute véhicule/amende/facture/sinistre depuis n\'importe quelle page.' },
      { id: 'antai',     t: 'Désigner sur ANTAI',          m: 'Fiche d\'une amende → « Désigner sur ANTAI » ouvre le site officiel et copie le n° d\'avis.' },
      { id: 'tva',       t: 'TVA récupérable',             m: 'Onglet Factures → « Coût par période » affiche la TVA récupérable (pour le comptable).' },
      { id: 'immobilise',t: 'Suis les immobilisations',    m: 'Raccourcis → « Marquer un véhicule immobilisé » : alerte si un véhicule reste trop longtemps au garage.' },
    ];
    const seen = (() => { try { return (FP.settings.get().featureTipsSeen) || []; } catch (e) { return []; } })();
    const tip = TIPS.find(t => !seen.includes(t.id)); if (!tip) return;
    const el = document.createElement('div'); el.id = 'fp-nf'; el.className = 'fp-nf';
    const esc = FP.esc || (x => x);
    el.innerHTML = `<div class="fp-nf-head"><span>💡 ${esc(tip.t)}</span><button class="fp-nf-x" title="Fermer">✕</button></div>`
      + `<div class="fp-nf-body">${esc(tip.m)}</div>`
      + `<div class="fp-nf-actions"><button type="button" class="fp-nf-never">Ne plus proposer</button><button type="button" class="fp-nf-ok">OK, compris</button></div>`;
    document.body.appendChild(el);
    const seeIt = (all) => { try { const s = FP.settings.get(); s.featureTipsSeen = all ? TIPS.map(t => t.id) : ((s.featureTipsSeen || []).concat([tip.id])); FP.settings.save(s); } catch (e) {} el.remove(); };
    el.querySelector('.fp-nf-x').onclick = () => seeIt(false);
    el.querySelector('.fp-nf-ok').onclick = () => seeIt(false);
    el.querySelector('.fp-nf-never').onclick = () => seeIt(true);
  } catch (e) {}
};

// Flèche « ← Retour » en haut de chaque page : revient à la page précédente (page/onglet d'où l'on
// vient). N'apparaît QUE si l'on arrive d'une autre page DU SITE (sinon « retour » n'a pas de sens).
FP.injectBackButton = () => {
  try {
    if (!document.body || document.getElementById('fp-back')) return;
    // Pas de « Retour » sur les pages « racine »/accueil (le tableau de bord notamment) ni sur les
    // pages publiques : le retour n'y mène nulle part d'utile.
    if (/dashboard|index|login|brochure|prix|logos|carte|avis|ecran|demo/i.test(location.pathname)) return;
    let sameApp = false;
    try { const r = document.referrer ? new URL(document.referrer) : null; sameApp = !!r && r.host === location.host && r.pathname !== location.pathname; } catch (e) {}
    if (!sameApp) return;
    const main = document.querySelector('main') || document.body;
    const b = document.createElement('button');
    b.id = 'fp-back'; b.type = 'button'; b.className = 'fp-back'; b.title = 'Revenir à la page précédente';
    b.innerHTML = '<i data-lucide="arrow-left" style="width:15px;height:15px"></i> Retour';
    b.addEventListener('click', () => { history.back(); });
    main.insertBefore(b, main.firstChild);
    if (window.lucide) lucide.createIcons();
  } catch (e) {}
};

// Navigation active state (sidebar)
document.addEventListener('DOMContentLoaded', () => {
  // Appliquer le thème (couleurs des groupes) dès le chargement
  FP.settings.applyTheme();
  FP.injectBackButton();
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
  FP.buildJisMenu();   // onglet privé « JIS » (propriétaire uniquement)
  if (_isAdmin) FP.enableNavReorder(); // glisser-déposer des onglets (admin only)
  // Appliquer les textes éditables custom (titres, sous-titres)
  FP.applyCustomTexts();
  // Injecter la barre de recherche globale dans toutes les sidebars
  FP.injectGlobalSearch();
  // Injecter le bouton déconnexion en bas des sidebars
  FP.injectLogoutButton();
  // Confort transversal : bouton « + » flottant, ouverture directe #add, vue mobile en cartes, tour guidé
  FP.injectQuickAdd();
  FP.handleQuickAddHash();
  FP.mobileCardify(document);
  window.addEventListener('fp:data-ready', () => { try { FP.mobileCardify(document); } catch (e) {} });
  window.addEventListener('resize', () => { try { FP.mobileCardify(document); } catch (e) {} });
  FP.injectTour();
  setTimeout(() => { try { FP.featureTip(); } catch (e) {} }, 2500); // pop « nouveauté » (après le tour éventuel)

  // Animations 3D au survol des bulles KPI (global — validé). La carte s'incline vers le
  // curseur + reflet qui suit la souris. Ré-appliqué après un re-rendu de données
  // (fp:data-ready) pour les cartes recréées. Respecte prefers-reduced-motion.
  FP.enable3DTilt = () => {
    try {
      if (!window.matchMedia || !matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
      document.querySelectorAll('.kpi').forEach(card => {
        if (!card.querySelector('.fp-glare')) { const g = document.createElement('span'); g.className = 'fp-glare'; card.appendChild(g); }
        if (card.dataset.fpTilt) return; card.dataset.fpTilt = '1';
        let raf = 0;
        card.addEventListener('pointermove', (e) => {
          if (e.pointerType === 'touch') return;
          const r = card.getBoundingClientRect(); if (!r.width) return;
          const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
          if (raf) cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => {
            const rx = (0.5 - py) * 8, ry = (px - 0.5) * 8;
            card.style.transform = `perspective(720px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-3px)`;
            const g = card.querySelector('.fp-glare'); if (g) { g.style.setProperty('--gx', (px * 100).toFixed(1) + '%'); g.style.setProperty('--gy', (py * 100).toFixed(1) + '%'); }
          });
        });
        card.addEventListener('pointerleave', () => { if (raf) cancelAnimationFrame(raf); card.style.transform = ''; });
      });
    } catch (e) { /* effet purement cosmétique */ }
  };
  FP.enable3DTilt();
  window.addEventListener('fp:data-ready', () => { try { FP.enable3DTilt(); } catch (e) {} });

  // Rappel de sauvegarde (anti-perte) : RÉSERVÉ AU CEO (la sauvegarde complète est une action CEO),
  // et seulement une fois connecté (ce code ne tourne que dans l'app, après l'auth guard). UNE fois par
  // session, si aucune sauvegarde ou trop ancienne (> 30 jours) → petit rappel non bloquant vers Paramètres.
  (function backupReminder() {
    try {
      if (!(FP.isCEO && FP.isCEO())) return;
      // Sur téléphone : pas de rappel de sauvegarde (télécharger un fichier de sauvegarde n'a
      // pas de sens sur mobile, et le pop-up gêne). Réservé aux écrans larges (ordinateur).
      try { if (window.matchMedia && window.matchMedia('(max-width: 820px)').matches) return; } catch (e) {}
      if (sessionStorage.getItem('fp_backup_reminded') === '1') return;
      let iso = ''; try { iso = localStorage.getItem('fp_last_backup') || ''; } catch (e) {}
      const stale = !iso || (Date.now() - new Date(iso).getTime()) > 30 * 86400000;
      if (!stale) return;
      sessionStorage.setItem('fp_backup_reminded', '1');
      setTimeout(() => {
        if (!FP.toast) return;
        FP.toast('💾 Pense à télécharger une sauvegarde de tes données', {
          actionLabel: 'Sauvegarder', onAction: () => { location.href = (FP._pagePrefix ? FP._pagePrefix() : '') + 'parametres.html'; }
        });
      }, 2500);
    } catch (e) {}
  })();

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
    // ⚠️ La fermeture (clic ailleurs / Échap) pose un `display:none` EN LIGNE sur la liste ; un
    // style inline l'emporte sur la classe .open → sans ça, retaper ne réaffiche plus rien (il
    // fallait rafraîchir la page). On efface donc l'inline à chaque ré-affichage.
    results.style.display = '';
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
