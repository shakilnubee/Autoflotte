// Tests « fumée » (smoke) : chaque page clé se charge-t-elle SANS erreur JS, avec ses éléments clés ?
// Attrape la classe de bug « page blanche / JS cassé » (ex. une erreur de syntaxe qui tue toute la page).
// LECTURE SEULE : on charge les pages en local (data.js + cache), aucune donnée de prod n'est touchée.
import { test, expect } from '@playwright/test';

// Contournement du garde d'authentification (jeton factice : la page REND depuis data.js/cache ;
// les appels Supabase échouent en silence, ce qui n'empêche pas de tester la santé du JS).
const AUTH = () => {
  try {
    const tok = { access_token: 't', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: 't' } };
    localStorage.setItem('sb-tzjuptlzoywjeigmyfuj-auth-token', JSON.stringify(tok));
    localStorage.setItem('fp_remember_me', '1');
    localStorage.setItem('fp_societe', 'PXP');
  } catch (e) {}
};

// page → un sélecteur qui DOIT exister (présent dans le DOM, même replié) si la page est saine.
const PAGES = [
  ['/dashboard.html', '#sc-btn'],                 // hub Raccourcis
  ['/pages/vehicules.html', '#btn-compare'],      // comparateur
  ['/pages/budget.html', 'text=Contrats & abonnements'], // poste M3 (doit être là)
  ['/pages/statistiques.html', '#cmp-annee'],     // comparaison de mois
  ['/pages/amendes.html', 'body'],
  ['/pages/factures.html', 'body'],
  ['/pages/conducteurs.html', '#e-adr-rue'],      // adresse en cases
  ['/pages/sinistres.html', 'body'],
  ['/pages/contrats.html', 'body'],
  ['/pages/notifications.html', 'body'],
];

// Bruits d'environnement à ignorer (hors-ligne / bac à sable), PAS de vrais bugs applicatifs.
const IGNORE = /Chart is not defined|localStorage|Failed to load resource|net::ERR|supabase|Failed to fetch|lucide/i;

for (const [path, sel] of PAGES) {
  test(`fumée ${path}`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => { if (!IGNORE.test(e.message)) errors.push(e.message); });
    await page.addInitScript(AUTH);
    // 'commit' = dès que la navigation est acceptée (ne bloque pas sur une ressource lente d'une page
    // lourde comme Factures). On laisse ensuite le JS s'exécuter avant de vérifier.
    await page.goto(path, { waitUntil: 'commit', timeout: 20000 });
    await page.waitForTimeout(2500);
    // 1) Pas d'erreur JS applicative (page cassée)
    expect(errors, 'erreurs JS applicatives : ' + errors.join(' | ')).toEqual([]);
    // 2) L'élément clé est présent dans le DOM (la page a bien rendu son contenu)
    expect(await page.locator(sel).count(), 'élément clé manquant : ' + sel).toBeGreaterThan(0);
  });
}
