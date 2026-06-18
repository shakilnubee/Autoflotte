// ============================================================
//  Edge Function : scan-doc
//  Relais sécurisé entre Parc Pilot et l'API Claude (Haiku).
//  - garde la clé ANTHROPIC_API_KEY côté serveur (jamais dans le site)
//  - n'accepte que les utilisateurs connectés (JWT vérifié par Supabase)
//  - lit une facture/document et renvoie les champs en JSON
//
//  Déploiement : Supabase → Edge Functions → New function "scan-doc"
//  → coller ce code → Deploy.  Secret requis : ANTHROPIC_API_KEY.
// ============================================================

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6"; // lecture d'image plus fine (documents difficiles)
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { ...CORS, "content-type": "application/json" },
  });
}
function buildPrompt() {
  return [
    "Lis attentivement ce document de gestion de flotte (facture, permis de conduire, carte identite, carte grise, assurance, controle technique, etc.). Le document peut etre incline ou de travers : redresse-le mentalement.",
    "Identifie son type puis extrais les infos. Renvoie UNIQUEMENT un objet JSON valide, sans aucun texte autour, avec ces cles (mets null si l info est absente) :",
    "docType : un parmi facture, sinistre, permis, carte-identite, carte-grise, assurance, controle-technique, autre.",
    "date : date principale du document au format AAAA-MM-JJ (pour une facture, la date d emission).",
    "fournisseur : pour une facture, nom de la societe qui EMET la facture (souvent en haut avec un SIREN ou SIRET). Ce n est PAS le client TJMAX.",
    "numeroFacture, vehiculeImmat (plaque francaise AB-123-CD), km (entier sans espaces).",
    "montantHT, montantTVA, montantTTC (nombres a point decimal).",
    "description : courte, max 80 caracteres.",
    "AMENDE / AVIS DE CONTRAVENTION / PV - repere precisement :",
    "- numeroAvis : le grand numero 'Numero de l avis de contravention', en general EN HAUT A GAUCHE, 10 chiffres. Recopie CHAQUE chiffre exactement (ne confonds pas 3 et 8, 0 et 6, 1 et 7).",
    "- motif : nature de l infraction (ex Exces de vitesse, Stationnement, Feu rouge, Telephone au volant, Ceinture).",
    "- points : nombre de points retires (entier). Exces de vitesse inferieur a 20 km/h = 1 point ; stationnement = 0. Si ce n est pas ecrit clairement, mets null (ne devine pas).",
    "- date : la date de l INFRACTION / de constatation (souvent 'constate le JJ/MM/AAAA a HHhMM'), PAS la date d edition de l avis, ET SURTOUT PAS la date du jour.",
    "- montantTTC : le montant a payer, dans la section 'Montant de l amende' EN BAS de l avis. Il y a souvent 3 montants : amende forfaitaire (ex 68), montant MINORE 'ramene a' si paiement rapide (ex 45), montant MAJORE (ex 180). Mets le montant MINORE s il existe, sinon le forfaitaire. C est un PETIT montant (en general entre 11 et 1500 euros). NE prends JAMAIS comme montant un numero d avis, de telepaiement, de telephone, une reference, un code, une annee ou un code postal.",
    "- vehiculeImmat : la plaque.",
    "- numeroTelepaiement : le numero de telepaiement pour payer en ligne. Il est sur la NOTICE / CARTE DE PAIEMENT (souvent une AUTRE PAGE du document, pas la 1re), sous le libelle 'N° de telepaiement'. C'est ~10 a 14 chiffres. Donne UNIQUEMENT les chiffres, sans espaces.",
    "- cle : la 'Cle' (de telepaiement) associee, en general 2 chiffres, juste a cote du numero de telepaiement.",
    "CONTROLE TECHNIQUE (proces-verbal de controle technique automobile) :",
    "- controleTechniqueProchain : la date du PROCHAIN controle technique / fin de validite (souvent 'Prochain controle technique avant le JJ/MM/AAAA', 'visite a effectuer avant le', 'valable jusqu au'). Format AAAA-MM-JJ. C est une date FUTURE.",
    "- date : pour un controle technique, la date a laquelle le controle a ete EFFECTUE (date de la visite).",
    "PERMIS - distingue bien les rubriques numerotees : rubrique 3 = DATE DE NAISSANCE (ne l utilise JAMAIS comme date du permis). rubrique 4a = date de delivrance du permis = permisObtention. rubrique 4b = date d expiration = permisExpiration. rubrique 5 = numero du permis = permisNumero. rubrique 9 = categories = permisType.",
    "permisNumero : RUBRIQUE 5 uniquement (ex 16AQ28381, 9 a 12 caracteres). N utilise JAMAIS la longue ligne tout en bas (zone machine qui commence par D1FRA).",
    "permisObtention (4a) est toujours bien POSTERIEURE a la date de naissance (4a apres la rubrique 3). Si la date que tu allais mettre en permisObtention est egale ou proche de la rubrique 3, c est une erreur : reprends la 4a, ou mets null. permisExpiration = 4b du RECTO uniquement (jamais les dates par categorie du verso).",
    "idNumero (numero de carte identite ou titre de sejour), idExpiration (AAAA-MM-JJ).",
    "dateNaissance : la DATE DE NAISSANCE = RUBRIQUE 3 du permis (ou la date de naissance d une carte d identite / titre de sejour). Format AAAA-MM-JJ. C est une date passee (personne agee d environ 16 a 100 ans). Ne la confonds PAS avec la date de delivrance (4a) ni d expiration (4b).",
    "personne : nom complet de la personne sur le document (permis, carte identite), sinon null.",
    "REGLES DATES : format europeen jour/mois/annee. Ex 11.03.2030 = 11 mars 2030 = 2030-03-11 (n inverse JAMAIS le jour et le mois). Convertis aussi les dates en lettres.",
    "IMPORTANT : ne devine JAMAIS et n invente JAMAIS. Si tu ne lis pas clairement une valeur, surtout une date, mets null. Ne mets jamais la date du jour. Verifie chaque date avant de repondre.",
    "Montants sans symbole euro ni separateur de milliers (ex 1466.48).",
  ].join("\n");
}
function extractJson(text) {
  if (!text) return null;
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = cleaned.indexOf("{");
  const b = cleaned.lastIndexOf("}");
  if (a === -1 || b === -1 || b < a) return null;
  try { return JSON.parse(cleaned.slice(a, b + 1)); } catch (_) { return null; }
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "ANTHROPIC_API_KEY manquante" }, 500);
  let payload;
  try { payload = await req.json(); } catch (_) { return json({ error: "corps invalide" }, 400); }
  const fileBase64 = payload.fileBase64;
  const mediaType = payload.mediaType || "";
  if (!fileBase64) return json({ error: "aucun fichier" }, 400);
  const isPdf = mediaType.includes("pdf");
  const fileBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: fileBase64 } }
    : { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: fileBase64 } };
  // Le prompt peut venir du SITE (payload.prompt) : ainsi on ajuste la lecture par un simple
  // deploiement GitHub, SANS jamais avoir a redeployer cette fonction. Repli : le prompt interne.
  const promptText = (typeof payload.prompt === "string" && payload.prompt.trim().length > 30)
    ? payload.prompt
    : buildPrompt();
  const body = {
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: [fileBlock, { type: "text", text: promptText }] }],
  };
  let apiRes;
  try {
    apiRes = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return json({ error: "appel API echoue: " + (e && e.message ? e.message : String(e)) }, 502);
  }
  const data = await apiRes.json();
  if (!apiRes.ok) return json({ error: (data && data.error && data.error.message) || "erreur API", status: apiRes.status }, 502);
  const text = (data.content || []).filter((x) => x.type === "text").map((x) => x.text || "").join("");
  const fields = extractJson(text);
  if (!fields) return json({ ok: false, error: "lecture impossible", raw: text }, 200);
  return json({ ok: true, fields, model: MODEL }, 200);
});
