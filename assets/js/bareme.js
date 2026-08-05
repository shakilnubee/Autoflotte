/* ============================================================
   BARÈME TARIFAIRE — SOURCE UNIQUE (JIS)
   Lu par : bareme.html (édition), devis.html + contrat.html (générateurs), prix.html (calculateur).
   Stocké dans localStorage (clé 'pp_bareme') → modifiable sur le site, partagé sur le même navigateur.
   Tranches FIXES (≤10 / 11-20 / 21-50 / 50+) ; seuls les MONTANTS sont réglables.
   ============================================================ */
(function () {
  var KEY = 'pp_bareme';
  var DEFAULTS = {
    logicielVeh: 15,   // € / véhicule / mois — part logiciel (info / décomposition)
    gestionVeh: 25,    // € / véhicule / mois — part gestion (info / décomposition)
    minMensuel: 390,   // facturation MINIMUM / mois (tranche 1 à 10 véhicules)
    r1: 40,            // € / véhicule / mois — de 11 à 20 véhicules
    r2: 35,            // € / véhicule / mois — de 21 à 50 véhicules
    r3: 30,            // € / véhicule / mois — au-delà de 50 véhicules
    mes: 390           // mise en service (reprise + intégration) — OFFERTE si engagement annuel
  };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function num(v, d) { v = Number(v); return (isFinite(v) && v >= 0) ? v : d; }
  function get() {
    var b = clone(DEFAULTS);
    try {
      var s = JSON.parse(localStorage.getItem(KEY)) || {};
      ['logicielVeh', 'gestionVeh', 'minMensuel', 'r1', 'r2', 'r3', 'mes'].forEach(function (k) {
        if (s[k] != null) b[k] = num(s[k], b[k]);
      });
    } catch (e) {}
    return b;
  }
  function save(obj) {
    var b = get();
    ['logicielVeh', 'gestionVeh', 'minMensuel', 'r1', 'r2', 'r3', 'mes'].forEach(function (k) {
      if (obj && obj[k] != null) b[k] = num(obj[k], b[k]);
    });
    try { localStorage.setItem(KEY, JSON.stringify(b)); } catch (e) {}
    pushRemote(b); // synchro tous appareils
    return b;
  }
  function reset() { try { localStorage.removeItem(KEY); } catch (e) {} pushRemote(clone(DEFAULTS)); return clone(DEFAULTS); }

  // ===== Synchro TOUS APPAREILS (Supabase app_settings, id='bareme') =====
  // localStorage = simple cache rapide ; la SOURCE partagée est Supabase (propriétaire connecté).
  var SB_URL = 'https://tzjuptlzoywjeigmyfuj.supabase.co';
  var SB_KEY = 'sb_publishable_KC3TZ1zda-ja-0wkyjHUlg_aKohD6tq';
  function sb() {
    try {
      if (window.__ppSB) return window.__ppSB;
      if (window.supabase && window.supabase.createClient) { window.__ppSB = window.supabase.createClient(SB_URL, SB_KEY); return window.__ppSB; }
    } catch (e) {}
    return null;
  }
  function clean(obj) { var b = {}; ['logicielVeh', 'gestionVeh', 'minMensuel', 'r1', 'r2', 'r3', 'mes'].forEach(function (k) { if (obj && obj[k] != null) b[k] = num(obj[k], DEFAULTS[k]); }); return b; }
  function pushRemote(b) { var c = sb(); if (!c) return; try { c.from('app_settings').upsert({ id: 'bareme', data: clean(b) }).then(function () {}, function () {}); } catch (e) {} }
  // Récupère le barème serveur, met à jour le cache local, prévient les pages (pp:bareme-ready).
  function pull() {
    var c = sb(); if (!c) return Promise.resolve(null);
    return c.from('app_settings').select('data').eq('id', 'bareme').maybeSingle().then(function (r) {
      if (r && r.data && r.data.data) { try { localStorage.setItem(KEY, JSON.stringify(clean(r.data.data))); } catch (e) {} try { window.dispatchEvent(new Event('pp:bareme-ready')); } catch (e) {} return r.data.data; }
      return null;
    }, function () { return null; });
  }
  // Tarif au véhicule pour un nombre donné (null = forfait minimum, ≤ 10 véhicules).
  function tarifVeh(nb, b) { b = b || get(); nb = Math.max(1, nb || 1); if (nb <= 10) return null; if (nb <= 20) return b.r1; if (nb <= 50) return b.r2; return b.r3; }
  // Montant mensuel total (minimum garanti).
  function tarifMensuel(nb, b) { b = b || get(); nb = Math.max(1, nb || 1); var pv = tarifVeh(nb, b); return (pv == null) ? b.minMensuel : Math.max(b.minMensuel, pv * nb); }
  window.PP_BAREME = { KEY: KEY, defaults: function () { return clone(DEFAULTS); }, get: get, save: save, reset: reset, tarifVeh: tarifVeh, tarifMensuel: tarifMensuel, pull: pull };
  // Au chargement : on récupère le barème serveur (si connecté) → cache local à jour sur CE poste.
  try { pull(); } catch (e) {}
})();
