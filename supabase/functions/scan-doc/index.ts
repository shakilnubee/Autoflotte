// ============================================================
//  Edge Function : scan-doc
//  Relais sécurisé d'analyse documentaire de Parc Pilot.
//
//  ARCHITECTURE (additive, sûre) :
//   - OPENAI_API_KEY ABSENTE  → Claude seul (comportement HISTORIQUE, inchangé → rien ne casse).
//   - OPENAI_API_KEY PRÉSENTE → OpenAI = lecteur PRINCIPAL (vision PDF/image, JSON strict).
//        + pour les DOCS IMPORTANTS (facture, amende, carte grise, assurance, leasing),
//          Claude = 2ᵉ lecteur INDÉPENDANT (validation champ par champ) :
//            · CONFIRME    → on garde la valeur ;
//            · DIVERGENCE  → on met le champ à null (jamais rempli en silence) + on le signale ;
//            · INTROUVABLE → on garde la valeur OpenAI mais on la signale « à vérifier ».
//        → une donnée douteuse n'est JAMAIS livrée comme sûre (consigne : une donnée fausse est
//          plus dangereuse qu'une donnée vide).
//
//  - Garde les clés côté serveur (jamais dans le site).
//  - N'accepte que les utilisateurs connectés (JWT vérifié par Supabase).
//
//  Secrets Supabase : ANTHROPIC_API_KEY (requis), OPENAI_API_KEY (optionnel → active OpenAI),
//  ANTHROPIC_MODEL / OPENAI_MODEL (optionnels, surcharge des modèles).
// ============================================================

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const OPENAI_URL = "https://api.openai.com/v1/responses";
// Modèles Claude essayés dans l'ordre (1er accepté gardé). Surcharge : secret ANTHROPIC_MODEL.
const MODELS = (Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5,claude-haiku-4-5-20251001,claude-3-5-sonnet-20241022,claude-3-5-sonnet-latest")
  .split(",").map((s) => s.trim()).filter(Boolean);
// Modèles OpenAI essayés dans l'ordre. Surcharge : secret OPENAI_MODEL.
const OPENAI_MODELS = (Deno.env.get("OPENAI_MODEL") || "gpt-4o,gpt-4o-mini")
  .split(",").map((s) => s.trim()).filter(Boolean);
// Types de documents « importants » → double lecture (OpenAI + validation Claude).
const RE_IMPORTANT = /facture|amende|avis|contravention|carte.?grise|assur|leasing|lld|loa|contrat|sinistre|devis|controle|contrôle/i;

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
    "IMPORTANT : remplis le MAXIMUM de champs. Une valeur PRESENTE sur le document doit TOUJOURS etre remplie, meme si elle est petite, penchee, de travers ou de qualite moyenne : fais l effort de la dechiffrer. Ne mets null QUE si l information est vraiment ABSENTE du document, ou totalement illisible (coupee, barbouillee, trop floue pour toute lecture serieuse). Distinction clef : 'difficile a lire mais presente' = tu la lis et tu la remplis ; 'absente ou illisible' = null. Tu ne dois JAMAIS INVENTER une valeur qui n est pas ecrite (surtout pas une date, un montant, un nom de conducteur) ni mettre la date du jour. Si tu hesites entre deux lectures possibles d une valeur PRESENTE, choisis la plus plausible plutot que de laisser vide. Verifie chaque date (jour/mois/annee) avant de repondre.",
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

// ---- Appel CLAUDE (Anthropic) : contenu = [bloc document, {type:text,...}]. Essaie les modèles dans l'ordre.
async function callClaude(apiKey, content, maxTok) {
  let lastErr = "aucun modele disponible", lastStatus = 502;
  for (const m of MODELS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 55000);
    let apiRes;
    try {
      apiRes = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: m, max_tokens: maxTok, messages: [{ role: "user", content }] }),
        signal: ctrl.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      lastErr = (e && e.name === "AbortError") ? "timeout Claude" : ("appel Claude echoue: " + (e && e.message ? e.message : String(e)));
      continue;
    }
    clearTimeout(timer);
    const rawText = await apiRes.text();
    let parsed = null; try { parsed = JSON.parse(rawText); } catch (_) {}
    if (apiRes.ok && parsed) {
      const text = (parsed.content || []).filter((x) => x.type === "text").map((x) => x.text || "").join("");
      return { ok: true, text, model: m };
    }
    lastErr = (parsed && parsed.error && parsed.error.message) || ("HTTP " + apiRes.status + " : " + rawText.slice(0, 200));
    lastStatus = apiRes.status;
    if (apiRes.status === 404 && /model/i.test(lastErr)) continue;  // modèle absent → suivant
    return { ok: false, error: lastErr, status: lastStatus };        // autre erreur → inutile d'insister
  }
  return { ok: false, error: lastErr, status: lastStatus };
}

// ---- Appel OPENAI (Responses API) : PDF via input_file, image via input_image. Essaie les modèles dans l'ordre.
async function callOpenAI(apiKey, fileBase64, mediaType, promptText, maxTok) {
  const isPdf = (mediaType || "").includes("pdf");
  const fileItem = isPdf
    ? { type: "input_file", filename: "document.pdf", file_data: `data:application/pdf;base64,${fileBase64}` }
    : { type: "input_image", image_url: `data:${mediaType || "image/jpeg"};base64,${fileBase64}` };
  const input = [{ role: "user", content: [fileItem, { type: "input_text", text: promptText }] }];
  let lastErr = "aucun modele OpenAI disponible", lastStatus = 502;
  for (const m of OPENAI_MODELS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 55000);
    let apiRes;
    try {
      apiRes = await fetch(OPENAI_URL, {
        method: "POST",
        headers: { "content-type": "application/json", "authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({ model: m, input, max_output_tokens: maxTok }),
        signal: ctrl.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      lastErr = (e && e.name === "AbortError") ? "timeout OpenAI" : ("appel OpenAI echoue: " + (e && e.message ? e.message : String(e)));
      continue;
    }
    clearTimeout(timer);
    const rawText = await apiRes.text();
    let parsed = null; try { parsed = JSON.parse(rawText); } catch (_) {}
    if (apiRes.ok && parsed) {
      // Texte de sortie : convenance output_text, sinon on parcourt output[].content[].text.
      let text = typeof parsed.output_text === "string" ? parsed.output_text : "";
      if (!text && Array.isArray(parsed.output)) {
        for (const it of parsed.output) {
          if (it && Array.isArray(it.content)) for (const c of it.content) { if (c && (c.type === "output_text") && typeof c.text === "string") text += c.text; }
        }
      }
      return { ok: true, text, model: m };
    }
    lastErr = (parsed && parsed.error && parsed.error.message) || ("HTTP " + apiRes.status + " : " + rawText.slice(0, 200));
    lastStatus = apiRes.status;
    const modelNotFound = (apiRes.status === 404 || apiRes.status === 400) && /model/i.test(lastErr);
    if (modelNotFound) continue;
    return { ok: false, error: lastErr, status: lastStatus };
  }
  return { ok: false, error: lastErr, status: lastStatus };
}

// ---- Validation Claude (2e lecteur) : vérifie CHAQUE champ du JSON OpenAI sur le document d'origine.
function buildValidationPrompt(openaiFields) {
  return [
    "Tu es un CONTROLEUR INDEPENDANT. Voici un document, et des donnees extraites par un PREMIER outil (JSON ci-dessous).",
    "Pour CHAQUE cle du JSON (sauf docType), VERIFIE toi-meme la valeur directement sur le document, SANS faire confiance au premier outil.",
    "Renvoie UNIQUEMENT un objet JSON (aucun texte autour) : pour chaque cle, un objet { \"claude\": <la valeur que TU lis sur le document, ou null>, \"status\": \"CONFIRME\" | \"DIVERGENCE\" | \"INTROUVABLE\" }.",
    "- CONFIRME : ta lecture correspond a la valeur du premier outil.",
    "- DIVERGENCE : tu lis une valeur DIFFERENTE (donne-la dans \"claude\").",
    "- INTROUVABLE : cette information n'est pas lisible/presente sur le document.",
    "Ne CONFIRME jamais sans avoir reellement verifie. Ne devine pas. Memes regles de dates (JJ/MM/AAAA -> AAAA-MM-JJ, ne pas inverser jour/mois).",
    "JSON a verifier :",
    JSON.stringify(openaiFields || {}),
  ].join("\n");
}
// Fusion sûre : garde la valeur si CONFIRME ; met null si DIVERGENCE (jamais une donnee douteuse en silence) ;
// garde la valeur OpenAI mais signale si INTROUVABLE. Renvoie { fields, controle } (controle = détail par champ).
function fusionner(openaiFields, validation) {
  const fields = { ...openaiFields };
  const controle = {};
  const aVerifier = [];
  if (!validation || typeof validation !== "object") return { fields, controle, aVerifier };
  for (const k of Object.keys(openaiFields || {})) {
    if (k === "docType") continue;
    const ov = openaiFields[k];
    if (ov == null || ov === "") continue;               // rien à valider si vide
    const v = validation[k];
    if (!v || typeof v !== "object") { continue; }       // champ non évalué → on garde tel quel
    const status = String(v.status || "").toUpperCase();
    controle[k] = { openai: ov, claude: (v.claude != null ? v.claude : null), status };
    if (status === "DIVERGENCE") { fields[k] = null; aVerifier.push(k); }      // douteux → vide + à vérifier
    else if (status === "INTROUVABLE") { aVerifier.push(k); }                   // gardé mais signalé
    // CONFIRME → on garde la valeur telle quelle
  }
  return { fields, controle, aVerifier };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    const reqH = req.headers.get("Access-Control-Request-Headers") || CORS["Access-Control-Allow-Headers"];
    return new Response("ok", { headers: { ...CORS, "Access-Control-Allow-Headers": reqH } });
  }
  try {
    return await handle(req);
  } catch (e) {
    return json({ ok: false, error: "Erreur interne de la fonction : " + (e && e.message ? e.message : String(e)) }, 500);
  }
});

async function handle(req) {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  // SÉCURITÉ : on VALIDE le jeton auprès de Supabase (fail-closed si variables absentes).
  {
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    const SUPA = Deno.env.get("SUPABASE_URL"); const ANON = Deno.env.get("SUPABASE_ANON_KEY");
    if (!SUPA || !ANON) return json({ error: "unauthorized" }, 401);
    try {
      const u = await fetch(`${SUPA}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: ANON } });
      if (!u.ok) return json({ error: "unauthorized" }, 401);
    } catch (_) { return json({ error: "unauthorized" }, 401); }
  }

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!anthropicKey && !openaiKey) return json({ error: "Aucune clé IA configurée (ANTHROPIC_API_KEY / OPENAI_API_KEY)" }, 500);

  let payload;
  try { payload = await req.json(); } catch (_) { return json({ error: "corps invalide" }, 400); }
  const fileBase64 = payload.fileBase64;
  const mediaType = payload.mediaType || "";
  if (!fileBase64) return json({ error: "aucun fichier" }, 400);
  const isPdf = mediaType.includes("pdf");
  const docType = String(payload.docType || "");
  const promptText = (typeof payload.prompt === "string" && payload.prompt.trim().length > 30) ? payload.prompt : buildPrompt();
  let maxTok = 1024;
  const reqTok = Number(payload.maxTokens);
  if (Number.isFinite(reqTok) && reqTok > 1024) maxTok = Math.min(Math.floor(reqTok), 8192);

  // Bloc document pour Claude (format Anthropic).
  const claudeFileBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: fileBase64 } }
    : { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: fileBase64 } };

  // ========== CHEMIN 1 : OpenAI présent → lecteur principal (+ validation Claude sur docs importants) ==========
  if (openaiKey) {
    const oa = await callOpenAI(openaiKey, fileBase64, mediaType, promptText, maxTok);
    if (oa.ok) {
      const fields = extractJson(oa.text);
      if (fields) {
        const important = RE_IMPORTANT.test(docType) || RE_IMPORTANT.test(String(fields.docType || ""));
        // Validation Claude (2e lecteur) — uniquement docs importants + clé Claude dispo.
        if (important && anthropicKey) {
          const vp = buildValidationPrompt(fields);
          const cv = await callClaude(anthropicKey, [claudeFileBlock, { type: "text", text: vp }], Math.max(maxTok, 1500));
          if (cv.ok) {
            const validation = extractJson(cv.text);
            const { fields: merged, controle, aVerifier } = fusionner(fields, validation);
            return json({ ok: true, fields: merged, model: oa.model, validateur: cv.model, controle, aVerifier, lecteur: "openai+claude" }, 200);
          }
          // Validation indisponible → on renvoie quand même l'extraction OpenAI (ne bloque pas la lecture).
          return json({ ok: true, fields, model: oa.model, lecteur: "openai", validationErreur: cv.error }, 200);
        }
        return json({ ok: true, fields, model: oa.model, lecteur: "openai" }, 200);
      }
      // OpenAI a répondu mais JSON illisible → on tente Claude en repli (si dispo).
    }
    // OpenAI indisponible/illisible → REPLI sur Claude seul (si clé dispo) pour ne pas bloquer la lecture.
    if (anthropicKey) {
      const cc = await callClaude(anthropicKey, [claudeFileBlock, { type: "text", text: promptText }], maxTok);
      if (cc.ok) { const fields = extractJson(cc.text); if (fields) return json({ ok: true, fields, model: cc.model, lecteur: "claude (repli)" }, 200); return json({ ok: false, error: "lecture impossible", raw: cc.text }, 200); }
      return json({ error: (oa.error || cc.error || "lecture impossible"), status: cc.status || oa.status || 502 }, 502);
    }
    return json({ error: oa.error || "lecture impossible (OpenAI)", status: oa.status || 502 }, 502);
  }

  // ========== CHEMIN 2 : pas d'OpenAI → Claude seul (COMPORTEMENT HISTORIQUE, inchangé) ==========
  const cc = await callClaude(anthropicKey, [claudeFileBlock, { type: "text", text: promptText }], maxTok);
  if (!cc.ok) return json({ error: cc.error, status: cc.status }, 502);
  const fields = extractJson(cc.text);
  if (!fields) return json({ ok: false, error: "lecture impossible", raw: cc.text }, 200);
  return json({ ok: true, fields, model: cc.model }, 200);
}
