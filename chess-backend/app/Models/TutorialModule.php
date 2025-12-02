<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TutorialModule extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'skill_tier',
        'description',
        'icon',
        'sort_order',
        'unlock_requirement_id',
        'estimated_duration_minutes',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'estimated_duration_minutes' => 'integer',
        'sort_order' => 'integer',
    ];

    protected $appends = [
        'total_xp',
        'formatted_duration',
    ];

    /**
     * Get the lessons for this module
     */
    public function lessons(): HasMany
    {
        return $this->hasMany(TutorialLesson::class, 'module_id')
                    ->orderBy('sort_order');
    }

    /**
     * Get the active lessons for this module
     */
    public function activeLessons(): HasMany
    {
        return $this->hasMany(TutorialLesson::class, 'module_id')
                    ->where('is_active', true)
                    ->orderBy('sort_order');
    }

    /**
     * Get the unlock requirement module
     */
    public function unlockRequirement(): BelongsTo
    {
        return $this->belongsTo(TutorialModule::class, 'unlock_requirement_id');
    }

    /**
     * Get modules that depend on this one
     */
    public function dependentModules(): HasMany
    {
        return $this->hasMany(TutorialModule::class, 'unlock_requirement_id');
    }

    /**
     * Get user progress for this module
     * Optimized with eager loading to prevent N+1 queries
     */
    public function getUserProgress($userId): array
    {
        // Single eager-loaded query to get all lessons with user progress
        $lessons = $this->activeLessons()
            ->with(['userProgress' => function ($query) use ($userId) {
                $query->where('user_id', $userId);
            }])
            ->get();

        $totalLessons = $lessons->count();
        $earnedXp = 0;
        $totalScore = 0;
        $lessonsWithScores = 0;

        // Count completed lessons and calculate XP/scores using the already-loaded data
        $completedLessons = $lessons->filter(function ($lesson) use (&$earnedXp, &$totalScore, &$lessonsWithScores) {
            $progress = $lesson->userProgress->first();
            $isCompleted = $progress && in_array($progress->status, ['completed', 'mastered']);

            if ($isCompleted) {
                $earnedXp += $lesson->xp_reward ?? 0;

                // Add score if available
                if ($progress->best_score !== null && $progress->best_score > 0) {
                    $totalScore += $progress->best_score;
                    $lessonsWithScores++;
                }
            }

            return $isCompleted;
        })->count();

        $percentage = $totalLessons > 0 ? ($completedLessons / $totalLessons) * 100 : 0;
        $averageScore = $lessonsWithScores > 0 ? round($totalScore / $lessonsWithScores, 2) : null;

        return [
            'total_lessons' => $totalLessons,
            'completed_lessons' => $completedLessons,
            'percentage' => round($percentage, 2),
            'is_completed' => $completedLessons === $totalLessons && $totalLessons > 0,
            'earned_xp' => $earnedXp,
            'average_score' => $averageScore,
        ];
    }

    /**
     * Check if module is unlocked for a user
     */
    public function isUnlockedFor($userId): bool
    {
        if (!$this->unlock_requirement_id) {
            return true; // First module is always unlocked
        }

        $requirementModule = $this->unlockRequirement;
        if (!$requirementModule) {
            return true; // No requirement means unlocked
        }

        return $requirementModule->getUserProgress($userId)['is_completed'];
    }

    /**
     * Scope to get only active modules
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to get modules by skill tier
     */
    public function scopeByTier($query, $tier)
    {
        return $query->where('skill_tier', $tier);
    }

    /**
     * Get total XP possible from this module
     */
    public function getTotalXpAttribute(): int
    {
        return $this->activeLessons()->sum('xp_reward');
    }

    /**
     * Get estimated duration in human readable format
     */
    public function getFormattedDurationAttribute(): string
    {
        $minutes = $this->estimated_duration_minutes;

        if ($minutes < 60) {
            return "{$minutes}min";
        }

        $hours = floor($minutes / 60);
        $remainingMinutes = $minutes % 60;

        return $remainingMinutes > 0
            ? "{$hours}h {$remainingMinutes}min"
            : "{$hours}h";
    }
}