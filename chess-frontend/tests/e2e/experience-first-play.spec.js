import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Local fixtures only; never create a real account or game during QA.
  await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
});

for (const colour of ['White', 'Black']) {
test(`guest ${colour} first-use tour spends no clock or engine time`, async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play as guest', exact: true }).first().click();
  if (colour === 'Black') await page.getByRole('button', { name: 'Black', exact: true }).click();
  await page.screenshot({ path: `test-results/experience-setup-${colour}.png`, fullPage: true });
  await page.locator('.start-button').click();
  const tour = page.getByRole('dialog', { name: 'Undo Move' });
  await expect(tour).toBeVisible({ timeout: 25000 });
  await expect(page.getByText('Finish the introduction to start. Your clock is paused.')).toBeVisible();
  const timers = page.locator('.apb-clock-digits:visible');
  const before = await timers.allTextContents();
  expect(before.length).toBe(2);
  await page.clock.install();
  await page.clock.fastForward(30000);
  expect(await timers.allTextContents()).toEqual(before);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('chess99_active_computer_game')).moves.length)).toBe(0);
  await page.screenshot({ path: `test-results/experience-tour-${colour}.png`, fullPage: true });
  await tour.getByRole('button', { name: 'Skip', exact: true }).click();
  await expect(tour).not.toBeVisible();
  await expect(page.getByText('White to move.', { exact: true }).first()).toBeVisible();
  await page.clock.fastForward(2100);
  expect(await timers.allTextContents()).not.toEqual(before);
  await page.screenshot({ path: `test-results/experience-board-${colour}.png`, fullPage: true });
});
}

test('refresh restores an unfinished introduction without starting the clock', async ({ page }) => {
  await page.goto('/play');
  await page.locator('.start-button').click();
  await expect(page.getByRole('dialog', { name: 'Undo Move' })).toBeVisible({ timeout: 20000 });
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Undo Move' })).toBeVisible();
  const timers = page.locator('.apb-clock-digits:visible');
  const before = await timers.allTextContents();
  await page.clock.install();
  await page.clock.fastForward(30000);
  expect(await timers.allTextContents()).toEqual(before);
  await page.getByRole('dialog').getByRole('button', { name: 'Skip', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('chess99_active_computer_game')).preGameTourPending)).toBe(false);
});

test('learning hub retains working destinations and narrow screens do not overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/learn');
  await expect(page.getByRole('heading', { name: 'Your next small step in chess' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open lessons' })).toHaveAttribute('href', '/tutorial');
  await expect(page.getByRole('link', { name: 'Practise tactics' })).toHaveAttribute('href', '/tactical-trainer');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/experience-learn-360.png', fullPage: true });
});
