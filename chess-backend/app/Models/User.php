<?php

namespace App\Models;

use App\Enums\SubscriptionTier;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements MustVerifyEmail
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
        'last_activity_at',
        'tutorial_xp',
        'tutorial_level',
        'current_skill_tier',
        'current_streak_days',
        'longest_streak_days',
        'last_activity_date',
        'email_notifications_enabled',
        'email_preferences',
        'email_unsubscribed_at',
        'last_email_sent_at',
        'subscription_tier',
        'subscription_expires_at',
        'razorpay_subscription_id',
        'razorpay_customer_id',
        'subscription_auto_renew',
        'profile_completed',
        'birthday',
        'class_of_study',
        'board_theme',
        'role',
        'reset_token',
        'reset_token_expires_at',
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
        'last_activity_at' => 'datetime',
        'last_activity_date' => 'date',
        'email_notifications_enabled' => 'boolean',
        'email_preferences' => 'array',
        'email_unsubscribed_at' => 'datetime',
        'last_email_sent_at' => 'datetime',
        'subscription_expires_at' => 'datetime',
        'subscription_auto_renew' => 'boolean',
        'profile_completed' => 'boolean',
        'reset_token_expires_at' => 'datetime',
        'birthday' => 'date',
        'class_of_study' => 'integer',
    ];

    /**
     * Check if user wants a specific email type.
     */
    public function wantsEmailType(string $type): bool
    {
        if (!$this->email_notifications_enabled) {
            return false;
        }

        if ($this->email_unsubscribed_at) {
            return false;
        }

        $preferences = $this->email_preferences ?? [];

        return $preferences[$type] ?? true;
    }

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

    // -------------------------------------------------------------------------
    // SUBSCRIPTION SYSTEM RELATIONSHIPS AND METHODS
    // -------------------------------------------------------------------------

    /**
     * Get user's subscription payments
     */
    public function subscriptionPayments()
    {
        return $this->hasMany(SubscriptionPayment::class);
    }

    /**
     * Get the user's current subscription tier as enum
     */
    public function getSubscriptionTierEnum(): SubscriptionTier
    {
        return SubscriptionTier::from($this->subscription_tier ?? 'free');
    }

    /**
     * Check if user has an active (non-expired) paid subscription
     */
    public function hasActiveSubscription(): bool
    {
        if ($this->subscription_tier === 'free' || !$this->subscription_tier) {
            return false;
        }

        // If no expiry set, subscription is not active
        if (!$this->subscription_expires_at) {
            return false;
        }

        // Active if expiry is in the future (with 3-day grace period)
        return $this->subscription_expires_at->addDays(3)->isFuture();
    }

    /**
     * Check if user has at least the given subscription tier
     */
    public function hasSubscriptionTier(string|SubscriptionTier $tier): bool
    {
        if ($tier instanceof SubscriptionTier) {
            $requiredTier = $tier;
        } else {
            $requiredTier = SubscriptionTier::from($tier);
        }

        // Free tier is always accessible
        if ($requiredTier === SubscriptionTier::FREE) {
            return true;
        }

        // Must have active subscription for paid tiers
        if (!$this->hasActiveSubscription()) {
            return false;
        }

        return $this->getSubscriptionTierEnum()->isAtLeast($requiredTier);
    }

    /**
     * Get days remaining on subscription
     */
    public function subscriptionDaysRemaining(): int
    {
        if (!$this->subscription_expires_at) {
            return 0;
        }

        $days = now()->diffInDays($this->subscription_expires_at, false);

        return max(0, (int) $days);
    }

    /**
     * Activate a subscription for this user
     */
    public function activateSubscription(SubscriptionPlan $plan, ?string $razorpaySubscriptionId = null): void
    {
        $expiresAt = match($plan->interval) {
            'monthly' => now()->addMonth(),
            'yearly' => now()->addYear(),
            'lifetime' => now()->addYears(100),
            default => now()->addMonth(),
        };

        $this->update([
            'subscription_tier' => $plan->tier,
            'subscription_expires_at' => $expiresAt,
            'razorpay_subscription_id' => $razorpaySubscriptionId ?? $this->razorpay_subscription_id,
            'subscription_auto_renew' => true,
        ]);
    }

    /**
     * Extend subscription expiry (for renewals)
     */
    public function extendSubscription(string $interval): void
    {
        $baseDate = $this->subscription_expires_at && $this->subscription_expires_at->isFuture()
            ? $this->subscription_expires_at
            : now();

        $newExpiry = match($interval) {
            'monthly' => $baseDate->copy()->addMonth(),
            'yearly' => $baseDate->copy()->addYear(),
            default => $baseDate->copy()->addMonth(),
        };

        $this->update([
            'subscription_expires_at' => $newExpiry,
        ]);
    }

    /**
     * Downgrade user to free tier
     */
    public function downgradeToFree(): void
    {
        $this->update([
            'subscription_tier' => 'free',
            'subscription_expires_at' => null,
            'razorpay_subscription_id' => null,
            'subscription_auto_renew' => false,
        ]);
    }

    // -------------------------------------------------------------------------
    // TUTORIAL SYSTEM RELATIONSHIPS AND METHODS
    // -------------------------------------------------------------------------

    /**
     * Get user's tutorial progress
     */
    public function tutorialProgress()
    {
        return $this->hasMany(UserTutorialProgress::class, 'user_id');
    }

    /**
     * Get user's skill assessments
     */
    public function skillAssessments()
    {
        return $this->hasMany(UserSkillAssessment::class, 'user_id');
    }

    /**
     * Get user's achievements
     */
    public function userAchievements()
    {
        return $this->hasMany(UserAchievement::class, 'user_id');
    }

    /**
     * Get user's earned achievements
     */
    public function achievements()
    {
        return $this->belongsToMany(TutorialAchievement::class, 'user_achievements')
                    ->withPivot('earned_at')
                    ->withTimestamps();
    }

    /**
     * Get user's practice games
     */
    public function tutorialPracticeGames()
    {
        return $this->hasMany(TutorialPracticeGame::class, 'user_id');
    }

    /**
     * Get user's daily challenge completions
     */
    public function dailyChallengeCompletions()
    {
        return $this->hasMany(UserDailyChallengeCompletion::class, 'user_id');
    }

    /**
     * Award tutorial XP to user
     */
    public function awardTutorialXp($xpAmount, $reason = null): void
    {
        $this->increment('tutorial_xp', $xpAmount);
        $this->updateLevelIfNeeded();

        // Log XP award for debugging/analytics
        if ($reason) {
            \Log::info("User {$this->id} earned {$xpAmount} XP: {$reason}");
        }
    }

    /**
     * Update tutorial level based on XP
     */
    public function updateLevelIfNeeded(): void
    {
        $currentLevel = $this->tutorial_level;
        $newLevel = $this->calculateLevelFromXp($this->tutorial_xp);

        if ($newLevel > $currentLevel) {
            $this->update([
                'tutorial_level' => $newLevel,
            ]);

            // Check for level-based achievements
            $this->checkLevelAchievements($newLevel);
        }
    }

    /**
     * Check and award level-based achievements
     */
    public function checkLevelAchievements(int $level): void
    {
        // Define level-based achievements
        $levelAchievements = [
            5 => 'level_5_reached',
            10 => 'level_10_reached',
            15 => 'level_15_reached',
            20 => 'level_20_reached',
            25 => 'level_25_reached',
            30 => 'level_30_reached',
        ];

        // Check if this level has an achievement
        if (isset($levelAchievements[$level])) {
            $achievementCode = $levelAchievements[$level];
            $achievement = TutorialAchievement::where('code', $achievementCode)->first();

            if ($achievement) {
                // Award the achievement if not already earned
                $existing = $this->userAchievements()
                    ->where('achievement_id', $achievement->id)
                    ->exists();

                if (!$existing) {
                    $this->userAchievements()->create([
                        'achievement_id' => $achievement->id,
                        'earned_at' => now(),
                    ]);

                    \Log::info("User {$this->id} earned achievement: {$achievement->title}");
                }
            }
        }
    }

    /**
     * Calculate tutorial level from XP
     */
    public function calculateLevelFromXp($xp): int
    {
        // Formula: XP for level n = 100 * (1.5)^(n-1)
        $level = 1;
        $xpForLevel = 100;

        while ($xp >= $xpForLevel) {
            $level++;
            $xpForLevel = floor(100 * pow(1.5, $level - 1));
        }

        return $level;
    }

    /**
     * Get XP needed for next level
     */
    public function getXpForNextLevelAttribute(): int
    {
        $nextLevel = $this->tutorial_level + 1;
        return floor(100 * pow(1.5, $nextLevel - 1));
    }

    /**
     * Get XP progress towards next level
     */
    public function getXpProgressAttribute(): array
    {
        $currentLevel = $this->tutorial_level;
        $currentXp = $this->tutorial_xp;

        $xpForCurrentLevel = $currentLevel === 1 ? 0 : floor(100 * pow(1.5, $currentLevel - 2));
        $xpForNextLevel = floor(100 * pow(1.5, $currentLevel - 1));

        $xpNeeded = $xpForNextLevel - $xpForCurrentLevel;
        $xpEarned = $currentXp - $xpForCurrentLevel;
        $percentage = min(100, ($xpEarned / $xpNeeded) * 100);

        return [
            'current_xp' => $currentXp,
            'xp_needed' => $xpNeeded,
            'xp_earned' => $xpEarned,
            'percentage' => round($percentage, 2),
        ];
    }

    /**
     * Award achievement to user
     */
    public function awardAchievement($achievementId): bool
    {
        if ($this->userAchievements()->where('achievement_id', $achievementId)->exists()) {
            return false; // Already earned
        }

        $achievement = TutorialAchievement::find($achievementId);
        if (!$achievement) {
            return false;
        }

        $this->userAchievements()->create([
            'achievement_id' => $achievementId,
            'earned_at' => now(),
        ]);

        // Award achievement XP
        $this->awardTutorialXp($achievement->xp_reward, "Achievement: {$achievement->name}");

        return true;
    }


    /**
     * Update user's skill tier based on assessments
     */
    public function updateSkillTier(): void
    {
        $latestAssessment = $this->skillAssessments()
            ->where('score', '>=', 70)
            ->orderByDesc('completed_at')
            ->first();

        if ($latestAssessment && $latestAssessment->canUnlockNextTier()) {
            $this->update(['current_skill_tier' => $latestAssessment->next_tier]);
        }
    }

    /**
     * Update daily streak
     */
    public function updateDailyStreak(): void
    {
        $today = now()->format('Y-m-d');
        $lastActivity = $this->last_activity_date;

        if ($lastActivity) {
            $lastActivityDate = $lastActivity->format('Y-m-d');
            $yesterday = now()->subDay()->format('Y-m-d');

            if ($lastActivityDate === $today) {
                return; // Already updated today
            } elseif ($lastActivityDate === $yesterday) {
                // Continue streak
                $newStreak = $this->current_streak_days + 1;
                $longestStreak = max($this->longest_streak_days, $newStreak);
            } else {
                // Streak broken
                $newStreak = 1;
                $longestStreak = $this->longest_streak_days;
            }
        } else {
            // First activity
            $newStreak = 1;
            $longestStreak = 1;
        }

        $this->update([
            'current_streak_days' => $newStreak,
            'longest_streak_days' => $longestStreak,
            'last_activity_date' => $today,
        ]);
    }

    /**
     * Get current daily streak from challenge completions
     */
    public function getCurrentDailyStreak(): int
    {
        $streak = 0;
        $currentDate = now();

        for ($i = 0; $i < 365; $i++) { // Check up to a year
            $dateStr = $currentDate->format('Y-m-d');

            $hasCompletedChallenge = $this->dailyChallengeCompletions()
                ->whereHas('challenge', function ($query) use ($dateStr) {
                    $query->where('date', $dateStr);
                })
                ->where('completed', true)
                ->exists();

            if ($hasCompletedChallenge) {
                $streak++;
                $currentDate->subDay();
            } else {
                break;
            }
        }

        return $streak;
    }

    /**
     * Get tutorial progress statistics
     */
    public function getTutorialStatsAttribute(): array
    {
        $totalLessons = TutorialLesson::active()->count();
        $completedLessons = $this->tutorialProgress()->completed()->count();
        $masteredLessons = $this->tutorialProgress()->mastered()->count();

        $totalModules = TutorialModule::active()->count();
        $completedModules = TutorialModule::active()
            ->whereHas('activeLessons.userProgress', function ($query) {
                $query->where('user_id', $this->id)
                      ->where('status', 'completed');
            })
            ->count();

        $averageScore = $this->tutorialProgress()
            ->where('best_score', '>', 0)
            ->avg('best_score') ?? 0;

        $totalTimeSpent = $this->tutorialProgress()->sum('time_spent_seconds');
        $achievementsCount = $this->userAchievements()->count();

        // Calculate earned XP from completed lessons only (excluding mastery bonuses)
        $earnedXp = $this->tutorialProgress()
            ->completed()
            ->with('lesson')
            ->get()
            ->sum(function ($progress) {
                return $progress->lesson->xp_reward ?? 0;
            });

        return [
            'total_lessons' => $totalLessons,
            'completed_lessons' => $completedLessons,
            'mastered_lessons' => $masteredLessons,
            'completion_percentage' => $totalLessons > 0 ? round(($completedLessons / $totalLessons) * 100, 2) : 0,
            'total_modules' => $totalModules,
            'completed_modules' => $completedModules,
            'average_score' => round($averageScore, 2),
            'total_time_spent' => $totalTimeSpent,
            'formatted_time_spent' => $this->formatTimeSpent($totalTimeSpent),
            'achievements_count' => $achievementsCount,
            'current_streak' => $this->current_streak_days,
            'xp' => $this->tutorial_xp,
            'earned_xp' => $earnedXp,
            'level' => $this->tutorial_level,
            'skill_tier' => $this->current_skill_tier,
        ];
    }

    /**
     * Format time spent in human readable format
     */
    private function formatTimeSpent($seconds): string
    {
        $hours = floor($seconds / 3600);
        $minutes = floor(($seconds % 3600) / 60);

        if ($hours > 0) {
            return $minutes > 0 ? "{$hours}h {$minutes}m" : "{$hours}h";
        }

        return "{$minutes}m";
    }

    /**
     * Check if user has access to specific skill tier content
     */
    public function hasAccessToTier($tier): bool
    {
        $tierLevels = [
            'beginner' => 0,
            'intermediate' => 1,
            'advanced' => 2,
        ];

        $userTierLevel = $tierLevels[$this->current_skill_tier] ?? 0;
        $requestedTierLevel = $tierLevels[$tier] ?? 0;

        return $userTierLevel >= $requestedTierLevel;
    }

    /**
     * Get suggested AI difficulty based on skill tier
     */
    public function getSuggestedAiDifficulty(): string
    {
        return match($this->current_skill_tier) {
            'beginner' => 'easy',
            'intermediate' => 'medium',
            'advanced' => 'hard',
            default => 'easy',
        };
    }
}
