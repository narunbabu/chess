<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DailyChallenge extends Model
{
    use HasFactory;

    protected $fillable = [
        'date',
        'challenge_type',
        'skill_tier',
        'challenge_data',
        'xp_reward',
    ];

    protected $casts = [
        'challenge_data' => 'array',
        'xp_reward' => 'integer',
        'date' => 'date',
    ];

    /**
     * Get user completions for this challenge
     */
    public function userCompletions(): HasMany
    {
        return $this->hasMany(UserDailyChallengeCompletion::class, 'challenge_id');
    }

    /**
     * Get challenge type display name
     */
    public function getChallengeTypeDisplayAttribute(): string
    {
        return match($this->challenge_type) {
            'puzzle' => 'Tactical Puzzle',
            'endgame' => 'Endgame Study',
            'opening' => 'Opening Theory',
            'tactic' => 'Tactic Training',
            default => 'Challenge',
        };
    }

    /**
     * Get challenge type icon
     */
    public function getChallengeTypeIconAttribute(): string
    {
        return match($this->challenge_type) {
            'puzzle' => '🧩',
            'endgame' => '♟️',
            'opening' => '📖',
            'tactic' => '⚡',
            default => '🎯',
        };
    }

    /**
     * Get tier color class
     */
    public function getTierColorClassAttribute(): string
    {
        return match($this->skill_tier) {
            'beginner' => 'text-green-600 bg-green-100',
            'intermediate' => 'text-blue-600 bg-blue-100',
            'advanced' => 'text-purple-600 bg-purple-100',
            default => 'text-gray-600 bg-gray-100',
        };
    }

    /**
     * Get puzzle FEN position
     */
    public function getPuzzleFenAttribute(): ?string
    {
        return $this->challenge_data['fen'] ?? null;
    }

    /**
     * Get puzzle solution moves
     */
    public function getPuzzleSolutionAttribute(): array
    {
        return $this->challenge_data['solution'] ?? [];
    }

    /**
     * Get puzzle hints
     */
    public function getPuzzleHintsAttribute(): array
    {
        return $this->challenge_data['hints'] ?? [];
    }

    /**
     * Check if user has completed this challenge
     */
    public function isCompletedBy($userId): bool
    {
        return $this->userCompletions()
            ->where('user_id', $userId)
            ->where('completed', true)
            ->exists();
    }

    /**
     * Get user's completion for this challenge
     */
    public function getUserCompletion($userId): ?UserDailyChallengeCompletion
    {
        return $this->userCompletions()
            ->where('user_id', $userId)
            ->first();
    }

    /**
     * Get completion count
     */
    public function getCompletionCountAttribute(): int
    {
        return $this->userCompletions()->where('completed', true)->count();
    }

    /**
     * Get success rate
     */
    public function getSuccessRateAttribute(): float
    {
        $totalAttempts = $this->userCompletions()->count();
        if ($totalAttempts === 0) {
            return 0;
        }

        $completed = $this->userCompletions()->where('completed', true)->count();

        return round(($completed / $totalAttempts) * 100, 2);
    }

    /**
     * Scope to get challenges by date
     */
    public function scopeByDate($query, $date)
    {
        return $query->where('date', $date);
    }

    /**
     * Scope to get challenges by type
     */
    public function scopeByType($query, $type)
    {
        return $query->where('challenge_type', $type);
    }

    /**
     * Scope to get challenges by skill tier
     */
    public function scopeByTier($query, $tier)
    {
        return $query->where('skill_tier', $tier);
    }

    /**
     * Scope to get current challenge
     */
    public function scopeCurrent($query)
    {
        return $query->where('date', now()->format('Y-m-d'));
    }

    /**
     * Scope to get recent challenges
     */
    public function scopeRecent($query, $days = 7)
    {
        return $query->where('date', '>=', now()->subDays($days));
    }

    /**
     * Get or create today's challenge
     */
    public static function getOrCreateToday($type = null, $tier = null): self
    {
        $date = now()->format('Y-m-d');

        // First try to find existing challenge for today
        $challenge = static::where('date', $date)->first();

        if ($challenge) {
            return $challenge;
        }

        // If no challenge exists for today, create one
        return static::create([
            'date' => $date,
            'challenge_type' => $type ?? 'puzzle',
            'skill_tier' => $tier ?? 'beginner',
            'challenge_data' => static::generateChallengeData($type ?? 'puzzle', $tier ?? 'beginner'),
            'xp_reward' => 25,
        ]);
    }

    /**
     * Generate challenge data based on type and tier
     */
    private static function generateChallengeData($type, $tier): array
    {
        // This would typically pull from a database of puzzles or generate them
        // For now, we'll return a sample structure
        return [
            'fen' => 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
            'solution' => ['e5'],
            'hints' => [
                'Control the center',
                'Develop your pieces',
            ],
            'difficulty' => $tier,
            'category' => $type,
        ];
    }
}