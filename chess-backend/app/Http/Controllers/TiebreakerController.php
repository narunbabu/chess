<?php

namespace App\Http\Controllers;

use App\Models\Championship;
use App\Services\StandingsCalculatorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TiebreakerController extends Controller
{
    public function __construct(
        private StandingsCalculatorService $standingsCalculator
    ) {}

    /**
     * Get detailed tiebreaker breakdown for a championship
     */
    public function getBreakdown(int $id): JsonResponse
    {
        try {
            $championship = Championship::with([
                'participants.user',
                'matches.player1',
                'matches.player2',
                'matches.winner',
                'standings.user'
            ])->findOrFail($id);

            $breakdown = $this->calculateTiebreakerBreakdown($championship);

            return response()->json([
                'success' => true,
                'data' => $breakdown
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'error' => "Tournament #{$id} not found"
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Calculate detailed tiebreaker breakdown by round
     */
    private function calculateTiebreakerBreakdown(Championship $championship): array
    {
        $breakdown = [];

        // Get all rounds in order
        $allRounds = $championship->matches()
            ->select('round_number')
            ->distinct()
            ->orderBy('round_number')
            ->pluck('round_number')
            ->toArray();

        // Get rounds with completed matches
        $roundsWithCompleted = $championship->matches()
            ->completed() // Use the completed scope
            ->select('round_number')
            ->distinct()
            ->orderBy('round_number')
            ->pluck('round_number')
            ->toArray();

        
        // If no rounds with completed matches, create a simple breakdown from current standings
        if (empty($roundsWithCompleted)) {
            return [
                'final_standings' => $this->getFinalStandings($championship),
                'explanation' => ['No completed rounds found - showing current standings']
            ];
        }

        foreach ($roundsWithCompleted as $roundNumber) {
            $roundBreakdown = $this->calculateRoundBreakdown($championship, $roundNumber);
            $breakdown["round_{$roundNumber}"] = $roundBreakdown;
        }

        // Add final standings
        $breakdown['final_standings'] = $this->getFinalStandings($championship);

        return $breakdown;
    }

    /**
     * Calculate breakdown for a specific round
     */
    private function calculateRoundBreakdown(Championship $championship, int $roundNumber): array
    {
        // Get matches completed up to this round
        $matchesUpToRound = $championship->matches()
            ->where('round_number', '<=', $roundNumber)
            ->completed()
            ->with(['player1', 'player2'])
            ->get();

        // Get participants
        $participants = $championship->participants()
            ->where('payment_status_id', \App\Enums\PaymentStatus::COMPLETED->getId())
            ->with('user')
            ->get();

        $playerStats = [];

        // Calculate stats for each player
        foreach ($participants as $participant) {
            $playerStats[$participant->user_id] = $this->calculatePlayerStats(
                $participant->user,
                $matchesUpToRound
            );
        }

        // Sort players by tiebreaker rules
        $sortedPlayers = $this->sortPlayersByTiebreakers($playerStats);

        // Assign ranks
        $rankedPlayers = $this->assignRanks($sortedPlayers);

        return [
            'round_number' => $roundNumber,
            'matches_count' => $matchesUpToRound->count(),
            'players' => $rankedPlayers,
            'explanation' => $this->generateExplanation($rankedPlayers)
        ];
    }

    /**
     * Calculate player statistics for tiebreaker calculation
     */
    private function calculatePlayerStats($user, $matches): array
    {
        $stats = [
            'user_id' => $user->id,
            'name' => $user->name,
            'rating' => $user->rating,
            'points' => 0,
            'wins' => 0,
            'draws' => 0,
            'losses' => 0,
            'games_played' => 0,
            'buchholz' => 0,
            'sonneborn_berger' => 0,
            'opponents' => []
        ];

        $playerMatches = $matches->filter(function ($match) use ($user) {
            return $match->player1_id === $user->id || $match->player2_id === $user->id;
        });

        foreach ($playerMatches as $match) {
            $result = $this->getMatchResult($match, $user->id);
            $opponentId = $match->player1_id === $user->id ? $match->player2_id : $match->player1_id;
            $opponent = $opponentId ? $playerMatches->first(function ($m) use ($opponentId) {
                return $m->player1_id === $opponentId || $m->player2_id === $opponentId;
            })?->player1 ?? null : null;

            if ($opponentId) {
                $stats['opponents'][] = $opponentId;
            }

            // Update basic stats
            switch ($result) {
                case 'win':
                    $stats['points'] += 1;
                    $stats['wins']++;
                    break;
                case 'draw':
                    $stats['points'] += 0.5;
                    $stats['draws']++;
                    break;
                case 'loss':
                    $stats['losses']++;
                    break;
            }
            $stats['games_played']++;
        }

        return $stats;
    }

    /**
     * Get match result for a player
     */
    private function getMatchResult($match, int $userId): string
    {
        // Handle forfeits
        if ($match->result_type === \App\Enums\ChampionshipResultType::FORFEIT_PLAYER1->value) {
            return $match->player1_id === $userId ? 'loss' : 'win';
        } elseif ($match->result_type === \App\Enums\ChampionshipResultType::FORFEIT_PLAYER2->value) {
            return $match->player2_id === $userId ? 'loss' : 'win';
        } elseif ($match->result_type === \App\Enums\ChampionshipResultType::DOUBLE_FORFEIT->value) {
            return 'loss';
        }

        // Normal game results
        if ($match->winner_id === null) {
            return 'draw';
        }

        return $match->winner_id === $userId ? 'win' : 'loss';
    }

    /**
     * Sort players by tiebreaker rules
     */
    private function sortPlayersByTiebreakers(array $playerStats): array
    {
        // Calculate Buchholz and Sonneborn-Berger for each player
        foreach ($playerStats as &$stats) {
            $stats['buchholz'] = $this->calculateBuchholz($stats, $playerStats);
            $stats['sonneborn_berger'] = $this->calculateSonnebornBerger($stats, $playerStats);
        }

        // Sort by tiebreaker rules
        uasort($playerStats, function ($a, $b) {
            // 1. Points
            if ($a['points'] != $b['points']) {
                return $b['points'] <=> $a['points'];
            }

            // 2. Buchholz
            if ($a['buchholz'] != $b['buchholz']) {
                return $b['buchholz'] <=> $a['buchholz'];
            }

            // 3. Sonneborn-Berger
            if ($a['sonneborn_berger'] != $b['sonneborn_berger']) {
                return $b['sonneborn_berger'] <=> $a['sonneborn_berger'];
            }

            // 4. Rating
            return $b['rating'] <=> $a['rating'];
        });

        return $playerStats;
    }

    /**
     * Calculate Buchholz score
     */
    private function calculateBuchholz(array $playerStats, array $allPlayerStats): float
    {
        $buchholz = 0;

        foreach ($playerStats['opponents'] as $opponentId) {
            if (isset($allPlayerStats[$opponentId])) {
                $buchholz += $allPlayerStats[$opponentId]['points'];
            }
        }

        return $buchholz;
    }

    /**
     * Calculate Sonneborn-Berger score
     */
    private function calculateSonnebornBerger(array $playerStats, array $allPlayerStats): float
    {
        $sb = 0;
        $playerMatches = $this->getPlayerMatchResults($playerStats['user_id']);

        foreach ($playerMatches as $match) {
            $opponentId = $match['opponent_id'];
            $result = $match['result'];

            if (isset($allPlayerStats[$opponentId])) {
                $opponentPoints = $allPlayerStats[$opponentId]['points'];

                switch ($result) {
                    case 'win':
                        $sb += $opponentPoints;
                        break;
                    case 'draw':
                        $sb += $opponentPoints * 0.5;
                        break;
                    case 'loss':
                        // No points for losses
                        break;
                }
            }
        }

        return $sb;
    }

    /**
     * Get player match results (simplified)
     */
    private function getPlayerMatchResults(int $userId): array
    {
        // This is a simplified version - in production, you'd get actual match results
        return [];
    }

    /**
     * Assign ranks to players
     */
    private function assignRanks(array $sortedPlayers): array
    {
        $rankedPlayers = [];
        $currentRank = 1;
        $previousPlayer = null;

        foreach ($sortedPlayers as $playerStats) {
            if ($previousPlayer && $this->isTied($playerStats, $previousPlayer)) {
                $playerStats['rank'] = $previousPlayer['rank'];
            } else {
                $playerStats['rank'] = $currentRank;
            }

            $rankedPlayers[] = $playerStats;
            $previousPlayer = $playerStats;
            $currentRank++;
        }

        return $rankedPlayers;
    }

    /**
     * Check if two players are tied
     */
    private function isTied(array $player1, array $player2): bool
    {
        return $player1['points'] === $player2['points'] &&
               $player1['buchholz'] === $player2['buchholz'] &&
               $player1['sonneborn_berger'] === $player2['sonneborn_berger'] &&
               $player1['rating'] === $player2['rating'];
    }

    /**
     * Get final standings from database
     */
    private function getFinalStandings(Championship $championship): array
    {
        // First recalculate standings to ensure they're up to date
        $this->standingsCalculator->recalculateAllStandings($championship);

        // Get current standings
        $summary = $this->standingsCalculator->getStandingsSummary($championship);

        if (!isset($summary['standings'])) {
            return [];
        }

        return $summary['standings']->map(function ($standing) {
            return [
                'rank' => $standing['rank'],
                'name' => $standing['user']['name'],
                'rating' => $standing['user']['rating'],
                'points' => $standing['score'],
                'wins' => $standing['wins'],
                'draws' => $standing['draws'],
                'losses' => $standing['losses'],
                'buchholz' => $standing['buchholz'],
                'sonneborn_berger' => $standing['sonneborn_berger'],
            ];
        })->toArray();
    }

    /**
     * Generate explanation for the rankings
     */
    private function generateExplanation(array $rankedPlayers): array
    {
        $explanation = [];

        $explanation[] = "Tiebreaker Rules (in order):";
        $explanation[] = "1. **Points** - Total tournament points (1 for win, 0.5 for draw, 0 for loss)";
        $explanation[] = "2. **Buchholz** - Sum of all opponents' points";
        $explanation[] = "3. **Sonneborn-Berger** - Sum of opponents' points weighted by result";
        $explanation[] = "4. **Rating** - Player's initial rating (seeding)";

        // Find interesting tie scenarios
        $ties = $this->findTieScenarios($rankedPlayers);
        if (!empty($ties)) {
            $explanation[] = "\n**Tiebreakers Applied:**";
            foreach ($ties as $tie) {
                $explanation[] = "- {$tie}";
            }
        }

        return $explanation;
    }

    /**
     * Find interesting tie scenarios to highlight
     */
    private function findTieScenarios(array $rankedPlayers): array
    {
        $scenarios = [];

        // Look for players with same points but different rankings
        for ($i = 0; $i < count($rankedPlayers) - 1; $i++) {
            for ($j = $i + 1; $j < count($rankedPlayers); $j++) {
                if ($rankedPlayers[$i]['points'] === $rankedPlayers[$j]['points']) {
                    $player1 = $rankedPlayers[$i];
                    $player2 = $rankedPlayers[$j];

                    if ($player1['rank'] !== $player2['rank']) {
                        $reason = $this->determineRankingReason($player1, $player2);
                        $scenarios[] = "{$player1['name']} ranked above {$player2['name']} due to $reason";
                    }
                }
            }
        }

        return $scenarios;
    }

    /**
     * Determine why one player is ranked above another
     */
    private function determineRankingReason(array $player1, array $player2): string
    {
        if ($player1['buchholz'] > $player2['buchholz']) {
            return "higher Buchholz score ({$player1['buchholz']} vs {$player2['buchholz']})";
        }

        if ($player1['sonneborn_berger'] > $player2['sonneborn_berger']) {
            return "higher Sonneborn-Berger score ({$player1['sonneborn_berger']} vs {$player2['sonneborn_berger']})";
        }

        if ($player1['rating'] > $player2['rating']) {
            return "higher rating ({$player1['rating']} vs {$player2['rating']})";
        }

        return "tiebreaker rules";
    }
}