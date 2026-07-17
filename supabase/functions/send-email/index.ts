// ============================================================================
//  Parc Pilot — Fonction d'envoi d'e-mails (Resend)
//  ⚠️ La clé Resend N'EST PAS ici : elle est lue depuis un SECRET Supabase
//     (RESEND_API_KEY). Rien de secret dans ce fichier → il peut rester public.
//
//  Déploiement (une fois) :
//    1. Supabase → Edge Functions → « Deploy a new function » → nom : send-email
//       → colle ce fichier.
//    2. Supabase → Project Settings → Edge Functions → Secrets :
//         RESEND_API_KEY = <ta clé Resend>
//         EMAIL_FROM     = Parc Pilot <shakil.nubeebaccus@projectxparis.fr>
//       (EMAIL_FROM : mets d'abord "Parc Pilot <onboarding@resend.dev>" pour tester,
//        puis ton adresse @projectxparis.fr une fois le domaine vérifié sur Resend.)
//
//  Le site appelle cette fonction (utilisateur connecté requis) → elle envoie le mail.
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) {
    return json({ error: "RESEND_API_KEY absent — ajoute-le dans Supabase → Settings → Edge Functions → Secrets." }, 500);
  }
  const envFrom = Deno.env.get("EMAIL_FROM") || "Parc Pilot <onboarding@resend.dev>";

  let msg: Record<string, unknown>;
  try {
    msg = await req.json();
  } catch {
    return json({ error: "Corps JSON invalide" }, 400);
  }

  // Expéditeur : si le site fournit `from` (adresse de la société), on l'utilise ; sinon le
  // secret EMAIL_FROM. ⚠️ Resend n'accepte que les adresses d'un domaine VÉRIFIÉ dans Resend.
  const from = (msg.from && String(msg.from).trim()) ? String(msg.from).trim() : envFrom;

  const to = msg.to;
  const subject = msg.subject;
  if (!to || !subject || (!msg.html && !msg.text)) {
    return json({ error: "Champs requis : to, subject, et html ou text." }, 400);
  }

  const toList = (v: unknown) =>
    Array.isArray(v) ? v : String(v).split(",").map((s) => s.trim()).filter(Boolean);

  const payload: Record<string, unknown> = {
    from,
    to: toList(to),
    subject: String(subject),
  };
  if (msg.cc) payload.cc = toList(msg.cc);
  if (msg.html) payload.html = String(msg.html);
  if (msg.text) payload.text = String(msg.text);
  if (msg.replyTo) payload.reply_to = String(msg.replyTo);

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: data?.message || "Échec de l'envoi Resend", detail: data }, r.status);
    return json({ ok: true, id: data?.id });
  } catch (e) {
    return json({ error: "Erreur réseau vers Resend : " + String(e) }, 502);
  }
});
