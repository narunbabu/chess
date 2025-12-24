# Draw Events Table Migration Fix

**Date:** 2025-12-16
**Issue:** Database schema mismatch between migration and DrawHandlerService
**Status:** ⚠️ **ACTION REQUIRED** - Migration needs to be run

---

## 🐛 Problem

The `draw_events` table was created with incorrect column names that don't match what the `DrawHandlerService` expects:

**Migration Had:**
- `offered_by_user_id` ❌
- `offered_to_user_id` ❌
- `response` (enum) ❌
- Missing rating impact columns ❌

**DrawHandlerService Expects:**
- `offering_user_id` ✅
- `receiving_user_id` ✅
- `status` (enum) ✅
- `offering_player_rating_impact` ✅
- `receiving_player_rating_impact` ✅

**Error Message:**
```
SQLSTATE[HY000]: General error: 1 table draw_events has no column named offering_user_id
```

---

## ✅ Solution

I've created a migration fix that will:
1. Drop the old `draw_events` table
2. Recreate it with the correct schema matching `DrawHandlerService`

**Migration File:** `2025_12_16_141346_fix_draw_events_table_columns.php`

---

## 🚀 How to Fix

### Step 1: Stop Laravel Server
The database is currently locked. You need to stop any running Laravel processes:

```powershell
# If running artisan serve
# Press Ctrl+C in the terminal where it's running

# If running queue workers
php artisan queue:restart

# If using Laravel Octane/Swoole
php artisan octane:stop
```

### Step 2: Run the Migration

```powershell
cd C:\ArunApps\Chess-Web\chess-backend
php artisan migrate
```

**Expected Output:**
```
INFO  Running migrations.

2025_12_16_141346_fix_draw_events_table_columns ........ XX ms DONE
```

### Step 3: Restart Laravel Server

```powershell
php artisan serve
# Or however you normally start your server
```

### Step 4: Test Draw Offers

1. Start a multiplayer game
2. Make at least 2 moves (each player 1 move)
3. Click "Offer Draw"
4. Should work without errors ✅

---

## 📊 New Schema

```sql
CREATE TABLE draw_events (
    id INTEGER PRIMARY KEY,
    game_id INTEGER NOT NULL,
    offering_user_id INTEGER NOT NULL,        -- ✅ Correct column name
    receiving_user_id INTEGER NULL,           -- ✅ Correct column name
    position_fen TEXT NOT NULL,
    position_eval DECIMAL(8,2) NULL,
    offering_player_rating_impact INTEGER NULL,  -- ✅ New column
    receiving_player_rating_impact INTEGER NULL, -- ✅ New column
    status ENUM(...) DEFAULT 'pending',       -- ✅ Correct column name
    offered_at TIMESTAMP NULL,
    responded_at TIMESTAMP NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,

    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (offering_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiving_user_id) REFERENCES users(id) ON DELETE SET NULL
);
```

---

## 🔍 What Changed

### Files Modified

1. ✅ **2025_12_15_000004_create_draw_events_table.php**
   - Updated to use correct column names
   - Simplified schema to match service expectations

2. ✅ **2025_12_16_141346_fix_draw_events_table_columns.php** (NEW)
   - Drops and recreates draw_events table
   - Ensures correct schema is applied

---

## ⚠️ Data Loss Warning

**This migration will DROP the `draw_events` table**, which means:
- Any existing draw offers will be lost
- This is acceptable because the old table had the wrong schema
- Games themselves are not affected
- Ratings are not affected
- Only pending draw offers are lost

---

## 🧪 Testing After Migration

### Test 1: Draw Offer Creation
```
1. Start multiplayer game
2. Make 2+ moves
3. Click "Offer Draw"
✅ Expected: No errors, offer created
```

### Test 2: Check Database
```powershell
php artisan tinker
>>> DB::table('draw_events')->first();
```

Should show columns:
- `offering_user_id` ✅
- `receiving_user_id` ✅
- `status` ✅
- `offering_player_rating_impact` ✅
- `receiving_player_rating_impact` ✅

---

## 🔧 Troubleshooting

### Error: "disk I/O error"
**Cause:** Database file is locked by another process
**Fix:** Stop all Laravel processes (artisan serve, queue workers, etc.)

### Error: "Migration already ran"
**Fix:**
```powershell
php artisan migrate:rollback --step=1
php artisan migrate
```

### Error: "Table draw_events already exists"
**Fix:**
```powershell
# Manually drop the table
php artisan tinker
>>> Schema::dropIfExists('draw_events');
>>> exit
php artisan migrate
```

---

## 📝 Summary

**Problem:** Database schema didn't match code expectations
**Root Cause:** Original migration used different column names
**Solution:** New migration that recreates table with correct schema
**Action Required:** Stop server → Run migration → Restart server
**Impact:** Draw offers will now work correctly ✅

---

## ✅ Verification Checklist

After running the migration, verify:

- [ ] Migration completed successfully
- [ ] Table `draw_events` exists
- [ ] Columns match DrawHandlerService expectations
- [ ] Draw offer can be created via API
- [ ] No SQL errors in logs
- [ ] Frontend draw button works

---

**Status:** Ready to run migration ✅
