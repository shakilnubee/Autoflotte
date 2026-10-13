#!/usr/bin/env node
// ============================================================
// Garde-fou ANTI-PERTE — Parc Pilot   (node scripts/audit-persist.mjs)
// ------------------------------------------------------------
// 100 % INFORMATIF : ce script NE BLOQUE RIEN et ne modifie RIEN. Il sort toujours
// en code 0 (aucun déploiement ni aucune fonctionnalité ne peut être bloqué par lui).
//
// Il répond à UNE question : « quels endroits DÉFONT une donnée synchronisée par
// SUPPRESSION de clé ? » — c'est le motif fragile (la fusion anti-perte peut faire
// "revenir" l'entrée) qui a causé les bugs RDV garage / immobilisation / anomalies.
// Il vérifie AUSSI que le correctif de fond (fusion) est toujours en place.
//
// À lancer quand on ajoute un bouton "défaire / lever / annuler / remettre à zéro"
// sur une donnée de réglages, pour s'assurer qu'il marque une valeur (tombstone)
// plutôt que de supprimer une clé seule.
// ============================================================
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(process.argv[2] || '.');
const rel = (p) => p.replace(ROOT + '/', '');

let app = '';
try { app = readFileSync(join(ROOT, 'assets/js/app.js'), 'utf8'); }
catch { console.log('ℹ️  audit-persist : app.js introuvable, rien à analyser.'); process.exit(0); }

// 1) Extraire la liste des maps SYNCHRONISÉES (COLLECTION_KEYS) depuis app.js.
const KEYS = new Set();
try {
  const m = /const COLLECTION_KEYS = new Set\(\[([\s\S]*?)\]\)/.exec(app);
  if (m) for (const q of m[1].matchAll(/'([A-Za-z0-9_]+)'/g)) KEYS.add(q[1]);
} catch { /* ignore */ }

// 2) Fichiers à scanner (sources + pages, jamais les .min.js).
const files = [];
const addDir = (d) => { try { if (existsSync(d)) for (const f of readdirSync(d)) if (/\.(js|html)$/.test(f) && !/\.min\.js$/.test(f)) files.push(join(d, f)); } catch { /* ignore */ } };
addDir(join(ROOT, 'assets/js'));
addDir(join(ROOT, 'pages'));
try { for (const f of readdirSync(ROOT)) if (f.endsWith('.html')) files.push(join(ROOT, f)); } catch { /* ignore */ }

// 3) Chercher les suppressions `delete <...>.<MAP>[...]` où <MAP> est une map synchronisée.
const delRe = /delete\s+([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\[/g;
const hits = [];
for (const f of files) {
  let txt = ''; try { txt = readFileSync(f, 'utf8'); } catch { continue; }
  const lines = txt.split('\n');
  lines.forEach((ln, i) => {
    delRe.lastIndex = 0; let m;
    while ((m = delRe.exec(ln))) {
      const mapName = m[1].split('.').pop();
      if (KEYS.has(mapName)) hits.push({ file: rel(f), line: i + 1, map: mapName, code: ln.trim().slice(0, 120) });
    }
  });
}

// 4) Invariants : le correctif de fond + les tombstones de référence sont-ils toujours là ?
const invariants = [
  { ok: /if \(ov === undefined\) \{ delete out\[k\]; return; \}/.test(app), label: 'Correctif husk dans mergeMap (suppression de clé-objet réellement appliquée)' },
  { ok: /done\(vehId\)\s*\{/.test(app) && /leveLe/.test(app), label: 'Tombstones de référence (rdvGarage.done / immobilise.leveLe)' },
];

// 5) Rapport (toujours exit 0).
console.log('── Garde-fou anti-perte (informatif, ne bloque rien) ──');
console.log(`Maps synchronisées connues : ${KEYS.size}`);
console.log(`Suppressions de clé sur maps synchronisées : ${hits.length} (motif fragile — préférer un marqueur/tombstone pour un "défaire")`);
for (const h of hits) console.log(`  • ${h.file}:${h.line}  [${h.map}]  ${h.code}`);
console.log('');
for (const inv of invariants) console.log(`${inv.ok ? '✅' : '⚠️ '} ${inv.label}${inv.ok ? '' : '  ← ABSENT : le correctif anti-perte a peut-être été retiré, à vérifier.'}`);
console.log('\nRappel : un bouton "lever / annuler / remis à vérifier / fait" sur une donnée synchronisée');
console.log('doit MARQUER une valeur (ex. {fait:true}, leveLe, unok) — pas supprimer la clé seule.');
process.exit(0);
