<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Role extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'display_name',
        'description',
        'hierarchy_level',
        'is_system_role',
    ];

    protected $casts = [
        'hierarchy_level' => 'integer',
        'is_system_role' => 'boolean',
    ];

    /**
     * The permissions that belong to this role
     */
    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class, 'role_permissions')
                    ->withTimestamps();
    }

    /**
     * The users that have this role
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_roles')
                    ->withPivot('assigned_by', 'assigned_at')
                    ->withTimestamps();
    }

    /**
     * Check if this role has a specific permission
     */
    public function hasPermission(string $permissionName): bool
    {
        return $this->permissions()
                    ->where('name', $permissionName)
                    ->exists();
    }

    /**
     * Check if this role has any of the given permissions
     */
    public function hasAnyPermission(array $permissionNames): bool
    {
        return $this->permissions()
                    ->whereIn('name', $permissionNames)
                    ->exists();
    }

    /**
     * Check if this role has all of the given permissions
     */
    public function hasAllPermissions(array $permissionNames): bool
    {
        $count = $this->permissions()
                      ->whereIn('name', $permissionNames)
                      ->count();

        return $count === count($permissionNames);
    }

    /**
     * Assign permission to this role
     */
    public function assignPermission(Permission|string $permission): self
    {
        if (is_string($permission)) {
            $permission = Permission::where('name', $permission)->firstOrFail();
        }

        $this->permissions()->syncWithoutDetaching([$permission->id]);

        return $this;
    }

    /**
     * Remove permission from this role
     */
    public function removePermission(Permission|string $permission): self
    {
        if (is_string($permission)) {
            $permission = Permission::where('name', $permission)->firstOrFail();
        }

        $this->permissions()->detach($permission->id);

        return $this;
    }

    /**
     * Check if this role is higher in hierarchy than another role
     */
    public function isHigherThan(Role $role): bool
    {
        return $this->hierarchy_level > $role->hierarchy_level;
    }

    /**
     * Check if this role is lower in hierarchy than another role
     */
    public function isLowerThan(Role $role): bool
    {
        return $this->hierarchy_level < $role->hierarchy_level;
    }
}
