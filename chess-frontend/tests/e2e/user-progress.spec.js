// @ts-check
const { test, expect } = require('@playwright/test');

const FRONTEND_URL = process.env.BASE_URL || 'http://localhost:3000';

async function loginAs(page) {
  await page.goto(FRONTEND_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);

  // Click "Use email instead" to reveal email/password form
  const emailLink = page.locator('button:has-text("email"), a:has-text("email")');
  if (await emailLink.count() > 0) {
    await emailLink.first().click();
    await page.waitForTimeout(1000);
  }

  // Fill in credentials
  await page.locator('input[type="email"]').fill('ab@ameyem.com');
  await page.locator('input[type="password"], input[placeholder="Password"]').fill('Vedansh@123');

  // Click submit
  const submitBtn = page.locator('button[type="submit"]');
  await submitBtn.click();
  console.log('✅ Login submitted');

  // Wait for navigation to dashboard
  await page.waitForURL('**/dashboard**', { timeout: 20000 }).catch(() => {
    console.log('⚠️ No redirect to dashboard after login');
  });
  await page.waitForTimeout(3000);

  // If not on dashboard, navigate manually
  if (!page.url().includes('/dashboard')) {
    await page.goto(FRONTEND_URL + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 });
  }

  // Wait for dashboard data to load (game histories, etc.)
  await page.waitForTimeout(6000);
  console.log('📍 Current URL:', page.url());
}

test.describe('User Progress Charts', { timeout: 90000 }, () => {
  test.setTimeout(90000);

  test('Dashboard shows View Progress button', async ({ page }) => {
    await loginAs(page);

    // Scroll down to the statistics section
    const statsHeader = page.locator('text=Your Statistics');
    if (await statsHeader.count() > 0) {
      await statsHeader.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
    }

    // Take screenshot of dashboard
    await page.screenshot({ path: 'tests/e2e/screenshots/user-progress-dashboard.png', fullPage: true });
    console.log('📸 Dashboard screenshot saved');

    // Debug: list all buttons on page
    const allButtons = await page.locator('button').allTextContents();
    console.log('All buttons:', allButtons.filter(t => t.trim()).map(t => t.trim()));

    // Verify "View Progress" button exists - try multiple locators
    const progressBtn = page.locator('button').filter({ hasText: /Progress/i });
    await expect(progressBtn).toBeVisible({ timeout: 15000 });
    console.log('✅ View Progress button found');

    // Verify "View Details" button also exists
    const detailsBtn = page.locator('button').filter({ hasText: /Details/i });
    await expect(detailsBtn).toBeVisible({ timeout: 5000 });
    console.log('✅ View Details button found');
  });

  test('Click View Progress opens modal with charts', async ({ page }) => {
    await loginAs(page);

    // Click View Progress
    const progressBtn = page.getByRole('button', { name: /Progress/i });
    await progressBtn.click();
    await page.waitForTimeout(2000);

    // Modal should be visible
    const modal = page.locator('.detailed-stats-modal');
    await expect(modal).toBeVisible({ timeout: 10000 });
    console.log('✅ Progress modal opened');

    // Check for "Your Progress" header
    const header = modal.locator('h2');
    await expect(header).toHaveText('Your Progress', { timeout: 5000 });
    console.log('✅ Modal header correct');

    // Check for period selector buttons inside modal
    await expect(modal.getByRole('button', { name: '7 Days' })).toBeVisible({ timeout: 3000 });
    await expect(modal.getByRole('button', { name: '30 Days' })).toBeVisible({ timeout: 3000 });
    await expect(modal.getByRole('button', { name: 'All Time' })).toBeVisible({ timeout: 3000 });
    console.log('✅ Period selector buttons present');

    // Wait for charts to render (recharts needs a moment)
    await page.waitForTimeout(3000);

    // Take screenshot of progress modal
    await page.screenshot({ path: 'tests/e2e/screenshots/user-progress-modal.png', fullPage: true });
    console.log('📸 Modal screenshot saved');

    // Verify chart sections rendered
    await expect(page.locator('text=Rating Progression')).toBeVisible({ timeout: 10000 });
    console.log('✅ Rating Progression chart visible');

    await expect(page.locator('text=Rating Points Per Day')).toBeVisible({ timeout: 10000 });
    console.log('✅ Rating Points Per Day chart visible');

    await expect(page.locator('text=Games Played Per Day')).toBeVisible({ timeout: 10000 });
    console.log('✅ Games Played Per Day chart visible');
  });

  test('Period selector switches charts and modal closes', async ({ page }) => {
    await loginAs(page);

    // Open progress modal
    await page.getByRole('button', { name: /Progress/i }).click();
    await page.waitForTimeout(2000);

    const modal = page.locator('.detailed-stats-modal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Click "7 Days" period
    await modal.getByRole('button', { name: '7 Days' }).click();
    await page.waitForTimeout(3000);
    console.log('✅ Switched to 7d period');

    await page.screenshot({ path: 'tests/e2e/screenshots/user-progress-7d.png', fullPage: true });
    console.log('📸 7d screenshot saved');

    // Click "All Time"
    await modal.getByRole('button', { name: 'All Time' }).click();
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'tests/e2e/screenshots/user-progress-all.png', fullPage: true });
    console.log('📸 All Time screenshot saved');

    // Close modal via close button
    await modal.locator('.close-btn').click();
    await page.waitForTimeout(500);

    // Modal should be gone
    await expect(page.locator('.detailed-stats-modal')).not.toBeVisible({ timeout: 3000 });
    console.log('✅ Modal closes correctly');
  });
});
