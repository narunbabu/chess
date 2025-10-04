# Phase 2 Testing - Application Layer

**Test Environment:** Windows PowerShell + Laravel Tinker
**Phase:** 2 - Application Layer
**Prerequisites:** Phase 1 migrations completed successfully

---

## Test Suite Overview

Three critical tests to validate Phase 2 implementation:
1. **Enum Mapping** - Legacy value conversion
2. **Dual-Write** - Model mutators sync both columns
3. **Idempotent Service** - Safe concurrent calls

---

## Test 1: Enum Legacy Mapping

### Purpose
Verify that `fromLegacy()` correctly maps old values to canonical enums.

### Commands
```powershell
cd chess-backend
php artisan tinker
```

### Test Script
```php
echo "=== TEST 1: ENUM LEGACY MAPPING ===\n\n";

use App\Enums\GameStatus;
use App\Enums\EndReason;

// Test GameStatus mappings
echo "GameStatus Tests:\n";
$tests = [
    'waiting' => 'WAITING',
    'active' => 'ACTIVE',
    'finished' => 'FINISHED',
    'aborted' => 'ABORTED',
    'completed' => 'FINISHED',  // Legacy → Canonical
    'abandoned' => 'ABORTED',   // Legacy → Canonical
];

foreach ($tests as $input => $expected) {
    $result = GameStatus::fromLegacy($input);
    $match = ($result->name === $expected) ? '✅' : '❌';
    echo "  {$match} '{$input}' → {$result->name} (expected {$expected})\n";
}

echo "\nEndReason Tests:\n";
$reasonTests = [
    'checkmate' => 'CHECKMATE',
    'resignation' => 'RESIGNATION',
    'aborted' => 'ABORTED',
    'killed' => 'ABORTED',  // Legacy → Canonical
];

foreach ($reasonTests as $input => $expected) {
    $result = EndReason::fromLegacy($input);
    $match = ($result->name === $expected) ? '✅' : '❌';
    echo "  {$match} '{$input}' → {$result->name} (expected {$expected})\n";
}

echo "\n";
exit
```

### Expected Output
```
=== TEST 1: ENUM LEGACY MAPPING ===

GameStatus Tests:
  ✅ 'waiting' → WAITING (expected WAITING)
  ✅ 'active' → ACTIVE (expected ACTIVE)
  ✅ 'finished' → FINISHED (expected FINISHED)
  ✅ 'aborted' → ABORTED (expected ABORTED)
  ✅ 'completed' → FINISHED (expected FINISHED)
  ✅ 'abandoned' → ABORTED (expected ABORTED)

EndReason Tests:
  ✅ 'checkmate' → CHECKMATE (expected CHECKMATE)
  ✅ 'resignation' → RESIGNATION (expected RESIGNATION)
  ✅ 'aborted' → ABORTED (expected ABORTED)
  ✅ 'killed' → ABORTED (expected ABORTED)
```

### Pass Criteria
- ✅ All tests show ✅
- ✅ Legacy values (`completed`, `abandoned`, `killed`) map correctly

---

## Test 2: Model Dual-Write Mutators

### Purpose
Verify that setting `status` or `end_reason` automatically updates both old column and new FK column.

### Commands
```powershell
php artisan tinker
```

### Test Script
```php
echo "=== TEST 2: DUAL-WRITE MUTATORS ===\n\n";

use App\Models\Game;
use App\Models\GameStatus;
use App\Models\GameEndReason;

// Get or create a test game
$game = Game::first();
if (!$game) {
    echo "❌ No games found. Create a game first.\n";
    exit;
}

echo "Testing with Game ID: {$game->id}\n\n";

// TEST 2A: Legacy status value
echo "Test 2A: Setting status = 'abandoned' (legacy)\n";
$game->status = 'abandoned';
$game->save();
$game->refresh();

echo "  Old column (status): '{$game->status}'\n";
echo "  New column (status_id): {$game->status_id}\n";
echo "  Expected status: 'aborted'\n";
echo "  Expected status_id: 4\n";

$pass2a = ($game->status === 'aborted' && $game->status_id === 4);
echo "  Result: " . ($pass2a ? '✅ PASS' : '❌ FAIL') . "\n\n";

// TEST 2B: Canonical status value
echo "Test 2B: Setting status = 'finished' (canonical)\n";
$game->status = 'finished';
$game->save();
$game->refresh();

echo "  Old column (status): '{$game->status}'\n";
echo "  New column (status_id): {$game->status_id}\n";
echo "  Expected status: 'finished'\n";
echo "  Expected status_id: 3\n";

$pass2b = ($game->status === 'finished' && $game->status_id === 3);
echo "  Result: " . ($pass2b ? '✅ PASS' : '❌ FAIL') . "\n\n";

// TEST 2C: End reason (legacy)
echo "Test 2C: Setting end_reason = 'killed' (legacy)\n";
$game->end_reason = 'killed';
$game->save();
$game->refresh();

echo "  Old column (end_reason): '{$game->end_reason}'\n";
echo "  New column (end_reason_id): {$game->end_reason_id}\n";
echo "  Expected end_reason: 'aborted'\n";
echo "  Expected end_reason_id: 9\n";

$pass2c = ($game->end_reason === 'aborted' && $game->end_reason_id === 9);
echo "  Result: " . ($pass2c ? '✅ PASS' : '❌ FAIL') . "\n\n";

// TEST 2D: Relationship access
echo "Test 2D: Accessing via relationship\n";
$statusCode = $game->statusRelation->code;
$reasonCode = $game->endReasonRelation->code;

echo "  statusRelation->code: '{$statusCode}'\n";
echo "  endReasonRelation->code: '{$reasonCode}'\n";
echo "  Expected: 'finished', 'aborted'\n";

$pass2d = ($statusCode === 'finished' && $reasonCode === 'aborted');
echo "  Result: " . ($pass2d ? '✅ PASS' : '❌ FAIL') . "\n\n";

// Summary
$allPass = $pass2a && $pass2b && $pass2c && $pass2d;
echo "=== SUMMARY ===\n";
echo $allPass ? "✅ ALL TESTS PASSED\n" : "❌ SOME TESTS FAILED\n";

exit
```

### Expected Output
```
=== TEST 2: DUAL-WRITE MUTATORS ===

Testing with Game ID: 1

Test 2A: Setting status = 'abandoned' (legacy)
  Old column (status): 'aborted'
  New column (status_id): 4
  Expected status: 'aborted'
  Expected status_id: 4
  Result: ✅ PASS

Test 2B: Setting status = 'finished' (canonical)
  Old column (status): 'finished'
  New column (status_id): 3
  Expected status: 'finished'
  Expected status_id: 3
  Result: ✅ PASS

Test 2C: Setting end_reason = 'killed' (legacy)
  Old column (end_reason): 'aborted'
  New column (end_reason_id): 9
  Expected end_reason: 'aborted'
  Expected end_reason_id: 9
  Result: ✅ PASS

Test 2D: Accessing via relationship
  statusRelation->code: 'finished'
  endReasonRelation->code: 'aborted'
  Expected: 'finished', 'aborted'
  Result: ✅ PASS

=== SUMMARY ===
✅ ALL TESTS PASSED
```

### Pass Criteria
- ✅ All 4 sub-tests pass
- ✅ Legacy values automatically converted
- ✅ Both old and new columns updated
- ✅ Relationships work correctly

---

## Test 3: Idempotent Service Method

### Purpose
Verify that calling `updateGameStatus()` twice on a finished game is safe and returns current state.

### Prerequisites
This test requires a running Laravel app. You can test via:
1. **Postman/Insomnia** (recommended for manual testing)
2. **Tinker simulation** (shown below)

### Option A: Tinker Simulation

```powershell
php artisan tinker
```

```php
echo "=== TEST 3: IDEMPOTENT SERVICE ===\n\n";

use App\Models\Game;
use App\Services\GameRoomService;

$game = Game::first();
if (!$game) {
    echo "❌ No games found.\n";
    exit;
}

// Reset game to active state
$game->update(['status' => 'active', 'ended_at' => null]);
echo "Game {$game->id} reset to 'active'\n\n";

// Get service instance
$service = app(GameRoomService::class);

// First call - should update game
echo "Call 1: Ending game with status='aborted'\n";
try {
    $result1 = $service->updateGameStatus(
        $game->id,
        $game->white_player_id,
        'aborted',
        null,
        'aborted',
        'test-socket-1'
    );

    echo "  Success: {$result1['success']}\n";
    echo "  Status: {$result1['status']}\n";
    echo "  Already finished: " . (isset($result1['already_finished']) ? 'true' : 'false') . "\n";
    $pass1 = ($result1['success'] && $result1['status'] === 'aborted' && !isset($result1['already_finished']));
    echo "  Result: " . ($pass1 ? '✅ PASS' : '❌ FAIL') . "\n\n";
} catch (\Exception $e) {
    echo "  ❌ FAIL: {$e->getMessage()}\n\n";
    $pass1 = false;
}

// Second call - should return current state (idempotent)
echo "Call 2: Attempting to end again (should be idempotent)\n";
try {
    $result2 = $service->updateGameStatus(
        $game->id,
        $game->white_player_id,
        'finished',
        '1-0',
        'checkmate',
        'test-socket-2'
    );

    echo "  Success: {$result2['success']}\n";
    echo "  Status: {$result2['status']}\n";
    echo "  Already finished: " . (isset($result2['already_finished']) ? 'true' : 'false') . "\n";
    $pass2 = ($result2['success'] && $result2['status'] === 'aborted' && isset($result2['already_finished']));
    echo "  Result: " . ($pass2 ? '✅ PASS (idempotent)' : '❌ FAIL') . "\n\n";
} catch (\Exception $e) {
    echo "  ❌ FAIL: {$e->getMessage()}\n\n";
    $pass2 = false;
}

echo "=== SUMMARY ===\n";
echo ($pass1 && $pass2) ? "✅ ALL TESTS PASSED\n" : "❌ SOME TESTS FAILED\n";

exit
```

### Expected Output
```
=== TEST 3: IDEMPOTENT SERVICE ===

Game 1 reset to 'active'

Call 1: Ending game with status='aborted'
  Success: 1
  Status: aborted
  Already finished: false
  Result: ✅ PASS

Call 2: Attempting to end again (should be idempotent)
  Success: 1
  Status: aborted
  Already finished: true
  Result: ✅ PASS (idempotent)

=== SUMMARY ===
✅ ALL TESTS PASSED
```

### Pass Criteria
- ✅ First call updates game successfully
- ✅ Second call returns `already_finished: true`
- ✅ Second call preserves first call's status (doesn't change to 'finished')
- ✅ No exceptions thrown

---

## All-in-One Test Script

For quick validation, run all 3 tests sequentially:

```powershell
cd chess-backend
php artisan tinker
```

```php
// Copy entire Phase 2 test suite here
// (Combines Test 1 + Test 2 + Test 3 scripts)
// Run all tests and report final status

echo "========================================\n";
echo "PHASE 2 - COMPLETE TEST SUITE\n";
echo "========================================\n\n";

// [Insert Test 1 script]
// [Insert Test 2 script]
// [Insert Test 3 script]

echo "\n========================================\n";
echo "FINAL RESULT: ";
echo ($allTestsPass) ? "✅ PHASE 2 READY\n" : "❌ TESTS FAILED\n";
echo "========================================\n";

exit
```

---

## Troubleshooting

### Test 1 Fails: "Class 'App\Enums\GameStatus' not found"

**Cause:** Enum files not autoloaded

**Fix:**
```powershell
composer dump-autoload
```

### Test 2 Fails: "Call to undefined method getIdByCode()"

**Cause:** GameStatus model not loaded

**Fix:** Verify `chess-backend/app/Models/GameStatus.php` exists and run:
```powershell
composer dump-autoload
php artisan config:clear
```

### Test 3 Fails: "User not authorized"

**Cause:** Auth context not set in tinker

**Fix:** Use actual user IDs:
```php
$game = Game::first();
$userId = $game->white_player_id;  // Use real player ID
```

---

## Next Steps After All Tests Pass

1. ✅ Document test results
2. ✅ Reply "Phase 2 tests passed - proceed to Phase 3"
3. ⏳ Move to Phase 3: Frontend alignment
4. ⏳ Test kill game feature end-to-end

---

## Log Monitoring

Watch for errors during testing:
```powershell
Get-Content .\storage\logs\laravel.log -Tail 50 -Wait
```

Look for:
- ✅ "Game status updated" with canonical values logged
- ✅ "Game already finished, returning current state" (Test 3)
- ❌ Any "Data truncated" errors (should not appear)
