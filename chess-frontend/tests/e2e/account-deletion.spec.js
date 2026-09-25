const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Exercise the actual public artifact without a backend, login or mail send.
test.use({ javaScriptEnabled: false });
test('deletion request remains usable without JavaScript or an installed app', async ({ page }, testInfo) => {
  await page.route('https://chess99.com/delete-account.html', route => route.fulfill({
    contentType: 'text/html',
    body: fs.readFileSync(path.join(__dirname, '../../public/delete-account.html'), 'utf8'),
  }));
  await page.goto('https://chess99.com/delete-account.html');
  await expect(page.getByRole('heading', { name: 'Request account deletion', exact: true })).toBeVisible();
  const request = page.getByRole('link', { name: 'Compose deletion request' });
  const uri = new URL(await request.getAttribute('href'));
  expect(uri.protocol).toBe('mailto:');
  expect(uri.pathname).toBe('support@chess99.com');
  expect(uri.searchParams.get('subject')).toBe('Chess99 account deletion request');
  expect(uri.searchParams.get('body')).toContain('account and associated personal data');
  await expect(page.getByText(/you must send the email to submit/)).toBeVisible();
  await expect(page.getByText(/If no email app opens/)).toBeVisible();
  await expect(page.getByText(/30 days/)).toBeVisible();
  await expect(page.getByText(/UPI ID/)).toBeVisible();
  await expect(page.getByText(/retention period/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Read the Chess99 privacy policy' })).toHaveAttribute('href', '/privacy');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('deletion-page.png'), fullPage: true });
});
