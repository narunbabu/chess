# Phase 2 Testing Guide - Quick Start

**Purpose:** Verify Phase 2 authorization layer is working correctly

**Time Required:** 20-25 minutes

---

## Prerequisites

- ✅ Phase 1 complete and tested
- ✅ Phase 2 code implemented
- ✅ Laravel environment running
- ✅ Database has roles and permissions from Phase 1

---

## Quick Test Sequence

### 1️⃣ Test Policies in Tinker (10 min)

```bash
php artisan tinker
```

```php
// Get a user
$user = App\Models\User::first();

// Assign tournament organizer role
$user->assignRole('tournament_organizer');

// Test ChampionshipPolicy
$policy = new App\Policies\ChampionshipPolicy();

// ✅ Test 1: Can user create championships?
$policy->create($user);  // Should be true (has permission)

// ✅ Test 2: Create a test championship
$champ = App\Models\Championship::create([
    'title' => 'Test Championship',
    'description' => 'Testing authorization',
    'entry_fee' => 0,
    'registration_deadline' => now()->addDays(7),
    'start_date' => now()->addDays(14),
    'match_time_window_hours' => 24,
    'format' => 'swiss_only',
    'swiss_rounds' => 5,
    'status' => 'upcoming',
    'created_by' => $user->id,
    'visibility' => 'private',
]);

// ✅ Test 3: Can user view private championship (creator)?
$policy->view($user, $champ);  // Should be true (creator)

// ✅ Test 4: Can other user view private championship?
$other = App\Models\User::where('id', '!=', $user->id)->first();
if ($other) {
    $policy->view($other, $champ);  // Should be false (not creator)
}

// ✅ Test 5: Can guest view private championship?
$policy->view(null, $champ);  // Should be false (guest)

// ✅ Test 6: Can creator update championship?
$policy->update($user, $champ);  // Should be true (creator)

// ✅ Test 7: Can other user update championship?
if ($other) {
    $policy->update($other, $champ);  // Should be false
}

// ✅ Test 8: Can creator delete championship?
$policy->delete($user, $champ);  // Should be true (creator)

// Clean up - make public so we can see it later
$champ->visibility = 'public';
$champ->save();
```

---

### 2️⃣ Test Gates (5 min)

```php
// Still in tinker...

use Illuminate\Support\Facades\Gate;

// ✅ Test 1: Regular user cannot manage platform
Gate::forUser($user)->allows('manage-platform');  // Should be false

// ✅ Test 2: Tournament organizer can create championships
Gate::forUser($user)->allows('create-championship');  // Should be true

// ✅ Test 3: Make user admin
$user->assignRole('platform_admin');

// ✅ Test 4: Admin can manage platform
Gate::forUser($user)->allows('manage-platform');  // Should be true

// ✅ Test 5: Admin bypasses all gates
Gate::forUser($user)->allows('create-championship');  // Should be true
Gate::forUser($user)->allows('manage-users');  // Should be true
Gate::forUser($user)->allows('issue-refunds');  // Should be true
```

---

### 3️⃣ Test API Endpoints (10 min)

**Note:** You'll need to get an auth token first. Use your existing login flow or create one in tinker:

```php
// In tinker - get a token for testing
$user = App\Models\User::first();
$token = $user->createToken('test-token')->plainTextToken;
echo $token;  // Copy this token
```

**Test 1: Create Championship (Unauthenticated - SHOULD FAIL)**
```bash
curl -X POST http://localhost:8000/api/championships \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Tournament",
    "description": "Should fail without auth",
    "entry_fee": 0,
    "registration_deadline": "2025-12-01T00:00:00Z",
    "start_date": "2025-12-15T00:00:00Z",
    "match_time_window_hours": 24,
    "format": "swiss_only",
    "swiss_rounds": 5
  }'
```

**Expected Result:**
```json
{
  "message": "Unauthenticated."
}
```
Status: `401 Unauthorized`

---

**Test 2: Create Championship (Authenticated but No Permission - SHOULD FAIL)**

First, in tinker, remove organizer role from user:
```php
$user->removeRole('tournament_organizer');
$user->removeRole('platform_admin');
```

Then make API call:
```bash
curl -X POST http://localhost:8000/api/championships \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Tournament",
    "description": "Should fail without permission",
    "entry_fee": 0,
    "registration_deadline": "2025-12-01T00:00:00Z",
    "start_date": "2025-12-15T00:00:00Z",
    "match_time_window_hours": 24,
    "format": "swiss_only",
    "swiss_rounds": 5
  }'
```

**Expected Result:**
```json
{
  "message": "This action is unauthorized."
}
```
Status: `403 Forbidden`

---

**Test 3: Create Championship (With Permission - SHOULD SUCCEED)**

First, in tinker, assign role:
```php
$user->assignRole('tournament_organizer');
```

Then make API call (use same curl as Test 2):
```bash
curl -X POST http://localhost:8000/api/championships \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Authorized Tournament",
    "description": "This should work!",
    "entry_fee": 0,
    "registration_deadline": "2025-12-01T00:00:00Z",
    "start_date": "2025-12-15T00:00:00Z",
    "match_time_window_hours": 24,
    "format": "swiss_only",
    "swiss_rounds": 5,
    "visibility": "public"
  }'
```

**Expected Result:**
```json
{
  "message": "Championship created successfully",
  "championship": {
    "id": 1,
    "title": "My Authorized Tournament",
    "created_by": 1,  // ← YOUR USER ID
    "visibility": "public",
    ...
  }
}
```
Status: `201 Created`

---

**Test 4: Update Championship (Non-Creator - SHOULD FAIL)**

Get a token for a different user:
```php
$other = App\Models\User::where('id', '!=', $user->id)->first();
$otherToken = $other->createToken('test-token')->plainTextToken;
echo $otherToken;
```

```bash
curl -X PUT http://localhost:8000/api/championships/1 \
  -H "Authorization: Bearer OTHER_USER_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"title": "Hacked Title"}'
```

**Expected Result:**
```json
{
  "error": "Unauthorized",
  "message": "You do not have permission to update this championship"
}
```
Status: `403 Forbidden`

---

**Test 5: Update Championship (Creator - SHOULD SUCCEED)**

```bash
curl -X PUT http://localhost:8000/api/championships/1 \
  -H "Authorization: Bearer CREATOR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated by Creator"}'
```

**Expected Result:**
```json
{
  "message": "Championship updated successfully",
  "championship": {
    "id": 1,
    "title": "Updated by Creator",
    ...
  }
}
```
Status: `200 OK`

---

**Test 6: View Private Championship (Non-Creator - SHOULD FAIL)**

First, make championship private:
```php
$champ = App\Models\Championship::find(1);
$champ->visibility = 'private';
$champ->save();
```

Then try to view as other user:
```bash
curl -X GET http://localhost:8000/api/championships/1 \
  -H "Authorization: Bearer OTHER_USER_TOKEN_HERE"
```

**Expected Result:**
```json
{
  "error": "Unauthorized",
  "message": "You do not have permission to view this championship"
}
```
Status: `403 Forbidden`

---

**Test 7: List Championships (Visibility Filtering)**

```bash
# As guest (no token)
curl -X GET http://localhost:8000/api/championships

# Should only return public championships
```

```bash
# As authenticated user
curl -X GET http://localhost:8000/api/championships \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Should return public + user's own championships
```

---

## 🎯 Success Checklist

After completing all tests, check these:

**Tinker Tests:**
- [ ] ChampionshipPolicy::create() works correctly
- [ ] ChampionshipPolicy::view() respects visibility
- [ ] ChampionshipPolicy::update() allows creator only
- [ ] ChampionshipPolicy::delete() allows creator only
- [ ] Other users blocked from private championships

**Gate Tests:**
- [ ] Regular users blocked from admin gates
- [ ] Tournament organizers can create championships
- [ ] Platform admins bypass all gates
- [ ] Permission gates check correctly

**API Tests:**
- [ ] 401 for unauthenticated requests
- [ ] 403 for requests without permission
- [ ] 403 for non-creators updating championships
- [ ] 201 success when creating with permission
- [ ] created_by automatically set on creation
- [ ] Visibility filtering works in listings
- [ ] Private championships blocked for non-creators

---

## 🐛 Troubleshooting

### Error: "Class ChampionshipPolicy does not exist"

**Fix:**
```bash
composer dump-autoload
```

### Error: "This action is unauthorized" when it should work

**Check:**
```php
// In tinker
$user = User::first();

// Verify user has role
$user->roles;  // Should show roles

// Verify role has permission
$user->hasPermission('create_championship');  // Should be true

// Check policy directly
$policy = new App\Policies\ChampionshipPolicy();
$policy->create($user);  // Should be true
```

### Error: Gates not working

**Check:**
```php
// Verify gates are registered
Gate::abilities();  // Should list all gates

// Test specific gate
Gate::forUser($user)->allows('create-championship');
```

### API returns 500 instead of 403

**Check logs:**
```bash
tail -f storage/logs/laravel.log
```

Look for errors like:
- Class not found → run `composer dump-autoload`
- Method not found → check model methods exist
- Database errors → check migrations ran

---

## ✅ After Testing Successfully

Once all tests pass:

1. **Verify created_by is set:**
   ```php
   $champ = Championship::find(1);
   $champ->created_by;  // Should be user's ID, not null
   ```

2. **Verify policies work:**
   ```php
   $user->can('update', $champ);  // Should be true for creator
   ```

3. **Verify gates work:**
   ```php
   Gate::forUser($user)->allows('create-championship');  // Should match permission
   ```
   $user = User::first();
$token = $user->createToken('test-token')->plainTextToken;
  echo $token; // Copy this token

4. **Ready for Phase 3!**
   - Report test results
   - Note any issues
   - Confirm ready to proceed

---

**Next:** Once Phase 2 tests pass, we can proceed with:
- **Phase 3:** Organization Support & Remaining Controllers
- **Phase 4:** Polish, Admin UI, and Integration Tests


curl.exe -X POST "http://localhost:8000/api/championships" -H "Authorization: Bearer 15|8QenEKx0wAE5ZT3lipNxNSyxrXsN1IV8XDGesxqv0c4abb22" -H "Content-Type: application/json" -d "{\"title\": \"API Auth Test\", \"description\": \"Testing API auth\", \"entry_fee\": 50, \"registration_deadline\": \"2025-12-01T10:00:00Z\", \"start_date\": \"2025-12-15T10:00:00Z\", \"format\": \"swiss_only\", \"swiss_rounds\": 5}"

curl.exe -X POST "http://localhost:8000/api/championships" -H "Authorization: Bearer 15|8QenEKx0wAE5ZT3lipNxNSyxrXsN1IV8XDGesxqv0c4abb22" -H "Content-Type: application/json" -d "{\"title\": \"API Auth Test\", \"description\":  \"Testing API auth\", \"entry_fee\": 50, \"registration_deadline\": \"2025-12-01T10:00:00Z\", \"start_date\": \"2025-12-15T10:00:00Z\", \"format\": \"swiss_only\", \"swiss_rounds\": 5}"

 curl.exe -X POST "http://localhost:8000/api/championships" -H "Authorization: Bearer 16|m0BNns95JWmfVMADBwaBgUfwtvpSawvXIpfov917a52467b1" -H "Content-Type: application/json" -d "{\"title\":\"Auth Test Championship\",\"description\":\"Testing  complete auth flow\",\"entry_fee\":100,\"registration_deadline\":\"2025-12-01T10:00:00Z\",\"start_date\":\"2025-12-15T10:00:00Z\",\"format\":\"swiss_only\",\"swiss_rounds\":5,\"match_time_window_hours\":24}"