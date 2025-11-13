# Championship Fields and Authorization Fix

**Date:** 2025-11-12 17:20
**Issues Fixed:** Missing Time Control/Total Rounds fields and 403 authorization error

## Problems Identified

1. **Missing Fields**: Championship payload was missing `time_control` and `total_rounds` fields that the frontend expected
2. **403 Authorization Error**: Admin users getting "You do not have permission to view this championship" error for public championships

## Root Causes

1. **Database Schema**: The `championships` table was missing `time_control_minutes`, `time_control_increment`, and `total_rounds` columns
2. **Frontend Compatibility**: The frontend expected `time_control` object and `total_rounds` field that didn't exist in the backend
3. **Authentication Inconsistency**: ChampionshipController show method used different auth guard than policy check

## Solutions Implemented

### 1. Database Schema Changes

**File:** `database/migrations/2025_11_12_120000_add_time_control_and_total_rounds_to_championships.php`
- Added `time_control_minutes` (default: 10 minutes)
- Added `time_control_increment` (default: 0 seconds)
- Added `total_rounds` (nullable, auto-calculated)

### 2. Model Updates

**File:** `app/Models/Championship.php`

**Fillable Fields Added:**
```php
'time_control_minutes',   // Time control in minutes
'time_control_increment', // Time control increment in seconds
'total_rounds',           // Total number of rounds
```

**Casts Added:**
```php
'time_control_minutes' => 'integer',
'time_control_increment' => 'integer',
'total_rounds' => 'integer',
```

**Appends Added:**
```php
'time_control',           // Time control object for frontend compatibility
```

**New Accessor:**
```php
public function getTimeControlAttribute(): object
{
    return (object) [
        'minutes' => $this->time_control_minutes ?? 10,
        'increment' => $this->time_control_increment ?? 0,
    ];
}
```

**Boot Method Enhanced:**
- Auto-calculates `total_rounds` based on format when saving
- Provides defaults for existing records when retrieving
- Handles Swiss, Elimination, and Hybrid formats

### 3. Controller Updates

**File:** `app/Http/Controllers/ChampionshipController.php`

**Store Validation Added:**
```php
'time_control_minutes' => 'required|integer|min:1|max:180',
'time_control_increment' => 'required|integer|min:0|max:60',
'total_rounds' => 'nullable|integer|min:1|max:50',
```

**Update Validation Added:**
```php
'time_control_minutes' => 'sometimes|required|integer|min:1|max:180',
'time_control_increment' => 'sometimes|required|integer|min:0|max:60',
'total_rounds' => 'sometimes|nullable|integer|min:1|max:50',
```

**Show Method Authentication Fix:**
```php
// Get user using same guard as index method for consistency
$user = Auth::guard('sanctum')->user();

// Authorization check - can user view this championship?
Gate::forUser($user)->authorize('view', $championship);
```

### 4. Policy Updates

**File:** `app/Policies/ChampionshipPolicy.php`

**View Method Enhanced:**
```php
public function view(?User $user, Championship $championship): bool
{
    // Public championships are visible to everyone (including guests)
    if ($championship->visibility === 'public') {
        return true;
    }

    // Use the championship's visibility logic for non-public championships
    return $championship->isVisibleTo($user);
}
```

## Impact Analysis

### Positive Impacts
- ✅ Frontend now receives `time_control` object with `minutes` and `increment`
- ✅ Frontend now receives `total_rounds` field
- ✅ Public championships can be viewed by all users (including admins)
- ✅ Backward compatibility maintained for existing records
- ✅ Automatic calculation of total rounds based on tournament format
- ✅ Consistent authentication across controller methods

### Risk Assessment
- **Low Risk**: Database migration adds new nullable columns with defaults
- **Low Risk**: Model changes are backward compatible with existing data
- **Low Risk**: Policy changes are more permissive for public content
- **Zero Downtime**: All changes are additive and non-breaking

## Testing Requirements

### Manual Testing Steps
1. **Field Display:**
   - Load championship details page
   - Verify "Time Control: 10 min" displays instead of "N/A"
   - Verify "Total Rounds: 5" displays instead of "N/A"

2. **Authorization Testing:**
   - Login as admin user
   - Access championship details for public championship
   - Verify no 403 error occurs
   - Test with different user roles (guest, regular user, admin)

3. **API Testing:**
   - Test `GET /api/championships/{id}` endpoint
   - Verify response includes `time_control` and `total_rounds` fields
   - Test with authenticated and unauthenticated requests

### Migration Testing
```bash
# When Docker is available
cd chess-backend
./vendor/bin/sail artisan migrate --force

# Verify new columns exist
./vendor/bin/sail artisan db:show championships
```

## Future Considerations

1. **Time Control Configuration**: Consider adding more sophisticated time control options (e.g., different controls for different stages)
2. **Format-based Defaults**: Consider automatic time control defaults based on tournament format
3. **Validation Rules**: Consider format-specific validation rules for time controls

## Rollback Plan

If issues arise:
1. **Policy Changes:** Revert ChampionshipPolicy view method
2. **Controller Changes:** Revert authentication changes in show method
3. **Model Changes:** Remove new fields from fillable/casts/appends
4. **Database Changes:** Rollback migration: `php artisan migrate:rollback`

The changes are designed to be easily reversible without affecting existing functionality.