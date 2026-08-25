// ============================================================================
//  Parc Pilot — Signature électronique via YOUSIGN (API v3)
//
//  Envoie un PDF (état des lieux…) à Yousign pour signature électronique :
//    1) crée une "signature request"
//    2) y attache le PDF (document signable)
//    3) ajoute le signataire (l'employé) + le champ signature (position)
//    4) active la demande → Yousign envoie l'e-mail de signature au signataire.
//
//  ⚠️ La clé API Yousign vit UNIQUEMENT dans les secrets de l'Edge Function
//     (YOUSIGN_API_KEY), JAMAIS dans le repo (public). L'environnement (bac à sable
//     ou production) est piloté par le secret YOUSIGN_ENV ('sandbox' par défaut).
//
//  Sécurité : cette fonction n'agit que pour un utilisateur CONNECTÉ (verify_jwt reste
//     activé — c'est une action de gestion, pas un portail public).
//
//  Déploiement : automatique (GitHub Action deploy-edge-functions.yml au push sur main).
//  Secrets requis : YOUSIGN_API_KEY (+ YOUSIGN_ENV = 'sandbox' | 'production').
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

function baseUrl() {
  const env = (Deno.env.get("YOUSIGN_ENV") || "sandbox").toLowerCase();
  return env === "production" ? "https://api.yousign.app/v3" : "https://api-sandbox.yousign.app/v3";
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  const KEY = Deno.env.get("YOUSIGN_API_KEY");
  if (!KEY) return json({ error: "Signature indisponible : clé Yousign non configurée côté serveur (YOUSIGN_API_KEY)." }, 500);
  const H = { "Authorization": "Bearer " + KEY };
  const API = baseUrl();

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ error: "Requête invalide." }, 400); }

  const pdfB64 = String(body.pdfBase64 || "");
  const filename = String(body.filename || "document.pdf");
  const signer = (body.signer && typeof body.signer === "object") ? body.signer as Record<string, string> : {};
  const first = String(signer.firstName || "").trim();
  const last = String(signer.lastName || "").trim() || first || "-";
  const email = String(signer.email || "").trim();
  const requestName = String(body.requestName || "État des lieux à signer").slice(0, 180);
  const field = (body.field && typeof body.field === "object") ? body.field as Record<string, number> : {};
  if (!pdfB64) return json({ error: "PDF manquant." }, 400);
  if (!email || !first) return json({ error: "Signataire incomplet (nom / e-mail)." }, 400);

  try {
    // 1) Créer la signature request (envoi par e-mail).
    const srRes = await fetch(API + "/signature_requests", {
      method: "POST",
      headers: { ...H, "Content-Type": "application/json" },
      body: JSON.stringify({ name: requestName, delivery_mode: "email", timezone: "Europe/Paris" }),
    });
    const srTxt = await srRes.text();
    let sr: Record<string, unknown> = {};
    try { sr = JSON.parse(srTxt); } catch { /* garde le texte pour l'erreur */ }
    if (!srRes.ok || !sr.id) return json({ error: "Yousign (création) : " + (String((sr as { detail?: string }).detail || "") || srTxt).slice(0, 300) }, 502);
    const srId = String(sr.id);

    // 2) Attacher le PDF (document signable) — multipart/form-data.
    const fd = new FormData();
    fd.append("nature", "signable_document");
    fd.append("parse_anchors", "false");
    fd.append("file", new Blob([b64ToBytes(pdfB64)], { type: "application/pdf" }), filename);
    const docRes = await fetch(API + "/signature_requests/" + srId + "/documents", { method: "POST", headers: H, body: fd });
    const docTxt = await docRes.text();
    let docObj: Record<string, unknown> = {};
    try { docObj = JSON.parse(docTxt); } catch { /* idem */ }
    if (!docRes.ok || !docObj.id) return json({ error: "Yousign (document) : " + docTxt.slice(0, 300) }, 502);
    const docId = String(docObj.id);

    // 3) Ajouter le signataire + le champ signature (position en points, origine haut-gauche).
    const signerBody = {
      info: { first_name: first, last_name: last, email, locale: "fr" },
      signature_level: "electronic_signature",
      signature_authentication_mode: "no_otp",
      fields: [{
        document_id: docId, type: "signature",
        page: Math.max(1, Math.round(Number(field.page) || 1)),
        x: Math.max(0, Math.round(Number(field.x) || 40)),
        y: Math.max(0, Math.round(Number(field.y) || 700)),
        width: Math.max(60, Math.round(Number(field.width) || 170)),
        height: Math.max(30, Math.round(Number(field.height) || 40)),
      }],
    };
    const sgRes = await fetch(API + "/signature_requests/" + srId + "/signers", {
      method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify(signerBody),
    });
    const sgTxt = await sgRes.text();
    if (!sgRes.ok) return json({ error: "Yousign (signataire) : " + sgTxt.slice(0, 300) }, 502);

    // 4) Activer → Yousign envoie l'e-mail de signature au signataire.
    const actRes = await fetch(API + "/signature_requests/" + srId + "/activate", { method: "POST", headers: H });
    const actTxt = await actRes.text();
    if (!actRes.ok) return json({ error: "Yousign (activation) : " + actTxt.slice(0, 300) }, 502);

    return json({ ok: true, signatureRequestId: srId, env: (Deno.env.get("YOUSIGN_ENV") || "sandbox") });
  } catch (e) {
    return json({ error: "Erreur Yousign : " + ((e && (e as Error).message) || String(e)) }, 500);
  }
});
