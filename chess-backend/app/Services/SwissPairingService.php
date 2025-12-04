<?php

namespace App\Services;

use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipParticipant;
use App\Models\ChampionshipStanding;
use App\Models\User;
use App\Enums\ChampionshipMatchStatus;
use App\Enums\ChampionshipResultType;
use App\Enums\ChampionshipRoundType;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SwissPairingService
{
    /**
     * Generate pairings for a Swiss round
     */
    public function generatePairings(Championship $championship, int $roundNumber): array
    {
        // Validate championship format
        if (!$championship->getFormatEnum()->isSwiss()) {
            throw new \InvalidArgumentException('Championship format does not support Swiss pairings');
        }

        // Get eligible participants
        $participants = $this->getEligibleParticipants($championship);

        if ($participants->count() < 2) {
            $totalParticipants = $championship->participants()->count();
            $paidParticipants = $participants->count();

            throw new \InvalidArgumentException(
                "Not enough eligible participants for pairings. " .
                "Total registered: {$totalParticipants}, Paid: {$paidParticipants}. " .
                "At least 2 paid participants are required to generate matches."
            );
        }

        // Sort participants by score (descending) and tiebreakers
        $sortedParticipants = $this->sortParticipantsByScore($championship, $participants);

        // Generate pairings using Dutch algorithm (FIDE standard)
        $pairings = $this->dutchAlgorithm($championship, $sortedParticipants, $roundNumber);

        return $pairings;
    }

    /**
     * Create matches from pairings (enhanced with color assignment and event broadcasting)
     */
    public function createMatches(Championship $championship, array $pairings, int $roundNumber): Collection
    {
        $matches = collect();
        $byePlayers = collect();

        DB::transaction(function () use ($championship, $pairings, $roundNumber, $matches, $byePlayers) {
            foreach ($pairings as $pairing) {
                // Check if this is a bye pairing (player2_id is null)
                if (isset($pairing['is_bye']) && $pairing['is_bye']) {
                    $byeInfo = $pairing['user_info'] ?? [
                        'user_id' => $pairing['player1_id'],
                        'points_awarded' => $pairing['bye_points'] ?? $championship->getByePoints(),
                        'user' => \App\Models\User::find($pairing['player1_id'])
                    ];
                    $byePlayers->push($byeInfo);
                    continue;
                }

                // Use enhanced color assignment method
                $colorMethod = $championship->getColorAssignmentMethod();
                $colors = $this->assignColorsByMethod($championship, $pairing['player1_id'], $pairing['player2_id'], $colorMethod);

                $match = ChampionshipMatch::create([
                    'championship_id' => $championship->id,
                    'round_number' => $roundNumber,
                    'round_type' => ChampionshipRoundType::SWISS,
                    'player1_id' => $pairing['player1_id'], // Legacy support
                    'player2_id' => $pairing['player2_id'], // Legacy support
                    'white_player_id' => $colors['white'], // New color assignment
                    'black_player_id' => $colors['black'], // New color assignment
                    'color_assignment_method' => $colorMethod,
                    'auto_generated' => true,
                    'scheduled_at' => $pairing['scheduled_at'] ?? now(),
                    'deadline' => $pairing['deadline'] ?? now()->addHours($championship->match_time_window_hours),
                    'status' => ChampionshipMatchStatus::PENDING,
                ]);

                // Load relationships for the match
                $match->load(['whitePlayer', 'blackPlayer']);
                $matches->push($match);
                Log::info("Created enhanced Swiss pairing match", [
                    'championship_id' => $championship->id,
                    'round' => $roundNumber,
                    'white_player_id' => $colors['white'],
                    'black_player_id' => $colors['black'],
                    'color_method' => $colorMethod,
                    'match_id' => $match->id,
                ]);
            }
        });

        // Broadcast round generation event
        broadcast(new \App\Events\ChampionshipRoundGenerated(
            $championship,
            $roundNumber,
            $matches,
            $byePlayers->toArray()
        ));

        Log::info("Round generation broadcast", [
            'championship_id' => $championship->id,
            'round' => $roundNumber,
            'matches' => $matches->count(),
            'byes' => $byePlayers->count(),
        ]);

        return $matches;
    }

    /**
     * Get participants eligible for pairing (paid)
     */
    private function getEligibleParticipants(Championship $championship): Collection
    {
        // Only paid participants are eligible for pairings
        // This ensures consistency with StandingsCalculatorService and other tournament services
        return $championship->participants()
            ->where('payment_status_id', \App\Enums\PaymentStatus::COMPLETED->getId())
            ->with('user')
            ->get();
    }

    /**
     * Sort participants by score and tiebreakers
     */
    private function sortParticipantsByScore(Championship $championship, Collection $participants): Collection
    {
        return $participants->sortByDesc(function ($participant) use ($championship) {
            $standing = $championship->standings()
                ->where('user_id', $participant->user_id)
                ->first();

            $score = $standing?->points ?? 0; // Database uses 'points'
            $buchholz = $standing?->buchholz_score ?? 0; // Database uses 'buchholz_score'
            $sonnebornBerger = $standing?->sonneborn_berger ?? 0;
            $tRating = $participant->user->rating ?? 1200; // Use user's rating directly

            // Sort by: 1) Score, 2) Buchholz, 3) Sonneborn-Berger, 4) Tournament rating
            return [
                $score,
                $buchholz,
                $sonnebornBerger,
                $tRating
            ];
        })->values();
    }

    /**
     * Enhanced Dutch pairing algorithm with proper floating mechanism
     *
     * 🎯 FLOATING LOGIC: Players from odd-sized groups "fall down" to lower score groups
     * This ensures ALL players get paired, following Swiss tournament gravity rules
     */
    private function dutchAlgorithm(Championship $championship, Collection $participants, int $roundNumber): array
    {
        $pairings = [];

        // STEP 1: Create score groups sorted by score (descending)
        $scoreGroups = $this->createScoreGroups($championship, $participants);

        Log::info("Dutch algorithm - Score groups created", [
            'championship_id' => $championship->id,
            'round' => $roundNumber,
            'total_participants' => $participants->count(),
            'score_groups' => array_map(fn($g) => count($g), $scoreGroups),
        ]);

        // STEP 2: Process groups with floating mechanism
        $floater = null; // Player falling down from group above

        foreach ($scoreGroups as $score => $group) {
            $players = collect($group);

            Log::info("Processing score group", [
                'score' => $score,
                'group_size' => $players->count(),
                'player_ids' => $players->pluck('user_id')->toArray(),
                'has_floater' => $floater !== null,
            ]);

            // Add floater from previous (higher) group
            if ($floater) {
                Log::info("Adding floater to current group", [
                    'floater_id' => $floater->user_id,
                    'from_score' => 'previous_group',
                    'to_score' => $score,
                    'group_size_before' => $players->count(),
                ]);
                $players->push($floater);
                $floater = null;

                Log::info("Group after adding floater", [
                    'score' => $score,
                    'group_size' => $players->count(),
                    'player_ids' => $players->pluck('user_id')->toArray(),
                ]);
            }

            // If odd number, remove lowest-rated player as floater for next group
            if ($players->count() % 2 !== 0) {
                // Sort by rating to identify lowest
                $sorted = $players->sortBy(fn($p) => $p->user->rating ?? 1200)->values();
                $floater = $sorted->first(); // Lowest rated becomes floater
                $players = $sorted->slice(1)->values(); // Remove floater from current group and re-index

                Log::info("Player will float to next group", [
                    'floater_id' => $floater->user_id,
                    'floater_rating' => $floater->user->rating ?? 1200,
                    'current_score' => $score,
                    'group_size_before_float' => $sorted->count(),
                    'group_size_after' => $players->count(),
                    'remaining_player_ids' => $players->pluck('user_id')->toArray(),
                ]);
            }

            // STEP 3: Pair the even-numbered group
            if ($players->count() > 0) {
                Log::info("About to pair even group", [
                    'score' => $score,
                    'player_count' => $players->count(),
                    'is_even' => $players->count() % 2 === 0,
                    'player_ids' => $players->pluck('user_id')->toArray(),
                ]);

                $groupPairings = $this->pairEvenGroup($championship, $players, $roundNumber);
                $pairings = array_merge($pairings, $groupPairings);

                Log::info("Completed pairing group", [
                    'score' => $score,
                    'pairings_created' => count($groupPairings),
                ]);
            } else {
                Log::warning("Skipping empty group", [
                    'score' => $score,
                ]);
            }
        }

        // STEP 4: Handle final floater (becomes BYE)
        if ($floater) {
            Log::info("Final floater receives BYE", [
                'floater_id' => $floater->user_id,
                'championship_id' => $championship->id,
                'round' => $roundNumber,
            ]);

            $byeInfo = $this->handleBye($championship, $floater, $roundNumber);
            $pairings[] = [
                'is_bye' => true,
                'player1_id' => $floater->user_id,
                'player2_id' => null,
                'bye_points' => $championship->getByePoints(),
                'round_number' => $roundNumber,
                'user_info' => $byeInfo,
            ];
        }

        // STEP 5: CRITICAL VALIDATION
        $this->validatePairingCompleteness($participants, $pairings, $championship, $roundNumber);

        return $pairings;
    }

    /**
     * Pair players within an even-sized group
     *
     * Assumes group size is EVEN (guaranteed by floating logic)
     *
     * @param Championship $championship
     * @param Collection $players Even-sized collection of players
     * @param int $roundNumber
     * @return array Array of pairings
     */
    private function pairEvenGroup(Championship $championship, Collection $players, int $roundNumber): array
    {
        $pairings = [];

        if ($players->count() === 0) {
            return $pairings;
        }

        // Assert even number
        if ($players->count() % 2 !== 0) {
            Log::error("pairEvenGroup called with odd-sized group", [
                'group_size' => $players->count(),
                'championship_id' => $championship->id,
                'round' => $roundNumber,
            ]);
            throw new \Exception("pairEvenGroup requires even-sized group");
        }

        // Sort by color balance for fair color distribution
        $sortedPlayers = $this->balanceColors($championship, $players);

        // Pair sequentially with opponent validation
        $paired = collect();

        for ($i = 0; $i < $sortedPlayers->count(); $i += 2) {
            $player1 = $sortedPlayers[$i];
            $player2 = $sortedPlayers[$i + 1];

            // Skip if already paired (safety check)
            if ($paired->contains($player1->user_id) || $paired->contains($player2->user_id)) {
                continue;
            }

            // Check if they've already played
            if ($this->haveAlreadyPlayed($championship, $player1->user_id, $player2->user_id)) {
                // Try to find alternative within remaining unpaired players
                $alternative = $this->findAlternativeInGroup($championship, $sortedPlayers, $i, $paired);

                if ($alternative) {
                    $player2 = $alternative;
                } else {
                    // CONSTRAINT RELAXATION: Pair anyway (repeat match allowed if no alternative)
                    Log::warning("No alternative pairing found - allowing repeat match", [
                        'player1_id' => $player1->user_id,
                        'player2_id' => $player2->user_id,
                        'round' => $roundNumber,
                    ]);
                }
            }

            // Create pairing with color assignment
            $colorMethod = $championship->getColorAssignmentMethod();
            $colors = $this->assignColorsByMethod($championship, $player1->user_id, $player2->user_id, $colorMethod);

            $pairings[] = [
                'player1_id' => $colors['white'],
                'player2_id' => $colors['black'],
                'scheduled_at' => now(),
                'deadline' => now()->addHours($championship->match_time_window_hours),
                'color_assignment_method' => $colorMethod,
            ];

            $paired->push($player1->user_id);
            $paired->push($player2->user_id);
        }

        Log::info("Even group paired successfully", [
            'championship_id' => $championship->id,
            'round' => $roundNumber,
            'group_size' => $players->count(),
            'pairings_created' => count($pairings),
        ]);

        return $pairings;
    }

    /**
     * Find alternative pairing within group to avoid repeat matches
     */
    private function findAlternativeInGroup(Championship $championship, Collection $players, int $currentIndex, Collection $alreadyPaired): mixed
    {
        $currentPlayer = $players[$currentIndex];

        // Look for unpaired player that hasn't played current player
        for ($i = $currentIndex + 2; $i < $players->count(); $i++) {
            $candidate = $players[$i];

            if ($alreadyPaired->contains($candidate->user_id)) {
                continue;
            }

            if (!$this->haveAlreadyPlayed($championship, $currentPlayer->user_id, $candidate->user_id)) {
                return $candidate;
            }
        }

        return null;
    }

    /**
     * Validate that all participants are accounted for in pairings
     *
     * 🎯 CRITICAL SAFETY NET: Prevents silent player drops
     *
     * @throws \Exception if validation fails
     */
    private function validatePairingCompleteness(Collection $participants, array $pairings, Championship $championship, int $roundNumber): void
    {
        $participantIds = $participants->pluck('user_id')->toArray();
        $pairedIds = [];

        foreach ($pairings as $pairing) {
            if (isset($pairing['is_bye']) && $pairing['is_bye']) {
                $pairedIds[] = $pairing['player1_id'];
            } else {
                $pairedIds[] = $pairing['player1_id'];
                $pairedIds[] = $pairing['player2_id'];
            }
        }

        $pairedIds = array_unique($pairedIds);
        $expectedCount = count($participantIds);
        $actualCount = count($pairedIds);

        if ($actualCount !== $expectedCount) {
            $missingIds = array_diff($participantIds, $pairedIds);

            Log::error("🚨 CRITICAL PAIRING FAILURE: Not all players paired", [
                'championship_id' => $championship->id,
                'round' => $roundNumber,
                'expected_players' => $expectedCount,
                'actually_paired' => $actualCount,
                'missing_player_ids' => $missingIds,
                'pairings_count' => count($pairings),
            ]);

            throw new \Exception(
                "Swiss Pairing Validation Failed: Expected $expectedCount players, paired $actualCount. " .
                "Missing players: " . implode(', ', $missingIds)
            );
        }

        Log::info("✅ Pairing validation passed", [
            'championship_id' => $championship->id,
            'round' => $roundNumber,
            'players_paired' => $actualCount,
            'matches_created' => count($pairings),
        ]);
    }

    /**
     * Create score groups for Dutch algorithm
     */
    private function createScoreGroups(Championship $championship, Collection $participants): array
    {
        $groups = [];

        foreach ($participants as $participant) {
            $standing = $championship->standings()
                ->where('user_id', $participant->user_id)
                ->first();

            $score = $standing?->points ?? 0; // Database uses 'points'
            $groups[$score][] = $participant;
        }

        // Sort groups by score (descending)
        krsort($groups);

        return $groups;
    }

    /**
     * Pair participants within a score group
     *
     * 🎯 CRITICAL FIX: Return both pairings and unpaired players
     *
     * @param Championship $championship
     * @param array $group Array of participants in this score group
     * @param int $roundNumber
     * @param Collection $alreadyPaired Collection of already paired player IDs (to avoid duplicates across groups)
     * @return array ['pairings' => [...], 'unpaired' => [...]]
     */
    private function pairScoreGroup(Championship $championship, array $group, int $roundNumber, Collection $alreadyPaired = null): array
    {
        $pairings = [];
        $unpaired = [];
        $group = collect($group);

        if ($alreadyPaired === null) {
            $alreadyPaired = collect();
        }

        // 🎯 ENHANCED: Allow odd-sized groups but track unpaired players
        if ($group->count() % 2 !== 0) {
            Log::info("Score group has odd number of players - last player will be marked as unpaired", [
                'championship_id' => $championship->id,
                'round' => $roundNumber,
                'group_size' => $group->count(),
                'total_players' => $championship->participants()->count(),
            ]);
        }

        // Sort by float (who had white/black more) for color balance
        $sortedGroup = $this->balanceColors($championship, $group);

        // 🎯 FIXED: Track paired players within this group to prevent duplicates
        $pairedInGroup = collect();

        // Pair participants
        for ($i = 0; $i < $sortedGroup->count(); $i += 2) {
            // 🎯 SAFETY CHECK: Ensure current player exists
            if (!isset($sortedGroup[$i])) {
                Log::warning("Current player not found at index {$i} - breaking loop", [
                    'index' => $i,
                    'groupCount' => $sortedGroup->count(),
                    'round' => $roundNumber,
                ]);
                break;
            }

            $player1 = $sortedGroup[$i];

            // 🎯 SAFETY CHECK: Skip if this player was already paired in a previous group
            if ($alreadyPaired->contains($player1->user_id) || $pairedInGroup->contains($player1->user_id)) {
                Log::info("Player already paired - skipping", [
                    'user_id' => $player1->user_id,
                    'round' => $roundNumber,
                ]);
                continue;
            }

            // 🎯 CHECK: If no second player exists (odd-sized group), mark as unpaired
            if (!isset($sortedGroup[$i + 1])) {
                Log::info("Unpaired player in odd-sized group - will be paired across groups", [
                    'unpaired_player_id' => $player1->user_id,
                    'round' => $roundNumber,
                    'index' => $i,
                    'groupCount' => $sortedGroup->count(),
                ]);
                $unpaired[] = $player1;
                continue; // Continue to next iteration
            }

            $player2 = $sortedGroup[$i + 1];

            // 🎯 SAFETY CHECK: Skip if player2 was already paired
            if ($alreadyPaired->contains($player2->user_id) || $pairedInGroup->contains($player2->user_id)) {
                Log::info("Opponent already paired - marking player1 as unpaired", [
                    'user_id' => $player2->user_id,
                    'round' => $roundNumber,
                ]);
                $unpaired[] = $player1;
                continue;
            }

            // Check if they have already played each other
            if ($this->haveAlreadyPlayed($championship, $player1->user_id, $player2->user_id)) {
                // Try to find alternative pairing within remaining players in group
                $alternativePairing = $this->findAlternativePairing($championship, $sortedGroup, $i, $roundNumber);
                if ($alternativePairing) {
                    $pairings[] = $alternativePairing;
                    // Mark both players as paired
                    $pairedInGroup->push($alternativePairing['player1_id']);
                    $pairedInGroup->push($alternativePairing['player2_id']);
                } else {
                    // No alternative found - mark as unpaired for cross-group pairing
                    Log::info("No alternative pairing found - marking player as unpaired", [
                        'user_id' => $player1->user_id,
                        'round' => $roundNumber,
                    ]);
                    $unpaired[] = $player1;
                }
            } else {
                // Use enhanced color assignment based on tournament settings
                $colorMethod = $championship->getColorAssignmentMethod();
                $colors = $this->assignColorsByMethod($championship, $player1->user_id, $player2->user_id, $colorMethod);

                $pairings[] = [
                    'player1_id' => $colors['white'],
                    'player2_id' => $colors['black'],
                    'scheduled_at' => now(),
                    'deadline' => now()->addHours($championship->match_time_window_hours),
                    'color_assignment_method' => $colorMethod,
                ];

                // 🎯 FIXED: Mark both players as paired
                $pairedInGroup->push($player1->user_id);
                $pairedInGroup->push($player2->user_id);
            }
        }

        Log::info("Score group pairing completed", [
            'championship_id' => $championship->id,
            'round' => $roundNumber,
            'group_size' => $group->count(),
            'pairings_created' => count($pairings),
            'players_paired' => $pairedInGroup->count(),
            'unpaired_players' => count($unpaired),
        ]);

        return [
            'pairings' => $pairings,
            'unpaired' => $unpaired,
        ];
    }

    /**
     * Pair remaining unpaired players across score groups
     *
     * 🎯 NEW METHOD: Ensures ALL players get paired, even across different score groups
     *
     * @param Championship $championship
     * @param Collection $unpairedPlayers Collection of unpaired participant objects
     * @param int $roundNumber
     * @return array Array of pairings
     */
    private function pairRemainingPlayers(Championship $championship, Collection $unpairedPlayers, int $roundNumber): array
    {
        $pairings = [];
        $remaining = $unpairedPlayers->values(); // Re-index collection

        Log::info("Pairing remaining unpaired players", [
            'championship_id' => $championship->id,
            'round' => $roundNumber,
            'unpaired_count' => $remaining->count(),
            'unpaired_ids' => $remaining->pluck('user_id')->toArray(),
        ]);

        // Pair players sequentially (these are from different score groups, so cross-group pairing is allowed)
        for ($i = 0; $i < $remaining->count(); $i += 2) {
            if (!isset($remaining[$i])) {
                break;
            }

            $player1 = $remaining[$i];

            // If odd number of total unpaired players, last one needs special handling
            if (!isset($remaining[$i + 1])) {
                Log::warning("Odd number of unpaired players - last player cannot be paired", [
                    'championship_id' => $championship->id,
                    'round' => $roundNumber,
                    'unpaired_player_id' => $player1->user_id,
                    'note' => 'This should not happen if total participants is even and BYE was assigned correctly'
                ]);
                break;
            }

            $player2 = $remaining[$i + 1];

            // Check if these players have already played
            if ($this->haveAlreadyPlayed($championship, $player1->user_id, $player2->user_id)) {
                Log::info("Unpaired players have already played - trying next combination", [
                    'player1_id' => $player1->user_id,
                    'player2_id' => $player2->user_id,
                    'round' => $roundNumber,
                ]);

                // Try to find a different pairing among remaining players
                // This is a simplified approach - in a real implementation, you'd want more sophisticated matching
                continue;
            }

            // Create pairing
            $colorMethod = $championship->getColorAssignmentMethod();
            $colors = $this->assignColorsByMethod($championship, $player1->user_id, $player2->user_id, $colorMethod);

            $pairings[] = [
                'player1_id' => $colors['white'],
                'player2_id' => $colors['black'],
                'scheduled_at' => now(),
                'deadline' => now()->addHours($championship->match_time_window_hours),
                'color_assignment_method' => $colorMethod,
            ];

            Log::info("Created cross-group pairing for unpaired players", [
                'championship_id' => $championship->id,
                'round' => $roundNumber,
                'player1_id' => $player1->user_id,
                'player2_id' => $player2->user_id,
                'white_player_id' => $colors['white'],
                'black_player_id' => $colors['black'],
            ]);
        }

        Log::info("Remaining players pairing completed", [
            'championship_id' => $championship->id,
            'round' => $roundNumber,
            'pairings_created' => count($pairings),
        ]);

        return $pairings;
    }

    /**
     * Balance colors to ensure equal white/black games
     */
    private function balanceColors(Championship $championship, Collection $group): Collection
    {
        return $group->sortBy(function ($participant) use ($championship) {
            $colorBalance = $this->getColorBalance($championship, $participant->user_id);

            // Participants with more black games should get white
            return $colorBalance['black'] - $colorBalance['white'];
        })->values();
    }

    /**
     * Get color balance for a participant
     */
    private function getColorBalance(Championship $championship, int $userId): array
    {
        $completedMatches = $championship->matches()
            ->completed()
            ->where(function ($query) use ($userId) {
                $query->where('player1_id', $userId)
                      ->orWhere('player2_id', $userId);
            })
            ->get();

        $white = $completedMatches->where('player1_id', $userId)->count();
        $black = $completedMatches->where('player2_id', $userId)->count();

        return ['white' => $white, 'black' => $black];
    }

    /**
     * Enhanced color balance using new color assignment fields
     */
    private function getEnhancedColorBalance(Championship $championship, int $userId): array
    {
        $completedMatches = $championship->matches()
            ->completed()
            ->where(function ($query) use ($userId) {
                $query->where('white_player_id', $userId)
                      ->orWhere('black_player_id', $userId);
            })
            ->get();

        // Try new color assignment fields first
        $white = $completedMatches->where('white_player_id', $userId)->count();
        $black = $completedMatches->where('black_player_id', $userId)->count();

        // If no new fields found, fall back to legacy
        if ($white === 0 && $black === 0) {
            return $this->getColorBalance($championship, $userId);
        }

        return ['white' => $white, 'black' => $black];
    }

    /**
     * Assign colors using championship's preferred method
     */
    private function assignColorsByMethod(Championship $championship, int $userId1, int $userId2, string $method): array
    {
        switch ($method) {
            case 'balanced':
                return $this->assignColorsBalanced($championship, $userId1, $userId2);
            case 'alternate':
                return $this->assignColorsAlternate($championship, $userId1, $userId2);
            case 'random':
                return $this->assignColorsRandom($userId1, $userId2);
            default:
                return $this->assignColorsBalanced($championship, $userId1, $userId2);
        }
    }

    /**
     * Balanced color assignment (Swiss system standard)
     */
    private function assignColorsBalanced(Championship $championship, int $userId1, int $userId2): array
    {
        $balance1 = $this->getEnhancedColorBalance($championship, $userId1);
        $balance2 = $this->getEnhancedColorBalance($championship, $userId2);

        $float1 = $balance1['black'] - $balance1['white'];
        $float2 = $balance2['black'] - $balance2['white'];

        // Player with higher float (more black games) gets white
        if ($float1 > $float2) {
            return ['white' => $userId1, 'black' => $userId2];
        } elseif ($float2 > $float1) {
            return ['white' => $userId2, 'black' => $userId1];
        } else {
            // If floats are equal, consider rating difference
            $user1 = User::find($userId1);
            $user2 = User::find($userId2);

            if ($user1 && $user2) {
                // Higher rated player gets black as slight disadvantage
                return $user1->rating > $user2->rating
                    ? ['white' => $userId2, 'black' => $userId1]
                    : ['white' => $userId1, 'black' => $userId2];
            }

            // Random assignment if all else equal
            return rand(0, 1) === 0
                ? ['white' => $userId1, 'black' => $userId2]
                : ['white' => $userId2, 'black' => $userId1];
        }
    }

    /**
     * Alternate color assignment (strict alternation)
     */
    private function assignColorsAlternate(Championship $championship, int $userId1, int $userId2): array
    {
        $balance1 = $this->getEnhancedColorBalance($championship, $userId1);
        $balance2 = $this->getEnhancedColorBalance($championship, $userId2);

        // Strict alternation - prioritize minimizing color imbalance
        if ($balance1['white'] > $balance1['black']) {
            return ['white' => $userId2, 'black' => $userId1];
        } elseif ($balance2['white'] > $balance2['black']) {
            return ['white' => $userId1, 'black' => $userId2];
        } else {
            // If both have balanced colors, alternate based on previous round
            return $this->assignColorsBalanced($championship, $userId1, $userId2);
        }
    }

    /**
     * Random color assignment
     */
    private function assignColorsRandom(int $userId1, int $userId2): array
    {
        return rand(0, 1) === 0
            ? ['white' => $userId1, 'black' => $userId2]
            : ['white' => $userId2, 'black' => $userId1];
    }

    /**
     * Legacy color assignment method (for backward compatibility)
     */
    private function assignColors(Championship $championship, int $userId1, int $userId2): array
    {
        return $this->assignColorsBalanced($championship, $userId1, $userId2);
    }

    /**
     * Public color assignment method for external services
     */
    public function assignColorsPub(Championship $championship, int $userId1, int $userId2): array
    {
        return $this->assignColorsBalanced($championship, $userId1, $userId2);
    }

    /**
     * Check if two participants have already played each other
     */
    private function haveAlreadyPlayed(Championship $championship, int $player1Id, int $player2Id): bool
    {
        return $championship->matches()
            ->completed()
            ->where(function ($query) use ($player1Id, $player2Id) {
                $query->where(function ($q) use ($player1Id, $player2Id) {
                    $q->where('player1_id', $player1Id)
                      ->where('player2_id', $player2Id);
                })->orWhere(function ($q) use ($player1Id, $player2Id) {
                    $q->where('player1_id', $player2Id)
                      ->where('player2_id', $player1Id);
                });
            })
            ->exists();
    }

    /**
     * Find alternative pairing within score group
     */
    private function findAlternativePairing(Championship $championship, Collection $group, int $currentIndex, int $roundNumber): ?array
    {
        // 🎯 SAFETY CHECK: Ensure index is within bounds
        if ($currentIndex >= $group->count()) {
            Log::warning("findAlternativePairing: Index out of bounds", [
                'currentIndex' => $currentIndex,
                'groupCount' => $group->count(),
                'round' => $roundNumber,
            ]);
            return null;
        }

        $currentPlayer = $group[$currentIndex];

        for ($i = $currentIndex + 2; $i < $group->count(); $i++) {
            $potentialOpponent = $group[$i];

            if (!$this->haveAlreadyPlayed($championship, $currentPlayer->user_id, $potentialOpponent->user_id)) {
                // 🎯 SAFETY CHECK: Ensure we have enough elements for swap
                if (!isset($group[$currentIndex + 1])) {
                    Log::warning("findAlternativePairing: Cannot swap - missing element", [
                        'currentIndex' => $currentIndex,
                        'groupCount' => $group->count(),
                        'round' => $roundNumber,
                    ]);
                    return null;
                }

                // Swap opponents
                $originalOpponent = $group[$currentIndex + 1];
                $group[$currentIndex + 1] = $potentialOpponent;
                $group[$i] = $originalOpponent;

                $colors = $this->assignColors($championship, $currentPlayer->user_id, $potentialOpponent->user_id);

                return [
                    'player1_id' => $colors['white'],
                    'player2_id' => $colors['black'],
                    'scheduled_at' => now(),
                    'deadline' => now()->addHours($championship->match_time_window_hours),
                ];
            }
        }

        return null;
    }

    /**
     * Handle cross-score group pairing (when same-score pairing is impossible)
     */
    private function crossScoreGroupPairing(Championship $championship, $player, int $roundNumber): ?array
    {
        // 🎯 CRITICAL FIX: Implement proper cross-score-group pairing
        // Find a player from the next lower score group
        $playerScore = $championship->standings()
            ->where('user_id', $player->user_id)
            ->first()?->points ?? 0;

        // Look for players in the next lower score group
        $lowerScoreGroups = $championship->standings()
            ->where('points', '<', $playerScore)
            ->orderBy('points', 'desc')
            ->orderBy('rating', 'desc') // Prefer higher rated players
            ->get();

        foreach ($lowerScoreGroups as $potentialOpponent) {
            // Check if this opponent is already paired
            $alreadyPaired = $this->isPlayerAlreadyPaired($championship, $potentialOpponent->user_id, $roundNumber);
            if (!$alreadyPaired) {
                Log::info("Cross-score group pairing found", [
                    'championship_id' => $championship->id,
                    'player1_id' => $player->user_id,
                    'player1_score' => $playerScore,
                    'player2_id' => $potentialOpponent->user_id,
                    'player2_score' => $potentialOpponent->points,
                    'round' => $roundNumber,
                ]);

                return [
                    'player1_id' => $player->user_id,
                    'player2_id' => $potentialOpponent->user_id,
                    'round_number' => $roundNumber,
                ];
            }
        }

        Log::warning("No cross-score group pairing found", [
            'championship_id' => $championship->id,
            'player_id' => $player->user_id,
            'player_score' => $playerScore,
            'round' => $roundNumber,
        ]);

        return null;
    }

    /**
     * Check if a player is already paired in the current round
     */
    private function isPlayerAlreadyPaired(Championship $championship, int $userId, int $roundNumber): bool
    {
        return $championship->matches()
            ->where('round_number', $roundNumber)
            ->where(function ($query) use ($userId) {
                $query->where('player1_id', $userId)
                    ->orWhere('player2_id', $userId);
            })
            ->exists();
    }

    /**
     * Enhanced bye handling with configurable points and optimal assignment
     */
    private function handleBye(Championship $championship, $participant, int $roundNumber): array
    {
        $byePoints = $championship->getByePoints();

        // 🎯 FIXED: Do NOT award points immediately for Swiss tournaments
        // Points will be awarded when all real matches in the round complete
        // This ensures fairness: BYE points awarded AFTER everyone plays their matches

        // Get standing for tracking purposes (don't modify points yet)
        $standing = $championship->standings()
            ->where('user_id', $participant->user_id)
            ->first();

        if (!$standing) {
            // Create standing entry if doesn't exist (with 0 points for now)
            $championship->standings()->create([
                'user_id' => $participant->user_id,
                'points' => 0, // Will be awarded when round completes
                'matches_played' => 0,
                'wins' => 0,
                'draws' => 0,
                'losses' => 0,
                'buchholz_score' => 0,
                'sonneborn_berger' => 0,
            ]);
        }

        // Create a BYE match as PENDING (will be completed when round finishes)
        ChampionshipMatch::create([
            'championship_id' => $championship->id,
            'round_number' => $roundNumber,
            'round_type' => ChampionshipRoundType::SWISS,
            'player1_id' => $participant->user_id,
            'player2_id' => null, // No opponent for bye
            'white_player_id' => null, // No color assignment for bye
            'black_player_id' => $participant->user_id,
            'color_assignment_method' => 'bye',
            'auto_generated' => true,
            'scheduled_at' => now(),
            'deadline' => now()->addHours($championship->match_time_window_hours),
            'status' => ChampionshipMatchStatus::PENDING, // 🎯 FIXED: PENDING until round completes
            'result_type' => 'bye',
            'winner_id' => $participant->user_id, // Pre-set winner (will be used when completing)
        ]);

        Log::info("🎯 [BYE CREATED] Swiss BYE match created as PENDING", [
            'championship_id' => $championship->id,
            'round' => $roundNumber,
            'user_id' => $participant->user_id,
            'bye_points' => $byePoints,
            'status' => 'PENDING',
            'timing' => 'will_complete_when_round_finishes',
            'fairness' => 'points_awarded_after_all_real_matches_complete',
        ]);

        // Return bye information for broadcasting
        return [
            'user_id' => $participant->user_id,
            'user' => $participant->user,
            'points_to_award' => $byePoints, // Not awarded yet!
            'status' => 'PENDING',
            'round_number' => $roundNumber
        ];
    }

    /**
     * 🎯 NEW: Smart BYE selection with group balancing
     *
     * Strategy: Give BYE to player whose removal creates the most balanced group sizes
     * Priority 1: Find group where removal makes ALL groups even-sized
     * Priority 2: If no perfect solution, remove from lowest score group
     * Priority 3: Within selected group, choose lowest-rated player with fewest BYEs
     */
    private function selectOptimalByeRecipientWithGroupBalancing(Championship $championship, array $scoreGroups): mixed
    {
        if (empty($scoreGroups)) {
            return null;
        }

        Log::info("Smart BYE selection - analyzing group balance", [
            'championship_id' => $championship->id,
            'score_groups' => array_map(fn($g) => count($g), $scoreGroups),
        ]);

        // 🎯 PRIORITY 1: Find group where removal makes ALL groups even-sized
        $perfectGroup = $this->findGroupForPerfectBalancing($scoreGroups);
        if ($perfectGroup !== null) {
            $selectedScore = $perfectGroup['score'];
            $selectedGroup = $perfectGroup['group'];
            Log::info("Perfect balancing found", ['selected_score' => $selectedScore]);
        } else {
            // 🎯 PRIORITY 2: No perfect solution - use lowest score group (Swiss rule)
            ksort($scoreGroups); // Ensure lowest score first
            $selectedScore = array_key_first($scoreGroups);

            // 🎯 SAFETY CHECK: Ensure we have a valid score group
            if ($selectedScore === null || !isset($scoreGroups[$selectedScore])) {
                Log::warning("No valid score groups found for BYE selection");
                return null;
            }

            $selectedGroup = $scoreGroups[$selectedScore];
            Log::info("No perfect balance - using lowest score group", ['selected_score' => $selectedScore]);
        }

        if (empty($selectedGroup)) {
            return null;
        }

        // 🎯 PRIORITY 3: Within selected group, choose optimal player
        return $this->selectBestPlayerForBye($championship, collect($selectedGroup));
    }

    /**
     * Find score group where removing one player creates all even-sized groups
     */
    private function findGroupForPerfectBalancing(array $scoreGroups): ?array
    {
        foreach ($scoreGroups as $score => $group) {
            if (count($group) % 2 === 1) { // Only check odd-sized groups
                // Simulate removing one player from this group
                $remainingSize = count($group) - 1;

                // Check if all groups would be even after removal
                $allGroupsEven = true;
                foreach ($scoreGroups as $otherScore => $otherGroup) {
                    $checkSize = ($otherScore === $score) ? $remainingSize : count($otherGroup);
                    if ($checkSize % 2 !== 0) {
                        $allGroupsEven = false;
                        break;
                    }
                }

                if ($allGroupsEven) {
                    return ['score' => $score, 'group' => $group];
                }
            }
        }
        return null;
    }

    /**
     * Select best player for BYE from a candidate group
     * Priority: 1) Fewest BYEs received, 2) Lowest rating
     */
    private function selectBestPlayerForBye(Championship $championship, \Illuminate\Support\Collection $candidates): mixed
    {
        if ($candidates->isEmpty()) {
            return null;
        }

        // Get BYE history for all candidates
        $byeHistory = $championship->matches()
            ->where('result_type_id', \App\Enums\ChampionshipResultType::BYE->getId())
            ->whereIn('player1_id', $candidates->pluck('user_id'))
            ->get()
            ->groupBy('player1_id')
            ->map(fn($matches) => $matches->count());

        // Sort candidates by: 1) Fewest BYEs, 2) Lowest rating
        return $candidates->sortBy(function ($participant) use ($byeHistory) {
            $byes = $byeHistory->get($participant->user_id, 0);
            $rating = $participant->user->rating ?? 1200;

            // Lower array = higher priority in sortBy
            return [
                $byes,    // Fewest BYEs first
                $rating,  // Lowest rating first
            ];
        })->first();
    }

    /**
     * Optimal bye assignment - select player with lowest score who hasn't had bye recently
     *
     * @deprecated Use selectOptimalByeRecipientFromLowestGroup instead
     */
    private function selectOptimalByeRecipient(Championship $championship, Collection $participants): mixed
    {
        // Get bye statistics from standings
        $standings = $championship->standings()
            ->whereIn('user_id', $participants->pluck('user_id'))
            ->get()
            ->keyBy('user_id');

        // Sort by: 1) Lowest score, 2) Fewest byes received, 3) Lowest rating
        return $participants->sortBy(function ($participant) use ($standings, $championship) {
            $standing = $standings->get($participant->user_id);
            $score = $standing?->points ?? 0; // Database uses 'points'
            $byes = $standing?->byes_received ?? 0;
            $rating = $participant->user->rating ?? 1200;

            // Higher priority = lower number in sorting
            return [
                $score,           // Lowest score first
                $byes,            // Fewest byes first
                $rating,          // Lowest rating first (give advantage to weaker players)
            ];
        })->first();
    }

    /**
     * Validate that pairings are valid
     */
    public function validatePairings(Championship $championship, array $pairings): array
    {
        $errors = [];
        $participantIds = [];

        foreach ($pairings as $index => $pairing) {
            // Check required fields
            if (!isset($pairing['player1_id']) || !isset($pairing['player2_id'])) {
                $errors[] = "Pairing {$index}: Missing player IDs";
                continue;
            }

            // Check for duplicate participants
            if (in_array($pairing['player1_id'], $participantIds)) {
                $errors[] = "Pairing {$index}: Player 1 appears in multiple pairings";
            }
            if (in_array($pairing['player2_id'], $participantIds)) {
                $errors[] = "Pairing {$index}: Player 2 appears in multiple pairings";
            }

            $participantIds[] = $pairing['player1_id'];
            $participantIds[] = $pairing['player2_id'];

            // Check if players have already faced each other
            if ($this->haveAlreadyPlayed($championship, $pairing['player1_id'], $pairing['player2_id'])) {
                $errors[] = "Pairing {$index}: Players have already faced each other";
            }

            // Check self-pairing
            if ($pairing['player1_id'] === $pairing['player2_id']) {
                $errors[] = "Pairing {$index}: Player cannot play against themselves";
            }
        }

        return $errors;
    }

    /**
     * Get pairings summary for debugging
     */
    public function getPairingsSummary(Championship $championship, array $pairings): array
    {
        $summary = [
            'total_pairings' => count($pairings),
            'participants_paired' => 0,
            'color_balance' => ['white' => 0, 'black' => 0],
            'pairings' => []
        ];

        foreach ($pairings as $pairing) {
            $summary['participants_paired'] += 2;
            $summary['color_balance']['white']++;
            $summary['color_balance']['black']++;

            $player1 = User::find($pairing['player1_id']);
            $player2 = User::find($pairing['player2_id']);

            $summary['pairings'][] = [
                'player1' => $player1?->name ?? 'Unknown',
                'player2' => $player2?->name ?? 'Unknown',
                'deadline' => $pairing['deadline'] ?? 'Not set',
            ];
        }

        return $summary;
    }
}