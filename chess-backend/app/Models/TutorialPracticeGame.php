<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TutorialPracticeGame extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'lesson_id',
        'ai_difficulty',
        'result',
        'moves_played',
        'game_data',
        'duration_seconds',
        'xp_earned',
        'played_at',
    ];

    protected $casts = [
        'game_data' => 'array',
        'duration_seconds' => 'integer',
        'moves_played' => 'integer',
        'xp_earned' => 'integer',
        'played_at' => 'datetime',
    ];

    /**
     * Get the user
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Get the lesson (if this was for a specific lesson)
     */
    public function lesson(): BelongsTo
    {
        return $this->belongsTo(TutorialLesson::class, 'lesson_id');
    }

    /**
     * Get result color class
     */
    public function getResultColorClassAttribute(): string
    {
        return match($this->result) {
            'win' => 'text-green-600 bg-green-100',
            'draw' => 'text-yellow-600 bg-yellow-100',
            'loss' => 'text-red-600 bg-red-100',
            default => 'text-gray-600 bg-gray-100',
        };
    }

    /**
     * Get result icon
     */
    public function getResultIconAttribute(): string
    {
        return match($this->result) {
            'win' => '🏆',
            'draw' => '🤝',
            'loss' => '💔',
            default => '❓',
        };
    }

    /**
     * Get difficulty color class
     */
    public function getDifficultyColorClassAttribute(): string
    {
        return match($this->ai_difficulty) {
            'easy' => 'text-green-600',
            'medium' => 'text-yellow-600',
            'hard' => 'text-orange-600',
            'expert' => 'text-red-600',
            default => 'text-gray-600',
        };
    }

    /**
     * Get formatted duration
     */
    public function getFormattedDurationAttribute(): string
    {
        $seconds = $this->duration_seconds;
        $minutes = floor($seconds / 60);
        $remainingSeconds = $seconds % 60;

        return $minutes > 0 ? "{$minutes}m {$remainingSeconds}s" : "{$seconds}s";
    }

    /**
     * Scope to get games by user
     */
    public function scopeByUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    /**
     * Scope to get games by result
     */
    public function scopeByResult($query, $result)
    {
        return $query->where('result', $result);
    }

    /**
     * Scope to get games by difficulty
     */
    public function scopeByDifficulty($query, $difficulty)
    {
        return $query->where('ai_difficulty', $difficulty);
    }

    /**
     * Scope to get recent games
     */
    public function scopeRecent($query, $days = 30)
    {
        return $query->where('played_at', '>=', now()->subDays($days));
    }

    /**
     * Get win rate for a user
     */
    public static function getWinRateForUser($userId, $days = 30): float
    {
        $totalGames = static::byUser($userId)->recent($days)->count();
        if ($totalGames === 0) {
            return 0;
        }

        $wins = static::byUser($userId)->recent($days)->where('result', 'win')->count();

        return round(($wins / $totalGames) * 100, 2);
    }

    /**
     * Get average moves per game for a user
     */
    public static function getAverageMovesForUser($userId, $days = 30): float
    {
        return static::byUser($userId)
            ->recent($days)
            ->avg('moves_played') ?? 0;
    }
}