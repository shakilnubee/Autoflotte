// ============================================================
//  Edge Function : scan-doc
//  Relais sécurisé entre Parc Pilot et l'API Claude (Haiku).
//  - garde la clé ANTHROPIC_API_KEY côté serveur (jamais dans le site)
//  - n'accepte que les utilisateurs connectés (JWT vérifié par Supabase)
//  - lit une facture/document et renvoie les champs en JSON
//
//  Déploiement : Supabase → Edge Functions → New function "scan-doc"
//  → coller ce code → Deploy.
//  Secret à définir : ANTHROPIC_API_KEY (Edge Functions → Secrets).
// ============================================================

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

// Consigne d'extraction selon le type de document
function buildPrompt(docType: string): string {
  const base = `Tu es un assistant qui lit des documents de gestion de flotte automobile (factures de garage, carburant, etc.).
Lis ce document et renvoie UNIQUEMENT un objet JSON valide (aucun texte avant ou après), avec ces clés :
- "date" : date d'émission au format AAAA-MM-JJ (convertis les dates en lettres, ex. "12 juin 2026" -> "2026-06-12")
- "fournisseur" : nom de l'émetteur de la facture (la société qui facture)
- "numeroFacture" : numéro de la facture
- "vehiculeImmat" : plaque d'immatriculation française si présente (format "AB-123-CD"), sinon null
- "km" : kilométrage du véhicule s'il est indiqué (nombre entier sans espaces), sinon null
- "montantHT" : total hors taxe (nombre, point décimal), sinon null
- "montantTVA" : total TVA (nombre), sinon null
- "montantTTC" : total toutes taxes comprises (nombre), sinon null
- "description" : courte description de la prestation (max 80 caractères), sinon null
Règles : si une information est absente, mets null. Les montants sont des nombres (ex. 1466.48), sans symbole €, sans séparateur de milliers.`;
  return base;
}

function extractJson(text: string): Record<string, unknown> | null {
  if (!text) return null;
  // enlève d'éventuels ```json ... ```
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch (_) {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  // Vérifie qu'un utilisateur est bien connecté (Supabase vérifie déjà le JWT,
  // ce contrôle est une sécurité supplémentaire).
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "ANTHROPIC_API_KEY manquante (secret non défini)" }, 500);

  let payload: { fileBase64?: string; mediaType?: string; docType?: string };
  try {
    payload = await req.json();
  } catch (_) {
    return json({ error: "corps de requête invalide" }, 400);
  }

  const { fileBase64, mediaType, docType } = payload;
  if (!fileBase64) return json({ error: "aucun fichier" }, 400);

  const isPdf = (mediaType || "").includes("pdf");
  const fileBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: fileBase64 } }
    : { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: fileBase64 } };

  const body = {
    model: MODEL,
    max_tokens: 1024,
    messages: [
      { role: "user", content: [fileBlock, { type: "text", text: buildPrompt(docType || "facture") }] },
    ],
  };

  let apiRes: Response;
  try {
    apiRes = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return json({ error: "appel API échoué : " + (e instanceof Error ? e.message : String(e)) }, 502);
  }

  const data = await apiRes.json();
  if (!apiRes.ok) {
    return json({ error: data?.error?.message || "erreur API Claude", status: apiRes.status }, 502);
  }

  const text = (data.content || [])
    .filter((b: { type?: string }) => b.type === "text")
    .map((b: { text?: string }) => b.text || "")
    .join("");
  const fields = extractJson(text);
  if (!fields) return json({ ok: false, error: "lecture impossible", raw: text }, 200);

  return json({ ok: true, fields, model: MODEL }, 200);
});
