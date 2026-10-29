// Smoke checks with real key presses: every deck loads without a script error and moves forward on a key press,
// and every page loads without a script error and fits a phone without sideways scrolling.
// The deck kit's own check (deck-kit/check.mjs) still does the deep per-slide checks.
import { test, expect } from '@playwright/test';
import { decks, pages } from './targets.mjs';

// Script errors, plus any file from this repo that fails to load (a broken relative path).
// Files from other sites (fonts, CDNs, the review relay) are left out so the checks run offline.
function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => {
    // ERR_ABORTED is the browser cancelling on purpose (a video it stops buffering), not a missing file.
    if (r.url().startsWith('http://127.0.0.1') && !/ERR_ABORTED/.test(r.failure()?.errorText || '')) errors.push(`failed to load ${r.url()}`);
  });
  page.on('response', (r) => { if (r.url().startsWith('http://127.0.0.1') && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  return errors;
}

for (const path of decks) {
  test(`deck ${path} loads and a key press moves it forward`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(path);
    await page.waitForLoadState('load');
    // Let the deck's scripts (some from a CDN) finish loading. A live connection can keep the
    // network busy forever, so this wait is capped.
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);
    const hash = () => page.evaluate(() => location.hash);
    const start = await hash();
    // A slide can hold beats, so keep pressing until the deck says it moved. Presses stay slow
    // because Chrome drops history updates that come too fast.
    for (let i = 0; i < 20 && (await hash()) === start; i++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(400);
    }
    expect(await hash(), 'slide in the address after pressing Right').not.toBe(start);
    expect(errors).toEqual([]);
  });
}

for (const path of pages) {
  test(`page ${path} loads and fits a phone @phone`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(path);
    await page.waitForLoadState('load');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, 'pixels of sideways scroll').toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}
