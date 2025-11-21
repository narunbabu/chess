<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class TutorialLesson extends Model
{
    use HasFactory;

    protected $fillable = [
        'module_id',
        'title',
        'slug',
        'lesson_type',
        'content_data',
        'difficulty_rating',
        'sort_order',
        'estimated_duration_minutes',
        'xp_reward',
        'unlock_requirement_lesson_id',
        'is_active',
    ];

    protected $casts = [
        'content_data' => 'array',
        'is_active' => 'boolean',
        'difficulty_rating' => 'integer',
        'estimated_duration_minutes' => 'integer',
        'xp_reward' => 'integer',
        'sort_order' => 'integer',
    ];

    /**
     * Get the module this lesson belongs to
     */
    public function module(): BelongsTo
    {
        return $this->belongsTo(TutorialModule::class, 'module_id');
    }

    /**
     * Get the unlock requirement lesson
     */
    public function unlockRequirement(): BelongsTo
    {
        return $this->belongsTo(TutorialLesson::class, 'unlock_requirement_lesson_id');
    }

    /**
     * Get lessons that depend on this one
     */
    public function dependentLessons(): HasMany
    {
        return $this->hasMany(TutorialLesson::class, 'unlock_requirement_lesson_id');
    }

    /**
     * Get user progress records for this lesson
     */
    public function userProgress(): HasMany
    {
        return $this->hasMany(UserTutorialProgress::class, 'lesson_id');
    }

    /**
     * Get specific user progress for this lesson
     */
    public function getUserProgress($userId): ?UserTutorialProgress
    {
        return $this->userProgress()->where('user_id', $userId)->first();
    }

    /**
     * Check if lesson is unlocked for a user
     */
    public function isUnlockedFor($userId): bool
    {
        if (!$this->unlock_requirement_lesson_id) {
            return true; // No requirements
        }

        $requirementLesson = $this->unlockRequirement;
        if (!$requirementLesson) {
            return true;
        }

        $progress = $requirementLesson->getUserProgress($userId);
        return $progress && $progress->status === 'completed';
    }

    /**
     * Get content data with safe defaults
     */
    public function getContentDataAttribute($value): array
    {
        return $value ? json_decode($value, true) : [];
    }

    /**
     * Set content data as JSON
     */
    public function setContentDataAttribute($value): void
    {
        $this->attributes['content_data'] = is_string($value) ? $value : json_encode($value);
    }

    /**
     * Get puzzle data if this is a puzzle lesson
     */
    public function getPuzzleData(): array
    {
        return $this->content_data['puzzles'] ?? [];
    }

    /**
     * Get theory slides if this is a theory lesson
     */
    public function getTheorySlides(): array
    {
        return $this->content_data['slides'] ?? [];
    }

    /**
     * Get practice game configuration if this is a practice lesson
     */
    public function getPracticeConfig(): array
    {
        return $this->content_data['practice_config'] ?? [];
    }

    /**
     * Check if lesson is interactive
     */
    public function isInteractive(): bool
    {
        return in_array($this->lesson_type, ['interactive', 'puzzle', 'practice_game']);
    }

    /**
     * Get difficulty level as text
     */
    public function getDifficultyLevelAttribute(): string
    {
        return match(true) {
            $this->difficulty_rating <= 3 => 'Beginner',
            $this->difficulty_rating <= 6 => 'Intermediate',
            $this->difficulty_rating <= 8 => 'Advanced',
            default => 'Expert',
        };
    }

    /**
     * Get estimated duration in human readable format
     */
    public function getFormattedDurationAttribute(): string
    {
        $minutes = $this->estimated_duration_minutes;
        return $minutes < 60 ? "{$minutes}min" : ceil($minutes / 60) . 'h';
    }

    /**
     * Scope to get only active lessons
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to get lessons by type
     */
    public function scopeByType($query, $type)
    {
        return $query->where('lesson_type', $type);
    }

    /**
     * Scope to get lessons by difficulty
     */
    public function scopeByDifficulty($query, $minRating, $maxRating = null)
    {
        $query->where('difficulty_rating', '>=', $minRating);

        if ($maxRating !== null) {
            $query->where('difficulty_rating', '<=', $maxRating);
        }

        return $query;
    }
}