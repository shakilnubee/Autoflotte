#!/usr/bin/env node
// ============================================================
//  Parc Pilot — MINIFICATION des gros JS écrits à la main.
//
//  Pourquoi : app.js fait ~900 Ko NON minifié, ré-analysé par le navigateur à
//  CHAQUE page → chargement lent sur mobile. On sert une version minifiée
//  (app.min.js) ~2× plus légère à parser.
//
//  ⚠️ La SOURCE reste app.js / fleet-views.js (on édite TOUJOURS ceux-là).
//  Ce script régénère les .min.js. Un GARDE-FOU dans scripts/check-bugs.mjs FAIT
//  ÉCHOUER le contrôle (donc le déploiement) si un .min.js n'est pas à jour avec
//  sa source → impossible de déployer un JS minifié périmé.
//
//  À lancer après TOUTE modif de app.js / fleet-views.js :
//     node scripts/build-min.mjs
//  (le skill de déploiement l'inclut ; utilise npx terser, comme le build Tailwind.)
// ============================================================
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { TARGETS, srcHash } from './min-common.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let n = 0;
for (const t of TARGETS) {
  const srcPath = path.join(ROOT, t.src);
  const outPath = path.join(ROOT, t.out);
  const code = fs.readFileSync(srcPath, 'utf8');
  const h = srcHash(code);
  // npx terser (CLI) : -c compress, -m mangle. On NE mangle PAS les propriétés
  // (FP.* est utilisé dans les scripts inline des pages → renommer casserait tout).
  let min;
  try {
    min = execFileSync('npx', ['--yes', 'terser@5', srcPath, '-c', '-m', '--comments', 'false'],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    console.error('❌ terser a échoué sur ' + t.src + ' :', e && (e.message || e));
    process.exit(1);
  }
  fs.writeFileSync(outPath, '/*src=' + h + '*/\n' + min, 'utf8');
  const kb = (s) => Math.round(fs.statSync(s).size / 1024);
  console.log(`✓ ${t.out}  (${kb(srcPath)} Ko → ${kb(outPath)} Ko)  src=${h}`);
  n++;
}
console.log(`\n✅ ${n} fichier(s) minifié(s).`);
