// ============================================================
//  Parc Pilot — Routeur d'auditeurs (audit CIBLÉ, pas les 25 à chaque fois)
//  Lancement : node scripts/audit-router.mjs            (compare HEAD à origin/main)
//          ou : node scripts/audit-router.mjs <fichier...>  (fichiers explicites)
//  Sort la liste des auditeurs PERTINENTS selon les fichiers modifiés (carte de routage).
//  Objectif (consigne utilisateur) : des contrôles ciblés, pas des dizaines d'agents qui relisent tout.
// ============================================================
import { execSync } from 'node:child_process';

const NOMS = {
  1: 'Sécurité & accès', 2: 'Isolation sociétés & RGPD', 3: 'Calculs financiers', 4: 'Cohérence inter-pages',
  5: 'Synchro / perte de données', 6: 'Rafraîchissement d\'état', 7: 'Échecs silencieux', 8: 'Lecture OCR/IA & doublons',
  9: 'Remplissage auto & rapprochements', 10: 'Régression / perte après merge', 11: 'Performance', 12: 'Suppression/édition répercutée',
  13: 'Concurrence & modifs simultanées', 14: 'Sessions & permissions', 15: 'PWA / service worker / cache',
  16: 'Intégrité des données & relations', 17: 'Connecteurs & API externes', 18: 'Automatisations & notifications',
  19: 'Précision financière & arrondis', 20: 'Dates / échéances / fuseaux', 21: 'Robustesse imports & fichiers',
  22: 'Charge & volumétrie', 23: 'Sauvegarde / restauration', 24: 'Parcours réels & accessibilité', 25: 'Fiabilité des tests',
};

// Carte de routage fichier → auditeurs (reprend la carte validée : OCR/TCO/Supabase/Interface).
const RULES = [
  { re: /scanner2?\.js|parseAvis|ulysPdfToText|fleet-views|supabase\/functions\/scan-doc/i, dom: 'OCR / lecture de documents', auditors: [8, 9, 17, 21] },
  { re: /statistiques\.html|budget\.html|contrats\.html|bareme\.js/i, dom: 'TCO / calculs financiers', auditors: [3, 4, 19, 20] },
  { re: /supabase-client\.js|supabase\/functions|app\.(js|min\.js)$/i, dom: 'Supabase / données / persistance', auditors: [1, 2, 5, 13, 16] },
  { re: /dashboard\.html|^pages\/.*\.html|index\.html|styles\.css|sw\.js|manifest/i, dom: 'Interface', auditors: [6, 10, 15, 24] },
  { re: /amendes\.html/i, dom: 'Amendes', auditors: [3, 8, 12, 19] },
  { re: /conducteurs\.html/i, dom: 'Conducteurs', auditors: [9, 12, 2] },
  { re: /vehicules\.html/i, dom: 'Véhicules', auditors: [12, 14 /*etc*/, 4] },
];

let files = process.argv.slice(2);
if (!files.length) {
  try { files = execSync('git diff --name-only origin/main...HEAD', { encoding: 'utf8' }).split('\n').filter(Boolean); }
  catch (e) { try { files = execSync('git diff --name-only HEAD~1', { encoding: 'utf8' }).split('\n').filter(Boolean); } catch (e2) { files = []; } }
}

if (!files.length) { console.log('Aucun fichier modifié détecté. (Passe des fichiers en argument, ou travaille sur une branche.)'); process.exit(0); }

const selected = new Set();
const domaines = new Set();
for (const f of files) {
  for (const r of RULES) { if (r.re.test(f)) { r.auditors.forEach(a => selected.add(a)); domaines.add(r.dom); } }
}
// TOUJOURS : les contrôles de base (niveau 1) + régression sur tout lot.
selected.add(10); // régression / perte après merge

console.log('\n📁 Fichiers modifiés (' + files.length + ') :');
files.forEach(f => console.log('   • ' + f));
console.log('\n🧭 Domaines touchés : ' + (domaines.size ? [...domaines].join(', ') : '—'));
console.log('\n🔍 Auditeurs à lancer (audit ciblé) :');
[...selected].sort((a, b) => a - b).forEach(a => console.log('   #' + a + ' — ' + (NOMS[a] || '?')));
console.log('\n⚙️  Contrôles bloquants systématiques (niveau 1, à chaque commit) : check-bugs + tests unitaires.');
console.log('   node scripts/check-bugs.mjs .   &&   node scripts/test-calculs.mjs\n');
