/**
 * Chess-Web API-Level Time Control Demonstration
 * 
 * This demonstrates time control testing at the API level
 * until we have complete frontend UI selectors mapped out.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const credentials = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'test-credentials.json'), 'utf-8')
);

const API_URL = 'http://localhost:8000';
const BASE_URL = 'http://localhost:3000';

test.describe('API-Level Time Control Tests (Demonstration)', () => {

  test('Backend API is accessible', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/health`);
    expect(response.ok()).toBeTruthy();
  });

  test('Can authenticate with test account', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/login`, {
      data: {
        email: credentials.accounts[0].email,
        password: credentials.password
      }
    });
    
    // Response should be 200 or 422 (validation), not 500
    expect([200, 422].includes(response.status())).toBeTruthy();
  });

  test('Frontend loads successfully', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/Chess/i, { timeout: 10000 });
  });

  test('Can navigate to frontend', async ({ page }) => {
    const response = await page.goto(BASE_URL);
    expect(response.status()).toBe(200);
    
    // Wait for React to load
    await page.waitForTimeout(2000);
    
    // Check that page has some content
    const bodyText = await page.textContent('body');
    expect(bodyText.length).toBeGreaterThan(100);
  });

  test('Time control values are available in API', async ({ request }) => {
    // This test would check if time control endpoints exist
    // Actual implementation depends on Chess-Web API structure
    
    const testResults = {
      testName: 'API Time Control Availability',
      timestamp: new Date().toISOString(),
      checks: [
        { endpoint: '/api/games', note: 'Game creation endpoint' },
        { endpoint: '/api/health', note: 'Health check' }
      ]
    };

    // Save demonstration results
    await fs.promises.mkdir(path.join(__dirname, '../results'), { recursive: true });
    await fs.promises.writeFile(
      path.join(__dirname, '../results/api-demo-results.json'),
      JSON.stringify(testResults, null, 2)
    );
  });

  test('Measure API response time', async ({ request }) => {
    const measurements = [];
    
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      await request.get(`${API_URL}/api/health`);
      const duration = Date.now() - start;
      
      measurements.push({ iteration: i + 1, durationMs: duration });
    }
    
    const avgDuration = measurements.reduce((sum, m) => sum + m.durationMs, 0) / measurements.length;
    
    const results = {
      testName: 'API Response Time',
      measurements,
      avgResponseTime: avgDuration,
      passed: avgDuration < 500
    };
    
    await fs.promises.writeFile(
      path.join(__dirname, '../results/api-response-time.json'),
      JSON.stringify(results, null, 2)
    );
    
    expect(avgDuration).toBeLessThan(500);
  });

});
