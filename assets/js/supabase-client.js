// Auto-flotte — client Supabase (backend)
// Le SDK officiel doit être chargé AVANT ce fichier via :
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

(function () {
  const SUPABASE_URL = 'https://tzjuptlzoywjeigmyfuj.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_KC3TZ1zda-ja-0wkyjHUlg_aKohD6tq';

  if (typeof window === 'undefined' || !window.supabase || !window.supabase.createClient) {
    console.error('[supabase-client] Le SDK @supabase/supabase-js n\'est pas chargé. Ajoute <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script> avant ce fichier.');
    return;
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  window.FP = window.FP || {};
  FP.supabase = client;

  // Envoi d'e-mail via l'Edge Function 'send-email' (la clé Resend reste SECRÈTE côté serveur).
  // Rejette si la fonction n'est pas (encore) déployée → l'appelant peut alors se replier sur Gmail.
  // msg = { to, cc?, subject, html?, text?, replyTo? }
  FP.sendEmail = async (msg) => {
    if (client.functions && typeof client.functions.invoke === 'function') {
      const { data, error } = await client.functions.invoke('send-email', { body: msg });
      if (error) throw error;
      if (data && data.error) throw new Error(data.error);
      return data;
    }
    // Repli : appel direct de l'endpoint avec le jeton de l'utilisateur connecté
    let jwt = SUPABASE_KEY;
    try { const t = JSON.parse(localStorage.getItem('sb-tzjuptlzoywjeigmyfuj-auth-token') || '{}'); if (t && t.access_token) jwt = t.access_token; } catch (_) {}
    const res = await fetch(SUPABASE_URL + '/functions/v1/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + jwt },
      body: JSON.stringify(msg),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || (d && d.error)) throw new Error((d && d.error) || ('HTTP ' + res.status));
    return d;
  };

  // ===== Authentification =====
  // Détermine le chemin vers login.html selon le contexte (racine vs sous-dossier pages/)
  const loginPath = window.location.pathname.includes('/pages/') ? '../login.html' : 'login.html';

  FP.auth = {
    async getUser() {
      const { data: { session } } = await client.auth.getSession();
      return session ? session.user : null;
    },
    async getSession() {
      const { data: { session } } = await client.auth.getSession();
      return session;
    },
    async signOut() {
      await client.auth.signOut();
      window.location.href = loginPath;
    },
    /** Force la présence d'une session, sinon redirige vers /login.html */
    async requireAuth() {
      const user = await this.getUser();
      if (!user) {
        window.location.href = loginPath;
        return null;
      }
      return user;
    },
  };

  // Si "Se souvenir de moi" n'était pas coché ET que le navigateur a été fermé entre-temps,
  // on nettoie la session pour forcer une reconnexion (sessionStorage est vidé à la fermeture).
  const rememberMe = localStorage.getItem('fp_remember_me') === '1';
  const sessionAlive = sessionStorage.getItem('fp_session_alive') === '1';
  if (!rememberMe && !sessionAlive) {
    // L'utilisateur ne voulait pas être mémorisé, et c'est une nouvelle session navigateur
    localStorage.removeItem('sb-tzjuptlzoywjeigmyfuj-auth-token');
  }
  // Marqueur pour cette session navigateur (sera vidé à la fermeture)
  sessionStorage.setItem('fp_session_alive', '1');

  // Auto-redirect vers login.html si pas connecté (sauf sur login.html ou index.html)
  const path = window.location.pathname;
  const isLoginPage = path.endsWith('login.html');
  const isLandingPage = path.endsWith('index.html') || path === '/' || path.endsWith('/fleet-app/');
  if (!isLoginPage && !isLandingPage) {
    FP.auth.requireAuth();
  }

  // ===== Mappings snake_case ↔ camelCase =====
  // Le cas général : snake_case → camelCase par split-_ + capitalize.
  // Quelques colonnes ont des sigles (HT, TVA, TTC, CG) où la convention historique
  // utilisée par le frontend est `montantTTC`, `montantHT`, etc. — il faut un override.
  const SNAKE_TO_CAMEL_OVERRIDES = {
    'montant_ht':           'montantHT',
    'montant_tva':          'montantTVA',
    'montant_ttc':          'montantTTC',
    'changer_cg':           'changerCG',
    // CT = Contrôle Technique : sans override, on obtiendrait "prochainCt" / "dateDernierCt"
    // (petit t) alors que le frontend lit "prochainCT" / "dateDernierCT".
    'prochain_ct':          'prochainCT',
    'date_dernier_ct':      'dateDernierCT',
    // La colonne historique "note_pneus" (champ "Note pneus" retiré de la fiche) est
    // réutilisée pour stocker l'autonomie du véhicule → propriété frontend "autonomie".
    'note_pneus':           'autonomie',
    // De même, "type_pneus" (champ "Type" retiré) est réutilisée pour la version/finition
    // du véhicule (lue sur la facture d'achat) → propriété frontend "version".
    'type_pneus':           'version',
  };
  const CAMEL_TO_SNAKE_OVERRIDES = {};
  Object.entries(SNAKE_TO_CAMEL_OVERRIDES).forEach(([s, c]) => { CAMEL_TO_SNAKE_OVERRIDES[c] = s; });

  function snakeToCamel(key) {
    if (SNAKE_TO_CAMEL_OVERRIDES[key]) return SNAKE_TO_CAMEL_OVERRIDES[key];
    return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
  }
  function camelToSnake(key) {
    if (CAMEL_TO_SNAKE_OVERRIDES[key]) return CAMEL_TO_SNAKE_OVERRIDES[key];
    return key.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
  }

  function remapKeys(obj, fn) {
    if (!obj || typeof obj !== 'object') return obj;
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[fn(k)] = v;
    return out;
  }
  const toClient = (row) => remapKeys(row, snakeToCamel);
  const toDb     = (row) => remapKeys(row, camelToSnake);

  // ===== Multi-sociétés (étiquette "societe" par ligne) =====
  // Société active = celle affichée par l'admin. Par défaut "PXP" (= comportement actuel).
  function activeSociete() { try { return localStorage.getItem('fp_societe') || 'PXP'; } catch (e) { return 'PXP'; } }
  // Filtre des lignes selon la société active ('__all__' = tout afficher). Une ligne
  // sans étiquette est considérée comme "PXP" (rétro-compatible avec les données existantes).
  function filterSociete(rows) {
    const s = activeSociete();
    if (s === '__all__') return rows;
    return (rows || []).filter(r => (r.societe || 'PXP') === s);
  }
  // Étiquette une nouvelle ligne avec la société active — UNIQUEMENT si on n'est pas sur "PXP"
  // (ainsi, tant qu'on reste sur PXP, on n'envoie rien de nouveau → aucun risque avant la migration SQL).
  function stampSociete(row) {
    const s = activeSociete();
    if (row && row.societe == null && s && s !== 'PXP' && s !== '__all__') return { ...row, societe: s };
    return row;
  }

  // Clé primaire par table : la table "conducteurs" est indexée par "key" (pas de colonne "id").
  const PK_BY_TABLE = { conducteurs: 'key' };
  function pkColumn(table) { return PK_BY_TABLE[table] || 'id'; }

  // ===== API publique =====
  FP.db = {
    /** Charge les 3 tables et retourne { vehicules, amendes, factures } en camelCase */
    async loadAll() {
      // Tri explicite par id : sans ça, PostgreSQL renvoie les lignes dans l'ordre
      // du tas (heap), et toute ligne modifiée passe en dernier → ordre instable.
      const [v, a, f, c] = await Promise.all([
        client.from('vehicules').select('*').order('id', { ascending: true }),
        client.from('amendes').select('*').order('id', { ascending: true }),
        client.from('factures').select('*').order('id', { ascending: true }),
        client.from('conducteurs').select('*'),
      ]);
      const errors = [v.error, a.error, f.error].filter(Boolean); // conducteurs non bloquant (compteur)
      if (errors.length) {
        console.error('[FP.db.loadAll] erreurs :', errors);
        throw new Error(errors.map(e => e.message).join(' | '));
      }
      return {
        vehicules: filterSociete((v.data || []).map(toClient)),
        amendes:   filterSociete((a.data || []).map(toClient)),
        factures:  filterSociete((f.data || []).map(toClient)),
        conducteurs: filterSociete((c.data || []).map(toClient)),
      };
    },

    /** Met à jour partiellement une ligne. Renvoie { error } si échec. */
    async update(table, id, fields) {
      const snake = toDb(fields);
      const res = await client.from(table).update(snake).eq(pkColumn(table), id);
      if (res.error) console.error(`[FP.db.update ${table}#${id}]`, res.error);
      return res;
    },

    /** Insère une nouvelle ligne. */
    async insert(table, row) {
      const snake = toDb(table === 'app_settings' ? row : stampSociete(row));
      const res = await client.from(table).insert(snake);
      if (res.error) console.error(`[FP.db.insert ${table}]`, res.error);
      return res;
    },

    /** Lit toutes les lignes d'une table (converties en camelCase). */
    async select(table) {
      // Trier par la VRAIE clé primaire (conducteurs → "key", sinon "id") : sinon un ORDER BY id
      // sur une table sans colonne "id" renvoyait un 400 (visible dans la console) avant le repli.
      let res = await client.from(table).select('*').order(pkColumn(table), { ascending: true });
      // Filet de sécurité : si malgré tout le tri échoue (colonne absente), on réessaie sans tri.
      if (res.error && /column .* does not exist/i.test(res.error.message || '')) {
        res = await client.from(table).select('*');
      }
      if (res.error) { console.error(`[FP.db.select ${table}]`, res.error); return { data: [], error: res.error }; }
      return { data: filterSociete((res.data || []).map(toClient)), error: null };
    },

    /** Insère ou met à jour (upsert) une ligne par sa clé primaire. */
    async upsert(table, row) {
      const snake = toDb(table === 'app_settings' ? row : stampSociete(row));
      // Conflit sur la VRAIE clé primaire (ex. conducteurs → 'key', sinon 'id')
      const res = await client.from(table).upsert(snake, { onConflict: pkColumn(table) });
      if (res.error) console.error(`[FP.db.upsert ${table}]`, res.error);
      return res;
    },

    /** Supprime une ligne par sa clé primaire (id, ou `key` pour conducteurs). */
    async delete(table, id) {
      const res = await client.from(table).delete().eq(pkColumn(table), id);
      if (res.error) console.error(`[FP.db.delete ${table}#${id}]`, res.error);
      return res;
    },
  };
  FP._clientLoaded = true; // marqueur : supabase-client.js a bien fini de s'initialiser

  // Remplace le CONTENU d'un array sans changer sa référence
  // (important pour que les `const data = window.FP_DATA` capturés par les pages
  // voient toujours les bons éléments)
  function replaceArrayInPlace(target, source) {
    if (!Array.isArray(target)) return;
    target.length = 0;
    for (const item of source) target.push(item);
  }

  // ===== Loader async qui remplace les données dans window.FP_DATA =====
  FP.dbReady = (async function loadDataFromSupabase() {
    // S'assurer que window.FP_DATA existe avec les bonnes propriétés (sinon créer)
    window.FP_DATA = window.FP_DATA || { vehicules: [], amendes: [], factures: [], conducteurs: [] };
    if (!Array.isArray(window.FP_DATA.vehicules)) window.FP_DATA.vehicules = [];
    if (!Array.isArray(window.FP_DATA.amendes))   window.FP_DATA.amendes   = [];
    if (!Array.isArray(window.FP_DATA.factures))  window.FP_DATA.factures  = [];
    if (!Array.isArray(window.FP_DATA.conducteurs)) window.FP_DATA.conducteurs = [];

    // Profil multi-société : récupère la société de l'utilisateur + s'il est super-admin.
    // Un CLIENT (non-admin) est verrouillé sur SA société (le filtre + l'étiquetage suivent),
    // AVANT de charger les données. (La base, via la RLS, ne renvoie de toute façon que SA société.)
    try {
      const { data: { session } } = await client.auth.getSession();
      const u = session && session.user;
      if (u) {
        const pr = await client.from('profiles').select('societe,is_admin').eq('id', u.id).maybeSingle();
        if (pr && pr.data) {
          FP.profile = pr.data;
          try { localStorage.setItem('fp_profile', JSON.stringify(pr.data)); } catch (e) {}
          if (pr.data.is_admin === false && pr.data.societe) {
            try { localStorage.setItem('fp_societe', pr.data.societe); } catch (e) {}
          }
        }
      }
    } catch (e) { /* table profiles absente / hors-ligne : on garde le comportement admin */ }

    try {
      const data = await FP.db.loadAll();
      // Signature LÉGÈRE des champs affichés : si les données live sont IDENTIQUES à ce qui est
      // déjà affiché (data.js régénéré à jour), on évite le re-rendu inutile (« grisaille » /
      // page qui se remet). On ne ré-émet 'fp:data-ready' que si quelque chose a réellement changé.
      const sig = (d) => {
        const f = (arr, ks) => (arr || []).map(x => ks.map(k => (x[k] ?? '')).join('|')).join(';');
        return f(d.vehicules, ['id','km','statut','chauffeur','prochainCT','derniereRevision','proprietaire'])
             + '#' + f(d.amendes, ['id','statut','montant','montantTTC','points','date','prenom'])
             + '#' + f(d.factures, ['id','montantTTC','type','date','vehiculeImmat']);
      };
      const sigBefore = sig(window.FP_DATA);
      const sigAfter  = sig(data);
      // Remplace les contenus in-place
      replaceArrayInPlace(window.FP_DATA.vehicules, data.vehicules);
      replaceArrayInPlace(window.FP_DATA.amendes,   data.amendes);
      replaceArrayInPlace(window.FP_DATA.factures,  data.factures);
      if (Array.isArray(data.conducteurs)) replaceArrayInPlace(window.FP_DATA.conducteurs, data.conducteurs);
      const dataChanged = (sigBefore !== sigAfter);
      // Cache local des dernières données live → sert d'affichage initial à la prochaine
      // ouverture (évite le "flash" data.js figé → vraies données). On garde le cache
      // ⚠️ On cache TOUT (véhicules + amendes + factures) — et à jour à chaque chargement — pour
      // que le 1er affichage de chaque page corresponde EXACTEMENT au live → zéro "flash" de
      // chiffres. (data.js, lui, est un instantané figé qui devient périmé dès qu'on ajoute des
      // données ; le cache, lui, est rafraîchi à chaque visite.) Lecture ~10 ms : négligeable.
      const CK = window.FP_CACHE_KEY || 'fp_data_cache_v3';
      try { localStorage.removeItem('fp_data_cache'); } catch (e0) {} // ancienne clé périmée
      try {
        localStorage.setItem(CK, JSON.stringify({ vehicules: data.vehicules, amendes: data.amendes, factures: data.factures, conducteurs: data.conducteurs }));
      } catch (e) {
        // Quota dépassé : on retombe sur véhicules + amendes + conducteurs (compteurs justes), sans factures
        try { localStorage.setItem(CK, JSON.stringify({ vehicules: data.vehicules, amendes: data.amendes, conducteurs: data.conducteurs })); }
        catch (e2) { try { localStorage.setItem(CK, JSON.stringify({ amendes: data.amendes, conducteurs: data.conducteurs })); } catch (e3) { /* tant pis */ } }
      }
      console.log(`[FP.db] Chargé depuis Supabase : ${data.vehicules.length} véhicules, ${data.amendes.length} amendes, ${data.factures.length} factures`);
      // Re-appliquer les overrides locaux (cases cochées par l'utilisateur, etc.)
      if (FP.loadVehicleOverrides) FP.loadVehicleOverrides();
      // Charger les réglages PAR SOCIÉTÉ (apparence). Ligne app_settings = la société.
      // Repli sur l'ancienne ligne 'global' pour PXP (compat config existante).
      try {
        const sid = (FP.settings && FP.settings._dbId) ? FP.settings._dbId() : 'global';
        let sres = await client.from('app_settings').select('data').eq('id', sid).maybeSingle();
        let shared = sres && sres.data && sres.data.data;
        if ((!shared || typeof shared !== 'object') && sid === 'PXP') {
          sres = await client.from('app_settings').select('data').eq('id', 'global').maybeSingle();
          shared = sres && sres.data && sres.data.data;
        }
        if (shared && typeof shared === 'object') {
          const key = (FP.settings && FP.settings._key) ? FP.settings._key() : 'auto_flotte_settings';
          localStorage.setItem(key, JSON.stringify(shared));
          if (FP.settings && FP.settings.applyTheme) FP.settings.applyTheme();
          if (FP.applyCustomNavLabels) FP.applyCustomNavLabels();
          if (FP.applyNavOrder) FP.applyNavOrder();
          if (FP.applyNavVisibility) FP.applyNavVisibility();
          if (FP.applyCustomTexts) FP.applyCustomTexts();
        }
      } catch (e) { /* table absente ou hors-ligne : on garde les réglages locaux */ }
      // On ne déclenche le re-rendu des pages QUE si les données ont réellement changé
      // (sinon le 1er affichage depuis data.js/cache est déjà bon → pas de clignotement).
      if (dataChanged) {
        document.dispatchEvent(new CustomEvent('fp:data-ready', { detail: { source: 'supabase', counts: { vehicules: data.vehicules.length, amendes: data.amendes.length, factures: data.factures.length } } }));
      }
      return data;
    } catch (e) {
      console.warn('[FP.db] Supabase indisponible, fallback sur data.js local :', e);
      // Appliquer quand même les modifs locales (overrides) pour qu'elles s'affichent partout
      if (FP.loadVehicleOverrides) FP.loadVehicleOverrides();
      document.dispatchEvent(new CustomEvent('fp:data-ready', { detail: { source: 'local', error: e.message } }));
      return null;
    }
  })();
})();
