<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserStageProgress extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'lesson_id',
        'stage_id',
        'status',
        'attempts',
        'best_score',
        'total_time_seconds',
        'mistake_log',
        'hint_usage',
        'completed_at',
        'last_attempt_at',
    ];

    protected $casts = [
        'mistake_log' => 'array',
        'hint_usage' => 'array',
        'completed_at' => 'datetime',
        'last_attempt_at' => 'datetime',
        'best_score' => 'integer',
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
     * Get the stage
     */
    public function stage(): BelongsTo
    {
        return $this->belongsTo(InteractiveLessonStage::class, 'stage_id');
    }

    /**
     * Mark stage as started
     */
    public function markAsStarted(): void
    {
        $this->update([
            'status' => 'in_progress',
            'last_attempt_at' => now(),
        ]);
    }

    /**
     * Mark stage as completed
     */
    public function markAsCompleted(int $score, int $timeSpentSeconds): void
    {
        $this->update([
            'status' => 'completed',
            'best_score' => max($this->best_score, $score),
            'total_time_seconds' => $this->total_time_seconds + $timeSpentSeconds,
            'completed_at' => now(),
            'last_attempt_at' => now(),
        ]);
    }

    /**
     * Record an attempt
     */
    public function recordAttempt(string $move, array $result): void
    {
        $this->increment('attempts');
        $this->update(['last_attempt_at' => now()]);

        // Log mistakes if the attempt failed
        if (!$result['success']) {
            $mistakeLog = $this->mistake_log ?? [];
            $mistakeLog[] = [
                'move' => $move,
                'timestamp' => now()->toISOString(),
                'feedback' => $result['feedback'] ?? null,
                'feedback_type' => $result['feedback_type'] ?? 'fail',
            ];
            $this->update(['mistake_log' => $mistakeLog]);
        }

        // Update best score
        if ($result['success'] && ($result['score_change'] ?? 0) > 0) {
            $newScore = min(100, $this->best_score + $result['score_change']);
            if ($newScore > $this->best_score) {
                $this->update(['best_score' => $newScore]);
            }
        }
    }

    /**
     * Record hint usage
     */
    public function recordHintUsage(int $hintIndex, string $hintText): void
    {
        $hintUsage = $this->hint_usage ?? [];
        $hintUsage[] = [
            'hint_index' => $hintIndex,
            'hint_text' => $hintText,
            'used_at' => now()->toISOString(),
        ];
        $this->update(['hint_usage' => $hintUsage]);
    }

    /**
     * Get completion accuracy
     */
    public function getAccuracyAttribute(): float
    {
        if ($this->attempts === 0) {
            return 0.0;
        }

        $mistakeCount = count($this->mistake_log ?? []);
        return max(0, 100 - ($mistakeCount / $this->attempts * 100));
    }

    /**
     * Check if stage is mastered (completed with high accuracy)
     */
    public function isMastered(): bool
    {
        return $this->status === 'completed' &&
               $this->best_score >= 90 &&
               $this->accuracy >= 85;
    }

    /**
     * Scope to get completed stages
     */
    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    /**
     * Scope to get in-progress stages
     */
    public function scopeInProgress($query)
    {
        return $query->where('status', 'in_progress');
    }
}