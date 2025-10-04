# Phase 1 Testing - Database Normalization (SQLite)

**Test Environment:** Windows PowerShell + SQLite
**Phase:** 1.3 - Run and Verify Migrations
**Prerequisites:** Ensure you're in the `chess-backend` directory

---

## ✅ Migrations Already Run - Verification Only

Based on your output:
- ✅ Lookup tables created (4 statuses, 9 reasons)
- ✅ FK columns added (`status_id`, `end_reason_id`)
- ⏳ Need to verify backfill and data integrity

---

## Post-Migration Verification Tests (SQLite)

### 1. Verify Lookup Tables Data
```powershell
cd chess-backend
php artisan tinker
```

Inside tinker:
```php
// Check game_statuses table
DB::table('game_statuses')->orderBy('id')->get();
// Expected: waiting, active, finished, aborted

// Check game_end_reasons table
DB::table('game_end_reasons')->orderBy('id')->get();
// Expected: checkmate, resignation, stalemate, timeout, draw_agreed, threefold, fifty_move, insufficient_material, aborted

exit
```

### 2. Verify FK Columns Exist (SQLite-Compatible)
```powershell
php artisan tinker
```

Inside tinker:
```php
// Check columns exist
Schema::hasColumn('games', 'status_id');  // Should return true
Schema::hasColumn('games', 'end_reason_id');  // Should return true

// SQLite-specific: Get table schema
DB::select("PRAGMA table_info(games)");
// Look for status_id and end_reason_id in output

// SQLite-specific: Check foreign keys
DB::select("PRAGMA foreign_key_list(games)");
// Should show FKs to game_statuses and game_end_reasons

exit
```

**Expected FK output:**
```
[
  {
    "id": 0,
    "seq": 0,
    "table": "game_statuses",
    "from": "status_id",
    "to": "id",
    "on_update": "NO ACTION",
    "on_delete": "RESTRICT"
  },
  {
    "id": 1,
    "seq": 0,
    "table": "game_end_reasons",
    "from": "end_reason_id",
    "to": "id",
    "on_update": "NO ACTION",
    "on_delete": "RESTRICT"
  }
]
```

### 3. Verify Backfill Completeness (CRITICAL TEST)
```powershell
php artisan tinker
```

Inside tinker:
```php
// Check all games have status_id mapped
$unmapped = DB::table('games')->whereNull('status_id')->count();
echo "Games with null status_id: $unmapped\n";
// Expected: 0 (MUST BE ZERO)

// Show current game statuses
DB::table('games')
    ->select('id', 'status', 'status_id', 'end_reason', 'end_reason_id')
    ->get();
// Verify status_id populated for all rows

exit
```

**Pass Criteria:**
- ✅ `unmapped = 0` (all games have status_id)

### 4. Verify Status Mapping Correctness
```powershell
php artisan tinker
```

Inside tinker:
```php
// Verify status mapping correctness
DB::table('games')
    ->join('game_statuses', 'games.status_id', '=', 'game_statuses.id')
    ->select(
        'games.status as old_status',
        'game_statuses.code as new_status',
        DB::raw('COUNT(*) as count')
    )
    ->groupBy('old_status', 'new_status')
    ->get();
// Expected: old_status MUST match new_status for all rows

exit
```

**Expected output:**
```
[
  {
    "old_status": "active",
    "new_status": "active",
    "count": 1
  },
  {
    "old_status": "finished",
    "new_status": "finished",
    "count": 1
  }
]
```

### 5. Verify End Reason Mapping (If Applicable)
```powershell
php artisan tinker
```

Inside tinker:
```php
// Check end_reason mapping (only for games with end_reason)
DB::table('games')
    ->whereNotNull('end_reason')
    ->join('game_end_reasons', 'games.end_reason_id', '=', 'game_end_reasons.id')
    ->select(
        'games.end_reason as old_reason',
        'game_end_reasons.code as new_reason',
        DB::raw('COUNT(*) as count')
    )
    ->groupBy('old_reason', 'new_reason')
    ->get();
// Expected: old_reason should match new_reason for all rows

// If no games finished yet, this might return empty - that's OK
$gamesWithReason = DB::table('games')->whereNotNull('end_reason')->count();
echo "Games with end_reason: $gamesWithReason\n";

exit
```

### 6. Test Data Integrity (Sample Game)
```powershell
php artisan tinker
```

Inside tinker:
```php
// Test reading via relationship (manual join)
$game = DB::table('games')
    ->join('game_statuses', 'games.status_id', '=', 'game_statuses.id')
    ->leftJoin('game_end_reasons', 'games.end_reason_id', '=', 'game_end_reasons.id')
    ->select(
        'games.id',
        'games.status as old_status',
        'game_statuses.code as status_code',
        'games.end_reason as old_reason',
        'game_end_reasons.code as reason_code'
    )
    ->first();

print_r($game);
// Verify: old_status === status_code, old_reason === reason_code

exit
```

### 7. Clear Caches
```powershell
php artisan config:clear
php artisan cache:clear
```

---

## Success Criteria Summary

| Test | Expected Result | Your Status |
|------|-----------------|-------------|
| Lookup tables created | 4 statuses, 9 reasons | ✅ PASSED (you confirmed) |
| FK columns added | `status_id`, `end_reason_id` exist | ✅ PASSED (columns exist) |
| FK constraints | 2 foreign keys to lookup tables | ⏳ Run Test 2 |
| Backfill complete | 0 null `status_id` values | ⏳ Run Test 3 |
| Data integrity | Old values match new FK codes | ⏳ Run Test 4 |

**All tests must pass before proceeding to Phase 2.**

---

## Troubleshooting

### Error: "Backfill failed: X games have null status_id"

**Cause:** Games table has status values not in lookup table

**Fix:**
```powershell
php artisan tinker
```
```php
// Find unmapped values
DB::table('games')
    ->select('status', DB::raw('COUNT(*) as count'))
    ->groupBy('status')
    ->get();

// Check what's in lookup table
DB::table('game_statuses')->pluck('code');

// If status values don't match, add missing ones:
DB::table('game_statuses')->insert([
    ['code' => 'completed', 'label' => 'Completed', 'created_at' => now(), 'updated_at' => now()],
]);

exit
```

Then rollback and re-run:
```powershell
php artisan migrate:rollback --step=1
php artisan migrate
```

### Status Mismatch (old_status ≠ new_status)

**Cause:** Backfill logic error or data corruption

**Check current state:**
```php
DB::table('games')
    ->join('game_statuses', 'games.status_id', '=', 'game_statuses.id')
    ->select('games.id', 'games.status', 'game_statuses.code')
    ->whereRaw('games.status != game_statuses.code')
    ->get();
```

**If mismatches found:** Report the output for investigation.

---

## Quick Verification Command (All-in-One)

```powershell
php artisan tinker
```

```php
echo "=== PHASE 1 VERIFICATION ===\n\n";

echo "1. Lookup Tables:\n";
echo "   Statuses: " . DB::table('game_statuses')->count() . " (expect 4)\n";
echo "   Reasons: " . DB::table('game_end_reasons')->count() . " (expect 9)\n\n";

echo "2. FK Columns:\n";
echo "   status_id exists: " . (Schema::hasColumn('games', 'status_id') ? 'YES' : 'NO') . "\n";
echo "   end_reason_id exists: " . (Schema::hasColumn('games', 'end_reason_id') ? 'YES' : 'NO') . "\n\n";

echo "3. Backfill:\n";
$unmapped = DB::table('games')->whereNull('status_id')->count();
echo "   Unmapped games: $unmapped (must be 0)\n\n";

echo "4. Data Integrity:\n";
$mismatches = DB::table('games')
    ->join('game_statuses', 'games.status_id', '=', 'game_statuses.id')
    ->whereRaw('games.status != game_statuses.code')
    ->count();
echo "   Status mismatches: $mismatches (must be 0)\n\n";

$reasonMismatches = DB::table('games')
    ->whereNotNull('end_reason')
    ->join('game_end_reasons', 'games.end_reason_id', '=', 'game_end_reasons.id')
    ->whereRaw('games.end_reason != game_end_reasons.code')
    ->count();
echo "   Reason mismatches: $reasonMismatches (must be 0)\n\n";

if ($unmapped === 0 && $mismatches === 0 && $reasonMismatches === 0) {
    echo "✅ ALL TESTS PASSED - READY FOR PHASE 2\n";
} else {
    echo "❌ TESTS FAILED - SEE ABOVE\n";
}

exit
```

Copy/paste this entire block into tinker for instant verification.

---

## Next Steps After Successful Phase 1

1. ✅ Copy the "Quick Verification Command" output and share it
2. ✅ If all tests pass, reply **"Phase 1 tests passed"**
3. ⏳ Proceed to Phase 2: Application Layer (PHP enums, models, services)

---

## Log Monitoring (Optional)

Monitor for errors:
```powershell
Get-Content .\storage\logs\laravel.log -Tail 50 -Wait
```

Press `Ctrl+C` to stop.
