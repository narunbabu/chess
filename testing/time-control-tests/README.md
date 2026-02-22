# Chess-Web Time Control Tests

**Created:** February 10, 2026  
**Framework:** Playwright 1.58.2  
**Status:** Ready for execution (pending UI selector mapping)

---

## 🚀 Quick Start

### Prerequisites

- Servers running (Backend, Frontend, WebSocket)
- Node.js v22.14.0+
- Playwright installed (already done)

### Run Tests

```bash
# Run all tests
node run-all-tests.js

# Run specific test suite
npm run test:accuracy    # Time control accuracy
npm run test:sync        # Multi-browser sync
npm run test:edge        # Edge cases

# Run demo test (works now, no UI mapping needed)
npx playwright test 0-api-demo-test.spec.js

# Run with UI mode (interactive)
npm run test:ui
```

---

## 📁 Test Files

| File | Purpose | Status |
|------|---------|--------|
| `0-api-demo-test.spec.js` | API-level demo tests | ✅ Ready to run |
| `1-time-control-accuracy.spec.js` | Time control accuracy | ⏳ Needs UI selectors |
| `2-multi-browser-sync.spec.js` | Multi-browser sync | ⏳ Needs UI selectors |
| `3-edge-cases.spec.js` | Edge case testing | ⏳ Needs UI selectors |
| `run-all-tests.js` | Master test runner | ✅ Ready |
| `playwright.config.js` | Configuration | ✅ Ready |

---

## ⚠️ Before Running Full Tests

### Map UI Selectors

Tests assume certain CSS selectors. You need to verify and update them:

1. **Open frontend:**
   ```
   http://localhost:3000
   ```

2. **Open DevTools (F12)**

3. **Inspect elements and note selectors for:**
   - Clock displays (currently assumes `.clock-white`, `.clock-black`)
   - Chess board (currently assumes `.chess-board`)
   - Buttons (currently assumes `button:has-text("...")`)
   - Move squares (currently assumes `[data-square="e2"]`)

4. **Update test files** with actual selectors

5. **Run tests**

---

## 📊 Test Coverage

### Time Control Accuracy (`1-time-control-accuracy.spec.js`)

- ✅ Bullet (1+0) - Clock countdown, timeout
- ✅ Blitz (3+0) - Accuracy ±100ms over 3 minutes
- ✅ Blitz (5+3) - Increment functionality
- ✅ Rapid (10+0) - Long-term stability

**Total:** 7 tests

### Multi-Browser Sync (`2-multi-browser-sync.spec.js`)

- ✅ Chrome + Chrome sync
- ✅ Chrome + Firefox cross-browser sync
- ✅ Clock update propagation speed

**Total:** 3 tests

### Edge Cases (`3-edge-cases.spec.js`)

- ✅ Fast moves (<1s apart)
- ✅ Reconnection recovery
- ✅ Multiple concurrent games
- ✅ Page refresh state recovery
- ✅ Time display edge cases (0:59, 0:01, 0:00)

**Total:** 5 tests

### API Demo (`0-api-demo-test.spec.js`)

- ✅ Backend API accessible
- ✅ Authentication
- ✅ Frontend loads
- ✅ API response time

**Total:** 6 tests (across 3 browsers = 18 total)

---

## 🛠️ Configuration

### `playwright.config.js`

**Browsers:**
- Chromium (Desktop Chrome)
- Firefox (Desktop Firefox)
- WebKit (Desktop Safari)
- Mobile Chrome (Pixel 5)
- Mobile Safari (iPhone 12)

**Reporters:**
- HTML (interactive report)
- JSON (machine-readable)
- JUnit (CI/CD integration)
- List (console output)

**Features:**
- Serial execution (no parallel conflicts)
- Screenshot on failure
- Video on failure
- Trace on failure

---

## 📈 Results

After running tests, check:

```bash
# View HTML report
npm run test:report

# Or manually open:
../results/html-report/index.html

# View JSON results
cat ../results/test-results.json

# View specific test results
cat ../results/bullet-1-0-results.json
cat ../results/chrome-chrome-sync.json
# etc.
```

---

## 📝 Test Credentials

Tests use accounts from:
```
../test-credentials.json
```

**Accounts:** test1@chess.local through test10@chess.local  
**Password:** TestPass123! (all accounts)

---

## 🐛 Troubleshooting

### Servers not running?

```bash
cd ..\
START_SERVERS.bat
# Wait 15 seconds
```

### Playwright browsers not installed?

```bash
npx playwright install
```

### Tests failing with selector errors?

You need to map UI selectors (see "Before Running Full Tests" above).

### API endpoint 404 errors?

Some backend endpoints may not exist yet. Tests are designed to handle this gracefully.

---

## 📚 Documentation

- **Main Report:** `../time-control-report.md` (comprehensive)
- **Summary:** `../PHASE_2_COMPLETION_SUMMARY.md` (quick overview)
- **Test Plan:** `C:\Users\ab\.openclaw\workspace\testing\plans\Chess-Web_Real_User_Testing_PLAN.md`

---

## 🎯 Success Criteria

Tests pass when:

- ✅ Clock accuracy within ±100ms
- ✅ Multi-browser sync within ±200ms
- ✅ Fast moves handled correctly
- ✅ Reconnection recovery within ±1s
- ✅ Page refresh recovery within ±2s
- ✅ All clocks display correctly (mm:ss format)
- ✅ Game ends when clock hits 0

---

## 🔧 Extending Tests

### Add a new test

1. Create new `.spec.js` file or add to existing
2. Follow pattern from existing tests
3. Use helper functions:
   ```javascript
   await login(page, email, password);
   await createGame(page, timeControl, increment);
   const time = await getClockTime(page, 'white');
   await makeMove(page, 'e2', 'e4');
   ```
4. Save results to `../results/`

### Add new time control

1. Open `1-time-control-accuracy.spec.js`
2. Copy existing test
3. Modify time control value
4. Update test name and expected values

### Add new browser

1. Edit `playwright.config.js`
2. Add to `projects` array:
   ```javascript
   {
     name: 'New Browser',
     use: { ...devices['Device Name'] },
   }
   ```

---

## 📞 Support

**If tests fail:**

1. Check server status (Backend, Frontend, WebSocket)
2. Verify UI selectors are correct
3. Review error messages in console
4. Check screenshots in `../results/`
5. Review trace files if available

**For questions:**

- Read main report: `../time-control-report.md`
- Check inline comments in test files
- Review Playwright docs: https://playwright.dev

---

**Ready to test!** 🚀

Just map UI selectors and run `node run-all-tests.js`
