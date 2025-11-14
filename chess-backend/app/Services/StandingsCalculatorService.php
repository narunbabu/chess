<?php

namespace App\Services;

use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipStanding;
use App\Models\User;
use App\Enums\ChampionshipMatchStatus;
use App\Enums\ChampionshipResultType;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class StandingsCalculatorService
{
    /**
     * Update standings for a championship
     */
    public function updateStandings(Championship $championship): void
    {
        if (!$championship->getFormatEnum()->isSwiss()) {
            return; // Only calculate tiebreakers for Swiss tournaments
        }

        $participants = $this->getEligibleParticipants($championship);
        $matches = $this->getCompletedMatches($championship);

        foreach ($participants as $participant) {
            $standing = $this->calculateParticipantStanding($championship, $participant, $matches);
            $this->saveStanding($standing);
        }

        // Calculate tiebreakers
        $this->calculateTiebreakers($championship);

        // Update ranks
        $this->updateRanks($championship);

        Log::info("Updated championship standings", [
            'championship_id' => $championship->id,
            'participants' => $participants->count(),
        ]);
    }

    /**
     * Calculate standing for a single participant
     */
    public function calculateParticipantStanding(Championship $championship, $participant, Collection $matches): array
    {
        $participantMatches = $matches->filter(function ($match) use ($participant) {
            return $match->player1_id === $participant->user_id || $match->player2_id === $participant->user_id;
        });

        $score = 0;
        $wins = 0;
        $draws = 0;
        $losses = 0;
        $gamesPlayed = 0;

        foreach ($participantMatches as $match) {
            $result = $this->getMatchResult($match, $participant->user_id);

            switch ($result) {
                case 'win':
                    $score += 1;
                    $wins++;
                    break;
                case 'draw':
                    $score += 0.5;
                    $draws++;
                    break;
                case 'loss':
                    $losses++;
                    break;
            }

            $gamesPlayed++;
        }

        return [
            'championship_id' => $championship->id,
            'user_id' => $participant->user_id,
            'score' => $score,
            'games_played' => $gamesPlayed,
            'wins' => $wins,
            'draws' => $draws,
            'losses' => $losses,
            'buchholz' => 0, // Will be calculated later
            'sonneborn_berger' => 0, // Will be calculated later
            't_rating' => $participant->user->rating ?? 1200,
        ];
    }

    /**
     * Get eligible participants
     */
    private function getEligibleParticipants(Championship $championship): Collection
    {
        return $championship->participants()
            ->where('payment_status_id', \App\Enums\PaymentStatus::COMPLETED->getId())
            ->with('user')
            ->get();
    }

    /**
     * Get completed matches
     */
    private function getCompletedMatches(Championship $championship): Collection
    {
        return $championship->matches()
            ->completed() // Use model scope instead of direct status query
            ->with(['player1', 'player2'])
            ->get();
    }

    /**
     * Get match result for a participant
     */
    private function getMatchResult(ChampionshipMatch $match, int $userId): string
    {
        // Handle forfeits
        if ($match->result_type === ChampionshipResultType::FORFEIT_PLAYER1->value) {
            return $match->player1_id === $userId ? 'loss' : 'win';
        } elseif ($match->result_type === ChampionshipResultType::FORFEIT_PLAYER2->value) {
            return $match->player2_id === $userId ? 'loss' : 'win';
        } elseif ($match->result_type === ChampionshipResultType::DOUBLE_FORFEIT->value) {
            return 'loss'; // Both players get loss
        }

        // Normal game results
        if ($match->winner_id === null) {
            return 'draw';
        }

        return $match->winner_id === $userId ? 'win' : 'loss';
    }

    /**
     * Save standing to database
     */
    private function saveStanding(array $standingData): void
    {
        ChampionshipStanding::updateOrCreate(
            [
                'championship_id' => $standingData['championship_id'],
                'user_id' => $standingData['user_id'],
            ],
            [
                'score' => $standingData['score'],
                'games_played' => $standingData['games_played'],
                'wins' => $standingData['wins'],
                'draws' => $standingData['draws'],
                'losses' => $standingData['losses'],
                'buchholz' => $standingData['buchholz'],
                'sonneborn_berger' => $standingData['sonneborn_berger'],
                't_rating' => $standingData['t_rating'],
            ]
        );
    }

    /**
     * Calculate tiebreakers (Buchholz and Sonneborn-Berger)
     */
    private function calculateTiebreakers(Championship $championship): void
    {
        $standings = $championship->standings()->with('user')->get();
        $matches = $this->getCompletedMatches($championship);

        foreach ($standings as $standing) {
            $buchholz = $this->calculateBuchholz($standing, $standings, $matches);
            $sonnebornBerger = $this->calculateSonnebornBerger($standing, $standings, $matches);

            $standing->update([
                'buchholz' => $buchholz,
                'sonneborn_berger' => $sonnebornBerger,
            ]);
        }
    }

    /**
     * Calculate Buchholz tiebreaker
     */
    private function calculateBuchholz(ChampionshipStanding $standing, Collection $allStandings, Collection $matches): float
    {
        $opponentScores = 0;
        $userMatches = $matches->filter(function ($match) use ($standing) {
            return $match->player1_id === $standing->user_id || $match->player2_id === $standing->user_id;
        });

        foreach ($userMatches as $match) {
            $opponentId = $match->player1_id === $standing->user_id
                ? $match->player2_id
                : $match->player1_id;

            $opponentStanding = $allStandings->where('user_id', $opponentId)->first();

            if ($opponentStanding) {
                $opponentScores += $opponentStanding->score;
            }
        }

        return $opponentScores;
    }

    /**
     * Calculate Sonneborn-Berger tiebreaker
     */
    private function calculateSonnebornBerger(ChampionshipStanding $standing, Collection $allStandings, Collection $matches): float
    {
        $sbScore = 0;
        $userMatches = $matches->filter(function ($match) use ($standing) {
            return $match->player1_id === $standing->user_id || $match->player2_id === $standing->user_id;
        });

        foreach ($userMatches as $match) {
            $result = $this->getMatchResult($match, $standing->user_id);
            $opponentId = $match->player1_id === $standing->user_id
                ? $match->player2_id
                : $match->player1_id;

            $opponentStanding = $allStandings->where('user_id', $opponentId)->first();

            if ($opponentStanding) {
                switch ($result) {
                    case 'win':
                        $sbScore += $opponentStanding->score;
                        break;
                    case 'draw':
                        $sbScore += $opponentStanding->score * 0.5;
                        break;
                    case 'loss':
                        // No points added for losses
                        break;
                }
            }
        }

        return $sbScore;
    }

    /**
     * Update ranks based on scores and tiebreakers
     */
    private function updateRanks(Championship $championship): void
    {
        $standings = $championship->standings()
            ->orderBy('score', 'desc')
            ->orderBy('buchholz', 'desc')
            ->orderBy('sonneborn_berger', 'desc')
            ->orderBy('t_rating', 'desc')
            ->get();

        $currentRank = 1;
        $previousScore = null;
        $previousBuchholz = null;
        $previousSonnebornBerger = null;

        foreach ($standings as $index => $standing) {
            // Check if this player ties with previous
            $isTie = ($previousScore !== null && $standing->score === $previousScore &&
                     $standing->buchholz === $previousBuchholz &&
                     $standing->sonneborn_berger === $previousSonnebornBerger);

            if (!$isTie) {
                $currentRank = $index + 1;
            }

            $standing->update(['rank' => $currentRank]);

            $previousScore = $standing->score;
            $previousBuchholz = $standing->buchholz;
            $previousSonnebornBerger = $standing->sonneborn_berger;
        }
    }

    /**
     * Get standings summary
     */
    public function getStandingsSummary(Championship $championship): array
    {
        $standings = $championship->standings()
            ->with('user')
            ->orderBy('rank')
            ->get();

        $summary = [
            'total_participants' => $standings->count(),
            'completed_matches' => $this->getCompletedMatches($championship)->count(),
            'total_possible_matches' => $this->calculateTotalPossibleMatches($championship),
            'leader' => $standings->first(),
            'top_three' => $standings->take(3),
            'standings' => $standings->map(function ($standing) {
                return [
                    'rank' => $standing->rank,
                    'user' => $standing->user,
                    'score' => $standing->score,
                    'games_played' => $standing->games_played,
                    'wins' => $standing->wins,
                    'draws' => $standing->draws,
                    'losses' => $standing->losses,
                    'win_rate' => $standing->games_played > 0
                        ? round(($standing->wins / $standing->games_played) * 100, 1)
                        : 0,
                    'buchholz' => $standing->buchholz,
                    'sonneborn_berger' => $standing->sonneborn_berger,
                    't_rating' => $standing->t_rating,
                ];
            }),
        ];

        return $summary;
    }

    /**
     * Calculate total possible matches for Swiss tournament
     */
    private function calculateTotalPossibleMatches(Championship $championship): int
    {
        if (!$championship->getFormatEnum()->isSwiss()) {
            return $championship->matches()->count();
        }

        $participants = $this->getEligibleParticipants($championship);
        $rounds = $championship->swiss_rounds;

        // Each participant plays one game per round
        return $participants->count() * $rounds;
    }

    /**
     * Recalculate all standings from scratch
     */
    public function recalculateAllStandings(Championship $championship): void
    {
        Log::info("Recalculating all standings from scratch", [
            'championship_id' => $championship->id,
        ]);

        // Clear existing standings
        $championship->standings()->delete();

        // Recalculate everything
        $this->updateStandings($championship);
    }

    /**
     * Get participant's current standing
     */
    public function getParticipantStanding(Championship $championship, int $userId): ?ChampionshipStanding
    {
        return $championship->standings()
            ->where('user_id', $userId)
            ->with('user')
            ->first();
    }

    /**
     * Get participants eligible for next round
     */
    public function getEligibleForNextRound(Championship $championship): Collection
    {
        $currentRound = $championship->matches()->max('round_number') ?? 0;

        // For Swiss, all participants continue
        if ($championship->getFormatEnum()->isSwiss()) {
            return $this->getEligibleParticipants($championship);
        }

        // For elimination, get winners from previous round
        if ($currentRound > 0) {
            $winnerIds = $championship->matches()
                ->where('round_number', $currentRound)
                ->completed() // Use model scope instead of direct status query
                ->whereNotNull('winner_id')
                ->pluck('winner_id');

            return $championship->participants()
                ->whereIn('user_id', $winnerIds)
                ->with('user')
                ->get();
        }

        // First round - all eligible participants
        return $this->getEligibleParticipants($championship);
    }

    /**
     * Validate standings integrity
     */
    public function validateStandings(Championship $championship): array
    {
        $errors = [];
        $standings = $championship->standings()->get();
        $matches = $this->getCompletedMatches($championship);

        // Check if all participants have standings
        $participants = $this->getEligibleParticipants($championship);
        foreach ($participants as $participant) {
            $standing = $standings->where('user_id', $participant->user_id)->first();
            if (!$standing) {
                $errors[] = "Missing standing for participant {$participant->user_id}";
            }
        }

        // Check rank continuity
        $sortedStandings = $standings->sortBy('rank')->values();
        $expectedRank = 1;
        foreach ($sortedStandings as $standing) {
            if ($standing->rank < $expectedRank) {
                $errors[] = "Invalid rank {$standing->rank} for user {$standing->user_id} (expected >= {$expectedRank})";
            }
            $expectedRank = max($expectedRank, $standing->rank + 1);
        }

        // Check score calculations
        foreach ($standings as $standing) {
            $calculatedScore = $this->calculateScoreFromMatches($standing->user_id, $matches);
            if (abs($standing->score - $calculatedScore) > 0.001) {
                $errors[] = "Score mismatch for user {$standing->user_id}: stored {$standing->score}, calculated {$calculatedScore}";
            }
        }

        return $errors;
    }

    /**
     * Calculate score from matches for validation
     */
    private function calculateScoreFromMatches(int $userId, Collection $matches): float
    {
        $score = 0;
        $userMatches = $matches->filter(function ($match) use ($userId) {
            return $match->player1_id === $userId || $match->player2_id === $userId;
        });

        foreach ($userMatches as $match) {
            $result = $this->getMatchResult($match, $userId);
            switch ($result) {
                case 'win':
                    $score += 1;
                    break;
                case 'draw':
                    $score += 0.5;
                    break;
            }
        }

        return $score;
    }
}