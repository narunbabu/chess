<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserTutorialProgress extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'lesson_id',
        'status',
        'attempts',
        'best_score',
        'time_spent_seconds',
        'completed_at',
        'mastered_at',
        'last_accessed_at',
    ];

    protected $casts = [
        'best_score' => 'decimal:2',
        'time_spent_seconds' => 'integer',
        'attempts' => 'integer',
        'completed_at' => 'datetime',
        'mastered_at' => 'datetime',
        'last_accessed_at' => 'datetime',
    ];

    /**
     * Get the user
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Get the lesson
     */
    public function lesson(): BelongsTo
    {
        return $this->belongsTo(TutorialLesson::class, 'lesson_id');
    }

    /**
     * Mark lesson as started
     */
    public function markAsStarted(): void
    {
        $this->update([
            'status' => 'in_progress',
            'attempts' => $this->attempts + 1,
            'last_accessed_at' => now(),
        ]);
    }

    /**
     * Mark lesson as completed
     */
    public function markAsCompleted($score = null, $timeSpent = null): void
    {
        $this->update([
            'status' => 'completed',
            'best_score' => max($this->best_score, $score ?? 100),
            'time_spent_seconds' => $this->time_spent_seconds + ($timeSpent ?? 0),
            'completed_at' => now(),
            'last_accessed_at' => now(),
        ]);

        // Award XP to user
        $xpAwarded = $this->lesson->xp_reward;
        $this->user->awardTutorialXp($xpAwarded, $this->lesson->title);

        // Check for achievements
        $this->checkAchievements();
    }

    /**
     * Mark lesson as mastered
     */
    public function markAsMastered(): void
    {
        $this->update([
            'status' => 'mastered',
            'mastered_at' => now(),
            'last_accessed_at' => now(),
        ]);

        // Bonus XP for mastering
        $bonusXp = floor($this->lesson->xp_reward * 0.5);
        $this->user->awardTutorialXp($bonusXp, "Mastered: {$this->lesson->title}");
    }

    /**
     * Add time spent on lesson
     */
    public function addTimeSpent($seconds): void
    {
        $this->increment('time_spent_seconds', $seconds);
    }

    /**
     * Check if user has completed this lesson
     */
    public function isCompleted(): bool
    {
        return $this->status === 'completed' || $this->status === 'mastered';
    }

    /**
     * Check if user has mastered this lesson
     */
    public function isMastered(): bool
    {
        return $this->status === 'mastered';
    }

    /**
     * Get completion percentage
     */
    public function getCompletionPercentage(): float
    {
        return match($this->status) {
            'not_started' => 0,
            'in_progress' => 50,
            'completed' => 90,
            'mastered' => 100,
            default => 0,
        };
    }

    /**
     * Get formatted time spent
     */
    public function getFormattedTimeSpentAttribute(): string
    {
        $seconds = $this->time_spent_seconds;
        $hours = floor($seconds / 3600);
        $minutes = floor(($seconds % 3600) / 60);

        if ($hours > 0) {
            return $minutes > 0 ? "{$hours}h {$minutes}m" : "{$hours}h";
        }

        return "{$minutes}m";
    }

    /**
     * Check for and award achievements
     */
    private function checkAchievements(): void
    {
        $user = $this->user;
        $completedLessons = $user->tutorialProgress()
            ->where('status', 'completed')
            ->orWhere('status', 'mastered')
            ->count();

        // Check for lesson completion achievements
        $achievements = TutorialAchievement::where('requirement_type', 'lessons_completed')
            ->where('is_active', true)
            ->get();

        foreach ($achievements as $achievement) {
            if ($completedLessons >= $achievement->requirement_value) {
                $user->awardAchievement($achievement->id);
            }
        }

        // Check for perfect score achievements
        if ($this->best_score >= 95) {
            $perfectScoreAchievements = TutorialAchievement::where('requirement_type', 'score')
                ->where('requirement_value', '>=', 95)
                ->where('is_active', true)
                ->get();

            foreach ($perfectScoreAchievements as $achievement) {
                $user->awardAchievement($achievement->id);
            }
        }
    }

    /**
     * Scope to get progress by status
     */
    public function scopeByStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Scope to get completed lessons
     */
    public function scopeCompleted($query)
    {
        return $query->whereIn('status', ['completed', 'mastered']);
    }

    /**
     * Scope to get mastered lessons
     */
    public function scopeMastered($query)
    {
        return $query->where('status', 'mastered');
    }

    /**
     * Check if lesson is completed (for frontend compatibility)
     */
    public function getIsCompletedAttribute(): bool
    {
        return in_array($this->status, ['completed', 'mastered']);
    }
}