<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TutorialAchievement extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'icon',
        'tier',
        'requirement_type',
        'requirement_value',
        'xp_reward',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'requirement_value' => 'integer',
        'xp_reward' => 'integer',
    ];

    /**
     * Get users who have earned this achievement
     */
    public function userAchievements(): HasMany
    {
        return $this->hasMany(UserAchievement::class, 'achievement_id');
    }

    /**
     * Get users who have earned this achievement
     */
    public function users(): HasMany
    {
        return $this->hasManyThrough(
            User::class,
            UserAchievement::class,
            'achievement_id',
            'id',
            'id',
            'user_id'
        );
    }

    /**
     * Get tier color class
     */
    public function getTierColorClassAttribute(): string
    {
        return match($this->tier) {
            'bronze' => 'text-amber-600 bg-amber-100',
            'silver' => 'text-gray-600 bg-gray-100',
            'gold' => 'text-yellow-600 bg-yellow-100',
            'platinum' => 'text-purple-600 bg-purple-100',
            default => 'text-gray-600 bg-gray-100',
        };
    }

    /**
     * Get tier icon
     */
    public function getTierIconAttribute(): string
    {
        return match($this->tier) {
            'bronze' => '🥉',
            'silver' => '🥈',
            'gold' => '🥇',
            'platinum' => '💎',
            default => '🏅',
        };
    }

    /**
     * Check if user has earned this achievement
     */
    public function isEarnedBy($userId): bool
    {
        return $this->userAchievements()->where('user_id', $userId)->exists();
    }

    /**
     * Scope to get only active achievements
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to get achievements by tier
     */
    public function scopeByTier($query, $tier)
    {
        return $query->where('tier', $tier);
    }

    /**
     * Scope to get achievements by requirement type
     */
    public function scopeByRequirementType($query, $type)
    {
        return $query->where('requirement_type', $type);
    }

    /**
     * Get requirement description
     */
    public function getRequirementDescriptionAttribute(): string
    {
        return match($this->requirement_type) {
            'lessons_completed' => "Complete {$this->requirement_value} lessons",
            'streak' => "Maintain a {$this->requirement_value}-day streak",
            'score' => "Achieve a score of {$this->requirement_value}%",
            'speed' => "Complete a lesson in {$this->requirement_value} seconds",
            'special' => $this->description,
            default => 'Unknown requirement',
        };
    }

    /**
     * Check progress towards this achievement for a user
     */
    public function getProgressForUser($userId): array
    {
        $user = User::find($userId);

        return match($this->requirement_type) {
            'lessons_completed' => [
                'current' => $user->tutorialProgress()->completed()->count(),
                'required' => $this->requirement_value,
                'percentage' => min(100, ($user->tutorialProgress()->completed()->count() / $this->requirement_value) * 100),
            ],
            'streak' => [
                'current' => $user->current_streak_days,
                'required' => $this->requirement_value,
                'percentage' => min(100, ($user->current_streak_days / $this->requirement_value) * 100),
            ],
            'score' => [
                'current' => $user->tutorialProgress()->max('best_score'),
                'required' => $this->requirement_value,
                'percentage' => min(100, ($user->tutorialProgress()->max('best_score') / $this->requirement_value) * 100),
            ],
            'speed' => [
                'current' => $user->tutorialProgress()->min('time_spent_seconds') ?? 0,
                'required' => $this->requirement_value,
                'percentage' => $this->requirement_value > 0 ?
                    min(100, (($this->requirement_value - max(0, ($user->tutorialProgress()->min('time_spent_seconds') ?? $this->requirement_value))) / $this->requirement_value) * 100) : 0,
            ],
            'special' => [
                'current' => $this->isEarnedBy($userId) ? 1 : 0,
                'required' => 1,
                'percentage' => $this->isEarnedBy($userId) ? 100 : 0,
            ],
            default => [
                'current' => 0,
                'required' => $this->requirement_value,
                'percentage' => 0,
            ],
        };
    }
}