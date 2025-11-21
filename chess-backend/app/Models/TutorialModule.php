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
     */
    public function getUserProgress($userId): array
    {
        $totalLessons = $this->activeLessons()->count();

        // Debug: Get all active lessons with their user progress
        $activeLessons = $this->activeLessons()->get();
        $lessonDebug = [];

        foreach ($activeLessons as $lesson) {
            $userProgress = $lesson->userProgress()->where('user_id', $userId)->first();
            $lessonDebug[] = [
                'lesson_id' => $lesson->id,
                'lesson_title' => $lesson->title,
                'user_progress_status' => $userProgress?->status,
                'is_completed' => in_array($userProgress?->status, ['completed', 'mastered']),
            ];
        }

        \Log::info('Module Progress Debug', [
            'module_id' => $this->id,
            'module_name' => $this->name,
            'user_id' => $userId,
            'total_lessons' => $totalLessons,
            'active_lessons_debug' => $lessonDebug,
        ]);

        $completedLessons = $this->activeLessons()
            ->whereHas('userProgress', function ($query) use ($userId) {
                $query->where('user_id', $userId)
                      ->whereIn('status', ['completed', 'mastered']);
            })
            ->count();

        $percentage = $totalLessons > 0 ? ($completedLessons / $totalLessons) * 100 : 0;

        $result = [
            'total_lessons' => $totalLessons,
            'completed_lessons' => $completedLessons,
            'percentage' => round($percentage, 2),
            'is_completed' => $completedLessons === $totalLessons && $totalLessons > 0,
        ];

        \Log::info('Module Progress Result', [
            'module_id' => $this->id,
            'user_id' => $userId,
            'result' => $result,
        ]);

        return $result;
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