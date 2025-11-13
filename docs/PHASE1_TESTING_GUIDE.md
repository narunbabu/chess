# Phase 1 Testing Guide - Quick Start

**Purpose:** Verify Phase 1 authorization foundation is working correctly

**Time Required:** 10-15 minutes

---

## Prerequisites

- ✅ Phase 1 code implemented (all migrations and models created)
- ✅ Laravel environment running
- ✅ Database connection working
- ✅ Backup of database taken

---

## Step-by-Step Testing

### 1️⃣ Run Migrations (2 minutes)

```bash
cd chess-backend

# See what will be migrated
php artisan migrate:status

# Run migrations
php artisan migrate

# Verify success - should show all new migrations as "Ran"
php artisan migrate:status | grep "2025_11_12_11"
```

**Expected Output:**
```
Ran  2025_11_12_110000_create_roles_table
Ran  2025_11_12_110001_create_permissions_table
Ran  2025_11_12_110002_create_role_permissions_table
Ran  2025_11_12_110003_create_user_roles_table
Ran  2025_11_12_110004_create_organizations_table
Ran  2025_11_12_110005_add_authorization_to_championships
Ran  2025_11_12_110006_add_authorization_to_users
```

---

### 2️⃣ Run Seeder (1 minute)

```bash
php artisan db:seed --class=RolePermissionSeeder
```

**Expected Output:**
```
Assigned 'player' role to X users.
No platform admin found. You may want to manually assign the admin role to a user.
```

---

### 3️⃣ Verify Database (3 minutes)

**Option A: Using Tinker**

```bash
php artisan tinker
```

```php
// Check roles
App\Models\Role::count();                    // Should be 6

// Check permissions
App\Models\Permission::count();              // Should be 30

// Check role-permission assignments
DB::table('role_permissions')->count();      // Should be ~100

// Check user-role assignments
DB::table('user_roles')->count();            // Should equal user count

// See all roles
App\Models\Role::orderBy('hierarchy_level', 'desc')->get(['name', 'display_name', 'hierarchy_level']);
```

**Option B: Using SQL Client**

```sql
-- Check structure
SHOW TABLES LIKE 'roles';
SHOW TABLES LIKE 'permissions';
SHOW TABLES LIKE 'organizations';

-- Verify data
SELECT COUNT(*) FROM roles;                   -- Should be 6
SELECT COUNT(*) FROM permissions;             -- Should be 30
SELECT COUNT(*) FROM role_permissions;        -- Should be ~100

-- See roles
SELECT * FROM roles ORDER BY hierarchy_level DESC;
```

---

### 4️⃣ Test User Authorization (5 minutes)

```bash
php artisan tinker
```

```php
// Get first user
$user = App\Models\User::first();

// ✅ Test 1: User has 'player' role (auto-assigned by seeder)
$user->hasRole('player');  // Should return true

// ✅ Test 2: User has player permissions
$user->hasPermission('play_games');                 // Should be true
$user->hasPermission('register_for_championship'); // Should be true
$user->hasPermission('view_public_championships'); // Should be true

// ✅ Test 3: User DOES NOT have admin permissions
$user->hasPermission('manage_platform');      // Should be false
$user->hasPermission('manage_users');         // Should be false

// ✅ Test 4: Assign admin role
$user->assignRole('platform_admin');
$user->isPlatformAdmin();                     // Should be true now

// ✅ Test 5: Admin now has all permissions
$user->hasPermission('manage_platform');      // Should be true now
$user->hasPermission('create_championship');  // Should be true
$user->hasPermission('manage_users');         // Should be true

// ✅ Test 6: Get user's roles
$user->roles;  // Should show 'player' AND 'platform_admin'

// ✅ Test 7: Get highest role
$user->getHighestRole()->name;  // Should be 'platform_admin' (level 100)

// Clean up (remove admin for now)
$user->removeRole('platform_admin');
```

---

### 5️⃣ Test Championship Visibility (3 minutes)

```php
// Still in tinker...

// Get or create a test championship
$championship = App\Models\Championship::first();

// If no championships exist, create one
if (!$championship) {
    $championship = App\Models\Championship::create([
        'title' => 'Test Championship',
        'description' => 'Testing visibility',
        'entry_fee' => 0,
        'registration_deadline' => now()->addDays(7),
        'start_date' => now()->addDays(14),
        'match_time_window_hours' => 24,
        'format' => 'swiss_only',
        'swiss_rounds' => 5,
        'status' => 'upcoming',
        'visibility' => 'public',
        'allow_public_registration' => true,
    ]);
}

// ✅ Test 1: Public visibility
$championship->visibility = 'public';
$championship->save();
$championship->isPublic();           // Should be true
$championship->isVisibleTo(null);    // Should be true (public to everyone)

// ✅ Test 2: Private visibility
$championship->visibility = 'private';
$championship->save();
$championship->isVisibleTo(null);    // Should be false (not visible to guests)

// Get a user
$user = App\Models\User::first();

// ✅ Test 3: Set creator
$championship->created_by = $user->id;
$championship->save();

// ✅ Test 4: Creator can see private championship
$championship->isVisibleTo($user);   // Should be true (creator can see it)

// ✅ Test 5: Other users cannot see private championship
$otherUser = App\Models\User::where('id', '!=', $user->id)->first();
if ($otherUser) {
    $championship->isVisibleTo($otherUser); // Should be false
}

// ✅ Test 6: Admins can see everything
$user->assignRole('platform_admin');
$championship->isVisibleTo($user);   // Should be true (admin sees all)

// ✅ Test 7: Query scope works
App\Models\Championship::visibleTo($user)->count(); // Should return count
App\Models\Championship::visibleTo(null)->count();  // Only public championships

// Clean up
$championship->visibility = 'public';
$championship->save();
```

---

### 6️⃣ Test Role Hierarchy (2 minutes)

```php
// Still in tinker...

$admin = App\Models\Role::where('name', 'platform_admin')->first();
$player = App\Models\Role::where('name', 'player')->first();

// ✅ Test hierarchy
$admin->isHigherThan($player);   // Should be true (100 > 20)
$player->isLowerThan($admin);    // Should be true
$admin->hierarchy_level;         // Should be 100
$player->hierarchy_level;        // Should be 20
```

---

## 🎯 Success Checklist

After testing, verify these all passed:

**Database Structure:**
- [ ] 6 roles exist in database
- [ ] 30 permissions exist in database
- [ ] ~100 role-permission mappings exist
- [ ] All existing users have 'player' role
- [ ] Organizations table created
- [ ] Championships have new columns (created_by, organization_id, visibility)

**User Authorization:**
- [ ] User::hasRole() works correctly
- [ ] User::hasPermission() works correctly
- [ ] User::assignRole() works correctly
- [ ] User::isPlatformAdmin() works correctly
- [ ] User::getHighestRole() returns correct role

**Championship Visibility:**
- [ ] Championship::isPublic() works
- [ ] Championship::isVisibleTo() works correctly
- [ ] Private championships hidden from non-creators
- [ ] Public championships visible to everyone
- [ ] Query scope Championship::visibleTo() works

**Role Hierarchy:**
- [ ] Role::isHigherThan() works correctly
- [ ] Hierarchy levels correct (0-100)

---

## 🐛 Troubleshooting

### Migration Errors

**Error: "Table already exists"**
```bash
# Check if you already ran migrations
php artisan migrate:status

# If so, skip re-running or rollback first
php artisan migrate:rollback --step=7
php artisan migrate
```

**Error: "Column already exists"**
```bash
# This means you partially ran migrations
# Check which columns exist:
php artisan tinker
Schema::hasColumn('users', 'organization_id');
Schema::hasColumn('championships', 'created_by');

# If they exist, you can skip those migrations or manually remove them
```

**Error: "Foreign key constraint fails"**
```bash
# Means tables are being created in wrong order
# This shouldn't happen with our migration timestamps
# But if it does, check migration timestamps are sequential:
ls -la database/migrations/2025_11_12_11*
```

### Seeder Errors

**Error: "Class RolePermissionSeeder not found"**
```bash
# Regenerate autoload files
composer dump-autoload
php artisan db:seed --class=RolePermissionSeeder
```

**Error: "Player role not found"**
```bash
# Means roles migration didn't run
php artisan migrate:status | grep roles
# Re-run migrations if needed
```

### Tinker Errors

**Error: "Call to undefined method hasRole()"**
```bash
# User model wasn't updated properly
# Check if User.php has the authorization methods:
grep -n "hasRole" app/Models/User.php

# If not found, the model update didn't apply
# Re-open User.php and manually add the methods
```

---

## ✅ After Testing Successfully

Once all tests pass:

1. **Document your test results**
   - Screenshot successful tinker commands
   - Note any issues encountered
   - Record database row counts

2. **Create a test admin user**
   ```bash
   php artisan tinker
   ```
   ```php
   $admin = User::find(1); // Use your user ID
   $admin->assignRole('platform_admin');
   ```

3. **Ready for Phase 2!**
   - Report back which tests passed
   - Share any errors encountered
   - Confirm you're ready for Authorization Layer implementation

---

## 📝 Test Results Template

Copy and fill this out:

```
PHASE 1 TEST RESULTS
Date: _______________

✅ Migrations: [ ] Pass  [ ] Fail
✅ Seeder:     [ ] Pass  [ ] Fail
✅ Database:   [ ] Pass  [ ] Fail
✅ User Auth:  [ ] Pass  [ ] Fail
✅ Visibility: [ ] Pass  [ ] Fail
✅ Hierarchy:  [ ] Pass  [ ] Fail

Notes:
-
-
-

Issues Found:
-
-

Ready for Phase 2: [ ] Yes  [ ] No (explain why)
```

---

**Next:** Once all tests pass, proceed to Phase 2 (Authorization Layer)
