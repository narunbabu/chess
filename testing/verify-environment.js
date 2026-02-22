/**
 * Chess-Web Environment Verification Script
 * 
 * Verifies that the test environment is properly configured:
 * - Backend server is running
 * - Frontend server is running  
 * - Database is accessible
 * - WebSocket server is running
 * - Browser automation is available
 * 
 * Usage: node verify-environment.js
 */

const http = require('http');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const BACKEND_URL = 'http://localhost:8000';
const FRONTEND_URL = 'http://localhost:3000';
const WEBSOCKET_URL = 'ws://localhost:8080';

/**
 * Check if a URL is reachable
 */
function checkUrl(url, name) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname,
      method: 'GET',
      timeout: 3000,
    };

    const req = http.request(options, (res) => {
      console.log(`✅ ${name} is running (Status: ${res.statusCode})`);
      resolve(true);
    });

    req.on('error', () => {
      console.log(`❌ ${name} is NOT running`);
      resolve(false);
    });

    req.on('timeout', () => {
      console.log(`⏱️  ${name} request timed out`);
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

/**
 * Check if WebSocket server is running
 */
function checkWebSocket() {
  return new Promise((resolve) => {
    try {
      // Simple TCP connection check since WebSocket requires proper handshake
      const net = require('net');
      const socket = new net.Socket();
      
      socket.setTimeout(3000);
      socket.connect(8080, 'localhost', () => {
        console.log('✅ WebSocket server is running (Port 8080 open)');
        socket.destroy();
        resolve(true);
      });

      socket.on('error', () => {
        console.log('❌ WebSocket server is NOT running');
        resolve(false);
      });

      socket.on('timeout', () => {
        console.log('⏱️  WebSocket server request timed out');
        socket.destroy();
        resolve(false);
      });
    } catch (error) {
      console.log('❌ WebSocket check failed:', error.message);
      resolve(false);
    }
  });
}

/**
 * Check if Playwright is installed
 */
async function checkPlaywright() {
  try {
    const { stdout } = await execPromise('npx playwright --version');
    console.log(`✅ Playwright is installed: ${stdout.trim()}`);
    return true;
  } catch (error) {
    console.log('❌ Playwright is NOT installed');
    console.log('   Install with: npm install -D @playwright/test');
    return false;
  }
}

/**
 * Check if browsers are installed
 */
async function checkBrowsers() {
  try {
    // Check Chrome
    try {
      const { stdout: chromeVersion } = await execPromise('google-chrome --version 2>&1 || chrome --version 2>&1 || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --version 2>&1');
      console.log(`✅ Chrome is available: ${chromeVersion.trim()}`);
    } catch {
      console.log('⚠️  Chrome may not be available');
    }

    // Check if Playwright browsers are installed
    const { stdout } = await execPromise('npx playwright list-files 2>&1');
    if (stdout.includes('chromium') || stdout.includes('firefox')) {
      console.log('✅ Playwright browsers are installed');
      return true;
    } else {
      console.log('⚠️  Playwright browsers may not be installed');
      console.log('   Install with: npx playwright install');
      return false;
    }
  } catch (error) {
    console.log('⚠️  Could not verify browser installation');
    return false;
  }
}

/**
 * Check database status
 */
async function checkDatabase() {
  try {
    const fs = require('fs');
    const dbPath = 'C:\\ArunApps\\Chess-Web\\chess-backend\\database\\database.sqlite';
    
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      console.log(`✅ Database file exists (${(stats.size / 1024).toFixed(2)} KB)`);
      return true;
    } else {
      console.log('❌ Database file not found at:', dbPath);
      console.log('   Run migrations: php artisan migrate');
      return false;
    }
  } catch (error) {
    console.log('❌ Database check failed:', error.message);
    return false;
  }
}

/**
 * Check Node.js version
 */
async function checkNodeVersion() {
  const version = process.version;
  const majorVersion = parseInt(version.slice(1).split('.')[0]);
  
  if (majorVersion >= 18) {
    console.log(`✅ Node.js version is compatible: ${version}`);
    return true;
  } else {
    console.log(`⚠️  Node.js version may be too old: ${version} (recommended: >=18)`);
    return false;
  }
}

/**
 * Main verification function
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Chess-Web Environment Verification                    ║');
  console.log('║     Real User Multiplayer Testing - Phase 1               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const checks = {
    nodeVersion: false,
    backend: false,
    frontend: false,
    websocket: false,
    database: false,
    playwright: false,
    browsers: false,
  };

  // Run all checks
  console.log('🔍 Checking Node.js version...');
  checks.nodeVersion = await checkNodeVersion();
  console.log();

  console.log('🔍 Checking Backend server...');
  checks.backend = await checkUrl(`${BACKEND_URL}/api/users`, 'Backend API');
  console.log();

  console.log('🔍 Checking Frontend server...');
  checks.frontend = await checkUrl(FRONTEND_URL, 'Frontend');
  console.log();

  console.log('🔍 Checking WebSocket server...');
  checks.websocket = await checkWebSocket();
  console.log();

  console.log('🔍 Checking Database...');
  checks.database = await checkDatabase();
  console.log();

  console.log('🔍 Checking Playwright installation...');
  checks.playwright = await checkPlaywright();
  console.log();

  console.log('🔍 Checking Browser availability...');
  checks.browsers = await checkBrowsers();
  console.log();

  // Summary
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                 VERIFICATION SUMMARY                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const allPassed = Object.values(checks).every(v => v);
  const passedCount = Object.values(checks).filter(v => v).length;
  const totalCount = Object.keys(checks).length;

  console.log(`Checks passed: ${passedCount}/${totalCount}\n`);

  Object.entries(checks).forEach(([check, passed]) => {
    const icon = passed ? '✅' : '❌';
    const name = check.replace(/([A-Z])/g, ' $1').trim();
    console.log(`${icon} ${name}`);
  });

  console.log();

  if (allPassed) {
    console.log('🎉 All checks passed! Environment is ready for testing.\n');
    console.log('Next steps:');
    console.log('1. ✅ Run smoke tests: node smoke-test.js');
    console.log('2. 📋 Start real user testing\n');
    return 0;
  } else {
    console.log('⚠️  Some checks failed. Please fix the issues above.\n');
    console.log('Common fixes:');
    if (!checks.backend) {
      console.log('• Start backend: cd chess-backend && php artisan serve');
    }
    if (!checks.frontend) {
      console.log('• Start frontend: cd chess-frontend && npm run dev');
    }
    if (!checks.websocket) {
      console.log('• Start WebSocket: cd chess-backend && php artisan reverb:start');
    }
    if (!checks.database) {
      console.log('• Setup database: cd chess-backend && php artisan migrate:fresh --seed');
    }
    if (!checks.playwright) {
      console.log('• Install Playwright: npm install -D @playwright/test');
    }
    if (!checks.browsers) {
      console.log('• Install browsers: npx playwright install');
    }
    console.log();
    return 1;
  }
}

// Run verification
main().then(exitCode => process.exit(exitCode)).catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
