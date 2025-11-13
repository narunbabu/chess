<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'provider',
        'provider_id',
        'provider_token',
        'avatar_url',
        'rating',
        'is_provisional',
        'games_played',
        'peak_rating',
        'rating_last_updated',
        'organization_id',
        'is_active',
        'last_login_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'provider_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'is_provisional' => 'boolean',
        'rating_last_updated' => 'datetime',
        'is_active' => 'boolean',
        'last_login_at' => 'datetime',
    ];

    /**
     * Get the avatar URL with fallback
     * Ensures backward compatibility and provides a default avatar
     */
    public function getAvatarUrlAttribute($value)
    {
        // If avatar_url is set
        if ($value) {
            // Check if it's a local storage path (e.g., 'avatars/123_1234567890.jpg')
            if (str_starts_with($value, 'avatars/')) {
                // Return full URL to storage
                return asset('storage/' . $value);
            }
            // Otherwise, return as-is (for external URLs or backward compatibility)
            return $value;
        }

        // Fallback to a dynamic avatar based on email or ID
        if ($this->email) {
            return 'https://i.pravatar.cc/150?u=' . urlencode($this->email);
        }

        // Final fallback using user ID if email is not available
        return 'https://i.pravatar.cc/150?u=user' . $this->id;
    }

    /**
     * Get avatar attribute for backward compatibility
     * Some frontend components might still use 'avatar'
     */
    public function getAvatarAttribute()
    {
        return $this->avatar_url;
    }

    /**
     * Calculate K-factor for Elo rating calculation
     * Higher K-factor means faster rating changes
     *
     * @return int K-factor value
     */
    public function getKFactorAttribute()
    {
        // Provisional period: first 20 games use high K-factor for fast convergence
        if ($this->is_provisional || $this->games_played < 20) {
            return 64;
        }

        // Established players: K-factor based on rating level
        if ($this->rating >= 2400) {
            return 10; // Expert/Master level: very stable ratings
        } elseif ($this->rating >= 2000) {
            return 16; // Strong players: moderately stable
        } else {
            return 32; // Active players: normal adjustment
        }
    }

    /**
     * Update user rating after a game
     *
     * @param int $opponentRating Opponent's rating
     * @param float $actualScore Player's score (1.0 = win, 0.5 = draw, 0.0 = loss)
     * @return array Updated rating data
     */
    public function updateRating($opponentRating, $actualScore)
    {
        // Calculate expected score using Elo formula
        $expectedScore = 1 / (1 + pow(10, ($opponentRating - $this->rating) / 400));

        // Calculate rating change
        $ratingChange = $this->k_factor * ($actualScore - $expectedScore);

        // Update rating
        $oldRating = $this->rating;
        $newRating = round($oldRating + $ratingChange);

        // Update peak rating if new high
        $newPeakRating = max($this->peak_rating, $newRating);

        // Increment games played
        $newGamesPlayed = $this->games_played + 1;

        // Exit provisional period after 20 games
        $isProvisional = $newGamesPlayed < 20;

        // Update model
        $this->update([
            'rating' => $newRating,
            'games_played' => $newGamesPlayed,
            'peak_rating' => $newPeakRating,
            'is_provisional' => $isProvisional,
            'rating_last_updated' => now(),
        ]);

        return [
            'old_rating' => $oldRating,
            'new_rating' => $newRating,
            'rating_change' => round($ratingChange),
            'expected_score' => round($expectedScore, 3),
            'k_factor' => $this->k_factor,
            'is_provisional' => $isProvisional,
        ];
    }

    /**
     * Friends relationship - many-to-many
     */
    public function friends()
    {
        return $this->belongsToMany(User::class, 'user_friends', 'user_id', 'friend_id')
                    ->withPivot('status')
                    ->withTimestamps()
                    ->wherePivot('status', 'accepted')
                    ->select('users.id', 'users.name', 'users.avatar_url', 'users.rating');
    }

    /**
     * Pending friend requests sent by this user
     */
    public function sentFriendRequests()
    {
        return $this->belongsToMany(User::class, 'user_friends', 'user_id', 'friend_id')
                    ->withPivot('status')
                    ->withTimestamps()
                    ->wherePivot('status', 'pending')
                    ->select('users.id', 'users.name', 'users.avatar_url', 'users.rating');
    }

    /**
     * Pending friend requests received by this user
     */
    public function receivedFriendRequests()
    {
        return $this->belongsToMany(User::class, 'user_friends', 'friend_id', 'user_id')
                    ->withPivot('status')
                    ->withTimestamps()
                    ->wherePivot('status', 'pending')
                    ->select('users.id', 'users.name', 'users.avatar_url', 'users.rating');
    }

    /**
     * The roles that belong to this user
     */
    public function roles()
    {
        return $this->belongsToMany(Role::class, 'user_roles')
                    ->withPivot('assigned_by', 'assigned_at')
                    ->withTimestamps();
    }

    /**
     * The organization this user belongs to
     */
    public function organization()
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * Championships created by this user
     */
    public function createdChampionships()
    {
        return $this->hasMany(Championship::class, 'created_by');
    }

    /**
     * Check if user has a specific role
     */
    public function hasRole(string|array $roles): bool
    {
        if (is_array($roles)) {
            return $this->roles()->whereIn('name', $roles)->exists();
        }

        return $this->roles()->where('name', $roles)->exists();
    }

    /**
     * Check if user has any of the given roles
     */
    public function hasAnyRole(array $roles): bool
    {
        return $this->roles()->whereIn('name', $roles)->exists();
    }

    /**
     * Check if user has all of the given roles
     */
    public function hasAllRoles(array $roles): bool
    {
        $userRoles = $this->roles()->pluck('name')->toArray();
        return count(array_intersect($roles, $userRoles)) === count($roles);
    }

    /**
     * Check if user has a specific permission
     */
    public function hasPermission(string $permissionName): bool
    {
        return $this->roles()
                    ->whereHas('permissions', function ($query) use ($permissionName) {
                        $query->where('name', $permissionName);
                    })
                    ->exists();
    }

    /**
     * Check if user has any of the given permissions
     */
    public function hasAnyPermission(array $permissionNames): bool
    {
        return $this->roles()
                    ->whereHas('permissions', function ($query) use ($permissionNames) {
                        $query->whereIn('name', $permissionNames);
                    })
                    ->exists();
    }

    /**
     * Check if user has all of the given permissions
     */
    public function hasAllPermissions(array $permissionNames): bool
    {
        foreach ($permissionNames as $permission) {
            if (!$this->hasPermission($permission)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Assign role to user
     */
    public function assignRole(Role|string $role, ?int $assignedBy = null): self
    {
        if (is_string($role)) {
            $role = Role::where('name', $role)->firstOrFail();
        }

        $this->roles()->syncWithoutDetaching([
            $role->id => [
                'assigned_by' => $assignedBy,
                'assigned_at' => now(),
            ]
        ]);

        return $this;
    }

    /**
     * Remove role from user
     */
    public function removeRole(Role|string $role): self
    {
        if (is_string($role)) {
            $role = Role::where('name', $role)->firstOrFail();
        }

        $this->roles()->detach($role->id);

        return $this;
    }

    /**
     * Sync user roles (replace all roles with given ones)
     */
    public function syncRoles(array $roles, ?int $assignedBy = null): self
    {
        $roleIds = [];

        foreach ($roles as $role) {
            if (is_string($role)) {
                $roleModel = Role::where('name', $role)->firstOrFail();
                $roleIds[$roleModel->id] = [
                    'assigned_by' => $assignedBy,
                    'assigned_at' => now(),
                ];
            } else {
                $roleIds[$role->id] = [
                    'assigned_by' => $assignedBy,
                    'assigned_at' => now(),
                ];
            }
        }

        $this->roles()->sync($roleIds);

        return $this;
    }

    /**
     * Check if user can manage a championship
     */
    public function canManageChampionship(Championship $championship): bool
    {
        // Platform admins can manage everything
        if ($this->hasRole('platform_admin')) {
            return true;
        }

        // Championship creator can manage their own
        if ($championship->created_by === $this->id) {
            return true;
        }

        // Organization admins can manage org championships
        if ($this->hasRole('organization_admin') &&
            $championship->organization_id === $this->organization_id) {
            return true;
        }

        return false;
    }

    /**
     * Check if user is a platform admin
     */
    public function isPlatformAdmin(): bool
    {
        return $this->hasRole('platform_admin');
    }

    /**
     * Check if user is an organization admin
     */
    public function isOrganizationAdmin(): bool
    {
        return $this->hasRole('organization_admin');
    }

    /**
     * Check if user is a tournament organizer
     */
    public function isTournamentOrganizer(): bool
    {
        return $this->hasRole('tournament_organizer');
    }

    /**
     * Get highest role by hierarchy
     */
    public function getHighestRole(): ?Role
    {
        return $this->roles()
                    ->orderByDesc('hierarchy_level')
                    ->first();
    }
}
