// ============================================================================
//  Parc Pilot — Collecte du kilométrage par e-mail (fonction PUBLIQUE, protégée par TOKEN)
//
//  Le chauffeur reçoit un e-mail avec un lien personnel (km.html?t=<token>).
//  Cette fonction :
//    • GET  ?t=<token>      → renvoie les infos du véhicule (plaque, modèle, km connu)
//                             si le token est valide, non expiré, pas déjà utilisé.
//    • POST { t, km }       → enregistre le km : met à jour vehicules.km (si supérieur),
//                             marque la demande comme utilisée (km_recu + used_at).
//
//  ⚠️ Cette fonction est VOLONTAIREMENT publique (le chauffeur n'a pas de compte).
//     La sécurité = le TOKEN secret non devinable (une demande = un token à usage unique).
//     verify_jwt est désactivé pour cette fonction (voir supabase/config.toml).
//
//  Déploiement : automatique (GitHub Action deploy-edge-functions.yml au push sur main).
//    SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont injectés automatiquement.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    // no-store : la réponse contient des URLs SIGNÉES qui expirent → jamais de cache navigateur
    // (sinon un lien signé périmé donne une « erreur » au clic sur un document / la notice).
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function admin() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Charge une demande valide (token existant, non expiré). `used_at` non-null = déjà répondu.
async function loadReq(db: ReturnType<typeof createClient>, token: string) {
  const { data, error } = await db.from("km_requests").select("*").eq("token", token).maybeSingle();
  if (error) throw error;
  if (!data) return { err: "Lien invalide ou expiré." };
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return { err: "Ce lien a expiré. Demande un nouveau lien à ton gestionnaire de flotte." };
  }
  return { req: data };
}

// Charge un QR PERMANENT (collé dans le véhicule) : token → véhicule. Réutilisable (pas d'expiration).
async function loadQr(db: ReturnType<typeof createClient>, token: string) {
  const { data, error } = await db.from("km_qr").select("*").eq("token", token).maybeSingle();
  if (error) throw error;
  if (!data) return { err: "QR invalide. Demande à ton gestionnaire de flotte d'imprimer le bon QR." };
  return { qr: data };
}

// km actuel connu d'un véhicule (colonne vehicules.km).
async function vehKm(db: ReturnType<typeof createClient>, vehiculeId: string | null) {
  if (!vehiculeId) return null;
  const { data: v } = await db.from("vehicules").select("km").eq("id", vehiculeId).maybeSingle();
  return v && v.km != null ? Number(v.km) : null;
}

// Date (AAAA-MM-JJ) du DERNIER relevé RÉELLEMENT reçu pour ce véhicule (mail ou QR, used_at non-null).
// Les anciens km connus (avant cette fonctionnalité) n'ont pas de relevé daté → renvoie null : la date
// n'apparaît donc qu'à partir du PROCHAIN relevé (demande explicite de l'utilisateur).
async function dernierReleveDate(db: ReturnType<typeof createClient>, vehiculeId: string | null) {
  if (!vehiculeId) return null;
  try {
    const { data } = await db.from("km_requests")
      .select("used_at")
      .eq("vehicule_id", vehiculeId)
      .not("used_at", "is", null)
      .order("used_at", { ascending: false })
      .limit(1);
    const r = Array.isArray(data) && data[0];
    return (r && r.used_at) ? String(r.used_at).slice(0, 10) : null;
  } catch { return null; }
}

// ---- PORTAIL CONDUCTEUR : données non personnelles d'un véhicule, servies à la page v.html ----
// Infos véhicule sûres (jamais de PII : pas de chauffeur, pas de VIN).
async function vehInfo(db: ReturnType<typeof createClient>, vehiculeId: string | null) {
  if (!vehiculeId) return null;
  const { data: v } = await db.from("vehicules")
    .select("marque,modele,carburant,co2,km,prochain_ct,date_mise_en_circulation,cg_url,cg_file_id,chauffeur")
    .eq("id", vehiculeId).maybeSingle();
  return v || null;
}

// Signe une URL Supabase Storage (bucket privé) pour qu'elle soit ouvrable depuis la page publique.
// Les URLs non-Storage (déjà publiques) sont renvoyées telles quelles.
async function signUrl(db: ReturnType<typeof createClient>, url: string) {
  const u = String(url || "");
  const m = u.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?]+)/);
  if (!m) return url;
  let path = m[2]; try { path = decodeURIComponent(path); } catch { /* garde */ }
  try {
    const { data } = await db.storage.from(m[1]).createSignedUrl(path, 86400); // 24 h : marge si la page reste ouverte
    return (data && data.signedUrl) ? data.signedUrl : url;
  } catch { return url; }
}

// Conducteur (prénom / nom / poste) rattaché au véhicule, retrouvé par le nom « chauffeur » du véhicule.
function _norm(s: string) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, ""); }
async function vehConducteur(db: ReturnType<typeof createClient>, chauffeur: string, societe: string) {
  const name = String(chauffeur || "").trim();
  if (!name || name === "—") return null;
  const rows = ((await db.from("conducteurs").select("prenom,nom,poste,name,key").eq("societe", societe || "PXP")).data || []) as Record<string, unknown>[];
  const key = _norm(name);
  // 1) Correspondance sur le NOM COMPLET (prénom+nom OU champ `name`).
  let hit = rows.find((c) => _norm(String(c.prenom || "") + String(c.nom || "")) === key || _norm(String(c.name || "")) === key);
  // 2) Repli : le champ `chauffeur` du véhicule est SOUVENT juste le PRÉNOM (ex. « Shakil ») alors que la
  //    fiche conducteur porte le nom complet (« Shakil Nubeebaccus ») → l'égalité stricte échouait et le
  //    poste n'apparaissait pas. On retrouve alors le conducteur par son prénom (1er mot du chauffeur).
  if (!hit) {
    const first = _norm((name.split(/\s+/)[0]) || name);
    if (first) {
      hit = rows.find((c) => _norm(String(c.prenom || "")) === first)
         || rows.find((c) => { const f = _norm(String(c.prenom || "") + String(c.nom || "")) || _norm(String(c.name || "")); return !!f && f.indexOf(first) === 0; });
    }
  }
  if (!hit) return { prenom: name.split(" ")[0] || name, nom: name.split(" ").slice(1).join(" "), poste: "", name, key: "" };
  // Un conducteur peut n'avoir que `name` (prénom/nom vides) → on dérive prénom/nom du nom complet,
  // sinon le portail n'affichait AUCUN nom (bandeau conducteur absent).
  let prenom = String(hit.prenom || ""), nom = String(hit.nom || "");
  const full = String(hit.name || "").trim();
  if (!prenom && !nom && full) { const parts = full.split(/\s+/); prenom = parts[0] || ""; nom = parts.slice(1).join(" "); }
  return { prenom, nom, poste: String(hit.poste || ""), name: full || (prenom + " " + nom).trim(), key: String(hit.key || "") };
}

// ⚠️ Masses en service (champ G, kg) lues sur les cartes grises de la flotte — MÊME source que
// `FP.MASSE_CG` dans assets/js/app.js (la fiche véhicule). Sert au badge « stationnement Paris » du
// portail pour qu'il affiche EXACTEMENT le même verdict que la fiche. ⚠️ À garder en phase avec app.js.
const MASSE_CG: Record<string, number> = {
  "GC-885-LB": 2395, "GT-565-XR": 1885, "GD-056-CR": 2040, "GE-349-FZ": 2040, "HG-763-VP": 1825,
  "GR-745-LR": 1012, "FF-304-GL": 2215, "FF-777-XK": 2139, "GP-795-YL": 1505, "GW-075-EZ": 1505,
  "GW-087-EZ": 1505, "GW-173-JV": 1505, "FJ-607-QH": 1505, "FZ-301-YZ": 1505, "GY-860-FG": 1815,
  "GP-333-QJ": 1505, "HH-464-LQ": 2015, "GT-818-LC": 1710, "HB-844-DE": 2015, "HB-733-DE": 2015,
  "GA-313-PK": 2990, "FR-141-MP": 1760, "GA-333-PZ": 1639, "FS-224-PB": 1390, "FZ-501-YZ": 1416,
  "HH-458-LQ": 2015, "GR-585-HP": 1358, "GR-302-HP": 1358, "HF-477-XW": 1650, "HJ-804-VM": 2117,
  "GH-994-AR": 1395, "ET-095-LV": 1621, "ED-160-TZ": 1758, "FT-338-AJ": 1395, "GE-948-WY": 1446,
  "GR-019-ZG": 1358, "GR-467-HP": 1358, "HE-739-WP": 1505, "GP-232-WF": 1505, "HJ-285-FL": 1625,
  "HJ-181-RN": 1782, "HG-709-CH": 2015, "HF-749-VD": 1265, "HH-613-KE": 2015, "GM-548-QA": 1395,
};

// Amendes DU CONDUCTEUR (pour le portail « Mes amendes ») : montant + n° d'avis + date + motif,
// SANS PDF ni pièce jointe. Rattachées par le prénom/nom du conducteur (normalisé). Le montant renvoyé
// est le montant DÛ (majoré si l'amende est marquée majorée, sinon le montant courant).
async function vehAmendes(db: ReturnType<typeof createClient>, societe: string, conducteur: Record<string, unknown> | null) {
  if (!conducteur) return [];
  const { data } = await db.from("amendes").select("*").eq("societe", societe || "PXP");
  if (!Array.isArray(data)) return [];
  const keys = new Set<string>();
  const add = (s: unknown) => { const n = _norm(String(s || "")); if (n) keys.add(n); };
  add(conducteur.prenom); add(conducteur.name); add(String(conducteur.prenom || "") + String(conducteur.nom || ""));
  if (!keys.size) return [];
  const out: Array<Record<string, unknown>> = [];
  for (const a of data as Array<Record<string, unknown>>) {
    const ap = _norm(String(a.prenom || ""));
    if (!ap || !keys.has(ap)) continue;
    const majoree = a.majoree === true || a.majoree === "true";
    const montant = (majoree && a.montant_majore != null && a.montant_majore !== "") ? Number(a.montant_majore) : (Number(a.montant) || 0);
    out.push({ numeroAvis: String(a.numero_avis || ""), montant: isFinite(montant) ? montant : 0, date: String(a.date || ""), motif: String(a.motif || ""), statut: String(a.statut || "") });
  }
  // Tri : amendes NON PAYÉES d'abord, puis le reste — et dans chaque groupe, de la + récente à la + ancienne.
  // « payée » (statut normalisé commençant par « pay ») = payée ; « à payer » → « apayer » (n'y matche pas).
  const isPaid = (s: unknown) => /^pay/.test(_norm(String(s || "")));
  out.sort((x, y) => {
    const px = isPaid(x.statut) ? 1 : 0, py = isPaid(y.statut) ? 1 : 0;
    if (px !== py) return px - py;
    return String(y.date).localeCompare(String(x.date));
  });
  return out;
}

// Conducteur ACTUEL du véhicule : le champ `chauffeur` du véhicule, sinon l'affectation EN COURS
// (settings.affectations[vehId] = [{conducteur, debut, fin}]) — sinon un véhicule affecté via
// l'historique mais sans champ chauffeur n'affichait pas de nom sur le portail.
async function chauffeurActuel(db: ReturnType<typeof createClient>, vehiculeId: string | null, societe: string, vehChauffeur: string) {
  const direct = String(vehChauffeur || "").trim();
  if (direct && direct !== "—") return direct;
  if (!vehiculeId) return "";
  try {
    const { data } = await db.from("app_settings").select("data").eq("id", societe || "PXP").maybeSingle();
    const s = (data && data.data && typeof data.data === "object") ? data.data as Record<string, unknown> : {};
    const affAll = (s.affectations && typeof s.affectations === "object") ? s.affectations as Record<string, unknown> : {};
    const aff = affAll[vehiculeId];
    if (!Array.isArray(aff) || !aff.length) return "";
    const withNom = (aff as Record<string, unknown>[]).filter((a) => a && a.conducteur);
    const encours = withNom.filter((a) => !a.fin);
    const pick = (encours.length ? encours : withNom)
      .sort((a, b) => String(b.debut || "").localeCompare(String(a.debut || "")))[0];
    return pick ? String(pick.conducteur || "").trim() : "";
  } catch { return ""; }
}

// Langue d'un conducteur (par son nom + société) via la carte app_settings.condLangues. 'fr' par défaut.
async function condLangueDe(db: ReturnType<typeof createClient>, societe: string, chauffeur: string) {
  const name = String(chauffeur || "").trim();
  if (!name || name === "—") return "fr";
  const soc = societe || "PXP";
  const [{ data: st }, { data: cs }] = await Promise.all([
    db.from("app_settings").select("data").eq("id", soc).maybeSingle(),
    db.from("conducteurs").select("key,prenom,nom,name").eq("societe", soc),
  ]);
  const map = (st && st.data && (st.data as Record<string, unknown>).condLangues && typeof (st.data as Record<string, unknown>).condLangues === "object")
    ? (st.data as Record<string, Record<string, unknown>>).condLangues : {};
  const key = _norm(name);
  const hit = (cs || []).find((c: Record<string, unknown>) => _norm(String(c.prenom || "") + String(c.nom || "")) === key || _norm(String(c.name || "")) === key);
  const ck = hit && (hit as Record<string, unknown>).key;
  const lv = ck ? String((map as Record<string, unknown>)[ck as string] || "").toLowerCase() : "";
  return (lv === "en" || lv === "english" || lv === "anglais") ? "en" : "fr";
}

// Documents consultables du véhicule (carte grise + mémo + autres), depuis la table `documents`
// et le champ carte grise du véhicule. On ne renvoie que { label, url }.
async function vehDocs(db: ReturnType<typeof createClient>, vehiculeId: string | null, veh: Record<string, unknown> | null) {
  const out: { label: string; url: string; type: string }[] = [];
  const seen = new Set<string>();
  // ⚠️ RÈGLE : plus jamais de Google Drive — on n'expose QUE des documents hébergés sur la
  //    plateforme (Supabase Storage). Tout lien Drive est ignoré (à réimporter sur le site).
  const isDrive = (u: string) => /drive\.google|docs\.google/i.test(u);
  const push = (label: string, url: string, type: string) => {
    const u = String(url || "").trim();
    if (!u || seen.has(u) || isDrive(u)) return;
    seen.add(u); out.push({ label: label || "Document", url: u, type: type || "autre" });
  };
  // Carte grise portée par le véhicule (champ direct, hébergé plateforme). cg_file_id (Drive) ignoré.
  if (veh && veh.cg_url) push("Carte grise", String(veh.cg_url), "carte-grise");
  if (!vehiculeId) return out;
  const { data } = await db.from("documents").select("type,label,url").eq("vehicule_id", vehiculeId);
  for (const d of (data || [])) {
    if (!d || !d.url) continue;
    if (d.type === "etat-des-lieux") continue;         // les EDL ont leur propre rubrique
    push(String(d.label || ""), String(d.url), String(d.type || "autre"));
  }
  return out;
}

// Photos « état des lieux » du véhicule. Le SENS est stocké dans `label` ('Entrée'/'Sortie'),
// il n'y a pas de colonne dédiée (même convention que la fiche véhicule).
async function vehEdl(db: ReturnType<typeof createClient>, vehiculeId: string | null) {
  if (!vehiculeId) return [];
  const { data } = await db.from("documents").select("label,url").eq("vehicule_id", vehiculeId).eq("type", "etat-des-lieux");
  return (data || []).filter((d: Record<string, unknown>) => d && d.url)
    .map((d: Record<string, unknown>) => {
      const lbl = String(d.label || "").toLowerCase();
      const sens = lbl.startsWith("sort") ? "restitution" : "prise";
      return { url: String(d.url), sens };
    });
}

// Config PORTAIL par société : lue dans app_settings (id = société). Assureur/police + assistance + notice.
async function portalConfig(db: ReturnType<typeof createClient>, societe: string) {
  const soc = societe || "PXP";
  const { data } = await db.from("app_settings").select("data").eq("id", soc).maybeSingle();
  const s = (data && data.data && typeof data.data === "object") ? data.data as Record<string, unknown> : {};
  const p = (s.portail && typeof s.portail === "object") ? s.portail as Record<string, unknown> : {};
  const ass = (s.assuranceContrat && typeof s.assuranceContrat === "object") ? s.assuranceContrat as Record<string, unknown> : {};
  const prof = (s.profil && typeof s.profil === "object") ? s.profil as Record<string, unknown> : {};
  const socObj = (s.societe && typeof s.societe === "object") ? s.societe as Record<string, unknown> : {};
  // PXP : valeurs historiques par défaut (comme FP.assuranceContrat côté client).
  const assureur = String(ass.assureur || (soc === "PXP" ? "SWISSLIFE" : "")).trim();
  const police = String(ass.police || (soc === "PXP" ? "011165247/0599" : "")).trim();
  return {
    assureur, police,
    assistanceNumero: String(p.assistanceNumero || "").trim(),
    assistanceNotice: String(p.assistanceNotice || "").trim(),
    constatUrl: String(p.constatUrl || "").trim(),
    reglesTexte: String(p.reglesTexte || "").trim(),
    reglesLien: String(p.reglesLien || "").trim(),
    logo: String(prof.logoDataUrl || "").trim(),          // logo société (data URL) pour l'en-tête du portail
    societeNom: String(socObj.nom || "").trim(),
    // Carte des langues par conducteur (clé conducteur → 'fr'/'en') — sert à afficher le portail
    // dans la langue du conducteur. Consommée côté serveur puis retirée avant l'envoi au client.
    condLangues: (s.condLangues && typeof s.condLangues === "object") ? s.condLangues as Record<string, unknown> : {},
  };
}

// Upload de photos envoyées en base64 (data URL) par le conducteur → bucket public "scans".
async function uploadPhotos(db: ReturnType<typeof createClient>, photos: unknown, folder: string): Promise<string[]> {
  const urls: string[] = [];
  if (!Array.isArray(photos)) return urls;
  let i = 0;
  for (const raw of photos.slice(0, 8)) {
    const s = String(raw || "");
    const m = s.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) continue;
    const mime = m[1] || "image/jpeg";
    const ext = mime.includes("png") ? "png" : (mime.includes("webp") ? "webp" : (mime.includes("pdf") ? "pdf" : "jpg"));
    let bytes: Uint8Array;
    try { bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0)); } catch { continue; }
    if (bytes.length > 8_000_000) continue;              // garde-fou : 8 Mo max par fichier
    const path = folder + "/" + Date.now().toString(36) + "-" + (i++) + "-" + Math.round(bytes.length % 99991) + "." + ext;
    const up = await db.storage.from("scans").upload(path, bytes, { contentType: mime, upsert: false });
    if (up.error) continue;
    const pub = db.storage.from("scans").getPublicUrl(path);
    if (pub && pub.data && pub.data.publicUrl) urls.push(pub.data.publicUrl);
  }
  return urls;
}

function genId(prefix: string) {
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const db = admin();
  if (!db) return json({ error: "Service indisponible (configuration serveur)." }, 500);

  try {
    // ---- GET : le chauffeur ouvre son lien/QR → on lui montre SON véhicule (plaque verrouillée) ----
    if (req.method === "GET") {
      const url = new URL(req.url);
      const qtok = url.searchParams.get("q") || "";   // QR permanent (collé dans la voiture)
      const token = url.searchParams.get("t") || "";  // lien e-mail à usage unique

      if (qtok) {
        const { qr, err } = await loadQr(db, qtok);
        if (err) return json({ error: err }, 404);
        const kmConnu = await vehKm(db, qr.vehicule_id);
        const kmDate = await dernierReleveDate(db, qr.vehicule_id);
        const base = { ok: true, mode: "qr", plaque: qr.plaque || "", chauffeur: "", societe: qr.societe || "", kmConnu, kmDate, deja: false, kmRecu: null };
        // `full=1` (portail v.html) : on joint infos véhicule + documents + EDL + config société.
        if (url.searchParams.get("full") === "1") {
          const veh = await vehInfo(db, qr.vehicule_id);
          // Nom du conducteur : champ `chauffeur` du véhicule, sinon l'affectation en cours (historique).
          const chauffeurNom = await chauffeurActuel(db, qr.vehicule_id, qr.societe || "PXP", veh ? String(veh.chauffeur || "") : "");
          const [docs0, edl0, portal, conducteur] = await Promise.all([
            vehDocs(db, qr.vehicule_id, veh),
            vehEdl(db, qr.vehicule_id),
            portalConfig(db, qr.societe || "PXP"),
            vehConducteur(db, chauffeurNom, qr.societe || "PXP"),
          ]);
          // Bucket privé → on SIGNE les URLs pour qu'elles s'ouvrent depuis la page publique.
          const docs = await Promise.all(docs0.map(async (d) => ({ ...d, url: await signUrl(db, d.url) })));
          const edl = await Promise.all(edl0.map(async (e) => ({ ...e, url: await signUrl(db, e.url) })));
          if (portal.assistanceNotice) portal.assistanceNotice = await signUrl(db, portal.assistanceNotice);
          // Masse en service (champ G) pour le stationnement Paris — MÊME ordre de source que la fonction
          // vehMasse() de la fiche véhicule : (1) réglage société vehMasse[vehId] ; (2) table MASSE_CG
          // (= FP.masseCG, cartes grises de la flotte) ; (3) repli par modèle. → verdict identique à la fiche.
          let masseKg: number | null = null;
          try {
            const { data: setRow } = await db.from("app_settings").select("data").eq("id", qr.societe || "PXP").maybeSingle();
            const vm = (setRow && setRow.data && (setRow.data as Record<string, unknown>).vehMasse) as Record<string, unknown> | undefined;
            const raw = vm && qr.vehicule_id ? vm[qr.vehicule_id] : null;
            if (raw != null && raw !== "") masseKg = Number(raw);
          } catch (_) { /* pas de masse réglée */ }
          if (masseKg == null) { const k = String(qr.plaque || "").toUpperCase().trim(); if (MASSE_CG[k] != null) masseKg = MASSE_CG[k]; }
          if (masseKg == null && veh) {
            const mod = String(veh.modele || "").toUpperCase();
            const KNOWN: Record<string, number> = { "SEAL U": 2102, "ATTO 3": 1750 };
            for (const k in KNOWN) { if (mod.includes(k)) { masseKg = KNOWN[k]; break; } }
          }
          const info = veh ? {
            marque: veh.marque || "", modele: veh.modele || "", carburant: veh.carburant || "",
            co2: veh.co2 != null && veh.co2 !== "" ? Number(veh.co2) : null,
            masse: masseKg,
            km: veh.km != null ? Number(veh.km) : null,
            prochainCT: veh.prochain_ct || "", dateMiseEnCirculation: veh.date_mise_en_circulation || "",
          } : null;
          // Langue du conducteur (carte condLangues côté société) → le portail s'affiche en FR ou EN.
          const langMap = (portal as Record<string, unknown>).condLangues as Record<string, unknown> || {};
          const ck = conducteur && (conducteur as Record<string, unknown>).key;
          const lv = ck ? String(langMap[ck as string] || "").toLowerCase() : "";
          const langue = (lv === "en" || lv === "english" || lv === "anglais") ? "en" : "fr";
          delete (portal as Record<string, unknown>).condLangues;   // pas besoin de l'exposer au client
          const conducteur2 = conducteur ? { ...conducteur, langue } : { langue };
          // Amendes du conducteur (montant + n° d'avis) pour l'onglet « Mes amendes » du portail (sans PDF).
          const amendes = await vehAmendes(db, qr.societe || "PXP", conducteur as Record<string, unknown> | null);
          // ⚠️ La page v.html lit `portail` (français) → on émet cette clé (pas `portal`).
          return json({ ...base, veh: info, docs, edl, portail: portal, conducteur: conducteur2, amendes, langue });
        }
        return json(base);
      }

      if (!token) return json({ error: "Lien incomplet." }, 400);
      const { req: r, err } = await loadReq(db, token);
      if (err) return json({ error: err }, 404);
      // ⚠️ TOUJOURS À JOUR : on montre le km LIVE de la fiche véhicule (comme le QR permanent), pour
      // refléter les corrections manuelles / relevés reçus APRÈS l'envoi du mail. Repli sur km_avant
      // (valeur figée à l'envoi) uniquement si la fiche n'a pas de km.
      let kmConnu = await vehKm(db, r.vehicule_id);
      if (kmConnu == null || kmConnu === "") kmConnu = r.km_avant;
      const langue = await condLangueDe(db, r.societe || "PXP", r.chauffeur || "");  // e-mail dans la langue du conducteur
      const kmDate = await dernierReleveDate(db, r.vehicule_id);
      return json({
        ok: true, mode: "mail",
        plaque: r.plaque || "", chauffeur: r.chauffeur || "", societe: r.societe || "",
        kmConnu: kmConnu != null ? Number(kmConnu) : null, kmDate,
        deja: !!r.used_at, kmRecu: r.km_recu != null ? Number(r.km_recu) : null, langue,
      });
    }

    // ---- POST : le chauffeur envoie son km / une déclaration / des photos de restitution ----
    if (req.method === "POST") {
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { return json({ error: "Requête invalide." }, 400); }
      const action = String(body.action || "").trim();

      // === Déclaration de sinistre / problème (formulaire du portail) ===
      if (action === "declaration") {
        const qtok0 = String(body.q || "").trim();
        if (!qtok0) return json({ error: "QR incomplet." }, 400);
        const { qr, err } = await loadQr(db, qtok0);
        if (err) return json({ error: err }, 404);
        const type = String(body.type || "sinistre").trim() === "probleme" ? "probleme" : "sinistre";
        const description = String(body.description || "").trim();
        if (!description) return json({ error: "Décris brièvement ce qui s'est passé." }, 400);
        const photos = await uploadPhotos(db, body.photos, "declarations/" + (qr.plaque || "veh"));
        const rec = {
          id: genId("dc"), vehicule_id: qr.vehicule_id, plaque: qr.plaque || "", societe: qr.societe || "PXP",
          type, date_incident: String(body.dateIncident || "").slice(0, 120), lieu: String(body.lieu || "").slice(0, 240),
          description: description.slice(0, 4000), tiers: String(body.tiers || "").slice(0, 600),
          blesses: String(body.blesses || "").slice(0, 240), photos, statut: "nouveau",
        };
        const ins = await db.from("declarations_conducteur").insert(rec);
        if (ins.error) return json({ error: "Échec de l'enregistrement. Réessaie." }, 500);
        return json({ ok: true, type, photos: photos.length });
      }

      // === État des lieux : photos de restitution envoyées par le conducteur ===
      if (action === "edl") {
        const qtok0 = String(body.q || "").trim();
        if (!qtok0) return json({ error: "QR incomplet." }, 400);
        const { qr, err } = await loadQr(db, qtok0);
        if (err) return json({ error: err }, 404);
        const sens = String(body.sens || "restitution").trim() === "prise" ? "prise" : "restitution";
        const photos = await uploadPhotos(db, body.photos, "etat-des-lieux/" + (qr.plaque || "veh"));
        if (!photos.length) return json({ error: "Ajoute au moins une photo." }, 400);
        // Le sens vit dans `label` ('Entrée'/'Sortie') — même convention que la fiche véhicule.
        const label = sens === "restitution" ? "Sortie" : "Entrée";
        const rows = photos.map((u) => ({
          id: genId("D"), vehicule_id: qr.vehicule_id, type: "etat-des-lieux",
          label, url: u, societe: qr.societe || "PXP",
        }));
        const ins = await db.from("documents").insert(rows);
        if (ins.error) return json({ error: "Échec de l'envoi des photos. Réessaie." }, 500);
        return json({ ok: true, sens, photos: photos.length });
      }

      const qtok = String(body.q || "").trim();
      const token = String(body.t || "").trim();
      const km = Math.round(Number(body.km));
      if (!qtok && !token) return json({ error: "Lien incomplet." }, 400);
      if (!Number.isFinite(km) || km <= 0 || km > 3000000) {
        return json({ error: "Kilométrage invalide. Saisis un nombre (ex. 45 000)." }, 400);
      }

      // Résout le véhicule concerné selon le mode (QR permanent ou lien e-mail).
      let vehiculeId: string | null = null, plaque = "", societe = "", chauffeur = "", kmRef: number | null = null;
      if (qtok) {
        const { qr, err } = await loadQr(db, qtok);
        if (err) return json({ error: err }, 404);
        vehiculeId = qr.vehicule_id; plaque = qr.plaque || ""; societe = qr.societe || "";
        kmRef = await vehKm(db, vehiculeId);
      } else {
        const { req: r, err } = await loadReq(db, token);
        if (err) return json({ error: err }, 404);
        vehiculeId = r.vehicule_id; plaque = r.plaque || ""; societe = r.societe || ""; chauffeur = r.chauffeur || "";
        kmRef = r.km_avant != null ? Number(r.km_avant) : await vehKm(db, vehiculeId);
      }

      // Refuse un km ABERRANT (inférieur au km déjà connu) pour ne pas corrompre la fiche.
      if (kmRef != null && km < kmRef - 100) {
        return json({ error: `Le kilométrage saisi (${km}) est inférieur au dernier relevé connu (${kmRef}). Vérifie ton compteur.` }, 400);
      }

      // 1) Met à jour la fiche véhicule (seulement si le km reçu est supérieur au km actuel).
      if (vehiculeId) {
        const cur = (await vehKm(db, vehiculeId)) || 0;
        if (km > cur) await db.from("vehicules").update({ km }).eq("id", vehiculeId);
      }

      // 2) Journalise le relevé.
      const now = new Date().toISOString();
      if (qtok) {
        // QR permanent : chaque scan = une NOUVELLE ligne de relevé (historique par période).
        await db.from("km_requests").insert({
          token: "qr-" + crypto.randomUUID(), vehicule_id: vehiculeId, plaque, societe,
          chauffeur, km_avant: kmRef, km_recu: km, used_at: now, source: "qr",
        });
      } else {
        // Lien e-mail : marque la demande comme répondue (idempotent).
        await db.from("km_requests").update({ km_recu: km, used_at: now }).eq("token", token);
      }

      return json({ ok: true, plaque, km });
    }

    return json({ error: "Méthode non autorisée." }, 405);
  } catch (e) {
    return json({ error: (e && (e as Error).message) || "Erreur serveur." }, 500);
  }
});
