<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserDailyChallengeCompletion extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'challenge_id',
        'completed',
        'attempts',
        'time_spent_seconds',
        'completed_at',
    ];

    protected $casts = [
        'completed' => 'boolean',
        'attempts' => 'integer',
        'time_spent_seconds' => 'integer',
        'completed_at' => 'datetime',
    ];

    /**
     * Get the user
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Get the challenge
     */
    public function challenge(): BelongsTo
    {
        return $this->belongsTo(DailyChallenge::class, 'challenge_id');
    }

    /**
     * Mark challenge as completed
     */
    public function markCompleted($timeSpent = null): void
    {
        if ($this->completed) {
            return; // Already completed
        }

        $this->update([
            'completed' => true,
            'attempts' => $this->attempts + 1,
            'time_spent_seconds' => $timeSpent ?? $this->time_spent_seconds,
            'completed_at' => now(),
        ]);

        // Award XP to user
        $xpAwarded = $this->challenge->xp_reward;
        $this->user->awardTutorialXp($xpAwarded, "Daily Challenge: {$this->challenge->getChallengeTypeDisplayAttribute()}");

        // Check for streak achievements
        $this->checkStreakAchievements();
    }

    /**
     * Increment attempts
     */
    public function incrementAttempts(): void
    {
        $this->increment('attempts');
    }

    /**
     * Add time spent
     */
    public function addTimeSpent($seconds): void
    {
        $this->increment('time_spent_seconds', $seconds);
    }

    /**
     * Get formatted time spent
     */
    public function getFormattedTimeSpentAttribute(): string
    {
        $seconds = $this->time_spent_seconds;
        $minutes = floor($seconds / 60);
        $remainingSeconds = $seconds % 60;

        return $minutes > 0 ? "{$minutes}m {$remainingSeconds}s" : "{$seconds}s";
    }

    /**
     * Check if completed today
     */
    public function isCompletedToday(): bool
    {
        return $this->completed &&
               $this->completed_at &&
               $this->completed_at->isSameDay(now());
    }

    /**
     * Check for and award streak achievements
     */
    private function checkStreakAchievements(): void
    {
        $user = $this->user;
        $currentStreak = $user->getCurrentDailyStreak();

        // Check for streak achievements
        $streakAchievements = TutorialAchievement::where('requirement_type', 'streak')
            ->where('is_active', true)
            ->get();

        foreach ($streakAchievements as $achievement) {
            if ($currentStreak >= $achievement->requirement_value) {
                $user->awardAchievement($achievement->id);
            }
        }
    }

    /**
     * Scope to get completions by user
     */
    public function scopeByUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    /**
     * Scope to get completed challenges
     */
    public function scopeCompleted($query)
    {
        return $query->where('completed', true);
    }

    /**
     * Scope to get recent completions
     */
    public function scopeRecent($query, $days = 7)
    {
        return $query->where('completed_at', '>=', now()->subDays($days));
    }
}