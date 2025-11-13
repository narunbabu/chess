# Phase 3 Testing Guide - Organization Support

**Purpose:** Verify Phase 3 organization support and complete authorization coverage
**Time Required:** 25-30 minutes

---

## Prerequisites

- ✅ Phase 2 complete and tested
- ✅ Database seeded with roles and permissions
- ✅ Laravel server running (`php artisan serve`)
- ✅ Authentication token available

---

## Quick Start

### 1. Get Authentication Token

```powershell
php artisan tinker
```

```php
$user = App\Models\User::first();
$user->assignRole('platform_admin');
$token = $user->createToken('phase3-test')->plainTextToken;
echo $token;
exit
```

**Copy the token** for use in API tests below.

---

## Test 1: Organization CRUD Operations (10 minutes)

### A. Create Organization

```powershell
$token = "YOUR_TOKEN_HERE"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$body = @{
    name = "Chess Academy of Excellence"
    description = "Premier chess training organization"
    type = "club"
    contact_email = "admin@chessacademy.com"
    contact_phone = "+1-555-0100"
    website = "https://chessacademy.com"
    is_active = $true
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8000/api/organizations" `
    -Method POST `
    -Headers $headers `
    -Body $body

$response | ConvertTo-Json -Depth 4
```

**Expected Result:**
```json
{
  "message": "Organization created successfully",
  "organization": {
    "id": 1,
    "name": "Chess Academy of Excellence",
    "slug": "chess-academy-of-excellence",
    "description": "Premier chess training organization",
    "type": "club",
    "website": "https://chessacademy.com",
    "contact_email": "admin@chessacademy.com",
    "contact_phone": "+1-555-0100",
    "is_active": true,
    "created_by": 1,
    "created_at": "2025-11-12T...",
    "updated_at": "2025-11-12T..."
  }
}
```

**Save organization ID** for next tests: `$orgId = $response.organization.id`

### B. List Organizations

```powershell
$response = Invoke-RestMethod -Uri "http://localhost:8000/api/organizations" `
    -Method GET `
    -Headers $headers

$response | ConvertTo-Json -Depth 3
```

**Expected:** List of all organizations with member counts and championship counts

### C. Get Single Organization

```powershell
$orgId = 1  # Use the ID from creation
$response = Invoke-RestMethod -Uri "http://localhost:8000/api/organizations/$orgId" `
    -Method GET `
    -Headers $headers

$response | ConvertTo-Json -Depth 4
```

**Expected:** Full organization details with creator, users, and championships

### D. Update Organization

```powershell
$updateBody = @{
    description = "Updated: Premier chess training and tournament organization"
    website = "https://newchessacademy.com"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8000/api/organizations/$orgId" `
    -Method PUT `
    -Headers $headers `
    -Body $updateBody

$response | ConvertTo-Json -Depth 3
```

**Expected:** Organization updated successfully with new values

### E. Test Authorization Failure

```powershell
# Test without authentication (should get 401)
try {
    Invoke-WebRequest -Uri "http://localhost:8000/api/organizations" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body
} catch {
    Write-Host "Expected 401: $($_.Exception.Response.StatusCode.value__)"
}
```

**Expected:** 401 Unauthorized

---

## Test 2: Organization Member Management (8 minutes)

### A. Get Organization Members

```powershell
$response = Invoke-RestMethod -Uri "http://localhost:8000/api/organizations/$orgId/members" `
    -Method GET `
    -Headers $headers

$response | ConvertTo-Json -Depth 3
```

**Expected:** List of organization members (should include creator)

### B. Add Member to Organization

```powershell
# First create a test user in tinker
php artisan tinker
```

```php
$newUser = App\Models\User::create([
    'name' => 'Test Player',
    'email' => 'player@test.com',
    'password' => bcrypt('password123'),
]);
echo $newUser->id;
exit
```

```powershell
# Add the user to organization
$addMemberBody = @{
    user_id = 2  # Use the new user ID
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8000/api/organizations/$orgId/members" `
    -Method POST `
    -Headers $headers `
    -Body $addMemberBody

$response | ConvertTo-Json -Depth 3
```

**Expected:** User added to organization successfully

### C. Remove Member from Organization

```powershell
$userId = 2  # The user we just added
$response = Invoke-RestMethod -Uri "http://localhost:8000/api/organizations/$orgId/members/$userId" `
    -Method DELETE `
    -Headers $headers

$response | ConvertTo-Json
```

**Expected:** User removed from organization successfully

---

## Test 3: Championship Payment Authorization (5 minutes)

### A. Test Refund Authorization (Admin Only)

```powershell
# This should work (platform_admin has permission)
$refundBody = @{
    reason = "Tournament cancelled due to technical issues"
} | ConvertTo-Json

# You'll need a participant ID from your database
# For testing, let's assume participant ID 1 exists
try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/championships/payment/refund/1" `
        -Method POST `
        -Headers $headers `
        -Body $refundBody

    $response | ConvertTo-Json
} catch {
    Write-Host "Response: $($_.Exception.Message)"
}
```

**Expected:** Either successful refund OR appropriate error if participant doesn't exist

### B. Test Refund Without Permission

```powershell
# Create a token for a regular player
php artisan tinker
```

```php
$player = App\Models\User::where('email', 'player@test.com')->first();
$player->assignRole('player');
$playerToken = $player->createToken('test')->plainTextToken;
echo $playerToken;
exit
```

```powershell
# Try to issue refund as player (should fail)
$playerHeaders = @{
    "Authorization" = "Bearer PLAYER_TOKEN_HERE"
    "Content-Type" = "application/json"
}

try {
    Invoke-WebRequest -Uri "http://localhost:8000/api/championships/payment/refund/1" `
        -Method POST `
        -Headers $playerHeaders `
        -Body $refundBody
} catch {
    Write-Host "Expected 403: $($_.Exception.Response.StatusCode.value__)"
}
```

**Expected:** 403 Forbidden (player doesn't have issue-refunds permission)

---

## Test 4: Tournament Administration (7 minutes)

### A. Get Tournament Overview

```powershell
$response = Invoke-RestMethod -Uri "http://localhost:8000/api/admin/tournaments/overview" `
    -Method GET `
    -Headers $headers

$response | ConvertTo-Json -Depth 3
```

**Expected:** Tournament overview with active, upcoming, and completed championships

### B. Get System Health

```powershell
$response = Invoke-RestMethod -Uri "http://localhost:8000/api/admin/tournaments/health" `
    -Method GET `
    -Headers $headers

$response | ConvertTo-Json -Depth 3
```

**Expected:** System health metrics (queue, database, tournaments)

### C. Get Analytics

```powershell
$response = Invoke-RestMethod -Uri "http://localhost:8000/api/admin/tournaments/analytics" `
    -Method GET `
    -Headers $headers

$response | ConvertTo-Json -Depth 3
```

**Expected:** Analytics data for championships, participants, revenue, matches

### D. Run Maintenance Tasks

```powershell
$maintenanceBody = @{
    tasks = @("check_expired", "update_standings")
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8000/api/admin/tournaments/maintenance" `
    -Method POST `
    -Headers $headers `
    -Body $maintenanceBody

$response | ConvertTo-Json
```

**Expected:** Maintenance tasks completed with results for each task

---

## Test 5: Multi-Tenant Authorization (5 minutes)

### A. Create Organization-Owned Championship

```powershell
# Create championship belonging to organization
$champBody = @{
    title = "Organization Internal Tournament"
    description = "Private tournament for organization members"
    entry_fee = 0
    registration_deadline = "2025-12-01T10:00:00Z"
    start_date = "2025-12-15T10:00:00Z"
    format = "swiss_only"
    swiss_rounds = 5
    match_time_window_hours = 24
    visibility = "organization_only"
    organization_id = $orgId
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8000/api/championships" `
    -Method POST `
    -Headers $headers `
    -Body $champBody

$response | ConvertTo-Json -Depth 3
```

**Expected:** Organization-only championship created successfully

### B. Verify Visibility Filtering

```powershell
# Get all championships (should include public + org championships for members)
$response = Invoke-RestMethod -Uri "http://localhost:8000/api/championships" `
    -Method GET `
    -Headers $headers

# Check that organization championship is visible to org admin
$orgChampionships = $response.data | Where-Object { $_.organization_id -eq $orgId }
Write-Host "Organization championships visible: $($orgChampionships.Count)"
```

**Expected:** Organization championships visible to organization members

---

## Test 6: Delete Organization (3 minutes)

### A. Try to Delete Organization with Active Championships

```powershell
# Should fail if organization has active championships
try {
    Invoke-WebRequest -Uri "http://localhost:8000/api/organizations/$orgId" `
        -Method DELETE `
        -Headers $headers
} catch {
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "Expected error: $($errorResponse.message)"
}
```

**Expected:** Error message about active championships preventing deletion

### B. Delete Organization (After Completing Championships)

```powershell
# Complete or cancel all championships first, then:
$response = Invoke-RestMethod -Uri "http://localhost:8000/api/organizations/$orgId" `
    -Method DELETE `
    -Headers $headers

$response | ConvertTo-Json
```

**Expected:** Organization deleted successfully (soft delete)

---

## Verification Checklist

### Organization CRUD
- ✅ Create organization (201)
- ✅ List organizations (200)
- ✅ Get single organization (200)
- ✅ Update organization (200)
- ✅ Delete organization (200 or 422 if has active championships)
- ✅ Unauthenticated requests return 401
- ✅ Unauthorized requests return 403

### Member Management
- ✅ Get organization members (200)
- ✅ Add member to organization (200)
- ✅ Remove member from organization (200)
- ✅ Cannot remove organization creator
- ✅ User auto-assigned organization_admin role on organization creation

### Payment Authorization
- ✅ Admin can issue refunds (with issue-refunds permission)
- ✅ Regular users cannot issue refunds (403)
- ✅ Payment initiation works for authenticated users
- ✅ Webhook handling works (public endpoint)

### Tournament Administration
- ✅ Overview requires manageTournaments permission
- ✅ System health accessible to admins
- ✅ Analytics accessible to admins
- ✅ Maintenance tasks executable by admins
- ✅ Route middleware blocks non-admin access

### Multi-Tenant Features
- ✅ Organization-owned championships created correctly
- ✅ Visibility filtering works (organization_only, private, public)
- ✅ Organization members can view org championships
- ✅ Non-members cannot view organization_only championships

---

## Troubleshooting

### Issue: "Unauthenticated" errors

**Solution:**
```powershell
# Regenerate token
php artisan tinker
$user = App\Models\User::first();
$token = $user->createToken('test')->plainTextToken;
echo $token;
```

### Issue: "Forbidden" errors

**Solution:**
```powershell
# Check user roles and permissions
php artisan tinker
$user = App\Models\User::first();
echo "Roles: " . $user->roles->pluck('name')->implode(', ');
echo "Has create_organization: " . ($user->hasPermission('create_organization') ? 'YES' : 'NO');

# Assign required role
$user->assignRole('platform_admin');  # Or appropriate role
```

### Issue: Organization routes not found (404)

**Solution:**
```powershell
# Clear route cache
php artisan route:clear
php artisan route:cache

# Verify routes exist
php artisan route:list | Select-String "organizations"
```

### Issue: "manageTournaments" gate not defined

**Solution:**
```powershell
# Clear config cache
php artisan config:clear
php artisan cache:clear

# Restart server
# Press Ctrl+C and run: php artisan serve
```

---

## Success Criteria

✅ **All 6 test sections pass**
✅ **No 500 errors**
✅ **Proper 401/403 responses for unauthorized access**
✅ **Organization CRUD working correctly**
✅ **Member management functional**
✅ **Payment authorization protecting refund endpoint**
✅ **Tournament admin routes accessible to authorized users**
✅ **Multi-tenant visibility filtering working**

---

## Next Steps

Once all Phase 3 tests pass:

1. ✅ Proceed to Phase 4 (Polish & UI)
2. 📝 Review implementation documentation
3. 🚀 Prepare for production deployment
4. 🎨 Implement frontend authorization UI

---

**Phase 3 Status:** Ready for Testing

**Estimated Completion:** 25-30 minutes

**Questions?** Review `docs/updates/2025_11_12_phase3_organization_support.md` for implementation details
