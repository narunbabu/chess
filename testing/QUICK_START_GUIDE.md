# Chess-Web Testing - Quick Start Guide

**Date:** February 10, 2026  
**Purpose:** Get testing environment up and running in 5 minutes

---

## Prerequisites

✅ Node.js installed (v18+)  
✅ PHP installed (v8.1+)  
✅ Composer installed  
✅ NPM/PNPM installed

---

## Quick Start (5 Minutes)

### Option A: Automated Start (Windows)

1. **Start all servers at once:**
   ```bash
   cd C:\ArunApps\Chess-Web\testing
   START_SERVERS.bat
   ```

2. **Wait 15 seconds** for servers to initialize

3. **Verify environment:**
   ```bash
   node verify-environment.js
   ```

4. **Create test accounts:**
   ```bash
   node setup-test-accounts.js
   ```

5. **Run smoke tests:**
   ```bash
   node smoke-test.js
   ```

### Option B: Manual Start

#### Step 1: Start Backend (Terminal 1)
```bash
cd C:\ArunApps\Chess-Web\chess-backend
php artisan serve
```
**Expected:** `Server started on http://localhost:8000`

#### Step 2: Start WebSocket (Terminal 2)
```bash
cd C:\ArunApps\Chess-Web\chess-backend
php artisan reverb:start
```
**Expected:** `Reverb server started on port 8080`

#### Step 3: Start Frontend (Terminal 3)
```bash
cd C:\ArunApps\Chess-Web\chess-frontend
npm run dev
```
**Expected:** `Local: http://localhost:3000`

#### Step 4: Wait & Verify
Wait 15 seconds, then:
```bash
cd C:\ArunApps\Chess-Web
node testing/verify-environment.js
```

#### Step 5: Create Test Accounts
```bash
node testing/setup-test-accounts.js
```

#### Step 6: Run Smoke Tests
```bash
node testing/smoke-test.js
```

---

## Troubleshooting

### Backend won't start
**Error:** `Address already in use`  
**Fix:** Another process is using port 8000
```bash
# Windows: Find and kill the process
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Then restart
php artisan serve
```

### Frontend won't start
**Error:** `Port 3000 is already in use`  
**Fix:** Kill the existing process or use a different port
```bash
# Use different port
npm run dev -- --port 3001

# Or kill the process
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### WebSocket won't start
**Error:** `Port 8080 is already in use`  
**Fix:** Similar to backend
```bash
netstat -ano | findstr :8080
taskkill /PID <PID> /F
```

### Database errors
**Error:** `Database not found`  
**Fix:** Run migrations
```bash
cd chess-backend
php artisan migrate:fresh --seed
```

### Test accounts already exist
**Error:** `Email already taken`  
**Fix:** This is normal! The script will detect existing accounts and test login instead.

---

## What Each Script Does

### `verify-environment.js`
✅ Checks if all servers are running  
✅ Verifies database exists  
✅ Confirms Playwright is installed  
✅ Checks browser availability  

**When to run:** After starting servers, before creating accounts

### `setup-test-accounts.js`
✅ Creates 10 test accounts via API  
✅ Tests login for each account  
✅ Saves credentials to `test-credentials.json`  

**When to run:** After environment verification passes

### `smoke-test.js`
✅ Tests user login  
✅ Tests game creation  
✅ Tests move execution  
✅ Tests game state retrieval  

**When to run:** After accounts are created

---

## Expected Output

### ✅ Successful Setup
```
╔════════════════════════════════════════════════════════════╗
║                 VERIFICATION SUMMARY                       ║
╚════════════════════════════════════════════════════════════╝

Checks passed: 7/7

✅ node Version
✅ backend
✅ frontend
✅ websocket
✅ database
✅ playwright
✅ browsers

🎉 All checks passed! Environment is ready for testing.
```

### ✅ Accounts Created
```
╔════════════════════════════════════════════════════════════╗
║                   SETUP SUMMARY                            ║
╚════════════════════════════════════════════════════════════╝

✅ Accounts created:       10
⚠️  Accounts already exist: 0
❌ Accounts failed:        0
🔐 Login tests passed:     10/10
```

### ✅ Smoke Tests Passed
```
╔════════════════════════════════════════════════════════════╗
║                   SMOKE TEST SUMMARY                       ║
╚════════════════════════════════════════════════════════════╝

Tests passed: 5/5

✅ Login tests:         3/3
✅ Game creation:       1/1
✅ Get active games:    1/1
✅ Make move:           1/1
✅ Get game state:      1/1

🎉 All smoke tests passed! System is ready for full testing.
```

---

## Files Created

After running the setup, you'll have:

```
testing/
├── setup-test-accounts.js    # Account creation script
├── verify-environment.js     # Environment checker
├── smoke-test.js            # Basic functionality tests
├── test-credentials.json    # Generated credentials (DO NOT COMMIT)
├── setup-report.md          # This report
├── START_SERVERS.bat        # Windows startup script
└── QUICK_START_GUIDE.md     # This guide
```

---

## Next Steps After Setup

Once all scripts pass:

1. **Review setup-report.md** - Check for any issues
2. **Update credentials** - `test-credentials.json` has all login info
3. **Start Phase 2** - Time Control Testing (Feb 11)
4. **Read testing plan** - `testing/plans/Chess-Web_Real_User_Testing_PLAN.md`

---

## Security Notes

⚠️ **Important:**
- All test accounts use the same password: `TestPass123!`
- Test credentials are stored in `test-credentials.json`
- **DO NOT commit credentials to Git**
- **DO NOT use these accounts in production**
- Delete test accounts after testing is complete

---

## Common Issues

### "Cannot find module"
**Fix:** Install dependencies
```bash
# Backend
cd chess-backend
composer install

# Frontend
cd chess-frontend
npm install
```

### "Playwright not found"
**Fix:** Install Playwright
```bash
npm install -D @playwright/test
npx playwright install
```

### "Database is locked"
**Fix:** Close any open database connections
```bash
cd chess-backend
php artisan cache:clear
php artisan config:clear
```

---

## Time Estimates

| Task | Time | Status |
|------|------|--------|
| Server startup | 2 min | ⏳ |
| Environment verification | 30 sec | ⏳ |
| Account creation | 1 min | ⏳ |
| Smoke tests | 1 min | ⏳ |
| **Total** | **~5 min** | ⏳ |

---

## Support

If you encounter issues not covered here:

1. Check `setup-report.md` for detailed status
2. Review Laravel logs: `chess-backend/storage/logs/laravel.log`
3. Check frontend console: Browser DevTools → Console
4. Verify database: `chess-backend/database/database.sqlite`

---

**Status:** Ready to start  
**Created:** February 10, 2026  
**Last Updated:** February 10, 2026 - 06:35 IST
