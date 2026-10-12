// ============================================================
//  Parc Pilot — Tests unitaires des calculs métier
//  Lancement : node scripts/test-calculs.mjs
//  Zéro dépendance. Extrait chaque helper FP.* de app.js et le teste en isolation
//  (avec des stubs pour FP.settings / FP.primeVeh / FP.tvsDetail). Sort code ≠ 0 si un test échoue
//  → branchable comme contrôle BLOQUANT avant commit / en CI.
// ============================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'assets/js/app.js'), 'utf8');

// --- Extracteur : récupère la source d'un helper « FP.NAME = <expr>; » (équilibrage {} () []). ---
function extract(name) {
  const re = new RegExp('FP\\.' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*=');
  const m = re.exec(SRC);
  if (!m) throw new Error('helper introuvable dans app.js : FP.' + name);
  let i = SRC.indexOf('=', m.index) + 1;
  let depth = 0, inStr = null, prev = '';
  for (; i < SRC.length; i++) {
    const c = SRC[i];
    if (inStr) { if (c === inStr && prev !== '\\') inStr = null; prev = c; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; prev = c; continue; }
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') depth--;
    else if (c === ';' && depth === 0) break;
    prev = c;
  }
  return SRC.slice(m.index, i + 1);
}

// --- Bac à sable : un FP minimal + stubs, puis on évalue les helpers extraits dedans. ---
function makeFP(settings) {
  const FP = {};
  FP.settings = { get: () => settings || {} };
  FP.primeVeh = (v) => (settings && settings.assurancePrimes && settings.assurancePrimes[v.immat]) || 0;
  FP.tvsDetail = (v) => (settings && settings.tvs && settings.tvs[v.immat]) || { applicable: false, total: 0 };
  // Évalue une liste de helpers (dans l'ordre ; chacun fait « FP.x = … »).
  const load = (names) => { for (const n of names) { const code = extract(n); (new Function('FP', code))(FP); } };
  return { FP, load };
}

// --- Mini framework d'assertions ---
let pass = 0, fail = 0; const fails = [];
function eq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; } else { fail++; fails.push(`❌ ${label}\n     attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`); }
}
function ok(cond, label) { eq(!!cond, true, label); }

// ============================================================
//  TESTS
// ============================================================

// --- Helpers « source unique » (doivent déjà être verts) ---
{
  const { FP, load } = makeFP({});
  load(['estVendu', 'horsFlotte', 'normImmat']);
  eq(FP.estVendu({ statut: 'vendu' }), true, 'estVendu(vendu)');
  eq(FP.estVendu({ statut: 'Vendue' }), true, 'estVendu(Vendue)');
  eq(FP.estVendu({ statut: 'cédé' }), false, 'estVendu(cédé) = false (cédé ≠ vendu)');
  eq(FP.estVendu({ statut: 'actif' }), false, 'estVendu(actif)');
  eq(FP.horsFlotte({ statut: 'cédé' }), true, 'horsFlotte(cédé) = true');
  eq(FP.horsFlotte({ statut: 'restitué' }), true, 'horsFlotte(restitué) = true');
  eq(FP.horsFlotte({ statut: 'actif' }), false, 'horsFlotte(actif) = false');
  // normImmat : tirets, espaces, casse → identiques
  eq(FP.normImmat('HL-724-CD'), FP.normImmat('hl 724 cd'), 'normImmat tolère tirets/espaces/casse');
  eq(FP.normImmat('AB-123-CD'), 'AB123CD', 'normImmat(AB-123-CD) = AB123CD');
}

// --- M3 : contratCadreCoutAnnuel (pur) ---
{
  const { FP, load } = makeFP({});
  load(['contratCadreCoutAnnuel']);
  eq(FP.contratCadreCoutAnnuel({ montant: 100, periode: 'mois' }), 1200, 'contrat mensuel 100€ = 1200€/an');
  eq(FP.contratCadreCoutAnnuel({ montant: 1200, periode: 'an' }), 1200, 'contrat annuel 1200€ = 1200€/an');
  eq(FP.contratCadreCoutAnnuel({ montant: 0 }), 0, 'contrat 0€ = 0');
}

// --- M2 : un véhicule « cédé » ne doit PLUS être facturé (assurance + TVS) ---
//   Ces tests encodent le comportement CORRECT. Sur le code actuel (filtre !estVendu),
//   un véhicule « cédé » est encore compté → ces tests ÉCHOUENT (= preuve du bug M2).
{
  const settings = { assurancePrimes: { 'AB123CD': 1200, 'CD456EF': 800 }, tvs: { 'AB123CD': { applicable: true, total: 300 } } };
  const { FP, load } = makeFP(settings);
  load(['estVendu', 'horsFlotte', 'assuranceAnnuelle', 'tvsAnnuelleFlotte']);
  const actif = { immat: 'CD456EF', statut: 'actif' };
  const cede = { immat: 'AB123CD', statut: 'cédé' };
  eq(FP.assuranceAnnuelle([actif, cede]), 800, 'M2 — assurance exclut le véhicule cédé (800, pas 2000)');
  eq(FP.tvsAnnuelleFlotte([cede]), 0, 'M2 — TVS exclut le véhicule cédé (0, pas 300)');
}

// ============================================================
console.log(`\n  ${pass} réussis, ${fail} échoués`);
if (fail) { console.log('\n' + fails.join('\n') + '\n'); process.exit(1); }
console.log('✅ Tous les tests de calcul passent.\n');
