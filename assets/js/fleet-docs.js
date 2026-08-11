// Parc Pilot — mémos de documents Google Drive (assurance par plaque, permis par prénom).
// ⚠️ RGPD (dépôt PUBLIC) : ce fichier NE DOIT PLUS contenir de données personnelles.
// Il contenait auparavant des NOMS de conducteurs et des liens vers des scans de PERMIS de conduire
// (PII sensible) + des plaques → il a été VIDÉ. Les documents (cartes grises, assurances, permis)
// vivent désormais UNIQUEMENT dans Supabase (tables `documents` / `conducteurs`), chargés après
// connexion et protégés par RLS. L'app fonctionne parfaitement avec ce mémo vide : c'est déjà l'état
// imposé à toutes les sociétés autres que PXP (cf. app.js, filtre multi-sociétés de FP_DOCS).
// NE PAS re-remplir ce fichier avec des noms/plaques/liens de permis.
window.FP_DOCS = { assurance: {}, permis: {} };
