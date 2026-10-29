// Browser checks for the decks and pages (Playwright). Run: npm run test:browser
// Same file in rcc-acm, rcc-gdg, and pcolee/explorAI; only tests/browser/targets.mjs differs per repo.
import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;

export default defineConfig({
  testDir: 'tests/browser',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: `http://127.0.0.1:${PORT}/`, trace: 'retain-on-failure' },
  webServer: {
    command: `node tests/browser/serve.mjs . ${PORT}`,
    url: `http://127.0.0.1:${PORT}/package.json`, // any file that exists; the root has no index page
    reuseExistingServer: true,
  },
  projects: [
    { name: 'chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'safari', use: { ...devices['Desktop Safari'] } },
    { name: 'iphone', use: { ...devices['iPhone 15'] }, grep: /@phone/ },
  ],
});
