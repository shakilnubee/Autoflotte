// Config Playwright — tests de parcours (« fumée » + e2e). Rien n'est publié sur le site.
// - En LOCAL / dans cet environnement : on utilise le Chromium DÉJÀ présent (binaire headless_shell),
//   pour éviter un téléchargement. Surcharge possible via PW_CHROME.
// - En CI (GitHub Actions, variable CI=true) : on laisse Playwright utiliser SON navigateur, installé
//   par « npx playwright install chromium » dans le workflow.
import { defineConfig } from '@playwright/test';

const EN_CI = !!process.env.CI;
const CHROME_LOCAL = process.env.PW_CHROME || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  fullyParallel: true,
  reporter: [['list']],
  // Sert le site en statique en local (lecture seule, aucune donnée de prod touchée).
  webServer: {
    command: 'python3 -m http.server 8899',
    url: 'http://127.0.0.1:8899/dashboard.html',
    reuseExistingServer: true,
    timeout: 20000,
  },
  use: {
    baseURL: 'http://127.0.0.1:8899',
    launchOptions: EN_CI
      ? { args: ['--no-sandbox', '--disable-dev-shm-usage'] }            // CI : navigateur de Playwright
      : { executablePath: CHROME_LOCAL, args: ['--no-sandbox', '--disable-dev-shm-usage'] }, // local : binaire présent
  },
});
