# Quick Phase 2 Testing Guide (Windows PowerShell)

## Problem Identified

The gates are returning `false` because the **role-permission relationships haven't been seeded yet**.

Your roles exist, but they don't have any permissions associated with them in the `role_permissions` table.

---

## Solution: Run the Seeder

### Step 1: Seed Role-Permission Relationships

```powershell
# From chess-backend directory
php artisan db:seed --class=RolePermissionSeeder
```

**Expected Output:**
```
Seeding: Database\Seeders\RolePermissionSeeder
Seeded:  Database\Seeders\RolePermissionSeeder (XX.XXms)
Database seeding completed successfully.
```

---

### Step 2: Test Gates Again

```powershell
php artisan tinker
```

```php
$user = App\Models\User::first();
$user->assignRole('platform_admin');

// Test gates - should all return TRUE now
Gate::forUser($user)->allows('manage-platform');        // Should be true
Gate::forUser($user)->allows('create-championship');    // Should be true
Gate::forUser($user)->allows('manage-users');           // Should be true
Gate::forUser($user)->allows('issue-refunds');          // Should be true

// Exit tinker
exit
```

**Expected Results: All should return `true`**

---

### Step 3: Test API with PowerShell

#### 3.1 Get an Auth Token

```powershell
php artisan tinker
```

```php
$user = App\Models\User::first();
$token = $user->createToken('test-token')->plainTextToken;
echo $token;
exit
```

Copy the token output (e.g., `16|abcd1234...`)

#### 3.2 Test Unauthenticated Request (Should Fail with 401)

```powershell
# Define the JSON body
$body = @{
    title = "Auth Test Championship"
    description = "Testing authorization"
    entry_fee = 100
    registration_deadline = "2025-12-01T10:00:00Z"
    start_date = "2025-12-15T10:00:00Z"
    format = "swiss_only"
    swiss_rounds = 5
    match_time_window_hours = 24
} | ConvertTo-Json

# Make request WITHOUT token (should get 401)
Invoke-WebRequest -Uri "http://localhost:8000/api/championships" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

**Expected: 401 Unauthorized**

#### 3.3 Test Authenticated Request (Should Succeed with 201)

```powershell
# Replace YOUR_TOKEN_HERE with the token from step 3.1
$token = "YOUR_TOKEN_HERE"

# Define headers
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Make authenticated request
$response = Invoke-RestMethod -Uri "http://localhost:8000/api/championships" `
    -Method POST `
    -Headers $headers `
    -Body $body

# Display response
$response | ConvertTo-Json -Depth 4
```

**Expected: 201 Created with championship data**

#### 3.4 Test Public GET (Should Work)

```powershell
# No authentication needed for public listings
$response = Invoke-RestMethod -Uri "http://localhost:8000/api/championships" `
    -Method GET

# Display response
$response | ConvertTo-Json -Depth 4
```

**Expected: 200 OK with list of public championships**

---

## Automated Testing

Run the automated test script:

```powershell
# From chess-backend directory
.\test-phase2.ps1
```

This script will:
1. ✅ Run the seeder
2. ✅ Test all gates in Tinker
3. ✅ Test unauthenticated API access (should fail)
4. ✅ Test authenticated API access (should succeed)
5. ✅ Test public API access (should work)

---

## Troubleshooting

### Issue: "The title field is required" even though you sent data

**Cause:** Windows PowerShell curl escaping issues with JSON

**Solution:** Use `Invoke-RestMethod` instead of `curl.exe` (as shown above)

### Issue: Gates still returning false after seeding

**Cause:** Cache or session issue

**Solutions:**
```powershell
# Clear Laravel cache
php artisan cache:clear
php artisan config:clear
php artisan route:clear

# Then restart tinker and test again
php artisan tinker
```

### Issue: 401 even with valid token

**Cause:** Token might be expired or invalid

**Solution:** Generate a new token:
```php
php artisan tinker
$user = App\Models\User::first();
$token = $user->createToken('test-token')->plainTextToken;
echo $token;
```

---

## Success Criteria

✅ **All these should work:**

1. RolePermissionSeeder runs without errors
2. Gates return `true` for platform_admin
3. Unauthenticated requests get 401
4. Authenticated requests with valid permissions succeed
5. Public endpoints work without authentication
6. Created championships have correct `created_by` field

---

## Next Steps After Success

Once all tests pass:

1. ✅ Phase 2 is complete
2. 🚀 Ready to proceed to Phase 3 (Organization Support)
3. 📝 Update your project status

**Phase 3 Preview:**
- Organization CRUD operations
- Protect remaining controllers (Match, Payment, Admin)
- Organization-level authorization
- Multi-tenant support

---

## Quick Command Reference

```powershell
# Seed permissions
php artisan db:seed --class=RolePermissionSeeder

# Test in Tinker
php artisan tinker

# Clear cache
php artisan cache:clear

# Run automated tests
.\test-phase2.ps1
```

---

**Status: Ready to test! Start with Step 1 above.**
