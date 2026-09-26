// ============================================================================
//  Parc Pilot — DEMANDE + RELANCE AUTOMATIQUES des relevés km (tâche planifiée)
//
//  Problème résolu : jusqu'ici, la demande de relevé km était 100 % manuelle
//  (bouton « Demander le km par mail ») et rien n'était relancé automatiquement.
//  Cette fonction envoie TOUTE SEULE : (1) la 1re demande aux véhicules dont le km
//  est en retard, puis (2) des relances tant que le chauffeur n'a pas répondu.
//  BONUS (même tâche quotidienne, aucun réglage en plus) : (3) un RAPPEL « la veille »
//  du CONTRÔLE TECHNIQUE (prochain_ct = demain) au conducteur + gestionnaire en copie.
//
//  DÉCLENCHEMENT : appelée 1×/jour par une tâche planifiée (pg_cron → net.http_post,
//  voir supabase/km-relance-setup.sql). Peut aussi être testée à la main par un CEO.
//
//  RÈGLES (anti-spam, fidèles à la logique du site) — pour CHAQUE véhicule :
//    • 1re DEMANDE AUTO : s'il n'y a AUCUNE demande en cours et que le km est EN RETARD
//      (même règle que l'alerte « relevé km à faire » : notif.releveKmJours / cycle
//      releveKmDebut, d'après kmMajDates), on envoie une 1re demande. L'e-mail du
//      chauffeur est résolu via la table `conducteurs` (jamais inventé ; prénom nu
//      ambigu = on n'envoie pas, comme FP.kmCollecte.emailDe).
//    • RELANCE : si une demande est en cours SANS RÉPONSE depuis ≥ X jours
//      (notif.releveKmRelanceJours, défaut 7), on renvoie. Chaque envoi repose le
//      compteur (nouveau sent_at) → au plus 1 envoi tous les X jours.
//    • On NE fait RIEN si : le chauffeur a répondu (mail/QR/manuel), le km a été mis à
//      jour à la main (kmMajDates), le véhicule est hors flotte / à vendre, ou décoché
//      du suivi km (kmSuiviExclus), ou pas d'e-mail résoluble.
//    • PLAFOND : au plus KM_RELANCE_MAX relances (défaut 4) tant qu'aucun relevé n'est
//      reçu → on arrête de harceler ; l'alerte in-app reste visible pour le gestionnaire.
//    • Isolation MULTI-SOCIÉTÉS : from + réglages + conducteurs lus par société.
//
//  SÉCURITÉ : verify_jwt=false (voir config.toml). L'appel doit fournir l'en-tête
//    x-cron-secret == KM_RELANCE_SECRET (secret serveur), OU un JWT de CEO (is_admin)
//    pour un test manuel. Sinon 401. La clé Resend reste un SECRET serveur.
//
//  SECRETS (Supabase → Edge Functions → Secrets) :
//    KM_RELANCE_SECRET = une longue chaîne au hasard (partagée avec la tâche cron).
//    RESEND_API_KEY / EMAIL_FROM = déjà présents (utilisés par send-email).
//    KM_RELANCE_MAX  = (option) plafond de relances par cycle (défaut 4).
//    KM_FORM_BASE    = (option) URL du formulaire (défaut https://parc-pilot.fr/km.html).
//
//  Déploiement : automatique (GitHub Action deploy-edge-functions.yml au push sur main).
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const normImmat = (s: unknown) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
// Normalisations IDENTIQUES au site (FP.normPrenom / FP.normNomComplet) → même résolution de conducteur.
const stripAcc = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const normPrenom = (s: unknown) => stripAcc(String(s ?? "").trim().split(/\s+/)[0].toLowerCase());
const normNomComplet = (s: unknown) => stripAcc(String(s ?? "").trim().toLowerCase()).replace(/\s+/g, " ").trim();
// Nom affiché d'un conducteur (FP.conducteurs.displayName) : base + nom si absent de la base.
const condDisplayName = (c: any) => {
  const base = String(c.name || c.prenom || c.key || "").trim();
  return (c.nom && !base.toLowerCase().includes(String(c.nom).toLowerCase())) ? (base + " " + c.nom).trim() : base;
};
// Résout l'e-mail du chauffeur d'un véhicule (FP.conducteurs.find + garde anti-homonyme de FP.kmCollecte.emailDe).
// list = conducteurs NON masqués de la société. Renvoie '' si introuvable ou prénom nu ambigu.
function resolveEmail(chauffeur: string, list: any[]): string {
  const nm = String(chauffeur || "").trim();
  if (!nm || nm === "—") return "";
  // 1) match exact sur le nom complet.
  const full = normNomComplet(nm);
  let c: any = null;
  if (full) c = list.find((x) => normNomComplet(condDisplayName(x)) === full) || null;
  // 2) repli par prénom seul — bloqué si plusieurs conducteurs portent ce prénom.
  if (!c) {
    const k = normPrenom(nm);
    if (!k) return "";
    const matches = list.filter((x) => normPrenom(x.name || x.prenom || x.key) === k);
    if (matches.length !== 1) return "";
    c = matches[0];
  }
  // Garde e-mails distincts pour un même prénom nu (comme emailDe) : ne pas écrire au mauvais salarié.
  if (String(nm).split(/\s+/).length === 1) {
    const k = normPrenom(nm);
    const emails = [...new Set(list.filter((x) => normPrenom(x.name || x.prenom || x.key) === k && String(x.email || "").trim()).map((x) => String(x.email).trim().toLowerCase()))];
    if (emails.length >= 2) return "";
  }
  return String((c && c.email) || "").trim();
}
// Hors flotte (même liste que FP.horsFlotte côté site) : on ne relance pas ces véhicules.
const HORS_FLOTTE = new Set(["vendu", "vendue", "à vendre", "a vendre", "a-vendre", "cédé", "cede", "cédée", "hors service", "hors-service", "hs", "archive", "archivé", "archivée", "restitué", "restitue"]);
const horsFlotte = (statut: unknown) => HORS_FLOTTE.has(String(statut ?? "").toLowerCase().trim());
const uuid = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : (Date.now().toString(36) + Math.random().toString(36).slice(2, 14)));

// « Km à faire » — MÊME règle que l'alerte du site (buildAlertes → relevé km à faire) : selon le dernier
// km connu (kmMajDates), avec ou sans date d'ancrage de cycle. Sert à déclencher la 1re demande auto.
function kmDue(immat: string, kmDates: Record<string, unknown>, notif: any, nowTs: number): boolean {
  const periodeJ = Math.max(1, Number(notif.releveKmJours) || 45);
  const kim = normImmat(immat);
  let lastUpd = 0;
  for (const key in kmDates) { if (normImmat(key) === kim) { const t = new Date(kmDates[key] as string).getTime(); if (!isNaN(t)) lastUpd = Math.max(lastUpd, t); } }
  const debut = (notif.releveKmDebut ? new Date(notif.releveKmDebut) : null);
  if (debut && !isNaN(debut.getTime())) {
    const dsStart = Math.floor((nowTs - debut.getTime()) / 86400000);
    if (dsStart < 0) return false;                                   // cycle pas encore commencé
    const cycles = Math.floor(dsStart / periodeJ);
    const echeance = debut.getTime() + cycles * periodeJ * 86400000;
    return !(lastUpd && lastUpd >= echeance);                        // relevé déjà fait après la dernière échéance ?
  }
  if (!lastUpd) return true;                                          // jamais renseigné
  return Math.floor((nowTs - lastUpd) / 86400000) >= periodeJ;
}

// E-mail de relance (branded, sobre) : logo société (URL http) ou marque Parc Pilot, plaque, bouton.
// Logo Parc Pilot « en dur » (identique au site : FP.ppLogoMail) — HTML pur (jamais bloqué comme une image).
// Emballe l'e-mail dans un document forçant le SCHÉMA CLAIR → mêmes couleurs en clair ET en sombre
// (Gmail/Apple Mail n'inversent plus). Identique à FP.mailDocument côté site.
function mailDoc(inner: string): string {
  return '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="color-scheme" content="only light">'
    + '<meta name="supported-color-schemes" content="only light">'
    + '</head><body style="margin:0;padding:0;background:#EEF2F7;color:#0F1E3D">' + inner + '</body></html>';
}
function ppLogoMail(): string {
  return '<span style="display:inline-block;vertical-align:middle;line-height:0;margin-right:9px">'
    + '<span style="display:block;width:17px;height:4px;background:#F8A24A;border-radius:3px"></span>'
    + '<span style="display:block;width:26px;height:4px;background:#F97316;border-radius:3px;margin-top:3px"></span>'
    + '<span style="display:block;width:11px;height:4px;background:#F97316;border-radius:3px;margin-top:3px"></span>'
    + '</span>'
    + '<span style="font-weight:900;font-style:italic;font-size:16px;color:#ffffff;vertical-align:middle">Parc</span>'
    + '<span style="font-weight:900;font-style:italic;font-size:16px;color:#F97316;vertical-align:middle">Pilot</span>';
}
// Pied de page commun : le logo Parc Pilot SEUL (aucun texte « société · via ») — identique au site.
function ppFooter(_nomSoc: string): string {
  return '<div style="background-color:#0B1220;padding:18px 22px;border-radius:0 0 14px 14px;text-align:center">'
    + '<div>' + ppLogoMail() + '</div>'
    + '</div>';
}
function mailHead(nomSoc: string, logoUrl: string): string {
  return logoUrl
    ? '<img src="' + esc(logoUrl) + '" alt="' + esc(nomSoc || "Logo") + '" style="max-height:40px;max-width:180px;object-fit:contain;background:#fff;border-radius:8px;padding:5px 8px;display:block">'
    : (nomSoc
        ? '<span style="font-weight:900;font-size:17px;color:#ffffff;letter-spacing:.02em">' + esc(nomSoc) + '</span>'
        : ppLogoMail());
}

// Remplissage des balises d'un modèle e-mail éditable (identique à FP.fillTags côté site).
function fillTags(tpl: string, o: Record<string, unknown>): string {
  let s = String(tpl == null ? "" : tpl);
  const first = String(o.prenom || "").trim().split(/\s+/)[0] || "";
  s = s.replace(/ ?\{prenom\}/gi, first ? " " + first : "");
  ["immat", "motif", "date"].forEach((k) => {
    const v = String(o[k] == null ? "" : o[k]).trim();
    s = s.replace(new RegExp(" ?\\{" + k + "\\}", "gi"), v ? " " + v : "");
  });
  return s.replace(/\n{3,}/g, "\n\n").trim();
}
function bodyText(t: string): string { return '<div style="white-space:pre-wrap;line-height:1.55">' + esc(t).replace(/\n/g, "<br>") + "</div>"; }
const DEF_RELEVEKM = "Bonjour {prenom},\n\nMerci d'indiquer le kilométrage actuel de ton véhicule {immat}. C'est rapide : un clic, un nombre, terminé.";
const DEF_RAPPELGARAGE = "Bonjour {prenom},\n\nPetit rappel : ton rendez-vous {motif} pour le véhicule {immat} est prévu demain. Pense à t'organiser !";

function buildMail(opts: { prenom: string; immat: string; marque: string; link: string; nomSoc: string; logoUrl: string; relance: boolean; modele?: string }) {
  const { prenom, immat, marque, link, nomSoc, logoUrl, relance } = opts;
  const subject = "Relevé kilométrique" + (immat ? " (" + immat + ")" : "") + (relance ? " (rappel)" : "");
  const title = relance ? "Petit rappel : relevé kilométrique" : "Relevé kilométrique demandé";
  // Message ÉDITABLE (Paramètres → E-mails). {prenom} {immat}. Repli = texte par défaut.
  const msg = fillTags((opts.modele && String(opts.modele).trim()) ? String(opts.modele) : DEF_RELEVEKM, { prenom, immat });
  const plate = immat
    ? '<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;white-space:nowrap"><tr>'
      + '<td style="background:#1B48C4;color:#fff;font-family:Arial,sans-serif;font-weight:800;font-size:11px;padding:8px 7px;border:2px solid #0b0b0b;border-right:none;border-radius:7px 0 0 7px">F</td>'
      + '<td style="background:#fff;color:#0b0b0b;font-family:Arial,sans-serif;font-weight:800;font-size:18px;letter-spacing:2px;padding:6px 14px;border:2px solid #0b0b0b;border-radius:0 7px 7px 0">' + esc(immat) + "</td></tr></table>"
    : "";
  const html = ''
    + '<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;color:#0F1E3D">'
    + '<div style="background-color:#0B1220;background-image:linear-gradient(135deg,#0B1220,#1E293B);color:#ffffff;padding:22px 24px;border-radius:14px 14px 0 0">'
    + '<div>' + mailHead(nomSoc, logoUrl) + "</div>"
    + '<div style="font-size:20px;font-weight:800;font-style:italic;margin-top:16px;line-height:1.25;color:#ffffff">' + title + "</div>"
    + (prenom ? '<div style="font-size:16px;font-weight:700;margin-top:14px;color:#fff">' + esc(prenom) + "</div>" : "")
    + (plate ? '<div style="margin-top:14px">' + plate + "</div>" : "")
    + "</div>"
    + '<div style="border:1px solid #E7EBF0;border-top:none;padding:22px">'
    + bodyText(msg)
    + '<p style="text-align:center;margin:22px 0">'
    + '<a href="' + esc(link) + '" style="display:inline-block;background:#0B1220;color:#fff;text-decoration:none;padding:14px 26px;border-radius:10px;font-weight:800;font-size:15px">Indiquer mon kilométrage →</a>'
    + "</p>"
    + '<p style="margin:14px 0 0;font-size:12px;color:#94A3B8">Si le bouton ne fonctionne pas, copie ce lien :<br>' + esc(link) + "</p>"
    + "</div>"
    + ppFooter(nomSoc)
    + "</div>";
  const text = msg + "\n\nClique sur ce lien : " + link + "\n\n" + (nomSoc || "Parc Pilot");
  return { subject, html: mailDoc(html), text };
}

// E-mail « rappel rendez-vous garage demain » (branded, même en-tête que le relevé km, sans bouton).
// motif = libellé humain de l'intervention (« Révision », « Contrôle technique », « Réparation »…).
function buildCtMail(opts: { prenom: string; immat: string; marque: string; dateFr: string; nomSoc: string; logoUrl: string; motif?: string; modele?: string }) {
  const { prenom, immat, dateFr, nomSoc, logoUrl } = opts;
  const motif = String(opts.motif || "Contrôle technique").trim() || "Contrôle technique";
  const motifBas = motif.toLowerCase();
  const subject = "Rappel : " + motifBas + " demain" + (immat ? " (" + immat + ")" : "");
  // Message ÉDITABLE (Paramètres → E-mails). {prenom} {immat} {motif} {date}.
  const msg = fillTags((opts.modele && String(opts.modele).trim()) ? String(opts.modele) : DEF_RAPPELGARAGE, { prenom, immat, motif, date: dateFr });
  const plate = immat
    ? '<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;white-space:nowrap"><tr>'
      + '<td style="background:#1B48C4;color:#fff;font-family:Arial,sans-serif;font-weight:800;font-size:11px;padding:8px 7px;border:2px solid #0b0b0b;border-right:none;border-radius:7px 0 0 7px">F</td>'
      + '<td style="background:#fff;color:#0b0b0b;font-family:Arial,sans-serif;font-weight:800;font-size:18px;letter-spacing:2px;padding:6px 14px;border:2px solid #0b0b0b;border-radius:0 7px 7px 0">' + esc(immat) + "</td></tr></table>"
    : "";
  const html = ''
    + '<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;color:#0F1E3D">'
    + '<div style="background-color:#0B1220;background-image:linear-gradient(135deg,#0B1220,#1E293B);color:#ffffff;padding:22px 24px;border-radius:14px 14px 0 0">'
    + '<div>' + mailHead(nomSoc, logoUrl) + "</div>"
    + '<div style="font-size:20px;font-weight:800;font-style:italic;margin-top:16px;line-height:1.25;color:#ffffff">' + esc(motif) + ' demain</div>'
    + (prenom ? '<div style="font-size:16px;font-weight:700;margin-top:14px;color:#fff">' + esc(prenom) + "</div>" : "")
    + (plate ? '<div style="margin-top:14px">' + plate + "</div>" : "")
    + "</div>"
    + '<div style="border:1px solid #E7EBF0;border-top:none;padding:22px">'
    + bodyText(msg)
    + "</div>"
    + ppFooter(nomSoc)
    + "</div>";
  const text = msg + "\n\n" + (nomSoc || "Parc Pilot");
  return { subject, html: mailDoc(html), text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  const SUPA = Deno.env.get("SUPABASE_URL");
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPA || !SERVICE) return json({ error: "Configuration serveur incomplète." }, 500);

  // --- Authentification : secret cron OU JWT de CEO (test manuel). ---
  const SECRET = (Deno.env.get("KM_RELANCE_SECRET") || "").trim();
  const provided = (req.headers.get("x-cron-secret") || "").trim();
  let authed = false;
  if (SECRET && provided && provided === SECRET) authed = true;
  if (!authed) {
    // Repli : un CEO connecté (is_admin) peut lancer la relance à la main.
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (token && ANON) {
      try {
        const u = await fetch(`${SUPA}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: ANON } });
        if (u.ok) {
          const uj = await u.json().catch(() => null);
          const id = (uj && (uj.id || (uj.user && uj.user.id))) || "";
          if (id) {
            const pr = await fetch(`${SUPA}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=is_admin`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
            if (Array.isArray(pr) && pr[0] && pr[0].is_admin) authed = true;
          }
        }
      } catch (_) { /* ignore */ }
    }
  }
  if (!authed) return json({ error: "Non autorisé." }, 401);

  let body: { dryRun?: boolean; societe?: string } = {};
  try { body = await req.json(); } catch { /* body vide = ok */ }
  const dryRun = !!body.dryRun;
  const onlySoc = body.societe ? String(body.societe).trim() : "";

  const RESEND_KEY = (Deno.env.get("RESEND_API_KEY") || "").trim();
  const envFrom = Deno.env.get("EMAIL_FROM") || "Parc Pilot <onboarding@resend.dev>";
  const MAXREL = Math.max(1, Number(Deno.env.get("KM_RELANCE_MAX")) || 4);
  const BASE = (Deno.env.get("KM_FORM_BASE") || "https://parc-pilot.fr/km.html").replace(/\/+$/, "");
  if (!dryRun && !RESEND_KEY) return json({ error: "RESEND_API_KEY absent." }, 500);

  const rest = (path: string, init?: RequestInit) =>
    fetch(`${SUPA}/rest/v1/${path}`, { ...(init || {}), headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", ...((init && init.headers) || {}) } });
  const getJson = (path: string) => rest(path).then((r) => (r.ok ? r.json() : [])).catch(() => []);

  // --- Chargement des données (service_role = toutes sociétés). ---
  const [settingsRows, vehicules, reqs, conducteurs] = await Promise.all([
    getJson("app_settings?select=id,data"),
    getJson("vehicules?select=id,immat,marque,modele,chauffeur,statut,societe,km,prochain_ct&limit=100000"),
    getJson("km_requests?select=id,vehicule_id,plaque,societe,chauffeur,email,km_avant,km_recu,sent_at,used_at,expires_at,source,created_at&order=created_at.desc&limit=100000"),
    getJson("conducteurs?select=key,name,nom,prenom,email,masque,societe&limit=100000"),
  ]);
  const cfgBySoc: Record<string, any> = {};
  (settingsRows as any[]).forEach((r) => { if (r && r.id) cfgBySoc[r.id] = (r.data && typeof r.data === "object") ? r.data : {}; });
  // Conducteurs NON masqués groupés par société (pour résoudre l'e-mail d'une 1re demande auto).
  const condBySoc: Record<string, any[]> = {};
  (conducteurs as any[]).forEach((c) => { if (!c || c.masque) return; const s = String(c.societe || "PXP"); (condBySoc[s] || (condBySoc[s] = [])).push(c); });

  // Demandes groupées par véhicule.
  const reqByVeh: Record<string, any[]> = {};
  (reqs as any[]).forEach((r) => { const k = String(r.vehicule_id || ""); if (!k) return; (reqByVeh[k] || (reqByVeh[k] = [])).push(r); });

  const now = Date.now();
  const summary: Record<string, { sent: number; skipped: number; failed: number }> = {};
  const details: Array<{ societe: string; immat: string; email: string; days: number; status: string; error?: string }> = [];
  const bump = (soc: string, k: "sent" | "skipped" | "failed") => { (summary[soc] || (summary[soc] = { sent: 0, skipped: 0, failed: 0 }))[k]++; };

  // Envoi effectif d'une demande (1re demande OU relance) : insère la ligne km_requests puis le mail.
  const envoyer = async (veh: any, soc: string, data: any, email: string, chauffeur: string, relance: boolean, days: number) => {
    if (dryRun) { bump(soc, "sent"); details.push({ societe: soc, immat: veh.immat || "", email, days, status: relance ? "dry-run-relance" : "dry-run-1re-demande" }); return; }
    const token = uuid();
    const kmAvant = Number.isFinite(Number(veh.km)) && Number(veh.km) > 0 ? Math.round(Number(veh.km)) : null;
    const row = {
      token, vehicule_id: String(veh.id), plaque: veh.immat || "", societe: soc,
      chauffeur: chauffeur || veh.chauffeur || "", email,
      km_avant: kmAvant, source: relance ? "relance" : "auto",
      sent_at: new Date().toISOString(), expires_at: new Date(Date.now() + 21 * 864e5).toISOString(),
    };
    const ins = await rest("km_requests", { method: "POST", body: JSON.stringify(row), headers: { Prefer: "return=minimal" } });
    if (!ins.ok) { bump(soc, "failed"); details.push({ societe: soc, immat: veh.immat || "", email, days, status: "insert-echec", error: (await ins.text().catch(() => "")).slice(0, 200) }); return; }
    // Expéditeur scopé par société (mirror send-email), sans copie (demande = juste au chauffeur).
    const p = (data.profil && typeof data.profil === "object") ? data.profil : {};
    const exp = String(p.mailExpediteur || "").trim();
    let from = envFrom, replyTo = "";
    if (exp) {
      const dom = String(p.mailDomaineEnvoi || "").trim().replace(/^@/, "");
      const fromAddr = dom ? (exp.split("@")[0] + "@" + dom) : exp;
      let nom = String((data.societe && data.societe.nom) || "").replace(/[<>"]/g, "").trim();
      if (/^parc\s*pilot$/i.test(nom)) nom = "";
      from = nom ? `${nom} <${fromAddr}>` : fromAddr;
      replyTo = exp;
    }
    const logoUrl = /^https?:\/\//.test(String(p.logoUrl || "")) ? String(p.logoUrl) : "";
    const nomSoc = String((data.societe && data.societe.nom) || "").trim();
    const prenom = String(chauffeur || veh.chauffeur || "").trim().split(/\s+/)[0] || "";
    const link = BASE + "?t=" + token;
    const mail = buildMail({ prenom, immat: veh.immat || "", marque: ((veh.marque || "") + " " + (veh.modele || "")).trim(), link, nomSoc, logoUrl, relance, modele: String(p.mailModeleReleveKm || "") });
    const payload: Record<string, unknown> = { from, to: [email], subject: mail.subject, html: mail.html, text: mail.text };
    if (replyTo) payload.reply_to = replyTo;
    try {
      const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok) { bump(soc, "failed"); details.push({ societe: soc, immat: veh.immat || "", email, days, status: "resend-echec", error: (await r.text().catch(() => "")).slice(0, 200) }); return; }
      bump(soc, "sent"); details.push({ societe: soc, immat: veh.immat || "", email, days, status: relance ? "relance-envoyee" : "1re-demande-envoyee" });
    } catch (e) {
      bump(soc, "failed"); details.push({ societe: soc, immat: veh.immat || "", email, days, status: "reseau-echec", error: String(e).slice(0, 200) });
    }
  };

  for (const veh of (vehicules as any[])) {
    const soc = String(veh.societe || "PXP");
    if (onlySoc && soc !== onlySoc) continue;
    if (horsFlotte(veh.statut)) continue;
    // ⚠️ Ne PAS replier sur la config PXP : une société sans réglages enverrait alors ses e-mails sous
    // l'identité (expéditeur/logo/nom) de PXP → mélange d'identités entre clients. Config vide = repli
    // neutre plateforme (EMAIL_FROM, sans logo ni nom d'une autre société). PXP = société comme les autres.
    const data = cfgBySoc[soc] || {};
    const notif = (data.notif && typeof data.notif === "object") ? data.notif : {};
    const relanceJours = Math.max(1, Number(notif.releveKmRelanceJours) || 7);
    const releveKmJours = Math.max(1, Number(notif.releveKmJours) || 45);
    const excl = (data.kmSuiviExclus && typeof data.kmSuiviExclus === "object") ? data.kmSuiviExclus : {};
    if (excl[veh.id]) continue; // décoché du suivi km
    const kmDates = (data.kmMajDates && typeof data.kmMajDates === "object") ? data.kmMajDates : {};

    const list = reqByVeh[String(veh.id)] || [];

    // ⚠️ GARDE « km déjà à jour » (correctif) : on ne relance/redemande JAMAIS un véhicule dont le
    // kilométrage est FRAIS — relevé REÇU (km_requests.used_at) OU mis à jour à la main (kmMajDates)
    // il y a moins de releveKmJours (défaut 45). Sinon une vieille demande restée « sans réponse »
    // (parce que le km a été donné AUTREMENT, ou avant qu'une nouvelle demande parte) déclenchait une
    // relance à tort — « j'ai déjà donné le km mais ça me relance ». Donner le km suffit désormais à
    // tout arrêter (peu importe le canal), car ça rend le véhicule « à jour ».
    {
      const kimG = normImmat(veh.immat);
      let lastKnownTs = list.filter((r) => r.used_at && r.km_recu != null).map((r) => new Date(r.used_at).getTime()).filter((t) => !isNaN(t)).reduce((m, t) => Math.max(m, t), 0);
      for (const key in kmDates) { if (normImmat(key) === kimG) { const t = new Date(kmDates[key]).getTime(); if (!isNaN(t)) lastKnownTs = Math.max(lastKnownTs, t); } }
      if (lastKnownTs && (now - lastKnownTs) < releveKmJours * 86400000) continue; // km frais → rien à demander
    }

    const sent = list.filter((r) => r.sent_at).sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
    const last = sent[0];

    // Y a-t-il une demande EN COURS (envoyée, sans réponse et non doublée par un relevé arrivé après) ?
    let pending: any = null, pendingSent = 0;
    if (last && !last.used_at) {
      const lastSent = new Date(last.sent_at).getTime();
      if (!isNaN(lastSent)) {
        const respondedAfter = list.some((r) => r.used_at && r.km_recu != null && new Date(r.used_at).getTime() >= lastSent);
        let updTs = 0; const kim = normImmat(veh.immat);
        for (const key in kmDates) { if (normImmat(key) === kim) { const t = new Date(kmDates[key]).getTime(); if (!isNaN(t)) updTs = Math.max(updTs, t); } }
        if (!respondedAfter && !(updTs >= lastSent)) { pending = last; pendingSent = lastSent; }
      }
    }

    if (pending) {
      // ── RELANCE d'une demande en cours ──
      const days = Math.floor((now - pendingSent) / 86400000);
      if (days < relanceJours) continue;                       // pas encore l'heure de relancer
      // Plafond de relances tant qu'aucun relevé n'est reçu (évite le harcèlement).
      const lastRecuTs = list.filter((r) => r.used_at && r.km_recu != null).map((r) => new Date(r.used_at).getTime()).filter((t) => !isNaN(t)).sort((a, b) => b - a)[0] || 0;
      const sentInStreak = sent.filter((r) => new Date(r.sent_at).getTime() > lastRecuTs).length;
      if (sentInStreak >= MAXREL) { bump(soc, "skipped"); details.push({ societe: soc, immat: veh.immat || "", email: "", days, status: "plafond-atteint" }); continue; }
      const email = String(pending.email || "").trim();
      if (!email) { bump(soc, "skipped"); details.push({ societe: soc, immat: veh.immat || "", email: "", days, status: "sans-email" }); continue; }
      await envoyer(veh, soc, data, email, pending.chauffeur || veh.chauffeur || "", true, days);
    } else {
      // ── 1re DEMANDE AUTO : aucune demande en cours, et le km est EN RETARD (même règle que l'alerte du site). ──
      if (!kmDue(veh.immat, kmDates, notif, now)) continue;
      const email = resolveEmail(String(veh.chauffeur || ""), condBySoc[soc] || []);
      if (!email) { bump(soc, "skipped"); details.push({ societe: soc, immat: veh.immat || "", email: "", days: 0, status: "sans-email" }); continue; }
      await envoyer(veh, soc, data, email, String(veh.chauffeur || ""), false, 0);
    }
  }

  // ============================================================================
  //  RAPPEL « VEILLE DE CONTRÔLE TECHNIQUE » — e-mail AUTO au conducteur (+ gestionnaire en copie).
  //  Déclenché par la MÊME tâche quotidienne (aucun réglage/secret supplémentaire). Fenêtre = 1 jour :
  //  on envoie quand l'échéance `prochain_ct` tombe DEMAIN (Europe/Paris) → au plus 1 envoi par échéance,
  //  donc pas besoin d'état anti-spam. Destinataires : le conducteur (résolu comme la relance km) + le
  //  gestionnaire (adresses d'envoi de la société : mailExpediteur + mailCopie) en copie. Isolé dans un
  //  try/catch : ne peut JAMAIS perturber la relance km ci-dessus. (La « prochaine révision » est une
  //  ESTIMATION mouvante — elle reste dans l'écran « Relances » manuel, pas dans ce rappel « la veille ».)
  const ctSummary: Record<string, { sent: number; skipped: number; failed: number }> = {};
  const ctBump = (soc: string, k: "sent" | "skipped" | "failed") => { (ctSummary[soc] || (ctSummary[soc] = { sent: 0, skipped: 0, failed: 0 }))[k]++; };
  const ctDetails: any[] = [];
  try {
    const parisYMD = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
    const demain = parisYMD(new Date(now + 86400000));
    for (const veh of (vehicules as any[])) {
      const soc = String(veh.societe || "PXP");
      if (onlySoc && soc !== onlySoc) continue;
      if (horsFlotte(veh.statut)) continue;
      const data = cfgBySoc[soc] || {};
      const ignores = (data.ignores && typeof data.ignores === "object") ? data.ignores : {};
      // Échéances « demain » à rappeler pour ce véhicule : (1) le CONTRÔLE TECHNIQUE (colonne prochain_ct,
      // sauf ignoré) et (2) tout RENDEZ-VOUS GARAGE saisi (settings.vehRdvGarage[vehId] = {date, motif}).
      // Regroupés (consigne utilisateur : « un rdv au garage = pareil ; CT et révision, regroupe ça »).
      const targets: Array<{ motif: string }> = [];
      const ctYmd = String((veh as any).prochain_ct ?? "").trim().slice(0, 10);
      if (ctYmd && ctYmd === demain && !ignores["conf:ct:" + veh.id]) targets.push({ motif: "Contrôle technique" });
      const rdvMap = (data.vehRdvGarage && typeof data.vehRdvGarage === "object") ? data.vehRdvGarage : {};
      const rdv = rdvMap[veh.id];
      if (rdv && rdv.date && String(rdv.date).slice(0, 10) === demain) targets.push({ motif: String(rdv.motif || "Rendez-vous garage").trim() || "Rendez-vous garage" });
      if (!targets.length) continue;
      const p = (data.profil && typeof data.profil === "object") ? data.profil : {};
      const condEmail = resolveEmail(String(veh.chauffeur || ""), condBySoc[soc] || []);
      const gestion = [String(p.mailExpediteur || "").trim(), String(p.mailCopie || "").trim()].filter(Boolean);
      const toList = [...new Set([condEmail, ...gestion].filter(Boolean).map((x) => x.toLowerCase()))];
      if (!toList.length) { ctBump(soc, "skipped"); ctDetails.push({ societe: soc, immat: veh.immat || "", status: "aucun-destinataire" }); continue; }
      // Identité expéditeur scopée société (mirror `envoyer` / send-email), repli neutre plateforme.
      let from = envFrom, replyTo = "";
      const exp = String(p.mailExpediteur || "").trim();
      if (exp) {
        const dom = String(p.mailDomaineEnvoi || "").trim().replace(/^@/, "");
        const fromAddr = dom ? (exp.split("@")[0] + "@" + dom) : exp;
        let nom = String((data.societe && data.societe.nom) || "").replace(/[<>"]/g, "").trim();
        if (/^parc\s*pilot$/i.test(nom)) nom = "";
        from = nom ? `${nom} <${fromAddr}>` : fromAddr; replyTo = exp;
      }
      const logoUrl = /^https?:\/\//.test(String(p.logoUrl || "")) ? String(p.logoUrl) : "";
      const nomSoc = String((data.societe && data.societe.nom) || "").trim();
      const prenom = String(veh.chauffeur || "").trim().split(/\s+/)[0] || "";
      const dateFr = demain.split("-").reverse().join("/");
      // Un e-mail par motif dû demain (en pratique 1 seul ; CT + rdv le même jour = 2, rare).
      for (const tg of targets) {
        if (dryRun) { ctBump(soc, "sent"); ctDetails.push({ societe: soc, immat: veh.immat || "", to: toList, motif: tg.motif, status: "dry-run" }); continue; }
        const mail = buildCtMail({ prenom, immat: veh.immat || "", marque: ((veh.marque || "") + " " + (veh.modele || "")).trim(), dateFr, nomSoc, logoUrl, motif: tg.motif, modele: String(p.mailModeleRappelGarage || "") });
        const payload: Record<string, unknown> = { from, to: toList, subject: mail.subject, html: mail.html, text: mail.text };
        if (replyTo) payload.reply_to = replyTo;
        try {
          const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          if (!r.ok) { ctBump(soc, "failed"); ctDetails.push({ societe: soc, immat: veh.immat || "", motif: tg.motif, status: "resend-echec", error: (await r.text().catch(() => "")).slice(0, 200) }); }
          else { ctBump(soc, "sent"); ctDetails.push({ societe: soc, immat: veh.immat || "", to: toList, motif: tg.motif, status: "envoye" }); }
        } catch (e) { ctBump(soc, "failed"); ctDetails.push({ societe: soc, immat: veh.immat || "", motif: tg.motif, status: "reseau-echec", error: String(e).slice(0, 200) }); }
      }
    }
  } catch (e) { ctDetails.push({ status: "exception", error: String(e).slice(0, 200) }); }

  return json({ ok: true, dryRun, max: MAXREL, summary, details, ctSummary, ctDetails });
});
