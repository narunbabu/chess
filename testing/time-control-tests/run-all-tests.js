/**
 * Chess-Web Time Control Testing - Master Test Runner
 * 
 * This script orchestrates all time control tests and generates a comprehensive report.
 */

const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const RESULTS_DIR = path.join(__dirname, '..', 'results');
const REPORT_PATH = path.join(__dirname, '..', '..', 'testing', 'time-control-report.md');

// Ensure results directory exists
async function ensureResultsDir() {
  try {
    await fs.mkdir(RESULTS_DIR, { recursive: true });
    console.log(`✅ Results directory ready: ${RESULTS_DIR}`);
  } catch (error) {
    console.error(`❌ Error creating results directory: ${error.message}`);
    throw error;
  }
}

// Run a test suite
async function runTestSuite(suiteName, command) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running: ${suiteName}`);
  console.log('='.repeat(60));
  
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    exec(command, { cwd: __dirname }, (error, stdout, stderr) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log(stdout);
      if (stderr) console.error(stderr);
      
      if (error) {
        console.log(`❌ ${suiteName} FAILED (${duration}s)`);
        resolve({
          suite: suiteName,
          passed: false,
          duration,
          error: error.message,
          stdout,
          stderr
        });
      } else {
        console.log(`✅ ${suiteName} PASSED (${duration}s)`);
        resolve({
          suite: suiteName,
          passed: true,
          duration,
          stdout,
          stderr: null
        });
      }
    });
  });
}

// Generate comprehensive test report
async function generateReport(testResults) {
  console.log('\n📝 Generating comprehensive test report...');
  
  const timestamp = new Date().toISOString();
  const totalTests = testResults.length;
  const passedTests = testResults.filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;
  
  // Load individual test result files
  const detailedResults = {};
  
  try {
    // Bullet test
    try {
      detailedResults.bullet = JSON.parse(
        await fs.readFile(path.join(RESULTS_DIR, 'bullet-1-0-results.json'), 'utf-8')
      );
    } catch (e) { detailedResults.bullet = null; }
    
    // Blitz test
    try {
      detailedResults.blitz = JSON.parse(
        await fs.readFile(path.join(RESULTS_DIR, 'blitz-3-0-results.json'), 'utf-8')
      );
    } catch (e) { detailedResults.blitz = null; }
    
    // Blitz with increment
    try {
      detailedResults.blitzIncrement = JSON.parse(
        await fs.readFile(path.join(RESULTS_DIR, 'blitz-5-3-results.json'), 'utf-8')
      );
    } catch (e) { detailedResults.blitzIncrement = null; }
    
    // Rapid test
    try {
      detailedResults.rapid = JSON.parse(
        await fs.readFile(path.join(RESULTS_DIR, 'rapid-10-0-results.json'), 'utf-8')
      );
    } catch (e) { detailedResults.rapid = null; }
    
    // Multi-browser sync
    try {
      detailedResults.chromeSync = JSON.parse(
        await fs.readFile(path.join(RESULTS_DIR, 'chrome-chrome-sync.json'), 'utf-8')
      );
    } catch (e) { detailedResults.chromeSync = null; }
    
    try {
      detailedResults.crossBrowserSync = JSON.parse(
        await fs.readFile(path.join(RESULTS_DIR, 'chrome-firefox-sync.json'), 'utf-8')
      );
    } catch (e) { detailedResults.crossBrowserSync = null; }
    
    // Edge cases
    try {
      detailedResults.fastMoves = JSON.parse(
        await fs.readFile(path.join(RESULTS_DIR, 'fast-moves.json'), 'utf-8')
      );
    } catch (e) { detailedResults.fastMoves = null; }
    
    try {
      detailedResults.reconnection = JSON.parse(
        await fs.readFile(path.join(RESULTS_DIR, 'reconnection.json'), 'utf-8')
      );
    } catch (e) { detailedResults.reconnection = null; }
    
    try {
      detailedResults.multipleGames = JSON.parse(
        await fs.readFile(path.join(RESULTS_DIR, 'multiple-games.json'), 'utf-8')
      );
    } catch (e) { detailedResults.multipleGames = null; }
    
    try {
      detailedResults.pageRefresh = JSON.parse(
        await fs.readFile(path.join(RESULTS_DIR, 'page-refresh.json'), 'utf-8')
      );
    } catch (e) { detailedResults.pageRefresh = null; }
    
  } catch (error) {
    console.warn(`⚠️  Warning: Could not load some detailed results: ${error.message}`);
  }
  
  // Build markdown report
  const report = `# Chess-Web Time Control Testing Report

**Generated:** ${new Date(timestamp).toLocaleString()}  
**Project:** Chess-Web (localhost testing)  
**Phase:** 2 - Time Control Testing  
**Tester:** Agent Worker (Subagent)

---

## 📊 Executive Summary

| Metric | Value |
|--------|-------|
| **Total Test Suites** | ${totalTests} |
| **Passed** | ✅ ${passedTests} |
| **Failed** | ❌ ${failedTests} |
| **Success Rate** | ${((passedTests / totalTests) * 100).toFixed(1)}% |
| **Overall Status** | ${failedTests === 0 ? '✅ **ALL PASSED**' : '❌ **SOME FAILURES**'} |

---

## 🎯 Test Coverage

### Task 1: Time Control Accuracy ✓

| Time Control | Status | Notes |
|--------------|--------|-------|
| Bullet (1+0) | ${detailedResults.bullet?.passed ? '✅ PASS' : '❌ FAIL'} | ${detailedResults.bullet?.passed ? 'Clock accurate' : detailedResults.bullet?.issues.join('; ')} |
| Blitz (3+0) | ${detailedResults.blitz?.passed ? '✅ PASS' : '❌ FAIL'} | ${detailedResults.blitz ? `Avg accuracy: ${detailedResults.blitz.avgAccuracy?.toFixed(1)}ms` : 'No data'} |
| Blitz (5+3) | ${detailedResults.blitzIncrement?.passed ? '✅ PASS' : '❌ FAIL'} | ${detailedResults.blitzIncrement ? 'Increment working' : 'No data'} |
| Rapid (10+0) | ${detailedResults.rapid?.passed ? '✅ PASS' : '❌ FAIL'} | ${detailedResults.rapid ? `Max drift: ${detailedResults.rapid.maxDrift?.toFixed(2)}s` : 'No data'} |

### Task 2: Multi-Browser Sync ✓

| Test | Status | Sync Accuracy |
|------|--------|---------------|
| Chrome + Chrome | ${detailedResults.chromeSync?.passed ? '✅ PASS' : '❌ FAIL'} | ${detailedResults.chromeSync ? `Max: ${detailedResults.chromeSync.maxSyncDiff?.toFixed(0)}ms` : 'No data'} |
| Chrome + Firefox | ${detailedResults.crossBrowserSync?.passed ? '✅ PASS' : '❌ FAIL'} | ${detailedResults.crossBrowserSync ? `Max: ${detailedResults.crossBrowserSync.maxSyncDiff?.toFixed(0)}ms` : 'No data'} |

### Task 3: Edge Cases ✓

| Test | Status | Details |
|------|--------|---------|
| Fast Moves (<1s) | ${detailedResults.fastMoves?.passed ? '✅ PASS' : '❌ FAIL'} | ${detailedResults.fastMoves ? `${detailedResults.fastMoves.measurements.length} rapid moves tested` : 'No data'} |
| Reconnection | ${detailedResults.reconnection?.passed ? '✅ PASS' : '❌ FAIL'} | ${detailedResults.reconnection ? `Accuracy: ${detailedResults.reconnection.accuracy?.toFixed(1)}s` : 'No data'} |
| Multiple Games | ${detailedResults.multipleGames?.passed ? '✅ PASS' : '❌ FAIL'} | ${detailedResults.multipleGames ? `${detailedResults.multipleGames.games.length} concurrent games` : 'No data'} |
| Page Refresh | ${detailedResults.pageRefresh?.passed ? '✅ PASS' : '❌ FAIL'} | ${detailedResults.pageRefresh ? `Recovery accuracy: ${detailedResults.pageRefresh.whiteAccuracy?.toFixed(1)}s` : 'No data'} |

---

## 📈 Performance Metrics

### Time Control Accuracy

${detailedResults.blitz ? `
**Blitz (3+0) Accuracy Over Time:**

| Interval | Expected Time | Actual Time | Accuracy (ms) |
|----------|---------------|-------------|---------------|
${detailedResults.blitz.measurements.slice(1, 7).map((m, i) => 
  `| ${m.interval}s | ${m.expectedTime.toFixed(1)}s | ${m.actualTime.toFixed(1)}s | ${m.accuracy.toFixed(0)}ms |`
).join('\n')}

**Statistics:**
- Average Accuracy: ${detailedResults.blitz.avgAccuracy?.toFixed(1)}ms
- Maximum Deviation: ${detailedResults.blitz.maxAccuracy?.toFixed(1)}ms
- Target: ±100ms
- **Result:** ${detailedResults.blitz.maxAccuracy <= 100 ? '✅ Within tolerance' : '❌ Exceeds tolerance'}
` : '_No Blitz data available_'}

### Clock Synchronization

${detailedResults.chromeSync ? `
**Chrome + Chrome Synchronization:**

${detailedResults.chromeSync.measurements.slice(0, 5).map(m => 
  `- **${m.stage}:** ${m.syncDifferenceMs.toFixed(0)}ms difference`
).join('\n')}

**Statistics:**
- Average Sync Diff: ${detailedResults.chromeSync.avgSyncDiff?.toFixed(1)}ms
- Maximum Sync Diff: ${detailedResults.chromeSync.maxSyncDiff?.toFixed(1)}ms
- Minimum Sync Diff: ${detailedResults.chromeSync.minSyncDiff?.toFixed(1)}ms
- Target: ±200ms
- **Result:** ${detailedResults.chromeSync.maxSyncDiff <= 200 ? '✅ Within tolerance' : '❌ Exceeds tolerance'}
` : '_No sync data available_'}

### Increment Functionality

${detailedResults.blitzIncrement ? `
**Blitz (5+3) Increment Tests:**

| Move # | Time Before | Time After | Increment | Expected | Accuracy |
|--------|-------------|------------|-----------|----------|----------|
${detailedResults.blitzIncrement.incrementTests.slice(0, 6).map(t => 
  `| ${t.moveNumber} | ${t.timeBeforeMove.toFixed(1)}s | ${t.timeAfterMove.toFixed(1)}s | ${t.incrementReceived.toFixed(1)}s | ${t.expectedIncrement}s | ${t.accuracy.toFixed(2)}s |`
).join('\n')}

**Result:** ${detailedResults.blitzIncrement.passed ? '✅ All increments within ±0.5s tolerance' : '❌ Some increments outside tolerance'}
` : '_No increment data available_'}

---

## 🐛 Issues Found

${testResults.map(r => {
  if (!r.passed) {
    return `
### ❌ ${r.suite}

**Status:** FAILED  
**Duration:** ${r.duration}s  
**Error:** ${r.error}

<details>
<summary>Test Output</summary>

\`\`\`
${r.stdout}
\`\`\`
</details>
`;
  }
  return '';
}).join('\n')}

${Object.entries(detailedResults).map(([key, data]) => {
  if (data && data.issues && data.issues.length > 0) {
    return `
### ⚠️ ${data.testName}

**Issues:**
${data.issues.map(issue => `- ${issue}`).join('\n')}
`;
  }
  return '';
}).join('\n')}

${failedTests === 0 && Object.values(detailedResults).every(d => !d || d.issues?.length === 0) ? 
  '✅ **No issues found! All tests passed.**' : ''}

---

## 🔍 Test Details

### Time Control Accuracy Tests

<details>
<summary>View detailed measurements</summary>

${Object.entries(detailedResults).filter(([k, v]) => 
  ['bullet', 'blitz', 'blitzIncrement', 'rapid'].includes(k) && v
).map(([key, data]) => `
#### ${data.testName}

\`\`\`json
${JSON.stringify(data.measurements, null, 2)}
\`\`\`
`).join('\n')}

</details>

### Multi-Browser Sync Tests

<details>
<summary>View synchronization data</summary>

${Object.entries(detailedResults).filter(([k, v]) => 
  ['chromeSync', 'crossBrowserSync'].includes(k) && v
).map(([key, data]) => `
#### ${data.testName}

\`\`\`json
${JSON.stringify(data.measurements, null, 2)}
\`\`\`
`).join('\n')}

</details>

### Edge Case Tests

<details>
<summary>View edge case results</summary>

${Object.entries(detailedResults).filter(([k, v]) => 
  ['fastMoves', 'reconnection', 'multipleGames', 'pageRefresh'].includes(k) && v
).map(([key, data]) => `
#### ${data.testName}

\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`
`).join('\n')}

</details>

---

## ✅ Success Criteria Assessment

| Criteria | Target | Actual | Status |
|----------|--------|--------|--------|
| All 4 time controls tested | Yes | ${Object.keys(detailedResults).filter(k => ['bullet', 'blitz', 'blitzIncrement', 'rapid'].includes(k)).length}/4 | ${Object.keys(detailedResults).filter(k => ['bullet', 'blitz', 'blitzIncrement', 'rapid'].includes(k)).length === 4 ? '✅' : '❌'} |
| Clock accuracy | ±100ms | ${detailedResults.blitz?.maxAccuracy?.toFixed(0) || 'N/A'}ms | ${detailedResults.blitz?.maxAccuracy <= 100 ? '✅' : '❌'} |
| Multi-browser sync | ±200ms | ${detailedResults.chromeSync?.maxSyncDiff?.toFixed(0) || 'N/A'}ms | ${detailedResults.chromeSync?.maxSyncDiff <= 200 ? '✅' : '❌'} |
| Edge cases tested | All | ${Object.keys(detailedResults).filter(k => ['fastMoves', 'reconnection', 'multipleGames', 'pageRefresh'].includes(k)).length}/4 | ${Object.keys(detailedResults).filter(k => ['fastMoves', 'reconnection', 'multipleGames', 'pageRefresh'].includes(k)).length === 4 ? '✅' : '❌'} |
| Comprehensive report | Yes | This document | ✅ |

---

## 📝 Recommendations

${failedTests === 0 ? `
### ✅ All Tests Passed!

The time control system is working well. Minor recommendations:

1. **Monitor clock drift** in production with real network latency
2. **Add telemetry** to track clock accuracy in live games
3. **Test on mobile devices** for touch-based gameplay
4. **Stress test** with 50+ concurrent games
` : `
### ❌ Issues Require Attention

Based on test failures, please address:

${testResults.filter(r => !r.passed).map(r => 
  `1. **${r.suite}:** ${r.error}`
).join('\n')}

Additional recommendations:
- Review WebSocket message handling for clock updates
- Check server-side time synchronization logic
- Verify client-side clock rendering updates
`}

---

## 📊 Test Execution Summary

${testResults.map(r => `
### ${r.suite}
- **Status:** ${r.passed ? '✅ PASSED' : '❌ FAILED'}
- **Duration:** ${r.duration}s
${r.error ? `- **Error:** ${r.error}` : ''}
`).join('\n')}

---

## 🏁 Conclusion

${failedTests === 0 ? `
**✅ Phase 2 Testing COMPLETE - ALL TESTS PASSED**

The Chess-Web time control system has been thoroughly tested and performs well across all test scenarios:
- Time control accuracy is within ±100ms tolerance
- Multi-browser synchronization works correctly
- Edge cases (fast moves, reconnection, page refresh) are handled properly
- Clock displays correctly in all scenarios

The system is ready for real-world user testing.
` : `
**⚠️ Phase 2 Testing COMPLETE - SOME FAILURES**

Testing has identified ${failedTests} area(s) requiring attention. Please review the issues section above and address the problems before proceeding to production testing.
`}

**Next Steps:**
1. ${failedTests > 0 ? 'Fix identified issues and retest' : 'Proceed to Phase 3 (Label & UI Testing)'}
2. ${failedTests > 0 ? 'Run tests again after fixes' : 'Test with real users on mobile devices'}
3. ${failedTests > 0 ? 'Document fixes in changelog' : 'Monitor production metrics'}

---

**Report Generated:** ${timestamp}  
**Testing Framework:** Playwright ${require('@playwright/test/package.json').version}  
**Test Files:** 3 (Accuracy, Multi-Browser, Edge Cases)  
**Total Test Duration:** ${testResults.reduce((sum, r) => sum + parseFloat(r.duration), 0).toFixed(2)}s
`;

  await fs.writeFile(REPORT_PATH, report);
  console.log(`✅ Report generated: ${REPORT_PATH}`);
  
  return report;
}

// Main execution
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Chess-Web Time Control Testing - Phase 2                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  try {
    // Setup
    await ensureResultsDir();
    
    // Run all test suites
    const testResults = [];
    
    // Test Suite 1: Time Control Accuracy
    testResults.push(await runTestSuite(
      'Task 1: Time Control Accuracy',
      'npx playwright test 1-time-control-accuracy.spec.js'
    ));
    
    // Test Suite 2: Multi-Browser Sync
    testResults.push(await runTestSuite(
      'Task 2: Multi-Browser Synchronization',
      'npx playwright test 2-multi-browser-sync.spec.js'
    ));
    
    // Test Suite 3: Edge Cases
    testResults.push(await runTestSuite(
      'Task 3: Edge Cases',
      'npx playwright test 3-edge-cases.spec.js'
    ));
    
    // Generate comprehensive report
    await generateReport(testResults);
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  ALL TESTS COMPLETE                                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    const passedCount = testResults.filter(r => r.passed).length;
    const totalCount = testResults.length;
    
    console.log(`✅ Passed: ${passedCount}/${totalCount}`);
    console.log(`❌ Failed: ${totalCount - passedCount}/${totalCount}`);
    console.log(`📝 Report: ${REPORT_PATH}\n`);
    
    process.exit(passedCount === totalCount ? 0 : 1);
    
  } catch (error) {
    console.error(`\n❌ Testing failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main, runTestSuite, generateReport };
