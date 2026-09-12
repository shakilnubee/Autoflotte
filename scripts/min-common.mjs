// Parc Pilot — helpers partagés minification (SANS dépendance : importable par
// build-min.mjs ET check-bugs.mjs sans tirer terser).
import crypto from 'crypto';

// Fichiers source → cible minifiée. Ajouter ici tout nouveau gros JS à minifier.
export const TARGETS = [
  { src: 'assets/js/app.js',         out: 'assets/js/app.min.js' },
  { src: 'assets/js/fleet-views.js', out: 'assets/js/fleet-views.min.js' },
];

// Empreinte courte de la SOURCE, embarquée en tête du .min.js (garde-fou anti-périmé).
export function srcHash(code) {
  return crypto.createHash('sha256').update(code, 'utf8').digest('hex').slice(0, 16);
}
export const HASH_RE = /^\/\*src=([0-9a-f]{16})\*\//;
