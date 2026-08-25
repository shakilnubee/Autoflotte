// ============================================================================
//  Parc Pilot — Signature électronique INTÉGRÉE d'un état des lieux (fonction PUBLIQUE)
//
//  L'employé (et le signataire société) reçoivent un lien signer.html?t=<token>&who=<role>.
//    • GET  ?t&who   → infos du document (plaque, modèle, PDF à consulter, déjà signé ?)
//    • POST { action:'sign', t, who, nom, signature(dataURL PNG) }
//                    → enregistre la signature ; quand TOUT le monde a signé, reconstruit le
//                      PDF signé (pdf-lib) et le range dans les Documents du véhicule.
//
//  ⚠️ PUBLIQUE (l'employé n'a pas de compte). Sécurité = le TOKEN secret du lien.
//     verify_jwt est désactivé pour cette fonction (supabase/config.toml).
//
//  Déploiement : automatique (GitHub Action au push sur main).
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument } from "npm:pdf-lib@1.17.1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
function admin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
const BUCKET = "scans";

// Extrait {bucket, path} d'une URL Supabase Storage (public|sign|authenticated) → pour re-signer.
function storagePath(url: string): { bucket: string; path: string } | null {
  const m = String(url || "").match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?]+)/);
  if (!m) return null;
  let p = m[2]; try { p = decodeURIComponent(p); } catch { /* garde */ }
  return { bucket: m[1], path: p };
}
async function signedUrl(db: ReturnType<typeof createClient>, url: string, secs = 86400) {
  const r = storagePath(url); if (!r) return url;
  try { const { data } = await db.storage.from(r.bucket).createSignedUrl(r.path, secs); return (data && data.signedUrl) || url; } catch { return url; }
}
async function fetchBytes(db: ReturnType<typeof createClient>, url: string): Promise<Uint8Array | null> {
  try {
    const r = storagePath(url);
    if (r) { const dl = await db.storage.from(r.bucket).download(r.path); if (dl.data) return new Uint8Array(await dl.data.arrayBuffer()); }
    const res = await fetch(url); if (res.ok) return new Uint8Array(await res.arrayBuffer());
  } catch { /* rien */ }
  return null;
}
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64); const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a;
}
function genId(p: string) { return p + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8); }

type Signer = { role: string; nom?: string; email?: string; signed?: boolean; signedAt?: string; ip?: string; sigUrl?: string };

// Reconstruit le PDF signé : appose chaque signature (image PNG) sur SON champ (points, origine
// haut-gauche → pdf-lib origine bas-gauche), avec le nom + la date sous la signature.
async function buildSignedPdf(db: ReturnType<typeof createClient>, row: Record<string, unknown>, signers: Signer[]): Promise<Uint8Array | null> {
  try {
    const base = await fetchBytes(db, String(row.pdf_url || "")); if (!base) return null;
    const pdf = await PDFDocument.load(base);
    const pages = pdf.getPages();
    for (const s of signers) {
      if (!s.sigUrl || s.signed !== true) continue;
      const field = (s.role === "societe" ? row.field_societe : row.field_employe) as Record<string, number> | null;
      if (!field || !field.page) continue;
      const page = pages[Math.max(0, Math.round(Number(field.page)) - 1)]; if (!page) continue;
      const sigBytes = await fetchBytes(db, s.sigUrl); if (!sigBytes) continue;
      let img; try { img = await pdf.embedPng(sigBytes); } catch { continue; }
      const boxW = Number(field.width) || 170, boxH = Number(field.height) || 40;
      const iw = img.width, ih = img.height, sc = Math.min(boxW / iw, boxH / ih);
      const w = iw * sc, h = ih * sc, ph = page.getHeight();
      const x = Number(field.x) || 40, yTop = Number(field.y) || 700;
      const yBottom = ph - yTop - h; // place le HAUT de l'image à yTop (origine bas-gauche pdf-lib)
      page.drawImage(img, { x, y: yBottom, width: w, height: h });
      try {
        const label = (s.nom || "") + (s.signedAt ? "  ·  " + String(s.signedAt).slice(0, 10) : "");
        page.drawText(label, { x, y: Math.max(6, yBottom - 9), size: 7 });
      } catch { /* texte best-effort */ }
    }
    return await pdf.save();
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const db = admin();
  if (!db) return json({ error: "Service indisponible (configuration serveur)." }, 500);

  try {
    // ---- GET : le signataire ouvre son lien → infos du document + sa signature déjà faite ? ----
    if (req.method === "GET") {
      const url = new URL(req.url);
      const token = url.searchParams.get("t") || "";
      const who = (url.searchParams.get("who") || "employe") === "societe" ? "societe" : "employe";
      if (!token) return json({ error: "Lien incomplet." }, 400);
      const { data: row } = await db.from("edl_signatures").select("*").eq("token", token).maybeSingle();
      if (!row) return json({ error: "Lien de signature invalide ou expiré." }, 404);
      const signers = (Array.isArray(row.signataires) ? row.signataires : []) as Signer[];
      const me = signers.find((s) => s.role === who);
      if (!me) return json({ error: "Aucun signataire correspondant à ce lien." }, 404);
      const pdfView = await signedUrl(db, String(row.statut === "signe" && row.signed_pdf_url ? row.signed_pdf_url : row.pdf_url));
      return json({
        ok: true, plaque: row.plaque || "", modele: row.modele || "", employe: row.employe || "",
        sens: row.sens || "remise", date: row.date || "", societe: row.societe || "",
        role: who, nom: me.nom || "", alreadySigned: me.signed === true, statut: row.statut || "en_attente",
        pdfUrl: pdfView,
      });
    }

    // ---- POST : le signataire envoie sa signature (image) ----
    if (req.method === "POST") {
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { return json({ error: "Requête invalide." }, 400); }
      if (String(body.action || "") !== "sign") return json({ error: "Action inconnue." }, 400);
      const token = String(body.t || "").trim();
      const who = String(body.who || "employe") === "societe" ? "societe" : "employe";
      const sigData = String(body.signature || "");
      const nom = String(body.nom || "").trim();
      if (!token) return json({ error: "Lien incomplet." }, 400);
      const m = /^data:image\/png;base64,(.+)$/.exec(sigData);
      if (!m) return json({ error: "Signature manquante — dessine ta signature puis valide." }, 400);

      const { data: row } = await db.from("edl_signatures").select("*").eq("token", token).maybeSingle();
      if (!row) return json({ error: "Lien invalide ou expiré." }, 404);
      const signers = (Array.isArray(row.signataires) ? row.signataires : []) as Signer[];
      const me = signers.find((s) => s.role === who);
      if (!me) return json({ error: "Signataire introuvable." }, 404);
      if (me.signed === true) return json({ ok: true, deja: true, statut: row.statut || "en_attente" });

      // Enregistre l'image de la signature (bucket public "scans").
      let sigUrl = "";
      try {
        const bytes = b64ToBytes(m[1]);
        if (bytes.length > 4_000_000) return json({ error: "Signature trop volumineuse." }, 400);
        const path = "edl-signatures/" + token + "/" + who + "-" + Date.now().toString(36) + ".png";
        const up = await db.storage.from(BUCKET).upload(path, bytes, { contentType: "image/png", upsert: true });
        if (!up.error) { const pub = db.storage.from(BUCKET).getPublicUrl(path); sigUrl = (pub && pub.data && pub.data.publicUrl) || ""; }
      } catch { /* best-effort */ }
      if (!sigUrl) return json({ error: "Échec de l'enregistrement de la signature. Réessaie." }, 500);

      me.signed = true; me.signedAt = new Date().toISOString();
      me.ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "";
      me.sigUrl = sigUrl; if (nom) me.nom = nom;

      // Tout le monde a-t-il signé ? (signataires ayant un e-mail = requis)
      const required = signers.filter((s) => s.email);
      const allSigned = required.length > 0 && required.every((s) => s.signed === true);
      let statut = row.statut || "en_attente";
      let signedPdfUrl = row.signed_pdf_url || null;

      if (allSigned) {
        statut = "signe";
        // Reconstruit le PDF signé + le range dans les Documents du véhicule.
        const signedBytes = await buildSignedPdf(db, row, signers);
        if (signedBytes) {
          try {
            const path = "documents/etat-des-lieux-signe-" + token + ".pdf";
            const up = await db.storage.from(BUCKET).upload(path, signedBytes, { contentType: "application/pdf", upsert: true });
            if (!up.error) {
              const { data: su } = await db.storage.from(BUCKET).createSignedUrl(path, 315360000); // ~10 ans
              signedPdfUrl = (su && su.signedUrl) || db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
            }
          } catch { /* upload best-effort */ }
          if (signedPdfUrl && row.vehicule_id) {
            try {
              await db.from("documents").insert({
                id: genId("D"), vehicule_id: row.vehicule_id, type: "etat-des-lieux",
                label: "État des lieux " + (row.sens === "restitution" ? "restitution" : "remise") + " — signé " + String(row.date || "").slice(0, 10),
                url: signedPdfUrl, societe: row.societe || "PXP",
              });
            } catch { /* best-effort */ }
          }
        }
      }

      await db.from("edl_signatures").update({ signataires: signers, statut, signed_pdf_url: signedPdfUrl }).eq("token", token);
      return json({ ok: true, statut, allSigned });
    }

    return json({ error: "Méthode non autorisée." }, 405);
  } catch (e) {
    return json({ error: (e && (e as Error).message) || "Erreur serveur." }, 500);
  }
});
