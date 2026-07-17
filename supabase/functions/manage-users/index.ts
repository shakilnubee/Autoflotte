// ============================================================================
//  Parc Pilot — Gestion des comptes / accès (CEO · Admin · Gestionnaire)
//  Créer / modifier / supprimer des utilisateurs DEPUIS la page Paramètres,
//  sans passer par Supabase. Tout est automatique et sécurisé.
//
//  ⚠️ SÉCURITÉ : cette fonction utilise la clé service_role (toute-puissante),
//     lue depuis l'environnement Supabase (JAMAIS dans le code du site public).
//     Elle vérifie D'ABORD que le demandeur est bien CEO ou Admin, et applique
//     sa PORTÉE : un Admin ne peut agir QUE dans sa propre société et ne peut
//     PAS créer de CEO. Un gestionnaire n'a aucun accès à cette fonction.
//
//  Déploiement (une fois) :
//    Supabase → Edge Functions → « Deploy a new function » → nom : manage-users
//    → colle ce fichier → Deploy.
//    (SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement par
//     Supabase à toutes les Edge Functions — rien à configurer.)
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Traduit un « accès » (ce que choisit l'utilisateur) en colonnes de la table profiles.
function accesToProfile(acces: string, societe: string | null) {
  if (acces === "ceo") return { is_admin: true, role: "admin", societe: null };
  if (acces === "gestionnaire") return { is_admin: false, role: "gestionnaire", societe };
  return { is_admin: false, role: "admin", societe }; // 'admin' (client)
}
function profileToAcces(p: { is_admin?: boolean; role?: string } | null) {
  if (!p) return "admin";
  if (p.is_admin) return "ceo";
  return p.role === "gestionnaire" ? "gestionnaire" : "admin";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Configuration serveur incomplète." }, 500);

  // Client « admin » (service_role) : lit/écrit auth + profiles en contournant la RLS.
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // 1) Qui appelle ? On valide le jeton (Bearer) de l'utilisateur connecté.
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Non connecté." }, 401);
  const { data: { user: caller } } = await admin.auth.getUser(token);
  if (!caller) return json({ error: "Session expirée — reconnecte-toi." }, 401);

  // 3) Droits du demandeur (source de vérité = profiles)
  const { data: me } = await admin.from("profiles").select("is_admin,role,societe").eq("id", caller.id).maybeSingle();
  const callerAcces = profileToAcces(me);
  const isCEO = callerAcces === "ceo";
  const isAdmin = callerAcces === "admin";
  if (!isCEO && !isAdmin) return json({ error: "Accès refusé : réservé au CEO et aux administrateurs." }, 403);
  const mySociete = me?.societe || null;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ error: "Corps JSON invalide." }, 400); }
  const action = String(body.action || "");

  // Garde-fou de PORTÉE : un Admin est limité à SA société et ne peut pas fabriquer de CEO.
  const guardScope = (acces: string, societe: string | null): string | null => {
    if (isCEO) return null;
    if (acces === "ceo") return "Un administrateur ne peut pas créer de compte CEO.";
    if (societe && mySociete && societe !== mySociete) return "Un administrateur ne peut agir que dans sa propre société.";
    return null;
  };
  // Vérifie qu'une cible existante est bien dans le périmètre du demandeur.
  const canTouchTarget = async (targetId: string): Promise<string | null> => {
    if (isCEO) return null;
    if (targetId === caller.id) return null;
    const { data: t } = await admin.from("profiles").select("is_admin,societe").eq("id", targetId).maybeSingle();
    if (!t) return "Compte introuvable.";
    if (t.is_admin) return "Vous ne pouvez pas modifier un compte CEO.";
    if ((t.societe || null) !== mySociete) return "Ce compte n'appartient pas à votre société.";
    return null;
  };

  try {
    // -------- LISTER --------
    if (action === "list") {
      let q = admin.from("profiles").select("id,email,societe,is_admin,role").order("email");
      if (!isCEO) q = q.eq("societe", mySociete);
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 500);
      const users = (data || []).map((p) => ({
        id: p.id, email: p.email, societe: p.societe,
        acces: profileToAcces(p), self: p.id === caller.id,
      }));
      return json({ ok: true, users, callerAcces, mySociete });
    }

    // -------- CRÉER --------
    if (action === "create") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const acces = String(body.acces || "gestionnaire");
      const societe = isCEO ? (body.societe ? String(body.societe) : null) : mySociete;
      if (!email || !password) return json({ error: "E-mail et mot de passe requis." }, 400);
      if (password.length < 8) return json({ error: "Le mot de passe doit faire au moins 8 caractères." }, 400);
      if (acces !== "ceo" && !societe) return json({ error: "Société requise pour un Admin/Gestionnaire." }, 400);
      const scopeErr = guardScope(acces, societe);
      if (scopeErr) return json({ error: scopeErr }, 403);

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (cErr || !created?.user) return json({ error: cErr?.message || "Création impossible (e-mail déjà utilisé ?)." }, 400);
      const prof = accesToProfile(acces, societe);
      const { error: pErr } = await admin.from("profiles").upsert({ id: created.user.id, email, ...prof });
      if (pErr) return json({ error: "Compte créé mais profil non enregistré : " + pErr.message }, 500);
      return json({ ok: true, id: created.user.id });
    }

    // -------- CHANGER L'ACCÈS / LA SOCIÉTÉ --------
    if (action === "updateRole") {
      const id = String(body.id || "");
      const acces = String(body.acces || "");
      if (!id || !acces) return json({ error: "Paramètres manquants." }, 400);
      const scopeErr0 = await canTouchTarget(id);
      if (scopeErr0) return json({ error: scopeErr0 }, 403);
      // Société cible : si non fournie, on CONSERVE celle du compte (pas d'effacement involontaire).
      const { data: tgt } = await admin.from("profiles").select("societe").eq("id", id).maybeSingle();
      const societe = acces === "ceo"
        ? null
        : (isCEO ? (body.societe != null ? String(body.societe) : (tgt?.societe || null)) : mySociete);
      const scopeErr = guardScope(acces, societe);
      if (scopeErr) return json({ error: scopeErr }, 403);
      if (id === caller.id && acces !== callerAcces)
        return json({ error: "Vous ne pouvez pas changer votre propre niveau d'accès." }, 400);
      const prof = accesToProfile(acces, societe);
      const { error } = await admin.from("profiles").update(prof).eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    // -------- RÉINITIALISER LE MOT DE PASSE --------
    if (action === "resetPassword") {
      const id = String(body.id || "");
      const password = String(body.password || "");
      if (!id || password.length < 8) return json({ error: "Mot de passe d'au moins 8 caractères requis." }, 400);
      const scopeErr = await canTouchTarget(id);
      if (scopeErr) return json({ error: scopeErr }, 403);
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    // -------- SUPPRIMER --------
    if (action === "delete") {
      const id = String(body.id || "");
      if (!id) return json({ error: "Identifiant manquant." }, 400);
      if (id === caller.id) return json({ error: "Vous ne pouvez pas supprimer votre propre compte." }, 400);
      const scopeErr = await canTouchTarget(id);
      if (scopeErr) return json({ error: scopeErr }, 403);
      await admin.from("profiles").delete().eq("id", id);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: "Action inconnue." }, 400);
  } catch (e) {
    return json({ error: "Erreur serveur : " + String(e) }, 500);
  }
});
