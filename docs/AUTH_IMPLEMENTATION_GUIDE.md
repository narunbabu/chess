# Multi-Role RBAC Implementation Guide

## Quick Start: Database Migrations

### Migration 1: Create Roles & Permissions Tables

```php
// database/migrations/2025_11_12_create_roles_and_permissions.php

Schema::create('roles', function (Blueprint $table) {
    $table->id();
    $table->string('code', 50)->unique();  // 'platform_admin', 'org_admin', 'organizer', 'monitor', 'player'
    $table->string('name', 100);
    $table->text('description')->nullable();
    $table->timestamps();
});

Schema::create('permissions', function (Blueprint $table) {
    $table->id();
    $table->string('code', 100)->unique();  // 'create_championship', 'manage_tournament'
    $table->string('name', 100);
    $table->text('description')->nullable();
    $table->string('resource', 50);         // 'championship', 'payment', 'user'
    $table->string('action', 50);           // 'create', 'read', 'update', 'delete'
    $table->timestamps();
});

Schema::create('role_permissions', function (Blueprint $table) {
    $table->id();
    $table->foreignId('role_id')->constrained('roles')->onDelete('cascade');
    $table->foreignId('permission_id')->constrained('permissions')->onDelete('cascade');
    $table->timestamps();
    
    $table->unique(['role_id', 'permission_id']);
});

Schema::create('user_roles', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
    $table->foreignId('role_id')->constrained('roles')->onDelete('restrict');
    $table->foreignId('organization_id')->nullable()->constrained('organizations')->onDelete('cascade');
    $table->timestamp('granted_at')->useCurrent();
    $table->foreignId('granted_by')->nullable()->constrained('users')->onDelete('set null');
    $table->timestamps();
    
    $table->unique(['user_id', 'role_id', 'organization_id']);
});
```

### Migration 2: Add Championship Creator Tracking

```php
// database/migrations/2025_11_12_add_created_by_to_championships.php

Schema::table('championships', function (Blueprint $table) {
    $table->foreignId('created_by')->nullable()->after('status_id')->constrained('users')->onDelete('restrict');
    $table->foreignId('organization_id')->nullable()->after('created_by')->constrained('organizations')->onDelete('set null');
    $table->enum('visibility', ['public', 'private', 'invite_only'])->default('public')->after('organization_id');
    
    $table->index('created_by');
    $table->index('organization_id');
});
```

### Migration 3: Championship Roles (Organizer/Monitor)

```php
// database/migrations/2025_11_12_create_championship_roles.php

Schema::create('championship_roles', function (Blueprint $table) {
    $table->id();
    $table->foreignId('championship_id')->constrained('championships')->onDelete('cascade');
    $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
    $table->enum('role_type', ['organizer', 'monitor', 'arbiter']);
    $table->timestamp('assigned_at')->useCurrent();
    $table->foreignId('assigned_by')->nullable()->constrained('users')->onDelete('set null');
    $table->timestamps();
    
    $table->unique(['championship_id', 'user_id', 'role_type']);
    $table->index(['championship_id', 'role_type']);
});
```

---

## Models: Add Relationships & Methods

### User Model Updates

```php
// app/Models/User.php

class User extends Authenticatable {
    // ... existing code ...

    // RELATIONSHIPS
    public function roles()
    {
        return $this->belongsToMany(Role::class, 'user_roles')
                    ->withPivot('organization_id', 'granted_at', 'granted_by')
                    ->withTimestamps();
    }

    public function permissions()
    {
        return $this->hasManyThrough(
            Permission::class,
            Role::class,
            'id',               // Foreign key on roles table
            'id',               // Foreign key on permissions table
            'id',               // Local key on users table
            'id'                // Local key on roles table
        )
        ->distinct()
        ->through('roles');  // Using pivot table
    }

    public function createdChampionships()
    {
        return $this->hasMany(Championship::class, 'created_by');
    }

    public function organizedChampionships()
    {
        return $this->hasManyThrough(
            Championship::class,
            ChampionshipRole::class,
            'user_id',
            'id',
            'id',
            'championship_id'
        )->where('role_type', 'organizer');
    }

    public function monitoredChampionships()
    {
        return $this->hasManyThrough(
            Championship::class,
            ChampionshipRole::class,
            'user_id',
            'id',
            'id',
            'championship_id'
        )->where('role_type', 'monitor');
    }

    // AUTHORIZATION METHODS
    public function hasRole($roleName)
    {
        if (is_string($roleName)) {
            return $this->roles()->where('code', $roleName)->exists();
        }
        return $this->roles()->whereIn('code', $roleName)->exists();
    }

    public function hasPermission($permission)
    {
        if (is_string($permission)) {
            return $this->permissions()->where('code', $permission)->exists();
        }
        return $this->permissions()->whereIn('code', $permission)->exists();
    }

    public function hasAnyRole($roles)
    {
        return $this->roles()->whereIn('code', (array)$roles)->exists();
    }

    public function hasAllPermissions($permissions)
    {
        return collect($permissions)
            ->every(fn($permission) => $this->hasPermission($permission));
    }

    public function canManageChampionship(Championship $championship)
    {
        // Platform admin can manage any championship
        if ($this->hasRole('platform_admin')) {
            return true;
        }

        // Org admin can manage org championships
        if ($this->hasRole('organization_admin') && 
            $championship->organization_id === $this->organization_id) {
            return true;
        }

        // Organizer can manage their own championships
        if ($championship->created_by === $this->id) {
            return true;
        }

        // Monitor assigned to this championship can manage it
        return ChampionshipRole::where('championship_id', $championship->id)
                              ->where('user_id', $this->id)
                              ->whereIn('role_type', ['organizer', 'monitor'])
                              ->exists();
    }

    public function canReportResult(Championship $championship)
    {
        // Admin & organizer can report
        if ($this->hasRole('platform_admin') || $championship->created_by === $this->id) {
            return true;
        }

        // Monitor for this championship can report
        return ChampionshipRole::where('championship_id', $championship->id)
                              ->where('user_id', $this->id)
                              ->whereIn('role_type', ['organizer', 'monitor', 'arbiter'])
                              ->exists();
    }
}
```

### Championship Model Updates

```php
// app/Models/Championship.php

class Championship extends Model {
    // ... existing code ...

    protected $fillable = [
        // ... existing ...
        'created_by',
        'organization_id',
        'visibility',
    ];

    // RELATIONSHIPS
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function organization()
    {
        return $this->belongsTo(Organization::class);
    }

    public function championshipRoles()
    {
        return $this->hasMany(ChampionshipRole::class);
    }

    public function organizers()
    {
        return $this->hasManyThrough(
            User::class,
            ChampionshipRole::class,
            'championship_id',
            'id',
            'id',
            'user_id'
        )->where('role_type', 'organizer');
    }

    public function monitors()
    {
        return $this->hasManyThrough(
            User::class,
            ChampionshipRole::class,
            'championship_id',
            'id',
            'id',
            'user_id'
        )->whereIn('role_type', ['monitor', 'arbiter']);
    }

    // AUTHORIZATION METHODS
    public function isOwnedBy(User $user)
    {
        return $this->created_by === $user->id;
    }

    public function canBeEditedBy(User $user)
    {
        return $user->hasRole('platform_admin') ||
               $user->hasRole('organization_admin') ||
               $this->isOwnedBy($user);
    }

    public function canBeDeletedBy(User $user)
    {
        // Can only delete if not started
        if ($this->status !== 'upcoming' && $this->status !== 'registration_open') {
            return false;
        }

        return $this->canBeEditedBy($user);
    }

    public function isAdministratedBy(User $user)
    {
        return $user->hasRole('platform_admin') ||
               $this->isOwnedBy($user) ||
               ChampionshipRole::where('championship_id', $this->id)
                              ->where('user_id', $user->id)
                              ->whereIn('role_type', ['organizer', 'monitor', 'arbiter'])
                              ->exists();
    }

    public function canBeAccessedBy(User $user)
    {
        if ($this->visibility === 'public') {
            return true;
        }

        if ($this->visibility === 'private') {
            return $this->isAdministratedBy($user) || 
                   $this->isUserRegistered($user->id);
        }

        if ($this->visibility === 'invite_only') {
            return $this->isAdministratedBy($user) || 
                   $this->isUserRegistered($user->id);
        }

        return false;
    }
}
```

### New Models

```php
// app/Models/Role.php
class Role extends Model {
    protected $fillable = ['code', 'name', 'description'];
    
    public function permissions()
    {
        return $this->belongsToMany(Permission::class, 'role_permissions');
    }
    
    public function users()
    {
        return $this->belongsToMany(User::class, 'user_roles')
                    ->withPivot('organization_id', 'granted_at');
    }
}

// app/Models/Permission.php
class Permission extends Model {
    protected $fillable = ['code', 'name', 'description', 'resource', 'action'];
    
    public function roles()
    {
        return $this->belongsToMany(Role::class, 'role_permissions');
    }
}

// app/Models/ChampionshipRole.php
class ChampionshipRole extends Model {
    protected $fillable = ['championship_id', 'user_id', 'role_type', 'assigned_by'];
    
    public function championship()
    {
        return $this->belongsTo(Championship::class);
    }
    
    public function user()
    {
        return $this->belongsTo(User::class);
    }
    
    public function assignedBy()
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }
}
```

---

## Authorization: Gates & Policies

### Register Gates (AuthServiceProvider)

```php
// app/Providers/AuthServiceProvider.php

public function boot(): void
{
    // CHAMPIONSHIP GATES
    Gate::define('create-championship', function (User $user) {
        return $user->hasAnyRole(['platform_admin', 'organization_admin', 'organizer']);
    });

    Gate::define('manage-tournament', function (User $user, Championship $championship) {
        return $user->hasRole('platform_admin') ||
               $championship->isOwnedBy($user) ||
               $championship->isAdministratedBy($user);
    });

    Gate::define('report-result', function (User $user, Championship $championship) {
        return $championship->isAdministratedBy($user);
    });

    Gate::define('process-refund', function (User $user, Championship $championship) {
        return $user->hasRole('platform_admin') ||
               $championship->isOwnedBy($user);
    });

    // ADMIN GATES
    Gate::define('manage-tournaments', function (User $user) {
        return $user->hasRole('platform_admin');
    });

    Gate::define('access-admin-dashboard', function (User $user) {
        return $user->hasRole('platform_admin');
    });
}
```

### ChampionshipPolicy

```php
// app/Policies/ChampionshipPolicy.php

class ChampionshipPolicy
{
    public function viewAny(User $user): bool
    {
        return true;  // Everyone can list (filtering done in controller)
    }

    public function view(User $user, Championship $championship): bool
    {
        return $championship->canBeAccessedBy($user);
    }

    public function create(User $user): bool
    {
        return $user->hasAnyRole(['platform_admin', 'organization_admin', 'organizer']);
    }

    public function update(User $user, Championship $championship): bool
    {
        return $championship->canBeEditedBy($user);
    }

    public function delete(User $user, Championship $championship): bool
    {
        return $championship->canBeDeletedBy($user);
    }

    public function manage(User $user, Championship $championship): bool
    {
        return $championship->isAdministratedBy($user) ||
               $user->hasRole('platform_admin');
    }

    public function reportResult(User $user, Championship $championship): bool
    {
        return $user->canReportResult($championship);
    }

    public function rescheduleMatch(User $user, Championship $championship): bool
    {
        return $user->canManageChampionship($championship);
    }
}
```

---

## Controller Updates

### ChampionshipController::store()

```php
public function store(Request $request): JsonResponse
{
    // CHECK PERMISSION
    $this->authorize('create', Championship::class);

    $validator = Validator::make($request->all(), [
        'title' => 'required|string|max:255',
        'description' => 'nullable|string|max:5000',
        'entry_fee' => 'required|numeric|min:0|max:10000',
        // ... existing validation ...
    ]);

    if ($validator->fails()) {
        return response()->json([
            'error' => 'Validation failed',
            'errors' => $validator->errors(),
        ], 422);
    }

    try {
        $validated = $validator->validated();
        
        // SET CREATOR
        $validated['created_by'] = auth()->id();
        
        // SET ORGANIZATION IF APPLICABLE
        $user = auth()->user();
        if ($user->hasRole('organization_admin')) {
            $validated['organization_id'] = $user->organization_id;
        }
        
        $championship = Championship::create($validated);
        
        // CREATE ORGANIZER ROLE RECORD
        ChampionshipRole::create([
            'championship_id' => $championship->id,
            'user_id' => auth()->id(),
            'role_type' => 'organizer',
            'assigned_by' => auth()->id(),
        ]);

        return response()->json([
            'status' => 'success',
            'championship' => $championship,
        ], 201);
    } catch (\Exception $e) {
        Log::error('Championship creation failed', ['error' => $e->getMessage()]);
        return response()->json([
            'error' => 'Failed to create championship',
            'message' => $e->getMessage(),
        ], 500);
    }
}
```

### ChampionshipController::update()

```php
public function update(Request $request, Championship $championship): JsonResponse
{
    // CHECK AUTHORIZATION
    $this->authorize('update', $championship);

    $validator = Validator::make($request->all(), [
        'title' => 'sometimes|required|string|max:255',
        'description' => 'sometimes|nullable|string|max:5000',
        // ... validation ...
    ]);

    if ($validator->fails()) {
        return response()->json([
            'error' => 'Validation failed',
            'errors' => $validator->errors(),
        ], 422);
    }

    try {
        $championship->update($validator->validated());

        return response()->json([
            'status' => 'success',
            'championship' => $championship,
        ]);
    } catch (\Exception $e) {
        Log::error('Championship update failed', ['error' => $e->getMessage()]);
        return response()->json([
            'error' => 'Failed to update championship',
        ], 500);
    }
}
```

### ChampionshipController::destroy()

```php
public function destroy(Championship $championship): JsonResponse
{
    // CHECK AUTHORIZATION
    $this->authorize('delete', $championship);

    try {
        $championship->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Championship deleted',
        ]);
    } catch (\Exception $e) {
        Log::error('Championship deletion failed', ['error' => $e->getMessage()]);
        return response()->json([
            'error' => 'Failed to delete championship',
        ], 500);
    }
}
```

---

## Route Authorization Fixes

### routes/api.php

```php
Route::prefix('championships')->middleware('auth:sanctum')->group(function () {
    // LIST - Anyone can view
    Route::get('/', [ChampionshipController::class, 'index']);

    // CREATE - Must have create-championship gate
    Route::post('/', [ChampionshipController::class, 'store'])
        ->can('create-championship');  // Uses Gate

    // SHOW - Public, but respects visibility
    Route::get('/{id}', [ChampionshipController::class, 'show']);

    // UPDATE - Policy-based (can:update,championship)
    Route::put('/{id}', [ChampionshipController::class, 'update'])
        ->can('update,championship');

    // DELETE - Policy-based
    Route::delete('/{id}', [ChampionshipController::class, 'destroy'])
        ->can('delete,championship');

    // ... other routes ...

    // ADMIN ROUTES
    Route::prefix('admin/tournaments')
        ->can('manage-tournaments')  // Fixed gate reference
        ->group(function () {
            Route::get('/overview', [TournamentAdminController::class, 'overview']);
            Route::post('/{championship}/start', [TournamentAdminController::class, 'startChampionship']);
            // ... more admin routes
        });
});
```

---

## Seeding Roles & Permissions

```php
// database/seeders/RolesAndPermissionsSeeder.php

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        // CREATE ROLES
        $admin = Role::create([
            'code' => 'platform_admin',
            'name' => 'Platform Administrator',
            'description' => 'Full platform access',
        ]);

        $org_admin = Role::create([
            'code' => 'organization_admin',
            'name' => 'Organization Administrator',
            'description' => 'Manage organization and its tournaments',
        ]);

        $organizer = Role::create([
            'code' => 'organizer',
            'name' => 'Tournament Organizer',
            'description' => 'Create and manage tournaments',
        ]);

        $monitor = Role::create([
            'code' => 'monitor',
            'name' => 'Monitor/Arbiter',
            'description' => 'Monitor matches and report results',
        ]);

        $player = Role::create([
            'code' => 'player',
            'name' => 'Player',
            'description' => 'Participate in tournaments',
        ]);

        // CREATE PERMISSIONS
        $permissions = [
            ['code' => 'create_championship', 'name' => 'Create Championship', 'resource' => 'championship', 'action' => 'create'],
            ['code' => 'manage_championship', 'name' => 'Manage Championship', 'resource' => 'championship', 'action' => 'update'],
            ['code' => 'report_result', 'name' => 'Report Match Result', 'resource' => 'match', 'action' => 'report'],
            ['code' => 'process_refund', 'name' => 'Process Refund', 'resource' => 'payment', 'action' => 'refund'],
            ['code' => 'view_analytics', 'name' => 'View Analytics', 'resource' => 'system', 'action' => 'read'],
            // ... more permissions ...
        ];

        foreach ($permissions as $perm) {
            Permission::create($perm);
        }

        // ASSIGN PERMISSIONS TO ROLES
        $admin->permissions()->sync(
            Permission::whereIn('code', [
                'create_championship', 'manage_championship', 'report_result',
                'process_refund', 'view_analytics'
            ])->pluck('id')
        );

        $organizer->permissions()->sync(
            Permission::whereIn('code', [
                'create_championship', 'manage_championship', 'report_result', 'process_refund'
            ])->pluck('id')
        );

        $monitor->permissions()->sync(
            Permission::whereIn('code', ['report_result'])->pluck('id')
        );
    }
}
```

---

## Testing Authorization

```php
// tests/Feature/AuthorizationTest.php

class AuthorizationTest extends TestCase
{
    public function test_only_organizer_can_create_championship()
    {
        $player = User::factory()->create();
        $player->roles()->attach(Role::where('code', 'player')->first());

        $this->actingAs($player)
            ->postJson('/api/championships', [
                'title' => 'Test Championship',
                'entry_fee' => 10,
                'registration_deadline' => now()->addDays(7),
                'start_date' => now()->addDays(14),
                'match_time_window_hours' => 24,
            ])
            ->assertForbidden();
    }

    public function test_organizer_cannot_edit_others_championship()
    {
        $org1 = User::factory()->create();
        $org2 = User::factory()->create();
        $org1->roles()->attach(Role::where('code', 'organizer')->first());
        $org2->roles()->attach(Role::where('code', 'organizer')->first());

        $championship = Championship::factory()->create(['created_by' => $org1->id]);

        $this->actingAs($org2)
            ->putJson("/api/championships/{$championship->id}", [
                'title' => 'Updated Title'
            ])
            ->assertForbidden();
    }

    public function test_organizer_can_edit_own_championship()
    {
        $organizer = User::factory()->create();
        $organizer->roles()->attach(Role::where('code', 'organizer')->first());

        $championship = Championship::factory()->create(['created_by' => $organizer->id]);

        $this->actingAs($organizer)
            ->putJson("/api/championships/{$championship->id}", [
                'title' => 'Updated Title'
            ])
            ->assertSuccessful();
    }
}
```

---

## Quick Checklist

- [ ] Create roles/permissions database tables
- [ ] Add created_by to championships
- [ ] Create championship_roles table
- [ ] Create Role, Permission, ChampionshipRole models
- [ ] Update User model with role methods
- [ ] Update Championship model with authorization methods
- [ ] Register gates in AuthServiceProvider
- [ ] Create ChampionshipPolicy
- [ ] Update all controller methods with authorization checks
- [ ] Fix route middleware references
- [ ] Seed roles and permissions
- [ ] Write authorization tests
- [ ] Test ownership validation
- [ ] Test role-based access control

