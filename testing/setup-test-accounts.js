/**
 * Chess-Web Test Account Setup Script
 * 
 * Creates 10 test accounts for real user multiplayer testing
 * via the Laravel API registration endpoint.
 * 
 * Usage: node setup-test-accounts.js
 */

const https = require('http');

// Configuration
const API_BASE_URL = 'http://localhost:8000/api';
const FRONTEND_URL = 'http://localhost:3000';
const TEST_PASSWORD = 'TestPass123!'; // Secure test password

// Test accounts to create
const TEST_ACCOUNTS = [
  { name: 'Test User 1', email: 'test1@chess.local', rating: 1200 },
  { name: 'Test User 2', email: 'test2@chess.local', rating: 1400 },
  { name: 'Test User 3', email: 'test3@chess.local', rating: 1600 },
  { name: 'Test User 4', email: 'test4@chess.local', rating: 1800 },
  { name: 'Test User 5', email: 'test5@chess.local', rating: 2000 },
  { name: 'Test User 6', email: 'test6@chess.local', rating: 1300 },
  { name: 'Test User 7', email: 'test7@chess.local', rating: 1500 },
  { name: 'Test User 8', email: 'test8@chess.local', rating: 1700 },
  { name: 'Test User 9', email: 'test9@chess.local', rating: 1900 },
  { name: 'Test User 10', email: 'test10@chess.local', rating: 2100 },
];

/**
 * Make HTTP POST request
 */
function httpPost(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(data);

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Accept': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({ status: res.statusCode, data: response });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Make HTTP GET request
 */
function httpGet(url, token = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({ status: res.statusCode, data: response });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Register a single test account
 */
async function registerAccount(account) {
  const payload = {
    name: account.name,
    email: account.email,
    password: TEST_PASSWORD,
    password_confirmation: TEST_PASSWORD,
  };

  try {
    const response = await httpPost(`${API_BASE_URL}/auth/register`, payload);
    
    if (response.status === 200 || response.status === 201) {
      console.log(`✅ Created: ${account.email} (${account.name})`);
      return {
        success: true,
        account: account,
        token: response.data.token,
        user: response.data.user,
      };
    } else if (response.status === 422) {
      // Account might already exist
      console.log(`⚠️  Already exists: ${account.email}`);
      return { success: false, account: account, error: 'already_exists' };
    } else {
      console.log(`❌ Failed: ${account.email} - Status ${response.status}`);
      return { success: false, account: account, error: response.data };
    }
  } catch (error) {
    console.log(`❌ Error: ${account.email} - ${error.message}`);
    return { success: false, account: account, error: error.message };
  }
}

/**
 * Test login for an account
 */
async function testLogin(email) {
  const payload = {
    email: email,
    password: TEST_PASSWORD,
  };

  try {
    const response = await httpPost(`${API_BASE_URL}/auth/login`, payload);
    
    if (response.status === 200) {
      console.log(`  ✅ Login successful: ${email}`);
      return { success: true, token: response.data.token };
    } else {
      console.log(`  ❌ Login failed: ${email} - Status ${response.status}`);
      return { success: false, error: response.data };
    }
  } catch (error) {
    console.log(`  ❌ Login error: ${email} - ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Verify API connectivity
 */
async function verifyApiConnectivity() {
  console.log('\n📡 Verifying API connectivity...');
  
  try {
    const response = await httpGet(`${API_BASE_URL}/users`);
    if (response.status === 200) {
      console.log('✅ API is reachable at ' + API_BASE_URL);
      return true;
    } else {
      console.log('⚠️  API responded with status: ' + response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ API is not reachable: ' + error.message);
    return false;
  }
}

/**
 * Main setup function
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Chess-Web Test Account Setup                          ║');
  console.log('║     Real User Multiplayer Testing - Phase 1               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Step 1: Verify API connectivity
  const apiReachable = await verifyApiConnectivity();
  if (!apiReachable) {
    console.log('\n❌ Cannot proceed: API server is not running');
    console.log('   Please start the backend server first:');
    console.log('   cd C:\\ArunApps\\Chess-Web\\chess-backend');
    console.log('   php artisan serve\n');
    process.exit(1);
  }

  // Step 2: Create test accounts
  console.log('\n👥 Creating test accounts...\n');
  const results = [];
  
  for (const account of TEST_ACCOUNTS) {
    const result = await registerAccount(account);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 200)); // Rate limiting
  }

  // Step 3: Test logins
  console.log('\n🔐 Testing login functionality...\n');
  let loginSuccessCount = 0;
  
  for (const result of results) {
    if (result.success || result.error === 'already_exists') {
      const loginResult = await testLogin(result.account.email);
      if (loginResult.success) loginSuccessCount++;
    }
  }

  // Step 4: Summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                   SETUP SUMMARY                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const successCount = results.filter(r => r.success).length;
  const existingCount = results.filter(r => r.error === 'already_exists').length;
  const failedCount = results.filter(r => r.success === false && r.error !== 'already_exists').length;

  console.log(`✅ Accounts created:       ${successCount}`);
  console.log(`⚠️  Accounts already exist: ${existingCount}`);
  console.log(`❌ Accounts failed:        ${failedCount}`);
  console.log(`🔐 Login tests passed:     ${loginSuccessCount}/${TEST_ACCOUNTS.length}\n`);

  // Step 5: Generate credentials file
  console.log('📄 Generating credentials file...\n');
  
  const credentials = {
    generated: new Date().toISOString(),
    password: TEST_PASSWORD,
    accounts: TEST_ACCOUNTS.map(acc => ({
      name: acc.name,
      email: acc.email,
      rating: acc.rating,
    })),
    notes: [
      'These are test accounts for real user multiplayer testing',
      'All accounts share the same password: ' + TEST_PASSWORD,
      'DO NOT use these credentials in production',
    ]
  };

  const fs = require('fs');
  const credentialsPath = 'C:\\ArunApps\\Chess-Web\\testing\\test-credentials.json';
  fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
  console.log(`✅ Credentials saved to: ${credentialsPath}\n`);

  // Step 6: Next steps
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                   NEXT STEPS                               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  console.log('1. ✅ Test accounts are ready');
  console.log('2. 📋 Run environment verification: node verify-environment.js');
  console.log('3. 🧪 Run smoke tests: node smoke-test.js');
  console.log('4. 📊 Check setup report: testing/setup-report.md\n');
}

// Run the setup
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
