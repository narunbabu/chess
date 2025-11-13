# Chess Web Platform: Authentication & Authorization Architecture Analysis

**Analysis Date:** November 12, 2025  
**Project:** Chess Web - Real-time Multiplayer Chess Platform  
**Scope:** Current auth structure and gaps for multi-role RBAC system

---

## 1. CURRENT AUTHENTICATION ARCHITECTURE

### 1.1 User Model (`/chess-backend/app/Models/User.php`)

**Current Fields:**
```php
protected $fillable = [
    'name',              // User's display name
    'email',             // Unique email address
    'password',          // Hashed password (nullable for social auth)
    'provider',          // OAuth provider (google, github, etc)
    'provider_id',       // Social auth provider ID
    'provider_token',    // Social auth token
    'avatar_url',        // User avatar URL
    'rating',            // Chess ELO rating
    'is_provisional',    // Whether rating is provisional (< 20 games)
    'games_played',      // Total games played
    'peak_rating',       // Highest rating achieved
    'rating_last_updated', // Timestamp of last rating update
];
```

**What's Missing:**
- ❌ `role` field (no role-based access control)
- ❌ `permissions` field or relationship
- ❌ `is_active` / `is_banned` field
- ❌ `organization_id` (no multi-tenant support)
- ❌ `email_verified_at` handling (exists in migration but not in fillable)
- ❌ `verified_email_at` status tracking

### 1.2 Authentication Method

**Location:** `/chess-backend/app/Http/Controllers/Auth/AuthController.php`

**Current Implementation:**
```php
- login()      → Email + password authentication via Auth::attempt()
- register()   → Create new user with email/password
- logout()     → Revoke current access token
```

**Framework Used:** Laravel Sanctum (API tokens)
- Token-based authentication (not session-based)
- Stateless API design
- No built-in permission system

**Database Support:**
- Users table has `email_verified_at` timestamp (unused)
- No roles/permissions tables
- No audit logs for authorization

### 1.3 Current Middleware Setup

**File:** `/chess-backend/app/Http/Kernel.php`

**Global Middleware:**
- `ValidatePostSize`
- `TrimStrings`
- `ConvertEmptyStringsToNull`
- `HandleCors` (Fruitcake/Cors)

**Route Middleware:**
```php
'auth'          → Authenticate::class
'auth.basic'    → AuthenticateWithBasicAuth::class
'can'           → Authorize::class        // For policies (UNUSED)
'guest'         → RedirectIfAuthenticated::class
'signed'        → ValidateSignature::class
'throttle'      → ThrottleRequests::class
'verified'      → EnsureEmailIsVerified::class (UNUSED)
'auth:sanctum'  → EnsureFrontendRequestsAreStateful::class
```

**What's Missing:**
- ❌ No role-based middleware (e.g., 'role:admin')
- ❌ No custom permission checks
- ❌ No audit/logging middleware
- ❌ Limited authorization enforcement

---

## 2. CHAMPIONSHIP OWNERSHIP & AUTHORIZATION

### 2.1 Championship Model (`/chess-backend/app/Models/Championship.php`)

**Current Schema:**
```php
protected $fillable = [
    'title',                      // Championship name
    'description',                // Description
    'entry_fee',                  // Registration fee
    'max_participants',           // Max players (nullable = unlimited)
    'registration_deadline',      // When registration closes
    'start_date',                 // Championship start
    'match_time_window_hours',    // Time limit per match
    'format_id',                  // FK to championship_formats
    'swiss_rounds',               // Rounds in Swiss phase
    'top_qualifiers',             // Players advancing to elimination
    'status_id',                  // FK to championship_statuses
];
```

**CRITICAL GAP:** 
- ❌ **NO `user_id` (creator/organizer) field**
- ❌ No ownership tracking
- ❌ No creator relationships
- ❌ No ability to determine who can modify a championship

### 2.2 Championship Participants (`/chess-backend/app/Models/ChampionshipParticipant.php`)

**Current Schema:**
```php
protected $fillable = [
    'championship_id',        // FK to championship
    'user_id',                // FK to user (participant only)
    'razorpay_order_id',      // Payment order ID
    'razorpay_payment_id',    // Payment confirmation
    'razorpay_signature',     // Payment signature
    'payment_status_id',      // FK to payment_statuses
    'amount_paid',            // Amount paid
    'registered_at',          // Registration timestamp
    'seed_number',            // Elimination bracket seeding
];
```

**Relationships:**
- Belongs to Championship
- Belongs to User

**Current Role:** Only tracks "participant" - no organizer/monitor/admin tracking

### 2.3 Database Schema Analysis

**Users Table:**
```
id (PK)
name
email (UNIQUE)
email_verified_at (unused)
password
provider
provider_id
provider_token
remember_token
avatar_url
rating
is_provisional
games_played
peak_rating
rating_last_updated
created_at
updated_at

❌ MISSING: role, permissions, organization_id, is_active
```

**Championships Table:**
```
id (PK)
title
description
entry_fee
max_participants
registration_deadline
start_date
match_time_window_hours
format_id (FK)
swiss_rounds
top_qualifiers
status_id (FK)
created_at
updated_at

❌ MISSING: user_id (creator), created_by, organization_id, visibility
```

**Championship Participants Table:**
```
id (PK)
championship_id (FK)
user_id (FK)
razorpay_order_id
razorpay_payment_id
razorpay_signature
payment_status_id (FK)
amount_paid
registered_at
seed_number
created_at
updated_at

❌ MISSING: role_type (participant/monitor/organizer indicator)
```

---

## 3. CURRENT AUTHORIZATION PATTERNS

### 3.1 API Routes Authorization

**File:** `/chess-backend/routes/api.php`

**Championship Routes (Lines 137-182):**
```php
Route::prefix('championships')->group(function () {
    Route::get('/', [ChampionshipController::class, 'index']);
    
    // ⚠️ Has middleware but references non-existent permission
    Route::post('/', [ChampionshipController::class, 'store'])
        ->middleware('can:create-tournaments');
    
    Route::get('/{id}', [ChampionshipController::class, 'show']);
    
    // ⚠️ Uses policy-based authorization (not implemented)
    Route::put('/{id}', [ChampionshipController::class, 'update'])
        ->middleware('can:manage,tournament');
    
    Route::delete('/{id}', [ChampionshipController::class, 'destroy'])
        ->middleware('can:manage,tournament');
    
    // Participant routes
    Route::get('/{id}/participants', [ChampionshipController::class, 'participants']);
    Route::get('/{id}/matches', [ChampionshipController::class, 'matches']);
    Route::get('/{id}/standings', [ChampionshipController::class, 'standings']);
    Route::get('/{id}/my-matches', [ChampionshipController::class, 'myMatches']);
    
    // Match management
    Route::prefix('/{championship}/matches')->group(function () {
        Route::post('/preview', [...])
            ->middleware('can:manage,tournament');
        Route::post('/schedule-next', [...])
            ->middleware('can:manage,tournament');
        // ... other match routes
    });
    
    // Payment routes
    Route::post('/{id}/payment/initiate', [...]);
    Route::post('/payment/callback', [...]);
    Route::post('/payment/refund/{participantId}', [...]);
});

// ⚠️ Admin routes with permission check
Route::prefix('admin/tournaments')
    ->middleware('can:manageTournaments')  // Not implemented
    ->group(function () {
        Route::get('/overview', [TournamentAdminController::class, 'overview']);
        Route::post('/{championship}/start', [TournamentAdminController::class, 'startChampionship']);
        // ... more admin routes
    });
```

**Issues:**
- ❌ Middleware references `'can:create-tournaments'` - NO GATE DEFINED
- ❌ Middleware references `'can:manage,tournament'` - NO POLICY DEFINED
- ❌ Middleware references `'can:manageTournaments'` - NO GATE DEFINED
- ⚠️ No actual authorization checks in controller methods
- ⚠️ Anyone can create tournaments (middleware doesn't work)
- ⚠️ Anyone can manage any tournament (no ownership check)

### 3.2 ChampionshipController Authorization

**File:** `/chess-backend/app/Http/Controllers/ChampionshipController.php`

**Current Implementation (Lines 91-108):**
```php
public function store(Request $request): JsonResponse
{
    $validator = Validator::make($request->all(), [
        'title' => 'required|string|max:255',
        'description' => 'nullable|string|max:5000',
        'entry_fee' => 'required|numeric|min:0|max:10000',
        'max_participants' => 'nullable|integer|min:2|max:1024',
        'registration_deadline' => 'required|date|after:now',
        'start_date' => 'required|date|after:registration_deadline',
        'match_time_window_hours' => 'required|integer|min:1|max:168',
        // ... more validation
    ]);
    
    // ⚠️ NO CHECK: Who is creating this championship?
    // ⚠️ NO STORAGE: Championship creator not recorded
    // ⚠️ NO VALIDATION: Entry fee doesn't validate user permissions
}
```

**Problems:**
- ✅ Validates input structure
- ❌ Does NOT validate permission to create
- ❌ Does NOT store creator information
- ❌ Does NOT enforce any role checks
- ❌ Does NOT check user eligibility (payment balance, account status, etc)

---

## 4. IDENTIFIED GAPS FOR MULTI-ROLE RBAC

### 4.1 Missing Database Structure

**Need to add:**

1. **Roles Table**
   ```sql
   CREATE TABLE roles (
       id BIGINT PRIMARY KEY AUTO_INCREMENT,
       code VARCHAR(50) UNIQUE,           -- 'platform_admin', 'org_admin', 'organizer', 'monitor', 'player'
       name VARCHAR(100),                 -- Display name
       description TEXT,                  -- Role description
       created_at TIMESTAMP,
       updated_at TIMESTAMP
   );
   ```

2. **Permissions Table**
   ```sql
   CREATE TABLE permissions (
       id BIGINT PRIMARY KEY AUTO_INCREMENT,
       code VARCHAR(100) UNIQUE,          -- 'create_championship', 'manage_championship', 'view_results'
       name VARCHAR(100),
       description TEXT,
       resource VARCHAR(50),              -- 'championship', 'payment', 'user', 'system'
       action VARCHAR(50),                -- 'create', 'read', 'update', 'delete'
       created_at TIMESTAMP,
       updated_at TIMESTAMP
   );
   ```

3. **Role-Permission Mapping**
   ```sql
   CREATE TABLE role_permissions (
       id BIGINT PRIMARY KEY AUTO_INCREMENT,
       role_id BIGINT,
       permission_id BIGINT,
       created_at TIMESTAMP,
       FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
       FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
       UNIQUE(role_id, permission_id)
   );
   ```

4. **User-Role Assignment**
   ```sql
   CREATE TABLE user_roles (
       id BIGINT PRIMARY KEY AUTO_INCREMENT,
       user_id BIGINT,
       role_id BIGINT,
       organization_id BIGINT NULLABLE,  -- For org-scoped roles
       granted_at TIMESTAMP,
       granted_by BIGINT,                -- Admin who granted role
       created_at TIMESTAMP,
       FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
       FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT,
       UNIQUE(user_id, role_id, organization_id)
   );
   ```

5. **Championship Creator Tracking**
   ```sql
   ALTER TABLE championships ADD COLUMN (
       created_by BIGINT,                 -- User who created championship
       organization_id BIGINT NULLABLE,   -- Optional organization
       visibility ENUM('public', 'private', 'invite_only') DEFAULT 'public',
       FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
       KEY (created_by),
       KEY (organization_id)
   );
   ```

6. **Championship Roles (Organizer/Monitor tracking)**
   ```sql
   CREATE TABLE championship_roles (
       id BIGINT PRIMARY KEY AUTO_INCREMENT,
       championship_id BIGINT,
       user_id BIGINT,
       role_type ENUM('organizer', 'monitor', 'arbiter'),
       assigned_at TIMESTAMP,
       assigned_by BIGINT,
       created_at TIMESTAMP,
       FOREIGN KEY (championship_id) REFERENCES championships(id) ON DELETE CASCADE,
       FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
       UNIQUE(championship_id, user_id, role_type)
   );
   ```

### 4.2 Missing Model Methods & Relationships

**User Model needs:**
```php
// Relationships
public function roles()          // hasMany/hasMany through pivot
public function permissions()    // hasManyThrough
public function organizationRoles() // scoped by organization
public function createdChampionships()
public function organizedChampionships()

// Methods
public function hasRole($roleName)
public function hasPermission($permission)
public function hasAnyRole($roles)
public function hasAllPermissions($permissions)
public function can($action, $resource)
public function canManageChampionship($championship)
```

**Championship Model needs:**
```php
// Relationships
public function creator()        // belongsTo User
public function organizers()     // hasMany through championship_roles
public function monitors()       // hasMany through championship_roles

// Methods
public function isOwnedBy($user)
public function canBeEditedBy($user)
public function canBeDeletedBy($user)
public function isAdministratedBy($user)
```

### 4.3 Missing Authorization Patterns

**Need to implement:**

1. **Gates (Simple checks)**
   ```php
   Gate::define('create-championship', function (User $user) {
       return $user->hasRole('organizer') || $user->hasRole('platform_admin');
   });
   
   Gate::define('manage-tournaments', function (User $user) {
       return $user->hasRole('platform_admin');
   });
   ```

2. **Policies (Resource-based checks)**
   ```php
   class ChampionshipPolicy {
       public function update(User $user, Championship $championship) {
           return $championship->isOwnedBy($user) || 
                  $user->hasRole('platform_admin');
       }
       
       public function manage(User $user, Championship $championship) {
           return $championship->isOwnedBy($user) ||
                  $championship->isAdministratedBy($user) ||
                  $user->hasRole('platform_admin');
       }
   }
   ```

3. **Custom Middleware**
   ```php
   class CheckChampionshipAccess {
       public function handle($request, $next, ...$roles) {
           $championship = $request->route('championship');
           $user = $request->user();
           
           if (!$championship->canBeAccessedBy($user)) {
               abort(403);
           }
       }
   }
   ```

---

## 5. REQUIRED ROLES & PERMISSIONS MATRIX

### 5.1 Role Definitions

| Role | Scope | Responsibilities | Access Level |
|------|-------|------------------|--------------|
| **Platform Admin** | Global | Oversee entire platform, manage organizations, view all tournaments, system-wide settings | Full system |
| **Organization Admin** | Organization | Manage organization members, approve tournament organizers, view organization tournaments | Organization-scoped |
| **Tournament Organizer** | Championship | Create/manage own tournaments, set up matches, manage participants, collect payments | Own championships |
| **Monitor/Arbiter** | Championship | Monitor active matches, report results, resolve disputes, update standings | Assigned championships |
| **Player** | Participant | Register for tournaments, play matches, view standings | Their own participation |
| **Guest** | Public | View public tournaments, watch replays | Read-only |

### 5.2 Permission Matrix

| Permission | Platform Admin | Org Admin | Organizer | Monitor | Player | Guest |
|-----------|---|---|---|---|---|---|
| **Championship Management** |
| Create championship | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit own championship | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit any championship | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete championship | ✅ | ✅ | ✅* | ❌ | ❌ | ❌ |
| Start championship | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Generate next round | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Match Management** |
| View matches | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Schedule matches | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Report match results | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Reschedule match | ✅ | ✅ | ✅ | ✅ | ⚠️* | ❌ |
| **Registration** |
| Register participant | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| View participants | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Remove participant | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Payment** |
| Initiate payment | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Process refund | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View payment records | ✅ | ✅ | ✅ | ✅ | ⚠️* | ❌ |
| **User Management** |
| View all users | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Ban user | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Assign roles | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **System** |
| View analytics | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View system health | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ |
| Run maintenance | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Legend:** ✅ Full access | ⚠️ Limited access | ❌ No access | *Conditional

---

## 6. CHAMPIONSHIP OWNERSHIP PATTERNS

### 6.1 Current Pattern (BROKEN)

```
User creates Championship
   ↓
Championship stored WITHOUT creator
   ↓
NO ABILITY TO:
  - Know who created it
  - Restrict edits to creator
  - Prevent unauthorized deletion
  - Track who transferred ownership
```

### 6.2 Proposed Pattern

```
User (with 'organizer' role) creates Championship
   ↓
Championship.created_by = user.id
Championship.organization_id = user.organization_id (if org admin)
   ↓
ChampionshipRole created: (championship_id, user_id, 'organizer')
   ↓
User can:
  - Edit their championship
  - Assign monitors/arbiters
  - View all matches
  - Manage participants
  - Process payments
   ↓
Validates:
  - Only owner/admin can modify
  - Only creator can delete (before registration)
  - Only platform_admin can transfer ownership
```

---

## 7. ENFORCEMENT GAPS

### 7.1 Controller-Level Gaps

**ChampionshipController::store()**
- ✅ Validates input
- ❌ No permission check
- ❌ No role verification
- ❌ Doesn't set created_by

**ChampionshipController::update()**
- ✅ Validates input
- ❌ No ownership check
- ❌ Middleware `'can:manage,tournament'` doesn't work
- ❌ No policy implementation

**ChampionshipController::destroy()**
- ✅ Can delete
- ❌ No ownership verification
- ❌ No status checks (can delete running tournament)
- ❌ Middleware broken

**TournamentAdminController**
- ✅ Routes exist
- ❌ Middleware `'can:manageTournaments'` not implemented
- ❌ No role enforcement
- ❌ Accessible by anyone (middleware broken)

### 7.2 Middleware Gaps

```php
// In routes/api.php - These DON'T WORK:
->middleware('can:create-tournaments')    // Gate not defined
->middleware('can:manage,tournament')     // Policy not defined
->middleware('can:manageTournaments')    // Gate not defined
```

---

## 8. AUTHENTICATION FLOW ANALYSIS

### Current Flow (Sanctum Tokens)

```
User Registration
   ↓
Email + Password created
   ↓
User assigned to 'player' role automatically (NOT IMPLEMENTED)
   ↓
Login
   ↓
Sanctum creates API token
   ↓
Token used for all requests
   ↓
No role/permission checks on protected routes
```

### Issues with Current Flow

1. **No automatic role assignment** - New users get no roles
2. **No role enforcement** - Middleware references non-existent gates/policies
3. **No scope tracking** - Can't tell who owns what championship
4. **No audit trail** - No logging of who did what
5. **No expiration policies** - Tokens don't expire

---

## 9. MISSING IMPLEMENTATION AREAS

### 9.1 Authorization Checks Needed

```php
// In controllers - Currently missing:

// Before creating championship
$this->authorize('create', Championship::class);

// Before updating championship
$this->authorize('update', $championship);

// Before deleting championship
$this->authorize('delete', $championship);

// Before managing tournament
$this->authorize('manage', $championship);

// Before reporting results
$this->authorize('reportResult', $match);

// Before issuing refund
$this->authorize('issueRefund', $championship);
```

### 9.2 Role-Based Queries

```php
// Currently missing - Need to filter by role:

// Get my championships (organizer view)
Championship::where('created_by', auth()->id())->get();

// Get championships I monitor
ChampionshipRole::where('user_id', auth()->id())
    ->where('role_type', 'monitor')
    ->with('championship')
    ->get();

// Get open championships (player view)
Championship::where('status_id', ChampionshipStatus::REGISTRATION_OPEN)
    ->where('visibility', 'public')
    ->get();

// Get system overview (admin view)
Championship::select([
    'id', 'title', 'created_by', 'status_id', 
    'registered_count', 'entry_fee', 'created_at'
])
    ->with('creator')
    ->orderBy('created_at', 'desc')
    ->get();
```

---

## 10. SUMMARY TABLE: Current vs. Needed

| Aspect | Current | Needed |
|--------|---------|--------|
| **User Roles** | None (all users equal) | 6 roles defined |
| **Role Tracking** | No table/field | user_roles pivot table |
| **Permissions** | None | 30+ permissions defined |
| **Championship Creator** | No tracking | `created_by` field |
| **Championship Organizer** | No tracking | championship_roles table |
| **Authorization Middleware** | Broken (gates don't exist) | Functional gates & policies |
| **Policy Classes** | None | ChampionshipPolicy required |
| **Permission Checks** | None in controllers | Every resource action checked |
| **Ownership Validation** | None | Before every modify operation |
| **Audit Logging** | None | Track all role changes |
| **Organization Scoping** | None | organization_id throughout |
| **API Response Filtering** | No | Filter by user's role/permissions |

---

## 11. IMPLEMENTATION ROADMAP

### Phase 1: Database & Models (3-4 hours)
1. Create roles, permissions, user_roles tables
2. Add created_by to championships
3. Create championship_roles table
4. Update User and Championship models

### Phase 2: Authorization System (4-5 hours)
1. Implement gates (create-championship, manageTournaments)
2. Implement ChampionshipPolicy
3. Add role/permission helper methods to User
4. Add ownership checks to Championship model

### Phase 3: Controller Updates (4-5 hours)
1. Add authorization checks to every endpoint
2. Store created_by when creating championship
3. Validate ownership on updates/deletes
4. Filter responses by user role/permissions

### Phase 4: Middleware & Routes (2-3 hours)
1. Fix/implement middleware
2. Update route definitions
3. Test authorization flows

### Phase 5: Testing & Documentation (2-3 hours)
1. Write authorization tests
2. Document permission matrix
3. Create role assignment procedures

**Total Estimated Time:** 15-20 hours

---

## 12. KEY DEPENDENCIES

**Must be implemented before:**
- Championship payment processing (verify user can create championship)
- Match scheduling (verify user can manage championship)
- Result reporting (verify monitor role assigned)
- Admin dashboard (verify platform_admin access)
- User banning/role assignment (need permission system)

**Blocking current:**
- Proper tournament management (no creator tracking)
- Multi-organizer tournaments (no role support)
- Payment authorization (no permission check)
- Admin oversight (no admin role/routes working)

---

