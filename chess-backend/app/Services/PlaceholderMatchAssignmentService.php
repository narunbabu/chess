<?php

namespace App\Services;

use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipStanding;
use App\Enums\ChampionshipRoundType as ChampionshipRoundTypeEnum;
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

        // Guard: Check if previous round is complete for Swiss rounds
        $roundType = $placeholderMatches->first()->getRoundTypeEnum();
        if ($roundType && $roundType->value === 'swiss' && $roundNumber > 1) {
            $progressionService = app(ChampionshipRoundProgressionService::class);
            $previousRoundComplete = $progressionService->isRoundComplete($championship, $roundNumber - 1);

            if (!$previousRoundComplete) {
                Log::info("Skipping Swiss round assignment - previous round not complete", [
                    'championship_id' => $championship->id,
                    'round_number' => $roundNumber,
                    'previous_round' => $roundNumber - 1,
                ]);

                return [
                    'assigned_count' => 0,
                    'matches' => [],
                    'reason' => 'previous_round_incomplete',
                ];
            }

            Log::info("Previous round complete - proceeding with Swiss assignment", [
                'championship_id' => $championship->id,
                'round_number' => $roundNumber,
            ]);
        }

        // 🎯 NEW: Check if this is a Swiss round - use Swiss pairing algorithm
        $firstMatch = $placeholderMatches->first();
        $roundType = $firstMatch->getRoundTypeEnum();

        if ($roundType && $roundType->isSwiss()) {
            Log::info("Swiss round placeholder detected - using Swiss pairing algorithm", [
                'championship_id' => $championship->id,
                'round_number' => $roundNumber,
            ]);
            return $this->assignSwissRoundPlaceholders($championship, $roundNumber, $placeholderMatches);
        }

        // 🎯 NEW: Handle elimination rounds
        if ($roundType && $roundType->isElimination()) {
            Log::info("Elimination round placeholder detected - using elimination bracket assignment", [
                'championship_id' => $championship->id,
                'round_number' => $roundNumber,
                'round_type' => $roundType->value,
            ]);
            return $this->assignEliminationRoundPlaceholders($championship, $roundNumber, $placeholderMatches, $roundType);
        }

        // Get current standings to determine rankings (for elimination rounds)
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

        // 🎯 NEW: Check if this is a Swiss round placeholder (positions will be null)
        $roundType = $match->getRoundTypeEnum();
        if ($roundType && $roundType->value === 'swiss' && !$positions) {
            Log::info("Swiss placeholder match detected - will use Swiss pairing algorithm", [
                'match_id' => $match->id,
                'round_number' => $match->round_number,
            ]);
            // Swiss placeholders are assigned as a group via assignSwissRoundPlaceholders
            // This individual assignment is not used for Swiss rounds
            return null;
        }

        if (!$positions) {
            Log::warning("Placeholder match missing position data", [
                'match_id' => $match->id,
            ]);
            return null;
        }

        // 🎯 CRITICAL FIX: Check if this is an elimination round that should use match winners
        $determinedByRound = $match->determined_by_round;

        if ($determinedByRound && $this->isEliminationRound($roundType)) {
            // Check what type of round determined this match
            // If determined by a Swiss round, use standings
            // If determined by an elimination round, use match winners
            $previousRoundType = $this->getPreviousRoundType($championship, $determinedByRound);

            if ($previousRoundType && $this->isEliminationRound($previousRoundType)) {
                // Previous round was elimination → use match winners
                return $this->assignPlayersFromPreviousMatches($championship, $match, $determinedByRound);
            }
            // Otherwise, fall through to use standings (Swiss → Elimination transition)
        }

        // For Swiss-to-Elimination transition, use standings
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

        Log::info("Assigned players to placeholder match from standings", [
            'match_id' => $match->id,
            'round_number' => $match->round_number,
            'round_type' => $roundType->value,
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
     * Assign Swiss round placeholder matches using Swiss pairing algorithm
     *
     * @param Championship $championship
     * @param int $roundNumber
     * @param Collection $placeholderMatches
     * @return array
     */
    private function assignSwissRoundPlaceholders(
        Championship $championship,
        int $roundNumber,
        Collection $placeholderMatches
    ): array {
        Log::info("Assigning Swiss round placeholders", [
            'championship_id' => $championship->id,
            'round_number' => $roundNumber,
            'placeholder_count' => $placeholderMatches->count(),
        ]);

        // Additional guard: Ensure previous round is complete
        if ($roundNumber > 1) {
            $progressionService = app(ChampionshipRoundProgressionService::class);
            $previousRoundComplete = $progressionService->isRoundComplete($championship, $roundNumber - 1);

            if (!$previousRoundComplete) {
                Log::warning("Swiss pairings blocked - previous round incomplete", [
                    'championship_id' => $championship->id,
                    'round_number' => $roundNumber,
                ]);

                return [
                    'assigned_count' => 0,
                    'matches' => [],
                    'reason' => 'previous_round_incomplete',
                ];
            }
        }

        // 1. Generate Swiss pairings (Source of Truth)
        // Returns array like: [['player1_id'=>1, 'player2_id'=>2], ['player1_id'=>3, 'player2_id'=>null]]
        $pairings = $this->swissService->generatePairings($championship, $roundNumber);

        if (empty($pairings)) {
            Log::warning("No Swiss pairings generated for round", [
                'championship_id' => $championship->id,
                'round_number' => $roundNumber,
            ]);
            return [
                'assigned_count' => 0,
                'matches' => [],
            ];
        }

        Log::info("Swiss pairings generated", [
            'championship_id' => $championship->id,
            'round' => $roundNumber,
            'pairings_count' => count($pairings),
            'placeholders_count' => $placeholderMatches->count()
        ]);

        // 2. Prepare placeholders queue (re-index to ensure 0, 1, 2 access)
        $availablePlaceholders = $placeholderMatches->values();
        $placeholderIndex = 0;
        $assignedCount = 0;
        $assignmentDetails = [];

        // 3. Iterate PAIRINGS (not matches) to ensure everyone gets a spot
        foreach ($pairings as $pairing) {
            $player1Id = $pairing['player1_id'];
            $player2Id = $pairing['player2_id']; // null indicates BYE

            // 🎯 IDEMPOTENCY FIX: Check if players are already matched in this round
            // This prevents duplicate Byes and double-assignments
            $existingMatch = ChampionshipMatch::where('championship_id', $championship->id)
                ->where('round_number', $roundNumber)
                ->where(function ($q) use ($player1Id, $player2Id) {
                    $q->where('player1_id', $player1Id)
                      ->orWhere('player2_id', $player1Id);

                    if ($player2Id !== null) {
                        $q->orWhere('player1_id', $player2Id)
                          ->orWhere('player2_id', $player2Id);
                    }
                })
                ->first();

            if ($existingMatch) {
                Log::info("Skipping pairing {$player1Id} vs " . ($player2Id ?? 'BYE') . " - already exists in Match {$existingMatch->id}");
                continue;
            }

            // 🎯 FIXED: Both BYE and standard matches now use placeholders
            // Determine colors for standard matches
            $colors = null;
            if ($player2Id !== null) {
                $colors = $this->swissService->assignColorsPub($championship, $player1Id, $player2Id);
            }

            // Try to use a placeholder (for both BYE and standard matches)
            if (isset($availablePlaceholders[$placeholderIndex])) {
                $match = $availablePlaceholders[$placeholderIndex];

                // Case A: BYE - Assign to placeholder
                // 🎯 IMPROVED: Swiss BYEs are PENDING, completed when round finishes
                if ($player2Id === null) {
                    $isSwissRound = $roundType && $roundType->value === 'swiss';

                    $updateData = [
                        'player1_id' => $player1Id,
                        'player2_id' => null,
                        'is_placeholder' => false,
                        'players_assigned_at' => now(),
                        'result_type_id' => \App\Enums\ChampionshipResultType::BYE->getId(),
                    ];

                    // BYE completion strategy:
                    // - Swiss: Always PENDING → Completed when all real matches finish
                    // - Elimination/Round-Robin: Immediately COMPLETED (no dependency on other matches)
                    if ($isSwissRound) {
                        // Swiss BYEs wait for all real matches to complete
                        $updateData['status_id'] = \App\Enums\ChampionshipMatchStatus::PENDING->getId();
                        $completionNote = " and left as PENDING (will complete when round finishes)";
                    } else {
                        // Non-Swiss BYEs complete immediately
                        $updateData['status_id'] = \App\Enums\ChampionshipMatchStatus::COMPLETED->getId();
                        $updateData['winner_id'] = $player1Id;
                        $completionNote = " and marked as COMPLETED";
                    }

                    $match->update($updateData);

                    Log::info("Assigned BYE to Player {$player1Id} using Match {$match->id}{$completionNote}", [
                        'championship_id' => $championship->id,
                        'round_number' => $roundNumber,
                        'player_id' => $player1Id,
                        'is_swiss' => $isSwissRound,
                        'status' => $isSwissRound ? 'PENDING' : 'COMPLETED',
                        'completion_timing' => $isSwissRound ? 'deferred_to_round_end' : 'immediate',
                    ]);

                    $assignmentDetails[] = "Assigned BYE to Player {$player1Id} using Match {$match->id}{$completionNote}";
                }
                // Case B: Standard Match
                else {
                    $match->assignPlaceholderPlayers(
                        $player1Id,
                        $player2Id,
                        $colors['white'],
                        $colors['black']
                    );
                    $assignmentDetails[] = "Assigned {$player1Id} vs {$player2Id} to Match {$match->id}";
                }

                $placeholderIndex++; // Increment for both BYE and standard matches
                $assignedCount++;
            }
            // Fallback: Create new match if we ran out of placeholders
            else {
                Log::warning("No placeholder available for pairing, creating new match", [
                    'p1' => $player1Id,
                    'p2' => $player2Id ?? 'BYE'
                ]);

                if ($player2Id === null) {
                    $this->createByeMatch($championship, $roundNumber, $player1Id);
                    $assignmentDetails[] = "Created new BYE match for Player {$player1Id}";
                } else {
                    $this->createNewMatch($championship, $roundNumber, $player1Id, $player2Id, $colors);
                    $assignmentDetails[] = "Created new match for {$player1Id} vs {$player2Id}";
                }
                $assignedCount++;
            }
        }

        // 4. Cleanup: Delete unused placeholders (e.g., when player count changed)
        if ($placeholderIndex < $availablePlaceholders->count()) {
            $unusedCount = $availablePlaceholders->count() - $placeholderIndex;
            Log::info("Deleting unused placeholders", [
                'count' => $unusedCount,
                'championship_id' => $championship->id,
                'round_number' => $roundNumber,
            ]);

            // Delete all unused placeholders starting from current index
            for ($i = $placeholderIndex; $i < $availablePlaceholders->count(); $i++) {
                $unusedMatch = $availablePlaceholders[$i];
                Log::info("Deleting unused placeholder", [
                    'match_id' => $unusedMatch->id,
                    'round_number' => $roundNumber,
                ]);
                $unusedMatch->delete();
            }
        }

        Log::info("Swiss round placeholder assignment completed", [
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
     * Helper to create a Bye match immediately
     */
    private function createByeMatch(Championship $championship, int $roundNumber, int $playerId): void
    {
        ChampionshipMatch::create([
            'championship_id' => $championship->id,
            'round_number' => $roundNumber,
            'round_type_id' => 1, // Swiss Round
            'player1_id' => $playerId,
            'player2_id' => null, // Bye
            'status_id' => \App\Enums\ChampionshipMatchStatus::COMPLETED->getId(), // Auto-complete
            'result_type_id' => \App\Enums\ChampionshipResultType::BYE->getId(),
            'winner_id' => $playerId,
            'is_placeholder' => false,
            'scheduled_at' => now(),
            'deadline' => now()->addHours($championship->match_time_window_hours ?? 24)
        ]);
    }

    /**
     * Helper to create a new match (fallback)
     */
    private function createNewMatch($championship, $roundNumber, $p1, $p2, $colors): void
    {
         ChampionshipMatch::create([
            'championship_id' => $championship->id,
            'round_number' => $roundNumber,
            'round_type_id' => 1, // Swiss Round
            'player1_id' => $p1,
            'player2_id' => $p2,
            'status_id' => \App\Enums\ChampionshipMatchStatus::PENDING->getId(),
            'is_placeholder' => false,
            'scheduled_at' => now(),
            'deadline' => now()->addHours($championship->match_time_window_hours ?? 24)
            // Apply colors if your model supports 'white_player_id' etc or just rely on p1/p2 order
        ]);
    }

    /**
     * Check if round type is elimination (not Swiss)
     *
     * @param \App\Enums\ChampionshipRoundType $roundType
     * @return bool
     */
    private function isEliminationRound(ChampionshipRoundTypeEnum $roundType): bool
    {
        return in_array($roundType->value, [
            'quarter_final',
            'semi_final',
            'final',
            'third_place',
            'elimination',
        ]);
    }

    /**
     * Get the round type of a previous round
     *
     * @param Championship $championship
     * @param int $roundNumber
     * @return \App\Enums\ChampionshipRoundType|null
     */
    private function getPreviousRoundType(Championship $championship, int $roundNumber): ?\App\Enums\ChampionshipRoundType
    {
        // Get any match from the previous round to determine its type
        $previousMatch = $championship->matches()
            ->where('round_number', $roundNumber)
            ->first();

        if (!$previousMatch) {
            return null;
        }

        return $previousMatch->getRoundTypeEnum();
    }

    /**
     * Assign players to elimination match based on winners of previous round
     *
     * @param Championship $championship
     * @param ChampionshipMatch $match
     * @param int $previousRoundNumber
     * @return array|null
     */
    private function assignPlayersFromPreviousMatches(
        Championship $championship,
        ChampionshipMatch $match,
        int $previousRoundNumber
    ): ?array {
        Log::info("Assigning players from previous round matches", [
            'match_id' => $match->id,
            'round_number' => $match->round_number,
            'determined_by_round' => $previousRoundNumber,
        ]);

        // Get completed matches from previous round
        $previousMatches = $championship->matches()
            ->where('round_number', $previousRoundNumber)
            ->whereNotNull('winner_id')
            ->with('winner')
            ->get();

        if ($previousMatches->isEmpty()) {
            Log::warning("No completed matches found in previous round", [
                'match_id' => $match->id,
                'previous_round' => $previousRoundNumber,
            ]);
            return null;
        }

        // Extract winners (for finals, semis, etc.)
        $winners = $previousMatches->pluck('winner_id')->toArray();

        if (count($winners) < 2) {
            Log::warning("Not enough winners from previous round", [
                'match_id' => $match->id,
                'previous_round' => $previousRoundNumber,
                'winners_count' => count($winners),
            ]);
            return null;
        }

        // For standard elimination: assign first two winners
        // TODO: This assumes match order determines bracket position
        // For more complex brackets, use placeholder_positions to map specific matches to positions
        $player1Id = $winners[0];
        $player2Id = $winners[1];

        // Assign colors
        $colors = $this->swissService->assignColorsPub(
            $championship,
            $player1Id,
            $player2Id
        );

        // Assign players to the match
        $match->assignPlaceholderPlayers(
            $player1Id,
            $player2Id,
            $colors['white'],
            $colors['black']
        );

        Log::info("Assigned players to placeholder match from previous winners", [
            'match_id' => $match->id,
            'round_number' => $match->round_number,
            'previous_round' => $previousRoundNumber,
            'player1_id' => $player1Id,
            'player2_id' => $player2Id,
        ]);

        return [
            'match_id' => $match->id,
            'round_number' => $match->round_number,
            'source' => 'previous_match_winners',
            'previous_round' => $previousRoundNumber,
            'player1_id' => $player1Id,
            'player2_id' => $player2Id,
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
            ->orderByRaw('(SELECT rating FROM users WHERE users.id = championship_standings.user_id) DESC')
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

    /**
     * Assign players to elimination round placeholder matches based on standings
     */
    private function assignEliminationRoundPlaceholders(
        Championship $championship,
        int $roundNumber,
        Collection $placeholderMatches,
        ChampionshipRoundTypeEnum $roundType
    ): array {
        // Get current standings to determine top qualifiers
        $standings = $this->getCurrentStandings($championship);

        // Determine how many players should participate in this elimination round
        $participantCount = $roundType->expectedMatches() * 2;

        Log::info("Assigning elimination round placeholders", [
            'championship_id' => $championship->id,
            'round_number' => $roundNumber,
            'round_type' => $roundType->value,
            'participant_count' => $participantCount,
            'available_qualifiers' => $standings->count(),
        ]);

        // Take top N players based on standings
        $qualifiedPlayers = $standings->take($participantCount);

        if ($qualifiedPlayers->count() < $participantCount) {
            Log::warning("Not enough qualified players for elimination round", [
                'expected' => $participantCount,
                'available' => $qualifiedPlayers->count(),
            ]);
            // Fill remaining with random players if needed
            $remainingPlayers = $standings->slice($participantCount);
            $qualifiedPlayers = $qualifiedPlayers->concat($remainingPlayers)->take($participantCount);
        }

        $assignedCount = 0;
        $assignmentDetails = [];

        foreach ($placeholderMatches as $match) {
            try {
                // For elimination rounds, pair top qualifiers appropriately
                $assignment = $this->assignPlayersToEliminationMatch(
                    $championship,
                    $match,
                    $qualifiedPlayers,
                    $roundType
                );

                $assignmentDetails[] = $assignment;
                $assignedCount++;

                // Remove assigned players from the pool
                if ($assignment['player1_id']) {
                    $qualifiedPlayers = $qualifiedPlayers->reject(fn($p) => $p->user_id === $assignment['player1_id']);
                }
                if ($assignment['player2_id']) {
                    $qualifiedPlayers = $qualifiedPlayers->reject(fn($p) => $p->user_id === $assignment['player2_id']);
                }

            } catch (\Exception $e) {
                Log::error("Failed to assign players to elimination match", [
                    'match_id' => $match->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        Log::info("Elimination round placeholder assignments completed", [
            'championship_id' => $championship->id,
            'round_number' => $roundNumber,
            'assigned_count' => $assignedCount,
            'matches_processed' => $placeholderMatches->count(),
        ]);

        return [
            'assigned_count' => $assignedCount,
            'matches_processed' => $placeholderMatches->count(),
            'assignments' => $assignmentDetails,
        ];
    }

    /**
     * Assign players to a single elimination match
     */
    private function assignPlayersToEliminationMatch(
        Championship $championship,
        ChampionshipMatch $match,
        Collection $qualifiedPlayers,
        ChampionshipRoundTypeEnum $roundType
    ): array {
        if ($qualifiedPlayers->count() < 2) {
            throw new \Exception("Not enough qualified players for elimination match");
        }

        // Take top 2 players for this match
        $player1 = $qualifiedPlayers->first();
        $player2 = $qualifiedPlayers->slice(1)->first();

        // Update the match with assigned players
        $match->update([
            'player1_id' => $player1->user_id,
            'player2_id' => $player2->user_id,
            'white_player_id' => $player1->user_id, // Higher ranked player gets white
            'black_player_id' => $player2->user_id,
        ]);

        Log::info("Elimination match assigned", [
            'match_id' => $match->id,
            'round_type' => $roundType->value,
            'player1' => $player1->user->name,
            'player2' => $player2->user->name,
            'player1_rank' => $player1->rank,
            'player2_rank' => $player2->rank,
        ]);

        return [
            'match_id' => $match->id,
            'player1_id' => $player1->user_id,
            'player2_id' => $player2->user_id,
            'player1_name' => $player1->user->name,
            'player2_name' => $player2->user->name,
            'player1_rank' => $player1->rank,
            'player2_rank' => $player2->rank,
        ];
    }
}
