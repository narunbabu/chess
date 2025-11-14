# Championship Status Schema Mismatch Fix - 2025-11-14

## Problem Summary

### Root Cause
The `championship_matches` table uses `status_id` (integer FK to `championship_match_statuses` lookup table), but code was querying `status` column directly, which doesn't exist in the database.

### Error Manifestation
```sql
SQLSTATE[42S22]: Column not found: 1054 Unknown column 'status' in 'where clause'
(Connection: mysql, SQL: select exists(select * from `championship_matches`
where `championship_matches`.`championship_id` = 2
and `championship_matches`.`championship_id` is not null
and `status` != completed) as `exists`)
```

### Design Pattern
- **Database**: `status_id` (integer, 1-4) → FK to `championship_match_statuses` table
- **Model**: `status` accessor/mutator converts between `status_id` and readable strings ('pending', 'in_progress', 'completed', 'cancelled')
- **Query Layer**: Must use scopes or `status_id` directly, cannot query `status` column

## Changes Made

### 1. Added Missing Scope to ChampionshipMatch Model
**File**: `app/Models/ChampionshipMatch.php`

Added `whereNotCompleted()` scope:
```php
/**
 * Scope: Not completed matches (pending, in_progress, scheduled, etc.)
 */
public function scopeWhereNotCompleted($query)
{
    return $query->where('status_id', '!=', ChampionshipMatchStatusEnum::COMPLETED->getId());
}
```

**Existing Scopes**:
- `pending()` - Get pending matches
- `inProgress()` - Get in-progress matches
- `completed()` - Get completed matches
- `whereNotCompleted()` - NEW: Get non-completed matches
- `forRound($roundNumber)` - Get matches for specific round
- `expired()` - Get expired matches

### 2. Fixed Services (7 files)

#### StandingsCalculatorService.php
- Line 112: `->where('status', ...)` → `->completed()`
- Line 374: `->where('status', ...)` → `->completed()`

#### MatchSchedulerService.php
- Line 161: `->where('status', ...)` → `->completed()`
- Line 173: `->where('status', '!=', ...)` → `->whereNotCompleted()`
- Line 181: `->where('status', '!=', ...)` → `->whereNotCompleted()`
- Line 270: `->where('status', ...)` → `->pending()`

#### EliminationBracketService.php
- Line 292: `->where('status', ...)` → `->completed()`
- Line 455: `->where('status', ...)` → `->completed()`
- Line 549: `->where('status', ...)` → `->completed()`

### 3. Fixed Jobs & Commands (3 files)

#### GenerateNextRoundJob.php
- Line 178: `->where('status', ...)` → `->completed()`

#### CheckExpiredMatchesJob.php
- Line 93: `->where('status', '!=', ...)` → `->whereNotCompleted()`
- Line 342: `->where('status', ...)` → `->completed()`
- Line 378: `->where('status', '!=', ...)` → `->whereNotCompleted()`

#### AutoGenerateRoundsCommand.php
- Line 37: `->where('status', ...)` → `->completed()`
- Line 136: `->where('status', ...)` → `->completed()`

### 4. Fixed Controllers (2 files)

#### ChampionshipMatchController.php
- Line 44: `->where('status', $status)` → Convert to `status_id` lookup:
  ```php
  ->when($request->status, function ($query, $status) {
      $statusId = \App\Models\ChampionshipMatchStatus::getIdByCode($status);
      $query->where('status_id', $statusId);
  })
  ```
- Line 91: Same fix for myMatches endpoint
- Lines 437-453: Changed to use scopes:
  - `->completed()` for completed matches
  - `->pending()` for pending matches
  - `->inProgress()` for active matches

#### TournamentAdminController.php
- Line 226: `->where('status', 'pending')` → `->pending()`
- Line 363: `->where('status', 'completed')` → `->completed()`

### 5. Documentation Created

#### `/docs/championship_match_generation.md`
Comprehensive guide explaining:
- Where matches can be generated (Admin Dashboard, API endpoints)
- How match generation works (Swiss, Elimination, Hybrid formats)
- Graceful handling when no matches exist
- Workflow examples
- Error messages and solutions
- Technical details about database schema

## Pattern to Follow

### ✅ Correct Usage

**Using Scopes** (Recommended):
```php
// Query for completed matches
$matches = $championship->matches()->completed()->get();

// Query for pending matches
$matches = $championship->matches()->pending()->get();

// Query for non-completed matches
$matches = $championship->matches()->whereNotCompleted()->get();
```

**Using status_id Directly**:
```php
// When scopes don't fit
$matches = $championship->matches()
    ->where('status_id', ChampionshipMatchStatus::COMPLETED->getId())
    ->get();
```

**Converting Request Parameters**:
```php
// When filtering by status from API request
->when($request->status, function ($query, $status) {
    $statusId = \App\Models\ChampionshipMatchStatus::getIdByCode($status);
    $query->where('status_id', $statusId);
})
```

**Reading Status from Models** (Accessor):
```php
// This works because the model has a status accessor
$match = ChampionshipMatch::find($id);
echo $match->status; // Returns 'pending', 'completed', etc.
```

**Setting Status on Models** (Mutator):
```php
// This works because the model has a status mutator
$match->update(['status' => 'completed']); // Automatically converts to status_id
```

### ❌ Incorrect Usage

**Direct Column Query**:
```php
// WRONG: 'status' column doesn't exist in database
$matches = $championship->matches()
    ->where('status', 'completed')
    ->get();
```

**Using Enum Value Directly**:
```php
// WRONG: Using string value instead of ID
$matches = $championship->matches()
    ->where('status_id', ChampionshipMatchStatus::COMPLETED->value)
    ->get();
```

## Files Changed

**Models**:
- ✅ `app/Models/ChampionshipMatch.php` - Added whereNotCompleted() scope

**Services**:
- ✅ `app/Services/StandingsCalculatorService.php`
- ✅ `app/Services/MatchSchedulerService.php`
- ✅ `app/Services/EliminationBracketService.php`

**Jobs**:
- ✅ `app/Jobs/GenerateNextRoundJob.php`
- ✅ `app/Jobs/CheckExpiredMatchesJob.php`

**Commands**:
- ✅ `app/Console/Commands/AutoGenerateRoundsCommand.php`

**Controllers**:
- ✅ `app/Http/Controllers/ChampionshipMatchController.php`
- ✅ `app/Http/Controllers/TournamentAdminController.php`

**Documentation**:
- ✅ `docs/championship_match_generation.md` - NEW
- ✅ `docs/updates/2025_11_14_fix_championship_status_schema_mismatch.md` - NEW

## Testing

### Endpoints to Test
1. `GET /api/championships/2` - Should now return successfully
2. `GET /api/championships/{id}/matches` - Should filter by status correctly
3. `POST /api/championships/{id}/generate-next-round` - Should validate correctly

### Expected Behavior
- Championships without matches return gracefully with zero counts
- Status filtering in API endpoints works correctly
- All database queries use `status_id` instead of non-existent `status` column
- Admin dashboard shows "Generate First Round" for championships without matches

## Cache Cleared
- ✅ Configuration cache cleared
- ✅ Application cache cleared

## Related Issues
- Fixes error when accessing `/api/championships/2`
- Fixes all instances of "Column not found: 'status'" errors
- Ensures consistent use of status scopes across entire codebase

## Notes for Future Development
1. **Always use scopes** for status queries instead of direct column access
2. **Remember the pattern**: Database uses `status_id` (integer), model provides `status` accessor (string)
3. **Use ChampionshipMatchStatus::getIdByCode()** to convert status strings to IDs when needed
4. **Refer to ChampionshipMatch model** for available scopes before writing queries
5. **Championships without matches** are valid and should be handled gracefully

## Impact
- **Risk Level**: Low - Changes follow existing model patterns
- **Breaking Changes**: None - External API contracts unchanged
- **Performance**: Neutral - Scopes are equivalent to raw queries
- **Security**: No impact - Authorization checks unchanged
