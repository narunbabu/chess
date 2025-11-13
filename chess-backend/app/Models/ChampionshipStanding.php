<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ChampionshipStanding extends Model
{
    use HasFactory;

    protected $fillable = [
        'championship_id',
        'user_id',
        'matches_played',
        'wins',
        'draws',
        'losses',
        'points',
        'buchholz_score',
        'sonneborn_berger',
        'rank',
        'final_position',
        'prize_amount',
        'credits_earned',
    ];

    protected $casts = [
        'championship_id' => 'integer',
        'user_id' => 'integer',
        'matches_played' => 'integer',
        'wins' => 'integer',
        'draws' => 'integer',
        'losses' => 'integer',
        'points' => 'decimal:1',
        'buchholz_score' => 'decimal:1',
        'sonneborn_berger' => 'decimal:1',
        'rank' => 'integer',
        'final_position' => 'integer',
        'prize_amount' => 'decimal:2',
        'credits_earned' => 'integer',
    ];

    // Relationships

    /**
     * The championship this standing belongs to
     */
    public function championship()
    {
        return $this->belongsTo(Championship::class);
    }

    /**
     * The user this standing represents
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // Scopes

    /**
     * Scope: Order by rank
     */
    public function scopeOrdered($query)
    {
        return $query->orderBy('points', 'desc')
                    ->orderBy('buchholz_score', 'desc')
                    ->orderBy('sonneborn_berger', 'desc');
    }

    /**
     * Scope: Top N standings
     */
    public function scopeTop($query, int $limit)
    {
        return $query->ordered()->limit($limit);
    }

    // Helper Methods

    /**
     * Update points after a match
     */
    public function updatePoints(float $pointsToAdd): void
    {
        $this->increment('matches_played');

        if ($pointsToAdd == 1.0) {
            $this->increment('wins');
            $this->increment('points', 1.0);
        } elseif ($pointsToAdd == 0.5) {
            $this->increment('draws');
            $this->points += 0.5;
            $this->save();
        } else {
            $this->increment('losses');
        }
    }

    /**
     * Calculate Buchholz score (sum of opponents' scores)
     *
     * @param array $opponentUserIds Array of opponent user IDs
     * @return float
     */
    public function calculateBuchholz(array $opponentUserIds): float
    {
        if (empty($opponentUserIds)) {
            return 0.0;
        }

        $opponentStandings = self::where('championship_id', $this->championship_id)
            ->whereIn('user_id', $opponentUserIds)
            ->get();

        $buchholzScore = $opponentStandings->sum('points');

        $this->update(['buchholz_score' => $buchholzScore]);

        return $buchholzScore;
    }

    /**
     * Calculate Sonneborn-Berger score (quality of wins)
     * Used as secondary tiebreaker
     *
     * @param array $matchResults Array of match results with ['opponent_id', 'points']
     * @return float
     */
    public function calculateSonnebornBerger(array $matchResults): float
    {
        if (empty($matchResults)) {
            return 0.0;
        }

        $sbScore = 0.0;

        foreach ($matchResults as $result) {
            $opponentStanding = self::where('championship_id', $this->championship_id)
                ->where('user_id', $result['opponent_id'])
                ->first();

            if ($opponentStanding) {
                // SB = sum of (opponent's score * player's result against opponent)
                $sbScore += $opponentStanding->points * $result['points'];
            }
        }

        $this->update(['sonneborn_berger' => $sbScore]);

        return $sbScore;
    }

    /**
     * Update rank based on current standings
     */
    public function updateRank(): void
    {
        $rank = self::where('championship_id', $this->championship_id)
            ->where(function ($query) {
                $query->where('points', '>', $this->points)
                    ->orWhere(function ($q) {
                        $q->where('points', $this->points)
                          ->where('buchholz_score', '>', $this->buchholz_score);
                    })
                    ->orWhere(function ($q) {
                        $q->where('points', $this->points)
                          ->where('buchholz_score', $this->buchholz_score)
                          ->where('sonneborn_berger', '>', $this->sonneborn_berger);
                    });
            })
            ->count() + 1;

        $this->update(['rank' => $rank]);
    }

    /**
     * Get win percentage
     */
    public function getWinPercentage(): float
    {
        if ($this->matches_played === 0) {
            return 0.0;
        }

        return round(($this->wins / $this->matches_played) * 100, 2);
    }

    /**
     * Get draw percentage
     */
    public function getDrawPercentage(): float
    {
        if ($this->matches_played === 0) {
            return 0.0;
        }

        return round(($this->draws / $this->matches_played) * 100, 2);
    }

    /**
     * Get loss percentage
     */
    public function getLossPercentage(): float
    {
        if ($this->matches_played === 0) {
            return 0.0;
        }

        return round(($this->losses / $this->matches_played) * 100, 2);
    }

    /**
     * Award prize
     */
    public function awardPrize(float $amount, int $credits): void
    {
        $this->update([
            'prize_amount' => $amount,
            'credits_earned' => $credits,
        ]);
    }
}
