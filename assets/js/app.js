// Auto-flotte — helpers JS partagés

const FP = {
  // Format euro
  euro(n) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
  },
  euroPrecis(n) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
  },
  // Format date FR
  date(iso) {
    if (!iso || iso === '—') return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  },
  // Nombre formaté
  num(n) {
    return new Intl.NumberFormat('fr-FR').format(n);
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
    if (v.carburant === 'Électrique') return 0;
    const base = v.carburant === 'Hybride' ? 80 : 180;
    const surcout = Math.round(v.km / 10000) * 12;
    return base + surcout;
  },
};

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
// Onglets réservés à l'admin (retirés du menu pour les autres rôles)
FP.ADMIN_ONLY_NAV = ['parametres.html'];

// === Paramètres utilisateur persistés (localStorage) ===
FP.settings = {
  STORAGE_KEY: 'auto_flotte_settings',
  defaults: {
    groupes: {
      'siege':       { label: 'Siège',       color: '#F59E0B' },
      'commerciaux': { label: 'Commerciaux', color: '#CA8A04' },
      'gov':         { label: 'Gov',         color: '#10B981' },
      'pool':        { label: 'Pool',        color: '#84CC16' },
      'a-vendre':    { label: 'À vendre',    color: '#DC2626' },
      'retail':      { label: 'Retail',      color: '#8B5CF6' },
      'depot':       { label: 'Dépôt',       color: '#3B82F6' },
      'non-classe':  { label: 'Non classé',  color: '#94A3B8' },
    },
    societe: { nom: 'Auto-flotte', siret: '', adresse: '' },
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
  },
  reset() {
    localStorage.removeItem(this.STORAGE_KEY);
    this.applyTheme();
  },
  applyTheme() {
    const s = this.get();
    Object.entries(s.groupes).forEach(([k, v]) => {
      document.documentElement.style.setProperty(`--grp-${k}`, v.color);
    });
  },
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
    if (diff < 0)        out.push({ niveau: 'danger', categorie: 'Contrôle technique', message: `CT dépassé de ${-diff}j`, detail: veh, sort: diff, target: 'vehicules.html' });
    else if (diff < 30)  out.push({ niveau: 'danger', categorie: 'Contrôle technique', message: `CT à faire dans ${diff}j`, detail: veh, sort: diff, target: 'vehicules.html' });
    else if (diff < 60)  out.push({ niveau: 'warn',   categorie: 'Contrôle technique', message: `CT à prévoir dans ${diff}j`, detail: veh, sort: diff, target: 'vehicules.html' });
    else if (diff < 90)  out.push({ niveau: 'info',   categorie: 'Contrôle technique', message: `CT dans ~2 mois (${diff}j)`, detail: veh, sort: diff, target: 'vehicules.html' });
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

  // --- Véhicules sans dernière révision enregistrée (info) ---
  const sansRev = (data.vehicules || []).filter(v => v.statut === 'actif' && (!v.derniereRevision || v.derniereRevision === '—') && (!v.chauffeur || v.chauffeur !== 'VENDU')).length;
  if (sansRev > 5) {
    out.push({ niveau: 'info', categorie: 'Maintenance', message: `${sansRev} véhicules sans dernière révision enregistrée`, detail: 'À compléter pour le suivi maintenance', sort: 2000, target: 'vehicules.html' });
  }

  const order = { danger: 0, warn: 1, info: 2 };
  out.sort((a, b) => (order[a.niveau] - order[b.niveau]) || (a.sort - b.sort));
  return out;
};
FP.persist = {
  available() { return !!(FP.db && FP.supabase); },
  _err(e) {
    console.error('[FP.persist]', e);
    alert("⚠️ Action appliquée à l'écran, mais l'enregistrement dans la base a échoué :\n" + (e.message || e) + "\n\nÇa risque de ne pas être conservé après rechargement.");
  },
  async insert(table, row) { if (!this.available()) return; try { const r = await FP.db.insert(table, row); if (r && r.error) throw r.error; } catch (e) { this._err(e); } },
  async upsert(table, row) { if (!this.available()) return; try { const r = await FP.db.upsert(table, row); if (r && r.error) throw r.error; } catch (e) { this._err(e); } },
  async update(table, id, fields) { if (!this.available()) return; try { const r = await FP.db.update(table, id, fields); if (r && r.error) throw r.error; } catch (e) { this._err(e); } },
  async delete(table, id) { if (!this.available()) return; try { const r = await FP.db.delete(table, id); if (r && r.error) throw r.error; } catch (e) { this._err(e); } },
};
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
      if (FP.isAdmin()) { // renommage d'onglet réservé à l'admin
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
// Applique les overrides sauvegardés sur FP_DATA.vehicules (à appeler au chargement de la page)
FP.loadVehicleOverrides = () => {
  if (!window.FP_DATA || !window.FP_DATA.vehicules) return;
  const overrides = FP.getVehicleOverrides();
  window.FP_DATA.vehicules.forEach(v => {
    if (overrides[v.id]) Object.assign(v, overrides[v.id]);
  });
};

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
  const editable = (window.FP && FP.isAdmin) ? FP.isAdmin() : true; // perso. colonnes = admin only
  const storageKey = `fp_table_${pageKey}`;
  const allKeys = columns.map(c => c.key);
  const defaultOrder = config.defaultOrder || allKeys.slice();

  function getCfg() {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
      const order = Array.isArray(stored.order) ? stored.order.filter(k => allKeys.includes(k)) : null;
      return {
        order: (order && order.length) ? order : defaultOrder.slice(),
        hidden: Array.isArray(stored.hidden) ? stored.hidden : [],
        labels: (stored.labels && typeof stored.labels === 'object') ? stored.labels : {},
      };
    } catch { return { order: defaultOrder.slice(), hidden: [], labels: {} }; }
  }
  function saveCfg(cfg) { localStorage.setItem(storageKey, JSON.stringify(cfg)); }
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
      out.push({ type: 'véh.', icon: '🚗', label: `${v.immat} · ${v.marque} ${v.modele}`.trim(), sub: v.chauffeur || '', url: pref + 'vehicules.html' });
    }
  });
  (window.FP_DATA?.amendes || []).forEach(a => {
    const text = `${a.prenom || ''} ${a.motif || ''} ${a.numeroAvis || ''}`.toLowerCase();
    if (text.includes(q)) {
      out.push({ type: 'amende', icon: '🎫', label: `${a.prenom} · ${a.motif}`, sub: `${a.montant ? FP.euroPrecis(a.montant) : ''} · ${FP.date(a.date)}`, url: pref + 'amendes.html' });
    }
  });
  (window.FP_DATA?.factures || []).forEach(f => {
    const text = `${f.vehiculeImmat || ''} ${f.fournisseur || ''} ${f.description || ''} ${f.numeroFacture || ''}`.toLowerCase();
    if (text.includes(q)) {
      out.push({ type: f.type || 'fact.', icon: f.type === 'sinistre' ? '⚠️' : '📄', label: `${f.vehiculeImmat} · ${f.fournisseur || ''}`, sub: `${f.description ? f.description.slice(0,60) : ''}`, url: pref + (f.type === 'sinistre' ? 'sinistres.html' : 'factures.html') });
    }
  });
  return out;
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

  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('[data-nav]').forEach(el => {
    if (el.dataset.nav === path) el.classList.add('active');
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
    if (!FP.isAdmin()) return; // édition des titres réservée à l'admin
    // Ignorer si on est en train de cliquer sur un autre bouton/lien
    if (e.target.closest('button, a, input, select')) return;
    FP.startTextEdit(el);
  });

  // Mobile menu toggle (landing)
  const burger = document.getElementById('burger');
  const menu = document.getElementById('mobile-menu');
  if (burger && menu) burger.addEventListener('click', () => menu.classList.toggle('hidden'));
});
