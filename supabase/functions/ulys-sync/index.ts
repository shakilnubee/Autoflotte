// ============================================================================
//  Parc Pilot — Passerelle API Ulys Partner (VINCI Autoroutes) — LECTURE (Palier 1)
//
//  L'API Ulys est une API SERVEUR-À-SERVEUR : on ne peut pas l'appeler depuis le
//  navigateur (CORS + ça exposerait la clé). Cette Edge Function sert de passerelle :
//  elle détient le jeton Ulys en SECRET côté serveur, ajoute les en-têtes requis
//  (Authorization: Bearer + x-initiator), appelle Ulys, et renvoie le JSON à Parc Pilot.
//
//  ⚠️ SÉCURITÉ :
//    • Le jeton Ulys (ULYS_BEARER) et l'initiateur (ULYS_INITIATOR) vivent dans les
//      SECRETS de l'Edge Function (Supabase) — JAMAIS dans le code du site public.
//    • La fonction VÉRIFIE d'abord que l'appelant est un utilisateur Parc Pilot connecté
//      (JWT valide) et NON un chauffeur. Un visiteur non connecté est rejeté (401).
//
//  Actions (POST { action, ... }) — LECTURE SEULE pour ce palier :
//    • "account"    → GET /api/account/                     (infos du compte Ulys)
//    • "contracts"  → GET /api/contracts/getcontracts/      (liste des contrats)
//    • "badges"     → GET /api/badges/getbadges/            (liste des badges + statuts)
//                     (option { contractUniqueId } → filtre sur un contrat)
//    • "ping"       → vérifie juste que la config serveur est présente (pas d'appel Ulys)
//
//  ⚠️ Aucune ÉCRITURE vers Ulys ici (commande / affectation de badge = paliers suivants).
//
//  SECRETS À DÉFINIR (une fois, dans Supabase → Edge Functions → Secrets) :
//    ULYS_BEARER    = le jeton « accès API » généré dans l'espace abonnés Ulys.
//    ULYS_INITIATOR = le numéro client Ulys (ex. 8211979) ou le code fleeter (FLT-xxxx).
//    ULYS_BASE      = (optionnel) URL de base. Défaut = PRODUCTION.
//                     PROD    : https://ulys-api-partner.vinci-autoroutes.com
//                     SANDBOX : https://ulys-api-partner-sandbox.vinci-autoroutes.com
//
//  Déploiement : automatique (GitHub Action deploy-edge-functions.yml au push sur main).
//    SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont injectés automatiquement.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const PROD_BASE = "https://ulys-api-partner.vinci-autoroutes.com";

// Appel GET vers l'API Ulys avec les en-têtes obligatoires. Renvoie { ok, status, data|error }.
async function ulysGet(path: string) {
  const bearer = (Deno.env.get("ULYS_BEARER") || "").trim();
  const initiator = (Deno.env.get("ULYS_INITIATOR") || "").trim();
  const base = (Deno.env.get("ULYS_BASE") || PROD_BASE).replace(/\/+$/, "");
  if (!bearer || !initiator) {
    return { ok: false, status: 500, error: "Configuration Ulys incomplète côté serveur (ULYS_BEARER / ULYS_INITIATOR)." };
  }
  let res: Response;
  try {
    res = await fetch(base + path, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${bearer}`,
        "x-initiator": initiator,
        "Accept": "application/json",
      },
    });
  } catch (e) {
    return { ok: false, status: 502, error: "Impossible de joindre Ulys : " + (e instanceof Error ? e.message : String(e)) };
  }
  // 429 = quota d'appels journalier atteint (message dédié demandé par la doc Ulys).
  if (res.status === 429) {
    return { ok: false, status: 429, error: "Limite d'appels Ulys atteinte pour aujourd'hui. Réessaie demain." };
  }
  if (res.status === 406) {
    return { ok: false, status: 406, error: "Ce service Ulys est réservé aux comptes ayant l'univers Télépéage." };
  }
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    return { ok: false, status: res.status, error: (data && typeof data === "object" ? JSON.stringify(data) : String(data || "")) || `Erreur Ulys (${res.status}).` };
  }
  return { ok: true, status: 200, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Configuration serveur incomplète." }, 500);
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // 1) L'appelant doit être un utilisateur Parc Pilot connecté.
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Non connecté." }, 401);
  const { data: { user: caller } } = await admin.auth.getUser(token);
  if (!caller) return json({ error: "Session expirée — reconnecte-toi." }, 401);

  // 2) Contrôles sur le profil de l'appelant :
  //    (a) un chauffeur (portail salarié) n'a pas accès aux données Ulys ;
  //    (b) ⚠️ MULTI-SOCIÉTÉS : le compte Ulys (clé) appartient à UNE société (ULYS_SOCIETE, défaut PXP).
  //        Un utilisateur d'une AUTRE société ne doit pas voir ces badges (= noms de salariés = données
  //        personnelles d'un autre client). Le CEO/super-admin (societe vide ou « __all__ ») passe.
  try {
    const { data: prof } = await admin.from("profiles").select("role, societe").eq("id", caller.id).maybeSingle();
    if (prof && prof.role === "chauffeur") return json({ error: "Accès non autorisé." }, 403);
    const owner = (Deno.env.get("ULYS_SOCIETE") || "PXP").trim().toLowerCase();
    const soc = String((prof && prof.societe) || "").trim().toLowerCase();
    if (soc && soc !== "__all__" && soc !== owner) {
      return json({ error: "Aucun compte Ulys configuré pour cette société." }, 403);
    }
  } catch { /* pas de profil lisible → on continue (l'API Ulys reste protégée par le secret serveur) */ }

  // 3) Action demandée.
  let body: { action?: string; contractUniqueId?: string } = {};
  try { body = await req.json(); } catch { /* body vide */ }
  const action = String(body.action || "").trim();

  if (action === "ping") {
    const ok = !!(Deno.env.get("ULYS_BEARER") || "").trim() && !!(Deno.env.get("ULYS_INITIATOR") || "").trim();
    return json({ ok, configured: ok, base: (Deno.env.get("ULYS_BASE") || PROD_BASE) });
  }

  let path = "";
  if (action === "account") path = "/api/account/";
  else if (action === "contracts") path = "/api/contracts/getcontracts/";
  else if (action === "badges") {
    const c = String(body.contractUniqueId || "").trim();
    path = c ? `/api/badges/getbadges?contractUniqueId=${encodeURIComponent(c)}` : "/api/badges/getbadges/";
  } else if (action === "invoices") {
    path = "/api/invoices/getinvoices/";
  } else if (action === "transactions") {
    // Détail transaction par transaction d'une facture télépéage (CSV). 3 derniers mois seulement.
    const id = String((body as { invoiceId?: string }).invoiceId || "").trim();
    if (!id) return json({ error: "invoiceId requis." }, 400);
    path = `/api/transactions/gettransactionsbilledcsv/${encodeURIComponent(id)}`;
  } else {
    return json({ error: "Action inconnue." }, 400);
  }

  const r = await ulysGet(path);
  if (!r.ok) return json({ error: r.error }, r.status || 502);
  return json({ ok: true, data: r.data });
});
