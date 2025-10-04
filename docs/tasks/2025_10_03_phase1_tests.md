# Phase 1 Testing - Database Normalization

**Test Environment:** Windows PowerShell
**Phase:** 1.3 - Run and Verify Migrations
**Prerequisites:** Ensure you're in the project root directory

---

## Pre-Migration Checks

### 1. Verify Current Database State
```powershell
# Check existing games table structure
php artisan tinker
```

Inside tinker:
```php
DB::select("SHOW CREATE TABLE games\G");
DB::table('games')->count();
DB::table('games')->select('status', DB::raw('COUNT(*) as count'))->groupBy('status')->get();
exit
```

### 2. Backup Database (CRITICAL)
```powershell
# Create backup directory if it doesn't exist
if (!(Test-Path ".\backups")) { New-Item -ItemType Directory -Path ".\backups" }

# Backup database (adjust credentials)
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
mysqldump -u root -p chess_production > ".\backups\chess_backup_$timestamp.sql"
```

**Verify backup created:**
```powershell
Get-ChildItem .\backups | Sort-Object LastWriteTime -Descending | Select-Object -First 1
```

---

## Migration Execution

### 3. Run Migrations
```powershell
# Check migration status first
php artisan migrate:status

# Run the new migrations
php artisan migrate --force

# Expected output:
#   Migrating: 2025_10_03_100000_create_game_status_tables
#   Migrated:  2025_10_03_100000_create_game_status_tables
#   Migrating: 2025_10_03_100001_add_status_fk_to_games
#   Migrated:  2025_10_03_100001_add_status_fk_to_games
```

**If migration fails:** See "Rollback Procedure" section below.

---

## Post-Migration Verification Tests

### 4. Verify Lookup Tables Created
```powershell
php artisan tinker
```

Inside tinker:
```php
// Check game_statuses table
DB::table('game_statuses')->get();
// Expected: 4 rows (waiting, active, finished, aborted)

// Check game_end_reasons table
DB::table('game_end_reasons')->get();
// Expected: 9 rows (checkmate, resignation, stalemate, etc.)

// Verify exact counts
echo "Statuses: " . DB::table('game_statuses')->count();
echo "Reasons: " . DB::table('game_end_reasons')->count();

exit
```

**Expected Output:**
```
Statuses: 4
Reasons: 9
```

### 5. Verify FK Columns Added
```powershell
php artisan tinker
```

Inside tinker:
```php
// Check new columns exist
Schema::hasColumn('games', 'status_id');  // Should return true
Schema::hasColumn('games', 'end_reason_id');  // Should return true

// Check FK constraints exist
DB::select("
    SELECT
        CONSTRAINT_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'games'
    AND REFERENCED_TABLE_NAME IS NOT NULL
");
// Should show: games_status_id_foreign, games_end_reason_id_foreign

exit
```

### 6. Verify Backfill Completeness
```powershell
php artisan tinker
```

Inside tinker:
```php
// Check all games have status_id mapped
$unmapped = DB::table('games')->whereNull('status_id')->count();
echo "Games with null status_id: $unmapped\n";
// Expected: 0

// Verify status mapping correctness
DB::table('games')
    ->join('game_statuses', 'games.status_id', '=', 'game_statuses.id')
    ->select('games.status as old_status', 'game_statuses.code as new_status', DB::raw('COUNT(*) as count'))
    ->groupBy('old_status', 'new_status')
    ->get();
// Expected: old_status should match new_status for all rows

// Check end_reason mapping (only for games with end_reason)
DB::table('games')
    ->whereNotNull('end_reason')
    ->join('game_end_reasons', 'games.end_reason_id', '=', 'game_end_reasons.id')
    ->select('games.end_reason as old_reason', 'game_end_reasons.code as new_reason', DB::raw('COUNT(*) as count'))
    ->groupBy('old_reason', 'new_reason')
    ->get();
// Expected: old_reason should match new_reason for all rows

exit
```

**Pass Criteria:**
- ✅ All games have non-null `status_id`
- ✅ Old status values match new status codes
- ✅ Old end_reason values match new reason codes (where not null)

### 7. Test Data Integrity
```powershell
php artisan tinker
```

Inside tinker:
```php
// Test reading via relationship (prepare for Phase 2)
$game = DB::table('games')
    ->join('game_statuses', 'games.status_id', '=', 'game_statuses.id')
    ->leftJoin('game_end_reasons', 'games.end_reason_id', '=', 'game_end_reasons.id')
    ->select('games.*', 'game_statuses.code as status_code', 'game_end_reasons.code as reason_code')
    ->first();

print_r($game);
// Verify status_code matches status, reason_code matches end_reason

exit
```

### 8. Clear Caches
```powershell
php artisan config:clear
php artisan cache:clear
php artisan view:clear
```

---

## Rollback Procedure (If Tests Fail)

### Option 1: Rollback Last Migration
```powershell
php artisan migrate:rollback --step=1
```

This will:
1. Drop `status_id` and `end_reason_id` columns
2. Drop lookup tables
3. Restore to pre-migration state

### Option 2: Full Database Restore (Emergency)
```powershell
# List available backups
Get-ChildItem .\backups

# Restore from backup (use latest timestamp)
mysql -u root -p chess_production < ".\backups\chess_backup_YYYYMMDD_HHMMSS.sql"
```

---

## Success Criteria Summary

| Test | Expected Result | Status |
|------|-----------------|--------|
| Lookup tables created | 4 statuses, 9 reasons | ☐ |
| FK columns added | `status_id`, `end_reason_id` exist | ☐ |
| Backfill complete | 0 null `status_id` values | ☐ |
| Data integrity | Old values match new FK codes | ☐ |
| FK constraints | Foreign keys created | ☐ |

**All tests must pass before proceeding to Phase 2.**

---

## Troubleshooting

### Error: "Backfill failed: X games have null status_id"
**Cause:** Games table has status values not in lookup table (e.g., 'completed', 'abandoned')

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

// If you see 'completed' or 'abandoned', manually add to game_statuses first:
DB::table('game_statuses')->insert([
    ['code' => 'completed', 'label' => 'Completed', 'created_at' => now(), 'updated_at' => now()],
    ['code' => 'abandoned', 'label' => 'Abandoned', 'created_at' => now(), 'updated_at' => now()],
]);

exit
```

Then rollback and re-run:
```powershell
php artisan migrate:rollback --step=1
php artisan migrate --force
```

### Error: "SQLSTATE[23000]: Integrity constraint violation"
**Cause:** Foreign key constraint violation

**Fix:** Check that `game_statuses` and `game_end_reasons` tables exist before running second migration.

---

## Next Steps After Successful Phase 1

1. ✅ Mark Phase 1.3 as completed in task doc
2. ⏳ Proceed to Phase 2.1: Create PHP Enums
3. ⏳ Document any issues encountered in `docs/updates/2025_10_03_HH_MM_update.md`

---

## Log Monitoring Command

Monitor for errors during testing:
```powershell
Get-Content .\storage\logs\laravel.log -Tail 50 -Wait
```

Press `Ctrl+C` to stop monitoring.
