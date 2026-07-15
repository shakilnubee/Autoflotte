#!/usr/bin/env node
// ============================================================
// Vérificateur de bugs automatique — Parc Pilot
// Tourne avant chaque déploiement (hook) ET manuellement :
//   node scripts/check-bugs.mjs
// Contrôles (statiques, rapides, zéro dépendance) :
//   1. Syntaxe JS de assets/js/*.js (node --check)
//   2. Cohérence du cache-busting : un seul ?v= partout
//   3. Liens/assets internes cassés (href/src vers un fichier absent)
//   4. RGPD : aucune donnée personnelle dans data.js (repo public)
// Sort en code 1 si un problème est trouvé (→ bloque le déploiement).
// ============================================================
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';

const ROOT = resolve(process.argv[2] || '.');
const errors = [];
const warn = [];

// -- liste des .html (racine + pages/) --
function htmlFiles() {
  const out = [];
  for (const f of readdirSync(ROOT)) if (f.endsWith('.html')) out.push(join(ROOT, f));
  const pdir = join(ROOT, 'pages');
  if (existsSync(pdir)) for (const f of readdirSync(pdir)) if (f.endsWith('.html')) out.push(join(pdir, f));
  return out;
}

// 1) Syntaxe JS
for (const js of ['assets/js/app.js', 'assets/js/supabase-client.js', 'assets/js/data.js']) {
  const p = join(ROOT, js);
  if (!existsSync(p)) continue;
  try { execSync(`node --check "${p}"`, { stdio: 'pipe' }); }
  catch (e) { errors.push(`Syntaxe JS invalide : ${js}\n   ${String(e.stderr || e).split('\n').slice(0, 3).join('\n   ')}`); }
}

// 2) Cohérence du cache-busting (?v=...) — UNIQUEMENT sur les assets partagés
//    (tailwind.css, styles.css, app.js, supabase-client.js, data.js, lucide.min.js).
//    On ignore les ?v= sur d'autres ressources (ex. logos images) qui ont leur propre versionnage.
const versions = new Set();
const ASSET_V = /(?:tailwind\.css|styles\.css|app\.js|supabase-client\.js|data\.js|lucide\.min\.js)\?v=([A-Za-z0-9]+)/g;
for (const h of htmlFiles()) {
  const txt = readFileSync(h, 'utf8');
  for (const m of txt.matchAll(ASSET_V)) versions.add(m[1]);
}
if (versions.size > 1) {
  errors.push(`Cache-busting incohérent : plusieurs versions ?v= sur les assets partagés (${[...versions].join(', ')}). Bumpe TOUT au même numéro.`);
}

// 3) Liens / assets internes cassés
const IGNORE = /^(https?:|mailto:|tel:|javascript:|data:|#|\{)/i;
for (const h of htmlFiles()) {
  const txt = readFileSync(h, 'utf8');
  const base = dirname(h);
  for (const m of txt.matchAll(/(?:href|src)\s*=\s*"([^"]+)"/g)) {
    let ref = m[1].trim();
    if (!ref || IGNORE.test(ref)) continue;
    ref = ref.split('?')[0].split('#')[0];               // enlève ?v=… et #ancre
    if (!/\.(html|js|css|svg|png|jpg|jpeg|webp|ico)$/i.test(ref)) continue; // que les fichiers locaux
    const target = resolve(base, ref);
    if (!existsSync(target)) {
      errors.push(`Lien cassé dans ${h.replace(ROOT + '/', '')} : "${m[1]}" → fichier introuvable`);
    }
  }
}

// 4) RGPD — aucune donnée personnelle dans data.js (repo public)
const dataPath = join(ROOT, 'assets/js/data.js');
if (existsSync(dataPath)) {
  const d = readFileSync(dataPath, 'utf8');
  const re = /"(email|adresse|dateNaissance|tel|nom|prenom|name|poste|permisNumero|permisUrl|permisFileId|chauffeur|vin)"\s*:\s*"[^"]+"/g;
  const hits = (d.match(re) || []).filter(s => !/:\s*""/.test(s));
  if (hits.length) errors.push(`RGPD : ${hits.length} champ(s) personnel(s) NON vidé(s) dans data.js (ex. ${hits[0].slice(0, 60)}…). Strippe l'identité avant commit.`);
}

// -- rapport --
if (warn.length) for (const w of warn) console.log(`⚠️  ${w}`);
if (errors.length) {
  console.error(`\n❌ ${errors.length} problème(s) détecté(s) :\n`);
  for (const e of errors) console.error(' • ' + e);
  console.error('\nCorrige avant de déployer.');
  process.exit(1);
}
console.log('✅ check-bugs : RAS (syntaxe JS, cache ?v=, liens internes, RGPD data.js).');
