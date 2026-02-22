const pw = require('@playwright/test');

(async () => {
  const browser = await pw.chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  // Step 1: Login page
  console.log('1. Navigating to login...');
  await page.goto('https://chess99.com/login', { timeout: 20000 });
  // Wait for React to hydrate — look for a button
  await page.waitForSelector('button', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);

  await page.screenshot({ path: '/tmp/chess99-01-login-page.png', fullPage: true });

  // Click "Use email instead" to show email/password inputs
  const emailToggle = page.getByText('Use email instead');
  if (await emailToggle.count() > 0) {
    console.log('   Clicking "Use email instead"...');
    await emailToggle.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: '/tmp/chess99-01b-email-form.png', fullPage: true });
  } else {
    console.log('   No "Use email instead" toggle found');
  }

  // Debug: check inputs now
  const allInputs = await page.locator('input').all();
  console.log('   Inputs found:', allInputs.length);
  for (const inp of allInputs) {
    const type = await inp.getAttribute('type');
    const name = await inp.getAttribute('name');
    const placeholder = await inp.getAttribute('placeholder');
    console.log('   - input type="' + type + '" name="' + name + '" placeholder="' + placeholder + '"');
  }

  // Find email input
  let emailField = null;
  for (const sel of ['input[type="email"]', 'input[name="email"]', 'input[placeholder*="email" i]']) {
    if (await page.locator(sel).count() > 0) {
      emailField = page.locator(sel).first();
      console.log('   Found email field: ' + sel);
      break;
    }
  }

  if (!emailField && allInputs.length >= 2) {
    emailField = page.locator('input').first();
    console.log('   Using first input as email field');
  }

  if (!emailField) {
    console.log('   ERROR: Cannot find email field');
    const bodySnippet = (await page.textContent('body')).substring(0, 800);
    console.log('   Body:', bodySnippet);
    await browser.close();
    process.exit(1);
  }

  // Find password
  const passField = await page.locator('input[type="password"]').count() > 0
    ? page.locator('input[type="password"]').first()
    : null;

  // Fill and submit
  await emailField.fill('test@chess99.com');
  if (passField) await passField.fill('test1234');
  console.log('2. Credentials filled, submitting...');

  // Submit
  for (const sel of ['button[type="submit"]', 'button:has-text("Log In")', 'button:has-text("Login")', 'button:has-text("Sign In")', 'button:has-text("Sign in")', 'form button']) {
    if (await page.locator(sel).count() > 0) {
      console.log('   Clicking: ' + sel);
      await page.locator(sel).first().click();
      break;
    }
  }

  await page.waitForTimeout(5000);
  await page.waitForLoadState('networkidle').catch(() => {});
  console.log('3. After login URL:', page.url());
  await page.screenshot({ path: '/tmp/chess99-02-after-login.png', fullPage: true });

  // Step 2: Dashboard
  console.log('4. Going to dashboard...');
  await page.goto('https://chess99.com/dashboard', { timeout: 20000 }).catch(() => {});
  await page.waitForSelector('.dashboard-container, .dashboard', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const dashUrl = page.url();
  console.log('5. Dashboard URL:', dashUrl);
  await page.screenshot({ path: '/tmp/chess99-03-dashboard.png', fullPage: true });

  // Subscription gates check
  console.log('');
  console.log('=== SUBSCRIPTION GATES CHECK ===');

  const adBanner = await page.locator('.ad-banner').count();
  const upgradeStrip = await page.locator('.upgrade-strip').count();
  const pageText = await page.textContent('body');

  console.log('Gate 1 - AdBanner (.ad-banner):        ' + (adBanner > 0 ? 'VISIBLE' : 'NOT FOUND'));
  console.log('Gate 2 - Upgrade strip (.upgrade-strip): ' + (upgradeStrip > 0 ? 'VISIBLE' : 'NOT FOUND'));
  console.log('Gate 3 - "ad-free with Silver":        ' + (pageText.includes('ad-free with Silver') ? 'FOUND' : 'NOT FOUND'));
  console.log('Gate 4 - "FREE" tier badge:            ' + (pageText.includes('FREE') ? 'FOUND' : 'NOT FOUND'));
  console.log('Gate 5 - "Go Silver" CTA:              ' + (pageText.includes('Go Silver') ? 'FOUND' : 'NOT FOUND'));
  console.log('Gate 6 - Welcome message:              ' + (pageText.includes('Welcome') ? 'FOUND' : 'NOT FOUND'));
  console.log('');
  console.log('Logged in: ' + (!dashUrl.includes('/login') ? 'YES' : 'NO'));

  // Scrolled screenshot
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/chess99-04-dashboard-scrolled.png', fullPage: false });

  await browser.close();
  console.log('Screenshots saved to /tmp/chess99-*.png');
})();
