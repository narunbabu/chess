# Organization Championship Visibility Fix

**Date**: 2025-11-12
**Issue**: Organization-only championships not visible to authenticated organization members
**Impact**: Critical - Multi-tenant authorization system non-functional
**Status**: ✅ **RESOLVED**

---

## Problem Summary

When users created organization-only championships (visibility = "organization_only"), these championships were not visible in the championship listing endpoint, even to authenticated members of the organization.

### Symptoms

```powershell
# Test Results Before Fix
[INFO] User 1 is a member of organization 4
[PASS] Organization-only championship created (ID: 8, OrgID: 4)
[INFO] Total championships found: 2
[INFO] Championship details:
  ID: 3, OrgID: , Visibility: public
  ID: 4, OrgID: , Visibility: public
[FAIL] Organization championship not visible to org member
```

Championship 8 with `visibility="organization_only"` and `organization_id=4` was successfully created but did not appear in the listing for User 1, who was confirmed to be a member of organization 4.

---

## Root Cause Analysis

### Architecture Context

The application uses **multi-tenant authorization** with three visibility levels:
- **public**: Visible to everyone
- **organization_only**: Visible only to members of the associated organization
- **private**: Visible only to creator and organization admins

### Route Configuration Issue

The championship listing endpoint was configured as a **public route** (no authentication middleware):

```php
// routes/api.php (BEFORE FIX)

// Inside auth:sanctum middleware group
Route::middleware('auth:sanctum')->group(function () {
    // Write operations (POST, PUT, DELETE)
    Route::prefix('championships')->group(function () {
        Route::post('/', [ChampionshipController::class, 'store']);
        Route::put('/{id}', [ChampionshipController::class, 'update']);
        ...
    });
});

// OUTSIDE auth middleware - Public routes
Route::prefix('championships')->group(function () {
    Route::get('/', [ChampionshipController::class, 'index']); // ⚠️ NO AUTH
    Route::get('/{id}', [ChampionshipController::class, 'show']); // ⚠️ NO AUTH
});
```

### The Problem Chain

1. **Request with valid token**: Client sends `Authorization: Bearer <valid-token>`
2. **No middleware applied**: Route has no `auth:sanctum` middleware
3. **Auth::user() returns null**: Standard `Auth::user()` only works with applied middleware
4. **Fallback to public-only**: Controller treats request as unauthenticated
5. **Organization championships hidden**: Visibility scope filters out non-public championships

### Controller Code (Before Fix)

```php
// ChampionshipController.php (BEFORE)
public function index(Request $request): JsonResponse
{
    $user = Auth::user(); // ❌ Returns null on public routes!
    $query = Championship::visibleTo($user);
    // With $user = null, only returns public championships
}
```

### Visibility Scope Logic

```php
// Championship.php - scopeVisibleTo()
public function scopeVisibleTo($query, ?User $user = null)
{
    if (!$user) {
        return $query->where('visibility', 'public'); // ❌ Only public!
    }

    // With authenticated user:
    return $query->where(function ($q) use ($user) {
        $q->where('visibility', 'public')
          ->orWhere(function ($q2) use ($user) {
              $q2->where('visibility', 'organization_only')
                 ->where('organization_id', $user->organization_id); // ✅ Includes org championships
          })
          ->orWhere('created_by', $user->id); // ✅ Includes own private championships
    });
}
```

### Debug Evidence

Laravel log showed the authentication failure:

```
[2025-11-12 12:17:25] local.INFO: Championship index - User org_id
  {"user_id":null,"organization_id":null}

[2025-11-12 12:17:25] local.INFO: Championship index - Query SQL
  {"sql":"select * from \"championships\" where \"visibility\" = ?","bindings":["public"]}
```

---

## Solution

### The Fix: Optional Authentication

Changed from standard `Auth::user()` to **`Auth::guard('sanctum')->user()`** which checks for Sanctum tokens even on public routes:

```php
// ChampionshipController.php (AFTER FIX)
public function index(Request $request): JsonResponse
{
    // ✅ Use Sanctum guard directly for optional authentication
    $user = Auth::guard('sanctum')->user();

    // ✅ Refresh user data to get latest organization_id
    // (Sanctum tokens cache user data at login time)
    if ($user) {
        $user->refresh();
    }

    $query = Championship::visibleTo($user);
    // Now correctly handles both authenticated and guest users
}
```

### Why This Works

| Method | Public Route Behavior | Auth Route Behavior |
|--------|----------------------|---------------------|
| `Auth::user()` | ❌ Always returns `null` | ✅ Returns authenticated user |
| `Auth::guard('sanctum')->user()` | ✅ Checks token, returns user if valid | ✅ Returns authenticated user |

**Key Insight**: `Auth::guard('sanctum')->user()` performs **optional authentication** - it checks for a valid token but doesn't fail if missing, making it perfect for public routes that should adapt to authenticated users.

### Additional Fix: User Data Refresh

Added `$user->refresh()` to reload user data from the database:

```php
if ($user) {
    $user->refresh(); // ✅ Reload organization_id from database
}
```

**Why needed**: Laravel Sanctum caches user attributes in the token at login time. When a user creates an organization and their `organization_id` is updated, the token still has the old value. Calling `refresh()` reloads the latest data.

---

## Verification

### Test Results

```powershell
# After Fix
[INFO] User 1 is a member of organization 7
[PASS] Organization-only championship created (ID: 11, OrgID: 7)
[INFO] Total championships found: 10
[PASS] Organization-only championship visible to org member ✅
[INFO] Found org championship: ID=11, OrgID=7, Visibility=organization_only
```

### Laravel Log (After Fix)

```
[2025-11-12 12:18:49] local.INFO: Championship index - User org_id
  {"user_id":1,"organization_id":7} ✅

[2025-11-12 12:18:49] local.INFO: Championship index - Query SQL
  {"sql":"select * from \"championships\" where ... ✅ Complex query with org filtering
```

### Test Suite Results

| Metric | Before Fix | After Fix | Change |
|--------|-----------|-----------|--------|
| Tests Passing | 24/28 (85.71%) | 25/28 (89.29%) | +1 test ✅ |
| Organization Visibility | ❌ Failed | ✅ Passed | **FIXED** |

---

## Impact & Lessons Learned

### Impact

✅ **Multi-tenant authorization now functional**
✅ **Organization-only championships correctly filtered by membership**
✅ **Public listing works for both authenticated and guest users**
✅ **No breaking changes to existing functionality**

### Architecture Lessons

1. **Public Routes with Optional Auth**: Use `Auth::guard('sanctum')->user()` for routes that should work for both guests and authenticated users

2. **Token Data Staleness**: Always refresh user data when authorization depends on recently updated attributes (like `organization_id`)

3. **Test Coverage**: End-to-end tests caught this issue that unit tests might miss (authentication context matters!)

4. **Route Design**: Consider whether routes truly need to be public or if they should use optional authentication middleware

### Similar Patterns to Check

This same pattern should be applied to **any public route that needs optional authentication**:

- ✅ `GET /championships` - Fixed
- ⚠️ `GET /championships/{id}` - May need same fix (uses `Gate::authorize` which depends on auth)
- Other public listing endpoints that should adapt to authenticated users

---

## Related Files

**Modified**:
- `chess-backend/app/Http/Controllers/ChampionshipController.php:42-48`

**Related**:
- `chess-backend/app/Models/Championship.php:395-427` (scopeVisibleTo)
- `chess-backend/routes/api.php:194-198` (public routes)
- `chess-backend/app/Policies/ChampionshipPolicy.php` (authorization logic)

**Tests**:
- `chess-backend/test-phase3-windows.ps1` (Test 5: Multi-Tenant Authorization)

---

## References

- [Laravel Sanctum Documentation - Optional Authentication](https://laravel.com/docs/10.x/sanctum#protecting-routes)
- [Phase 3 Testing Guide](/mnt/c/ArunApps/Chess-Web/chess-backend/docs/PHASE3_TESTING_GUIDE.md)
- [Organization Support Update](/mnt/c/ArunApps/Chess-Web/docs/updates/2025_11_12_phase3_organization_support.md)
