// ad-hoc research script — visual/UX tour of the live chess99.com production site
// PURE READ-ONLY: no game creation, no chat, no settings changes, no payments.
// Not part of the regular test suite; run manually and delete/ignore after use.
//
// IMPORTANT: navigates via in-app <Link> clicks (SPA client-side routing) rather
// than repeated page.goto() full-page loads. A prior run using page.goto() for
// every destination intermittently bounced back to /login (auth session did not
// reliably survive full-page reloads in rapid succession) — this is itself a
// notable finding, but for a clean visual tour we avoid re-triggering it here.
const { test } = require('@playwright/test');
const path = require('path');

const TEST_EMAIL = process.env.CHESS99_TEST_EMAIL || process.env.TEST_EMAIL || 'ab@ameyem.com';
const TEST_PASSWORD = process.env.CHESS99_TEST_PASSWORD || process.env.TEST_PASSWORD || 'Vedansh@123';

const OUT_DIR = path.join(__dirname, '..', '..', 'research-artifacts', 'web-tour');

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: true });
  console.log(`[shot] ${name} -> ${page.url()}`);
}

async function dismissTourIfPresent(page) {
  try {
    const skipTour = page.locator(
      '.guided-tour button:has-text("Skip"), .guided-tour button:has-text("Close"), .guided-tour [aria-label*="Close" i]'
    ).first();
    if (await skipTour.isVisible({ timeout: 1500 }).catch(() => false)) {
      await skipTour.click().catch(() => {});
      await page.waitForTimeout(300);
    }
    await page.evaluate(() => {
      try {
        const keys = Object.keys(localStorage).filter(k => k.includes('tour') || k.includes('guided'));
        keys.forEach(k => localStorage.setItem(k, 'true'));
      } catch (e) {}
      document.querySelectorAll('.guided-tour, .guided-tour-scrim').forEach(el => el.remove());
    });
  } catch (e) {
    // non-fatal
  }
}

async function isBouncedToLogin(page) {
  const url = page.url();
  if (url.includes('/login')) return true;
  const authRequired = await page.locator('text=Authentication Required').isVisible({ timeout: 500 }).catch(() => false);
  return authRequired;
}

async function relogin(page) {
  console.log('[recover] session appears lost, logging in again');
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1200);
  const emailLink = page.locator('button:has-text("email"), a:has-text("email")');
  if (await emailLink.count() > 0 && await emailLink.first().isVisible().catch(() => false)) {
    await emailLink.first().click();
    await page.waitForTimeout(600);
  }
  await page.locator('input[type="email"]').first().fill(TEST_EMAIL);
  await page.locator('input[type="password"], input[placeholder="Password"]').first().fill(TEST_PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await dismissTourIfPresent(page);
}

// Navigate to a destination by clicking a locator (SPA client-side nav) rather
// than page.goto(), so the React app instance (and its in-memory AuthContext
// state) is never torn down. Falls back to page.goto() + relogin if the
// locator isn't clickable, and retries once if we get bounced to /login.
async function clickNav(page, locatorFn, name, { fallbackPath } = {}) {
  try {
    const loc = locatorFn(page);
    if (await loc.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await loc.first().click({ timeout: 5000 });
    } else if (fallbackPath) {
      await page.goto(fallbackPath, { waitUntil: 'domcontentloaded', timeout: 20000 });
    }
    await page.waitForTimeout(2200);
    await dismissTourIfPresent(page);

    if (await isBouncedToLogin(page)) {
      await relogin(page);
      if (fallbackPath) {
        await page.goto(fallbackPath, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(2000);
        await dismissTourIfPresent(page);
      }
    }
    await shot(page, name);
  } catch (e) {
    console.log(`[error] navigation for ${name} failed: ${e.message}`);
    await shot(page, name);
  }
}

test.describe('Research: chess99.com live web tour', () => {
  test.setTimeout(8 * 60 * 1000);

  test('logged-out landing + logged-in nav tour', async ({ page }) => {
    // ---------- 1. Logged-out landing page ----------
    await page.addInitScript(() => {
      try { window.localStorage.clear(); } catch (e) {}
    });

    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 }).catch(async () => {
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    });
    await page.waitForTimeout(2500);
    await shot(page, '01-landing-hero.png');

    const viewportHeight = page.viewportSize()?.height || 900;
    const pageHeight = await page.evaluate(() => document.body.scrollHeight);
    let scrollShotIndex = 2;
    let lastScrollY = -1;
    for (let y = viewportHeight; y < pageHeight + viewportHeight; y += viewportHeight) {
      await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
      await page.waitForTimeout(600);
      const currentScrollY = await page.evaluate(() => window.scrollY);
      if (currentScrollY === lastScrollY) break;
      lastScrollY = currentScrollY;
      await shot(page, `02-landing-scrolled-${scrollShotIndex - 1}.png`);
      scrollShotIndex++;
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT_DIR, '02z-landing-fullpage.png'), fullPage: true });

    // ---------- 2. Log in ----------
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT_DIR, '03-login-page.png'), fullPage: true });

    const emailLink = page.locator('button:has-text("email"), a:has-text("email")');
    if (await emailLink.count() > 0 && await emailLink.first().isVisible().catch(() => false)) {
      await emailLink.first().click();
      await page.waitForTimeout(800);
    }
    await page.locator('input[type="email"]').first().fill(TEST_EMAIL);
    await page.locator('input[type="password"], input[placeholder="Password"]').first().fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 20000 }).catch(() => {
      console.log('[warn] did not redirect away from /login within timeout');
    });
    await page.waitForTimeout(3000);
    await dismissTourIfPresent(page);

    // ---------- 3. Logged-in landing page (wherever it lands post-login) ----------
    await shot(page, '04-logged-in-landing.png');

    // ---------- 4. Dashboard via clicking the header icon (SPA nav) ----------
    await clickNav(page, (p) => p.locator('a[title="Dashboard"], a[aria-label="Dashboard"]'), '05-dashboard.png', { fallbackPath: '/dashboard' });

    // ---------- 5. Remaining header icon-bar destinations (click, not goto) ----------
    await clickNav(page, (p) => p.locator('a[title="Lobby"], a[aria-label="Lobby"]'), '06-nav-lobby.png', { fallbackPath: '/lobby' });

    // Learn dropdown — hover to reveal, then click each item.
    const learnTrigger = page.locator('.nav-learn-wrapper').first();
    if (await learnTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await learnTrigger.hover();
      await page.waitForTimeout(500);
      await shot(page, '20-learn-dropdown.png');
    }
    await clickNav(page, (p) => p.locator('a[title="Dashboard"], a[aria-label="Dashboard"]'), '_reset.png', { fallbackPath: '/dashboard' }); // reset to a stable page between dropdown interactions

    for (const [label, itemText, name, fallbackPath] of [
      ['Learn', 'Lessons', '07-nav-learn-lessons.png', '/tutorial'],
      ['Learn', 'Tactical Trainer', '08-nav-learn-tactical-trainer.png', '/tactical-trainer'],
      ['Learn', 'Chess 0', '09-nav-learn-ebook.png', '/ebook'],
      ['Learn', 'Training Drills', '10-nav-learn-training-drills.png', '/training'],
    ]) {
      const trigger = page.locator('.nav-learn-wrapper').first();
      if (await trigger.isVisible({ timeout: 3000 }).catch(() => false)) {
        await trigger.hover();
        await page.waitForTimeout(400);
        const item = page.locator('.learn-dropdown-item', { hasText: itemText }).first();
        await clickNav(page, () => item, name, { fallbackPath });
      } else {
        await clickNav(page, (p) => p.locator('a[title="Dashboard"]'), name, { fallbackPath });
      }
    }

    await clickNav(page, (p) => p.locator('a[title="Championships"], a[aria-label="Championships"]'), '11-nav-championships.png', { fallbackPath: '/championships' });
    await clickNav(page, (p) => p.locator('a[title="Leaderboard"], a[aria-label="Leaderboard"]'), '12-nav-leaderboard.png', { fallbackPath: '/leaderboard' });

    // ---------- 6. Avatar dropdown panel + its destinations ----------
    const avatarBtn = page.locator('.user-avatar').first();
    if (await avatarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await avatarBtn.click();
      await page.waitForTimeout(800);
      await shot(page, '19-avatar-nav-panel.png');
    }

    async function clickPanelItem(itemText, name, fallbackPath) {
      // Re-open panel if it closed after the previous navigation.
      const panelOpen = await page.locator('.nav-panel.open').isVisible({ timeout: 1000 }).catch(() => false);
      if (!panelOpen) {
        const btn = page.locator('.user-avatar').first();
        if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await btn.click();
          await page.waitForTimeout(600);
        }
      }
      const item = page.locator('.nav-item', { hasText: itemText }).first();
      await clickNav(page, () => item, name, { fallbackPath });
    }

    await clickPanelItem('My Games', '13-nav-my-games.png', '/history');
    await clickPanelItem('Ambassador', '14-nav-ambassador.png', '/ambassador');
    await clickPanelItem('Pricing', '15-nav-pricing.png', '/pricing');
    await clickPanelItem('My Kids', '16-nav-parent-dashboard.png', '/parent');
    await clickPanelItem('Profile', '17-nav-profile.png', '/profile');
    await clickPanelItem('Settings', '18-nav-settings.png', '/settings');

    // ---------- 7. Footer + footer modals (About) ----------
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await shot(page, '21-footer-authenticated.png');

    const aboutBtn = page.locator('button:has-text("About")').first();
    if (await aboutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await aboutBtn.click({ timeout: 5000 }).catch((e) => console.log(`[warn] About click failed: ${e.message}`));
      await page.waitForTimeout(700);
      await shot(page, '22-footer-about-modal.png');
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(300);
    }

    // ---------- 8. Privacy / Terms ----------
    const privacyLink = page.locator('a[href="/privacy"]').first();
    await clickNav(page, () => privacyLink, '23-nav-privacy.png', { fallbackPath: '/privacy' });
    const termsLink = page.locator('a[href="/terms"]').first();
    await clickNav(page, () => termsLink, '24-nav-terms.png', { fallbackPath: '/terms' });

    console.log('[done] tour complete, screenshots in research-artifacts/web-tour/');
  });
});
