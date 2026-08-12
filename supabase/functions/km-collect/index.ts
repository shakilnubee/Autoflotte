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
    headers: { ...CORS, "Content-Type": "application/json" },
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const db = admin();
  if (!db) return json({ error: "Service indisponible (configuration serveur)." }, 500);

  try {
    // ---- GET : le chauffeur ouvre son lien → on lui montre le véhicule concerné ----
    if (req.method === "GET") {
      const token = new URL(req.url).searchParams.get("t") || "";
      if (!token) return json({ error: "Lien incomplet." }, 400);
      const { req: r, err } = await loadReq(db, token);
      if (err) return json({ error: err }, 404);
      // km le plus fiable connu (au cas où km_avant serait vide)
      let kmConnu = r.km_avant;
      if ((kmConnu == null || kmConnu === "") && r.vehicule_id) {
        const { data: v } = await db.from("vehicules").select("km").eq("id", r.vehicule_id).maybeSingle();
        if (v && v.km != null) kmConnu = v.km;
      }
      return json({
        ok: true,
        plaque: r.plaque || "",
        chauffeur: r.chauffeur || "",
        societe: r.societe || "",
        kmConnu: kmConnu != null ? Number(kmConnu) : null,
        deja: !!r.used_at,
        kmRecu: r.km_recu != null ? Number(r.km_recu) : null,
      });
    }

    // ---- POST : le chauffeur envoie son km ----
    if (req.method === "POST") {
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { return json({ error: "Requête invalide." }, 400); }
      const token = String(body.t || "").trim();
      const km = Math.round(Number(body.km));
      if (!token) return json({ error: "Lien incomplet." }, 400);
      if (!Number.isFinite(km) || km <= 0 || km > 3000000) {
        return json({ error: "Kilométrage invalide. Saisis un nombre (ex. 45 000)." }, 400);
      }
      const { req: r, err } = await loadReq(db, token);
      if (err) return json({ error: err }, 404);

      // On refuse un km ABERRANT (inférieur au km déjà connu) pour ne pas corrompre la fiche.
      const kmRef = r.km_avant != null ? Number(r.km_avant) : null;
      if (kmRef != null && km < kmRef - 100) {
        return json({ error: `Le kilométrage saisi (${km}) est inférieur au dernier relevé connu (${kmRef}). Vérifie ton compteur.` }, 400);
      }

      // 1) Met à jour la fiche véhicule (seulement si le km reçu est supérieur au km actuel).
      if (r.vehicule_id) {
        const { data: v } = await db.from("vehicules").select("km").eq("id", r.vehicule_id).maybeSingle();
        const cur = v && v.km != null ? Number(v.km) : 0;
        if (km > cur) {
          await db.from("vehicules").update({ km }).eq("id", r.vehicule_id);
        }
      }
      // 2) Marque la demande comme répondue (idempotent : on écrase si déjà répondu).
      await db.from("km_requests").update({ km_recu: km, used_at: new Date().toISOString() }).eq("token", token);

      return json({ ok: true, plaque: r.plaque || "", km });
    }

    return json({ error: "Méthode non autorisée." }, 405);
  } catch (e) {
    return json({ error: (e && (e as Error).message) || "Erreur serveur." }, 500);
  }
});
