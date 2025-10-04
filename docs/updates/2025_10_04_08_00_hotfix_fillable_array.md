# Hotfix: Added Virtual Attributes to Fillable Array

**Date:** 2025-10-04 08:00
**Issue:** `NOT NULL constraint failed: games.status_id` when accepting invitations
**Severity:** Critical (blocks game creation)
**Status:** ✅ Fixed

---

## Problem

After Phase 4 cleanup, the `$fillable` array in the Game model was updated to remove `'status'` and `'end_reason'` columns (which no longer exist). However, this broke mass assignment in code that still uses these attribute names:

```php
// InvitationController.php:196
$game = Game::create([
    'white_player_id' => $whiteId,
    'black_player_id' => $blackId,
    'status' => 'waiting',  // ❌ NOT in fillable array
    'result' => 'ongoing',
]);
```

**Error:**
```
SQLSTATE[23000]: Integrity constraint violation: 19 NOT NULL constraint failed: games.status_id
```

**Root Cause:**
- `'status'` removed from `$fillable` array in Phase 4
- Mass assignment ignores non-fillable attributes
- Mutator `setStatusAttribute()` never called
- `status_id` remains NULL
- Database constraint violation

---

## Solution

**Add virtual attributes back to fillable array:**

```php
protected $fillable = [
    'white_player_id',
    'black_player_id',
    'status',        // ✅ Virtual attribute (mutator converts to status_id)
    'status_id',     // FK to game_statuses table
    'result',
    'winner_player',
    'winner_user_id',
    'end_reason',    // ✅ Virtual attribute (mutator converts to end_reason_id)
    'end_reason_id', // FK to game_end_reasons table
    // ...
];
```

**How It Works:**
1. `'status'` is fillable (allows mass assignment)
2. `setStatusAttribute()` mutator intercepts the value
3. Mutator converts to `status_id` FK: `'waiting'` → `1`
4. Database stores only `status_id` (column `status` doesn't exist)
5. `getStatusAttribute()` accessor reads it back transparently

---

## Why This Works

**Virtual Attributes Pattern:**
- `'status'` and `'end_reason'` are "virtual" - they don't correspond to database columns
- Mutators intercept write operations and convert to FK columns
- Accessors intercept read operations and load from relationships
- Existing code continues to work unchanged

**Example:**
```php
// Write
$game = Game::create(['status' => 'waiting']);
// Mutator converts: 'waiting' → status_id = 1

// Read
echo $game->status;
// Accessor converts: status_id = 1 → 'waiting' (via relationship)

// Database
SELECT * FROM games WHERE id = 1;
-- Only status_id column exists (value = 1)
```

---

## Code Locations Affected

### ✅ Fixed in InvitationController

**File:** `app/Http/Controllers/InvitationController.php`
**Line:** 196-201

```php
$game = Game::create([
    'white_player_id' => $whiteId,
    'black_player_id' => $blackId,
    'status' => 'waiting',  // ✅ Now works (virtual attribute)
    'result' => 'ongoing',
]);
```

**Status:** ✅ Working after fillable update

---

### ✅ Other Game Creation Locations (Verified)

**1. GameRoomService.php**
- Uses direct attribute assignment (`$game->status = 'active'`)
- Not affected (mutator works regardless of fillable)

**2. GameController.php**
- No mass assignment game creation found
- Not affected

---

## Testing

**Test Case:** Accept invitation and create game

**Steps:**
1. User A sends invitation to User B
2. User B accepts invitation
3. Game should be created successfully

**Before Fix:**
```
❌ SQLSTATE[23000]: NOT NULL constraint failed: games.status_id
```

**After Fix:**
```
✅ Game created successfully with status_id = 1 ('waiting')
```

---

## Lessons Learned

### Best Practice for Virtual Attributes

**When using mutators/accessors for non-existent columns:**

1. ✅ **DO** keep virtual attributes in `$fillable` array
2. ✅ **DO** document them as "virtual" with comments
3. ✅ **DO** test mass assignment after schema changes
4. ❌ **DON'T** remove from fillable just because column doesn't exist

**Example:**
```php
protected $fillable = [
    // Real columns
    'status_id',     // FK to lookup table

    // Virtual attributes (handled by mutators)
    'status',        // Converts to status_id via setStatusAttribute()

    // Comment clearly documents the distinction
];
```

---

### Mass Assignment vs Direct Assignment

**Mass Assignment (needs fillable):**
```php
Game::create(['status' => 'waiting']);  // Requires 'status' in fillable
$game->fill(['status' => 'waiting']);   // Requires 'status' in fillable
```

**Direct Assignment (doesn't need fillable):**
```php
$game->status = 'waiting';  // Works even if not fillable
```

**Why the difference:**
- Mass assignment respects `$fillable` to prevent mass-assignment vulnerabilities
- Direct assignment bypasses fillable check and always calls mutator

---

## Impact Assessment

### Code Changed
- ✅ `app/Models/Game.php` - Added virtual attributes to fillable

### Code Unaffected
- ✅ All mutators/accessors unchanged
- ✅ All controllers unchanged (InvitationController works now)
- ✅ All services unchanged
- ✅ All frontend code unchanged

### Database Schema
- ✅ No changes required
- ✅ Migration unchanged

### Breaking Changes
- ❌ None

---

## Verification Checklist

- [x] Virtual attributes added to fillable
- [x] Mass assignment game creation works
- [x] Direct assignment still works
- [x] Accessors return correct values
- [x] No other game creation code broken
- [x] Documentation updated

---

## Related Issues

**Phase 4 Documentation Update Needed:**
- `docs/updates/2025_10_04_07_15_phase4_cleanup_complete.md`
- Should mention keeping virtual attributes in fillable

**Recommendation:**
- Add note about virtual attributes in Phase 4 docs
- Update test script to test mass assignment
- Consider adding automated test for this scenario

---

## Files Modified

1. **app/Models/Game.php**
   - Added `'status'` back to fillable (virtual attribute)
   - Added `'end_reason'` back to fillable (virtual attribute)
   - Added comments explaining virtual attributes

2. **docs/updates/2025_10_04_08_00_hotfix_fillable_array.md** (this file)

---

**Status:** ✅ **RESOLVED**

**Tested:** Invitation acceptance now creates games successfully

**Impact:** Zero - Only affects mass assignment, all other code paths unaffected
