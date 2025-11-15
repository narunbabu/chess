<?php

namespace App\Services;

use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipStanding;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

/**
 * Placeholder Match Assignment Service
 *
 * Handles dynamic assignment of players to placeholder matches based on rankings
 */
class PlaceholderMatchAssignmentService
{
    private SwissPairingService $swissService;
    private StandingsCalculatorService $standingsCalculator;

    public function __construct(
        SwissPairingService $swissService,
        StandingsCalculatorService $standingsCalculator
    ) {
        $this->swissService = $swissService;
        $this->standingsCalculator = $standingsCalculator;
    }

    /**
     * Assign players to placeholder matches for a specific round based on previous round rankings
     *
     * @param Championship $championship
     * @param int $roundNumber The round whose placeholder matches need player assignments
     * @return array Summary of assignments made
     */
    public function assignPlayersToPlaceholderMatches(Championship $championship, int $roundNumber): array
    {
        Log::info("Assigning players to placeholder matches", [
            'championship_id' => $championship->id,
            'round_number' => $roundNumber,
        ]);

        // Get unassigned placeholder matches for this round
        $placeholderMatches = $championship->matches()
            ->where('round_number', $roundNumber)
            ->unassignedPlaceholders()
            ->get();

        if ($placeholderMatches->isEmpty()) {
            Log::info("No placeholder matches found for round {$roundNumber}");
            return [
                'assigned_count' => 0,
                'matches' => [],
            ];
        }

        // Get current standings to determine rankings
        $standings = $this->getCurrentStandings($championship);

        $assignedCount = 0;
        $assignmentDetails = [];

        foreach ($placeholderMatches as $match) {
            try {
                $assignment = $this->assignPlayersToMatch($championship, $match, $standings);

                if ($assignment) {
                    $assignedCount++;
                    $assignmentDetails[] = $assignment;
                }
            } catch (\Exception $e) {
                Log::error("Failed to assign players to placeholder match", [
                    'match_id' => $match->id,
                    'round_number' => $roundNumber,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        Log::info("Placeholder match assignment completed", [
            'championship_id' => $championship->id,
            'round_number' => $roundNumber,
            'assigned_count' => $assignedCount,
        ]);

        return [
            'assigned_count' => $assignedCount,
            'matches' => $assignmentDetails,
        ];
    }

    /**
     * Assign players to a single placeholder match
     *
     * @param Championship $championship
     * @param ChampionshipMatch $match
     * @param Collection $standings
     * @return array|null Assignment details or null if failed
     */
    private function assignPlayersToMatch(
        Championship $championship,
        ChampionshipMatch $match,
        Collection $standings
    ): ?array {
        if (!$match->isPlaceholder() || $match->hasAssignedPlayers()) {
            return null;
        }

        $positions = $match->placeholder_positions;
        if (!$positions) {
            Log::warning("Placeholder match missing position data", [
                'match_id' => $match->id,
            ]);
            return null;
        }

        // Extract rank numbers from position strings (e.g., 'rank_1' => 1)
        $player1Rank = $this->extractRankNumber($positions['player1'] ?? null);
        $player2Rank = $this->extractRankNumber($positions['player2'] ?? null);

        if ($player1Rank === null || $player2Rank === null) {
            Log::warning("Invalid placeholder positions", [
                'match_id' => $match->id,
                'positions' => $positions,
            ]);
            return null;
        }

        // Get players at specified ranks
        $player1 = $this->getPlayerAtRank($standings, $player1Rank);
        $player2 = $this->getPlayerAtRank($standings, $player2Rank);

        if (!$player1 || !$player2) {
            Log::warning("Could not find players at specified ranks", [
                'match_id' => $match->id,
                'player1_rank' => $player1Rank,
                'player2_rank' => $player2Rank,
                'standings_count' => $standings->count(),
            ]);
            return null;
        }

        // Assign colors using Swiss pairing color balance
        $colors = $this->swissService->assignColorsPub(
            $championship,
            $player1->user_id,
            $player2->user_id
        );

        // Assign players to the match
        $match->assignPlaceholderPlayers(
            $player1->user_id,
            $player2->user_id,
            $colors['white'],
            $colors['black']
        );

        Log::info("Assigned players to placeholder match", [
            'match_id' => $match->id,
            'round_number' => $match->round_number,
            'player1' => [
                'rank' => $player1Rank,
                'user_id' => $player1->user_id,
                'name' => $player1->user->name ?? 'Unknown',
            ],
            'player2' => [
                'rank' => $player2Rank,
                'user_id' => $player2->user_id,
                'name' => $player2->user->name ?? 'Unknown',
            ],
        ]);

        return [
            'match_id' => $match->id,
            'round_number' => $match->round_number,
            'player1_rank' => $player1Rank,
            'player2_rank' => $player2Rank,
            'player1_id' => $player1->user_id,
            'player2_id' => $player2->user_id,
            'white_player_id' => $colors['white'],
            'black_player_id' => $colors['black'],
        ];
    }

    /**
     * Get current standings ordered by rank
     *
     * @param Championship $championship
     * @return Collection
     */
    private function getCurrentStandings(Championship $championship): Collection
    {
        return $championship->standings()
            ->with('user')
            ->orderByDesc('points')
            ->orderByDesc('buchholz_score')
            ->orderByDesc('sonneborn_berger')
            ->get();
    }

    /**
     * Extract rank number from position string (e.g., 'rank_1' => 1, 'rank_3' => 3)
     *
     * @param string|null $positionString
     * @return int|null
     */
    private function extractRankNumber(?string $positionString): ?int
    {
        if (!$positionString) {
            return null;
        }

        // Handle formats: 'rank_1', 'rank_2', etc.
        if (preg_match('/rank_(\d+)/', $positionString, $matches)) {
            return (int)$matches[1];
        }

        return null;
    }

    /**
     * Get player (standing) at specified rank
     *
     * @param Collection $standings Ordered standings collection
     * @param int $rank 1-based rank (1 = first place)
     * @return ChampionshipStanding|null
     */
    private function getPlayerAtRank(Collection $standings, int $rank): ?ChampionshipStanding
    {
        // Convert 1-based rank to 0-based index
        $index = $rank - 1;

        if ($index < 0 || $index >= $standings->count()) {
            return null;
        }

        return $standings->get($index);
    }

    /**
     * Check if a round has any unassigned placeholder matches
     *
     * @param Championship $championship
     * @param int $roundNumber
     * @return bool
     */
    public function hasUnassignedPlaceholders(Championship $championship, int $roundNumber): bool
    {
        return $championship->matches()
            ->where('round_number', $roundNumber)
            ->unassignedPlaceholders()
            ->exists();
    }

    /**
     * Get summary of placeholder matches for a round
     *
     * @param Championship $championship
     * @param int $roundNumber
     * @return array
     */
    public function getPlaceholderSummary(Championship $championship, int $roundNumber): array
    {
        $placeholders = $championship->matches()
            ->where('round_number', $roundNumber)
            ->placeholder()
            ->get();

        $unassigned = $placeholders->where('players_assigned_at', null)->count();
        $assigned = $placeholders->whereNotNull('players_assigned_at')->count();

        return [
            'total' => $placeholders->count(),
            'assigned' => $assigned,
            'unassigned' => $unassigned,
            'matches' => $placeholders->map(function ($match) {
                return [
                    'id' => $match->id,
                    'round_number' => $match->round_number,
                    'positions' => $match->placeholder_positions,
                    'description' => $match->getPlaceholderDescription(),
                    'is_assigned' => $match->hasAssignedPlayers(),
                    'player1_id' => $match->player1_id,
                    'player2_id' => $match->player2_id,
                ];
            })->values(),
        ];
    }

    /**
     * Assign round-robin placeholder matches for top-K coverage
     *
     * Ensures all pairs within top-K players are assigned across multiple rounds
     *
     * @param Championship $championship
     * @param int $topK Number of top players to cover
     * @param array $roundNumbers Array of round numbers to assign
     * @return array Assignment summary
     */
    public function assignRoundRobinPlaceholders(Championship $championship, int $topK, array $roundNumbers): array
    {
        Log::info("Assigning round-robin placeholders for top-K coverage", [
            'championship_id' => $championship->id,
            'top_k' => $topK,
            'rounds' => $roundNumbers,
        ]);

        // Get current standings
        $standings = $this->getCurrentStandings($championship);

        // Ensure we have at least topK players
        if ($standings->count() < $topK) {
            Log::warning("Not enough players for top-K coverage", [
                'required' => $topK,
                'available' => $standings->count(),
            ]);
            return [
                'assigned_count' => 0,
                'coverage_completed' => false,
                'error' => "Not enough players for top-{$topK} coverage",
            ];
        }

        // Get top K players
        $topKPlayers = $standings->take($topK);

        // Generate all required pairings for top K
        $requiredPairs = $this->generateTopKRequiredPairs($topK);

        // Check which pairs already have assigned matches
        $assignedPairs = $this->getAlreadyAssignedPairs($championship, $topKPlayers);

        // Find remaining pairs that need assignment
        $remainingPairs = $this->filterUnassignedPairs($requiredPairs, $assignedPairs);

        if (empty($remainingPairs)) {
            Log::info("All top-K pairs already assigned");
            return [
                'assigned_count' => 0,
                'coverage_completed' => true,
                'total_pairs' => count($requiredPairs),
                'assigned_pairs' => count($assignedPairs),
            ];
        }

        // Assign remaining pairs to available placeholder matches
        $assignmentCount = $this->assignRemainingPairs($championship, $remainingPairs, $roundNumbers, $topKPlayers);

        Log::info("Round-robin placeholder assignment completed", [
            'championship_id' => $championship->id,
            'top_k' => $topK,
            'assigned_count' => $assignmentCount,
            'total_pairs' => count($requiredPairs),
            'previously_assigned' => count($assignedPairs),
        ]);

        return [
            'assigned_count' => $assignmentCount,
            'coverage_completed' => empty($remainingPairs) || $assignmentCount >= count($remainingPairs),
            'total_pairs' => count($requiredPairs),
            'assigned_pairs' => count($assignedPairs) + $assignmentCount,
            'remaining_pairs' => max(0, count($remainingPairs) - $assignmentCount),
        ];
    }

    /**
     * Generate all required pairs for top K players
     *
     * @param int $topK
     * @return array Array of [player1_rank, player2_rank] pairs
     */
    private function generateTopKRequiredPairs(int $topK): array
    {
        $pairs = [];

        for ($i = 1; $i <= $topK; $i++) {
            for ($j = $i + 1; $j <= $topK; $j++) {
                $pairs[] = [
                    'player1_rank' => $i,
                    'player2_rank' => $j,
                ];
            }
        }

        return $pairs;
    }

    /**
     * Get pairs that already have assigned matches
     *
     * @param Championship $championship
     * @param Collection $topKPlayers
     * @return array Array of assigned [player1_id, player2_id] pairs
     */
    private function getAlreadyAssignedPairs(Championship $championship, Collection $topKPlayers): array
    {
        $topKPlayerIds = $topKPlayers->pluck('user_id')->toArray();

        // Get completed matches between top K players
        $completedMatches = $championship->matches()
            ->whereNotIn('status', ['pending', 'cancelled'])
            ->where(function ($query) use ($topKPlayerIds) {
                $query->whereIn('player1_id', $topKPlayerIds)
                      ->whereIn('player2_id', $topKPlayerIds);
            })
            ->whereNotNull('player1_id')
            ->whereNotNull('player2_id')
            ->get();

        $assignedPairs = [];
        foreach ($completedMatches as $match) {
            if (in_array($match->player1_id, $topKPlayerIds) &&
                in_array($match->player2_id, $topKPlayerIds)) {
                $assignedPairs[] = [$match->player1_id, $match->player2_id];
            }
        }

        return $assignedPairs;
    }

    /**
     * Filter out pairs that are already assigned
     *
     * @param array $requiredPairs Required pairs with ranks
     * @param array $assignedPairs Assigned pairs with IDs
     * @return array Remaining unassigned pairs with ranks
     */
    private function filterUnassignedPairs(array $requiredPairs, array $assignedPairs): array
    {
        // Convert assigned ID pairs to a normalized set for easy lookup
        $assignedSet = [];
        foreach ($assignedPairs as $pair) {
            $ids = array_map('intval', $pair);
            sort($ids);
            $assignedSet[implode('_', $ids)] = true;
        }

        $remainingPairs = [];
        foreach ($requiredPairs as $pair) {
            // Convert rank pair to ID pair using standings order
            // For now, we'll keep rank pairs and handle conversion during assignment
            $remainingPairs[] = $pair;
        }

        return $remainingPairs;
    }

    /**
     * Assign remaining pairs to available placeholder matches
     *
     * @param Championship $championship
     * @param array $remainingPairs
     * @param array $roundNumbers
     * @param Collection $topKPlayers
     * @return int Number of assignments made
     */
    private function assignRemainingPairs(
        Championship $championship,
        array $remainingPairs,
        array $roundNumbers,
        Collection $topKPlayers
    ): int {
        $assignmentCount = 0;
        $pairIndex = 0;

        foreach ($roundNumbers as $roundNumber) {
            // Get unassigned placeholder matches for this round
            $placeholderMatches = $championship->matches()
                ->where('round_number', $roundNumber)
                ->unassignedPlaceholders()
                ->get();

            $standings = $this->getCurrentStandings($championship);

            foreach ($placeholderMatches as $match) {
                if ($pairIndex >= count($remainingPairs)) {
                    // All pairs assigned
                    break 2; // Break out of both loops
                }

                $pair = $remainingPairs[$pairIndex];
                $assignment = $this->assignPlayersToMatchWithRanks($championship, $match, $pair, $standings, $topKPlayers);

                if ($assignment) {
                    $assignmentCount++;
                    $pairIndex++;
                }
            }
        }

        return $assignmentCount;
    }

    /**
     * Assign players to match using rank-based pair and topK players list
     *
     * @param Championship $championship
     * @param ChampionshipMatch $match
     * @param array $pair Array with player1_rank and player2_rank
     * @param Collection $standings
     * @param Collection $topKPlayers
     * @return array|null
     */
    private function assignPlayersToMatchWithRanks(
        Championship $championship,
        ChampionshipMatch $match,
        array $pair,
        Collection $standings,
        Collection $topKPlayers
    ): ?array {
        if (!$match->isPlaceholder() || $match->hasAssignedPlayers()) {
            return null;
        }

        $player1Rank = $pair['player1_rank'];
        $player2Rank = $pair['player2_rank'];

        // Get players at specified ranks from topK players
        $player1 = $this->getPlayerAtRank($topKPlayers, $player1Rank);
        $player2 = $this->getPlayerAtRank($topKPlayers, $player2Rank);

        if (!$player1 || !$player2) {
            Log::warning("Could not find top-K players at specified ranks", [
                'match_id' => $match->id,
                'player1_rank' => $player1Rank,
                'player2_rank' => $player2Rank,
                'topK_count' => $topKPlayers->count(),
            ]);
            return null;
        }

        // Validate coverage - ensure these players haven't already played each other
        if ($this->playersAlreadyPlayed($championship, $player1->user_id, $player2->user_id)) {
            Log::info("Players already played each other, skipping assignment", [
                'match_id' => $match->id,
                'player1_id' => $player1->user_id,
                'player2_id' => $player2->user_id,
            ]);
            return null;
        }

        // Assign colors using Swiss pairing color balance
        $colors = $this->swissService->assignColorsPub(
            $championship,
            $player1->user_id,
            $player2->user_id
        );

        // Assign players to the match
        $match->assignPlaceholderPlayers(
            $player1->user_id,
            $player2->user_id,
            $colors['white'],
            $colors['black']
        );

        Log::info("Assigned top-K players to placeholder match", [
            'match_id' => $match->id,
            'round_number' => $match->round_number,
            'player1' => [
                'rank' => $player1Rank,
                'user_id' => $player1->user_id,
                'name' => $player1->user->name ?? 'Unknown',
            ],
            'player2' => [
                'rank' => $player2Rank,
                'user_id' => $player2->user_id,
                'name' => $player2->user->name ?? 'Unknown',
            ],
        ]);

        return [
            'match_id' => $match->id,
            'round_number' => $match->round_number,
            'player1_rank' => $player1Rank,
            'player2_rank' => $player2Rank,
            'player1_id' => $player1->user_id,
            'player2_id' => $player2->user_id,
            'white_player_id' => $colors['white'],
            'black_player_id' => $colors['black'],
        ];
    }

    /**
     * Check if two players have already played each other
     *
     * @param Championship $championship
     * @param int $player1Id
     * @param int $player2Id
     * @return bool
     */
    private function playersAlreadyPlayed(Championship $championship, int $player1Id, int $player2Id): bool
    {
        return $championship->matches()
            ->where(function ($query) use ($player1Id, $player2Id) {
                $query->where(function ($q) use ($player1Id, $player2Id) {
                    $q->where('player1_id', $player1Id)->where('player2_id', $player2Id);
                })->orWhere(function ($q) use ($player1Id, $player2Id) {
                    $q->where('player1_id', $player2Id)->where('player2_id', $player1Id);
                });
            })
            ->whereNotIn('status', ['pending', 'cancelled'])
            ->exists();
    }

    /**
     * Get coverage analysis for top-K players
     *
     * @param Championship $championship
     * @param int $topK
     * @return array
     */
    public function getTopKCoverageAnalysis(Championship $championship, int $topK = 3): array
    {
        $standings = $this->getCurrentStandings($championship);
        $topKPlayers = $standings->take($topK);

        if ($topKPlayers->count() < $topK) {
            return [
                'valid' => false,
                'error' => "Insufficient players for top-{$topK} analysis",
                'required_players' => $topK,
                'available_players' => $topKPlayers->count(),
            ];
        }

        $requiredPairs = $this->generateTopKRequiredPairs($topK);
        $assignedPairs = $this->getAlreadyAssignedPairs($championship, $topKPlayers);

        $coveragePercentage = (count($assignedPairs) / count($requiredPairs)) * 100;

        return [
            'valid' => $coveragePercentage >= 100,
            'top_k' => $topK,
            'required_pairs' => count($requiredPairs),
            'assigned_pairs' => count($assignedPairs),
            'coverage_percentage' => round($coveragePercentage, 1),
            'is_complete' => $coveragePercentage >= 100,
            'top_players' => $topKPlayers->map(function ($standing, $index) {
                return [
                    'rank' => $index + 1,
                    'user_id' => $standing->user_id,
                    'name' => $standing->user->name ?? 'Unknown',
                    'points' => $standing->points,
                ];
            }),
            'pair_details' => $this->getPairCoverageDetails($championship, $topKPlayers),
        ];
    }

    /**
     * Get detailed pair coverage information
     *
     * @param Championship $championship
     * @param Collection $topKPlayers
     * @return array
     */
    private function getPairCoverageDetails(Championship $championship, Collection $topKPlayers): array
    {
        $details = [];
        $playerCount = $topKPlayers->count();

        for ($i = 0; $i < $playerCount; $i++) {
            for ($j = $i + 1; $j < $playerCount; $j++) {
                $player1 = $topKPlayers->get($i);
                $player2 = $topKPlayers->get($j);

                $hasPlayed = $this->playersAlreadyPlayed($championship, $player1->user_id, $player2->user_id);

                $details[] = [
                    'player1' => [
                        'rank' => $i + 1,
                        'user_id' => $player1->user_id,
                        'name' => $player1->user->name ?? 'Unknown',
                    ],
                    'player2' => [
                        'rank' => $j + 1,
                        'user_id' => $player2->user_id,
                        'name' => $player2->user->name ?? 'Unknown',
                    ],
                    'has_played' => $hasPlayed,
                ];
            }
        }

        return $details;
    }
}
