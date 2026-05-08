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
        'track_slug',
        'required_tier',
        'challenge_type',
        'skill_tier',
        'skill_band',
        'track_label',
        'challenge_data',
        'xp_reward',
    ];

    protected $casts = [
        'challenge_data' => 'array',
        'xp_reward' => 'integer',
        'date' => 'date',
    ];

    public const DEFAULT_TRACK = 'daily-starter';

    public const TRACKS = [
        'daily-starter' => [
            'slug' => 'daily-starter',
            'label' => 'Daily Starter',
            'required_tier' => 'free',
            'challenge_type' => 'puzzle',
            'skill_tier' => 'beginner',
            'skill_bands' => ['newcomer', 'beginner'],
            'xp_reward' => 20,
            'focus' => 'One clear tactic or mate pattern for a reliable daily habit.',
        ],
        'daily-improvement' => [
            'slug' => 'daily-improvement',
            'label' => 'Daily Improvement',
            'required_tier' => 'silver',
            'challenge_type' => 'puzzle',
            'skill_tier' => 'intermediate',
            'skill_bands' => ['beginner', 'improving-beginner', 'club-player'],
            'xp_reward' => 30,
            'focus' => 'Calculation practice for players building club strength.',
        ],
        'daily-endgame' => [
            'slug' => 'daily-endgame',
            'label' => 'Daily Endgame',
            'required_tier' => 'silver',
            'challenge_type' => 'endgame',
            'skill_tier' => 'intermediate',
            'skill_bands' => ['improving-beginner', 'club-player', 'advanced'],
            'xp_reward' => 35,
            'focus' => 'Practical conversion or saving technique.',
        ],
        'daily-master' => [
            'slug' => 'daily-master',
            'label' => 'Daily Master',
            'required_tier' => 'gold',
            'challenge_type' => 'puzzle',
            'skill_tier' => 'advanced',
            'skill_bands' => ['advanced', 'competitive'],
            'xp_reward' => 50,
            'focus' => 'Deeper calculation and professional preparation habits.',
        ],
    ];

    /**
     * Get user completions for this challenge
     */
    public function userCompletions(): HasMany
    {
        return $this->hasMany(UserDailyChallengeCompletion::class, 'challenge_id');
    }

    public static function normalizeTrackSlug(?string $trackSlug): string
    {
        return array_key_exists((string) $trackSlug, self::TRACKS)
            ? (string) $trackSlug
            : self::DEFAULT_TRACK;
    }

    public static function track(string $trackSlug): array
    {
        $slug = self::normalizeTrackSlug($trackSlug);

        return self::TRACKS[$slug];
    }

    public static function tracks(): array
    {
        return array_values(self::TRACKS);
    }

    public static function defaultSkillBandForTier(?string $tier): string
    {
        return match ($tier) {
            'intermediate' => 'club-player',
            'advanced' => 'advanced',
            default => 'beginner',
        };
    }

    public static function resolveSkillBandForTrack(array $track, ?string $requestedSkillBand, ?string $legacyTier): string
    {
        if ($requestedSkillBand && in_array($requestedSkillBand, $track['skill_bands'], true)) {
            return $requestedSkillBand;
        }

        $legacyBand = self::defaultSkillBandForTier($legacyTier ?? $track['skill_tier']);
        if (in_array($legacyBand, $track['skill_bands'], true)) {
            return $legacyBand;
        }

        return $track['skill_bands'][0];
    }

    public function getTrackMetadataAttribute(): array
    {
        $track = self::track($this->track_slug ?? self::DEFAULT_TRACK);

        return array_merge($track, [
            'slug' => $this->track_slug ?? $track['slug'],
            'label' => $this->track_label ?? $track['label'],
            'required_tier' => $this->required_tier ?? $track['required_tier'],
        ]);
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
     * Scope to get challenges by daily track
     */
    public function scopeByTrack($query, $trackSlug)
    {
        return $query->where('track_slug', self::normalizeTrackSlug($trackSlug));
    }

    /**
     * Scope to get current challenge
     */
    public function scopeCurrent($query)
    {
        return $query->whereDate('date', now());
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
    public static function getOrCreateToday($type = null, $tier = null, ?string $trackSlug = null, ?string $skillBand = null): self
    {
        $date = now()->format('Y-m-d');
        $track = self::track($trackSlug ?? self::DEFAULT_TRACK);
        $resolvedTrackSlug = $track['slug'];
        $resolvedType = $track['challenge_type'];
        $resolvedTier = $track['skill_tier'];
        $resolvedSkillBand = self::resolveSkillBandForTrack($track, $skillBand, $resolvedTier);

        // First try to find today's challenge for the requested track.
        $challenge = static::whereDate('date', $date)
            ->where('track_slug', $resolvedTrackSlug)
            ->first();

        if ($challenge) {
            return $challenge;
        }

        // Try alternative query method
        $challenge = static::where('date', $date)
            ->where('track_slug', $resolvedTrackSlug)
            ->first();
        if ($challenge) {
            return $challenge;
        }

        // If no challenge exists for today, create one with duplicate handling
        try {
            return static::create([
                'date' => $date,
                'track_slug' => $resolvedTrackSlug,
                'required_tier' => $track['required_tier'],
                'challenge_type' => $resolvedType,
                'skill_tier' => $resolvedTier,
                'skill_band' => $resolvedSkillBand,
                'track_label' => $track['label'],
                'challenge_data' => static::generateChallengeData($resolvedType, $resolvedTier),
                'xp_reward' => $track['xp_reward'],
            ]);
        } catch (\Illuminate\Database\QueryException $e) {
            // Handle UNIQUE constraint violation - race condition or data inconsistency
            if ($e->getCode() === 23000 || str_contains($e->getMessage(), 'UNIQUE constraint failed')) {
                // Another process created the challenge or there's a data inconsistency
                // Try multiple approaches to find the existing challenge
                $existing = static::whereDate('date', $date)
                    ->where('track_slug', $resolvedTrackSlug)
                    ->first();
                if (!$existing) {
                    $existing = static::where('date', $date)
                        ->where('track_slug', $resolvedTrackSlug)
                        ->first();
                }

                if ($existing) {
                    return $existing;
                }

                // If we still can't find it, there's a data integrity issue
                // For now, return the first challenge for this track as fallback
                $fallback = static::where('track_slug', $resolvedTrackSlug)
                    ->orderBy('id', 'desc')
                    ->first();

                if ($fallback) {
                    return $fallback;
                }
            }

            // Re-throw if it's a different error or the fallback was not found.
            throw $e;
        }
    }

    /**
     * Generate challenge data by picking a random future puzzle.
     * Falls back to a default puzzle if no unused puzzles remain.
     */
    private static function generateChallengeData($type, $tier): array
    {
        // Pick a random puzzle from future-dated challenges that haven't been used yet.
        // If the seeder has pre-populated dates, grab from the nearest unused one.
        $unused = static::where('date', '>', now()->format('Y-m-d'))
            ->where('challenge_type', $type)
            ->where('skill_tier', $tier)
            ->inRandomOrder()
            ->first();

        if (!$unused) {
            $unused = static::where('date', '>', now()->format('Y-m-d'))
                ->where('skill_tier', $tier)
                ->inRandomOrder()
                ->first();
        }

        if ($unused) {
            return $unused->challenge_data;
        }

        // Fallback: a simple beginner puzzle
        return [
            'fen' => '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1',
            'solution' => ['Ra8#'],
            'hints' => [
                'The king is trapped on the back rank.',
                'Use your rook to deliver mate.',
            ],
            'difficulty' => $tier,
            'category' => $type,
            'title' => 'Back Rank Mate',
            'description' => 'White to move — deliver checkmate in one move.',
        ];
    }
}
