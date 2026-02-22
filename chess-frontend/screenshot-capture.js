// Chess99 Screenshot Capture Script
// Uses Playwright to capture screenshots of all key pages in desktop and mobile viewports

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'images', 'screenshots');
const BASE_URL = 'http://localhost:3000';
const LOGIN_EMAIL = 'ab@ameyem.com';
const LOGIN_PASSWORD = 'Arun@123';

// Viewport configurations
const DESKTOP = { width: 1920, height: 1080, name: 'desktop' };
const MOBILE = { width: 390, height: 844, name: 'mobile', isMobile: true };

// Pages to capture
const PUBLIC_PAGES = [
  { path: '/', name: 'landing' },
  { path: '/login', name: 'login' },
  { path: '/puzzles', name: 'puzzles' },
  { path: '/learn', name: 'learn' },
  { path: '/play', name: 'play_computer' },
  { path: '/pricing', name: 'pricing' },
];

const AUTH_PAGES = [
  { path: '/lobby', name: 'lobby' },
  { path: '/dashboard', name: 'dashboard' },
  { path: '/profile', name: 'profile' },
  { path: '/championships', name: 'championships' },
  { path: '/history', name: 'history' },
  { path: '/training', name: 'training' },
  { path: '/tutorial', name: 'tutorial' },
  { path: '/game-history', name: 'game_history' },
  { path: '/account/subscription', name: 'subscription' },
];

async function captureScreenshot(page, pageName, viewport) {
  const fileName = `${pageName}_${viewport.name}.png`;
  const filePath = path.join(SCREENSHOT_DIR, fileName);
  
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  
  // Wait a bit for responsive adjustments
  await page.waitForTimeout(500);
  
  await page.screenshot({ 
    path: filePath, 
    fullPage: true,
    timeout: 30000
  });
  
  console.log(`  [OK] ${fileName}`);
}

async function navigateAndCapture(page, pageConfig, viewports) {
  const url = `${BASE_URL}${pageConfig.path}`;
  console.log(`\nNavigating to ${pageConfig.path}...`);
  
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    console.log(`  [WARN] networkidle timeout, trying domcontentloaded...`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    } catch (e2) {
      console.log(`  [ERROR] Could not load ${pageConfig.path}: ${e2.message}`);
      return;
    }
  }
  
  // Wait for content to settle
  await page.waitForTimeout(2000);
  
  // Check if we got redirected (e.g., auth guard)
  const currentUrl = page.url();
  if (currentUrl !== url && !currentUrl.startsWith(url)) {
    console.log(`  [INFO] Redirected to: ${currentUrl}`);
  }
  
  for (const viewport of viewports) {
    await captureScreenshot(page, pageConfig.name, viewport);
  }
}

async function login(page) {
  console.log('\n=== LOGGING IN ===');
  
  // Go to login page
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  
  // Click "Use email instead" button to reveal email form
  const emailButton = page.getByText('Use email instead');
  if (await emailButton.isVisible({ timeout: 5000 })) {
    await emailButton.click();
    console.log('  Clicked "Use email instead"');
    await page.waitForTimeout(1000);
  } else {
    console.log('  Email form already visible or button not found, trying direct form...');
  }
  
  // Fill in email
  const emailInput = page.locator('input[type="email"]');
  if (await emailInput.isVisible({ timeout: 5000 })) {
    await emailInput.fill(LOGIN_EMAIL);
    console.log(`  Filled email: ${LOGIN_EMAIL}`);
  } else {
    console.log('  [ERROR] Email input not found!');
    // Take a screenshot of the current state for debugging
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'login_debug.png'), fullPage: true });
    return false;
  }
  
  // Fill in password
  const passwordInput = page.locator('input[type="password"]');
  if (await passwordInput.isVisible({ timeout: 5000 })) {
    await passwordInput.fill(LOGIN_PASSWORD);
    console.log('  Filled password');
  } else {
    console.log('  [ERROR] Password input not found!');
    return false;
  }
  
  // Take a screenshot of the filled login form before submitting
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'login_filled_desktop.png'), fullPage: true });
  
  // Submit the form
  const submitButton = page.locator('button[type="submit"]');
  if (await submitButton.isVisible({ timeout: 3000 })) {
    await submitButton.click();
    console.log('  Submitted login form');
  } else {
    // Try pressing Enter instead
    await passwordInput.press('Enter');
    console.log('  Pressed Enter to submit');
  }
  
  // Wait for navigation after login
  try {
    await page.waitForURL(/\/(lobby|dashboard|play)/, { timeout: 15000 });
    console.log(`  Login successful! Redirected to: ${page.url()}`);
    return true;
  } catch (e) {
    console.log(`  [WARN] Login may have failed or redirect timeout. Current URL: ${page.url()}`);
    // Check for error messages
    const errorEl = page.locator('.text-red-500, .error, [role="alert"]');
    if (await errorEl.isVisible({ timeout: 2000 }).catch(() => false)) {
      const errorText = await errorEl.textContent();
      console.log(`  [ERROR] Login error message: ${errorText}`);
    }
    // Take debug screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'login_result_debug.png'), fullPage: true });
    return false;
  }
}

async function main() {
  // Ensure screenshot directory exists
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  
  console.log('=== Chess99 Screenshot Capture ===');
  console.log(`Screenshots will be saved to: ${SCREENSHOT_DIR}`);
  console.log(`Base URL: ${BASE_URL}`);
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const viewports = [DESKTOP, MOBILE];
  
  try {
    // ===== PHASE 1: Public pages (no auth needed) =====
    console.log('\n\n========== PHASE 1: PUBLIC PAGES ==========');
    
    const publicContext = await browser.newContext({
      viewport: DESKTOP,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    });
    const publicPage = await publicContext.newPage();
    
    for (const pageConfig of PUBLIC_PAGES) {
      await navigateAndCapture(publicPage, pageConfig, viewports);
    }
    
    await publicContext.close();
    
    // ===== PHASE 2: Authenticated pages =====
    console.log('\n\n========== PHASE 2: AUTHENTICATED PAGES ==========');
    
    const authContext = await browser.newContext({
      viewport: DESKTOP,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    });
    const authPage = await authContext.newPage();
    
    const loggedIn = await login(authPage);
    
    if (loggedIn) {
      for (const pageConfig of AUTH_PAGES) {
        await navigateAndCapture(authPage, pageConfig, viewports);
      }
    } else {
      console.log('\n[WARN] Login failed. Attempting to capture auth pages anyway (they may redirect to login)...');
      for (const pageConfig of AUTH_PAGES) {
        await navigateAndCapture(authPage, pageConfig, viewports);
      }
    }
    
    await authContext.close();
    
  } catch (error) {
    console.error(`\n[FATAL] ${error.message}`);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
  
  // List all captured screenshots
  console.log('\n\n========== CAPTURED SCREENSHOTS ==========');
  const files = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png')).sort();
  files.forEach(f => {
    const stats = fs.statSync(path.join(SCREENSHOT_DIR, f));
    console.log(`  ${f} (${(stats.size / 1024).toFixed(1)} KB)`);
  });
  console.log(`\nTotal: ${files.length} screenshots`);
}

main().catch(console.error);
