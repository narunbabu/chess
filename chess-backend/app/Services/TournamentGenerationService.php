<?php

namespace App\Services;

use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipParticipant;
use App\Models\ChampionshipStanding;
use App\Models\User;
use App\Enums\ChampionshipMatchStatus;
use App\Enums\ChampionshipRoundType;
use App\ValueObjects\TournamentConfig;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

/**
 * Tournament Generation Service
 *
 * Generates all rounds for a tournament in a single operation
 * Supports multiple tournament formats with intelligent pairing
 */
class TournamentGenerationService
{
    private SwissPairingService $swissService;

    public function __construct(SwissPairingService $swissService)
    {
        $this->swissService = $swissService;
    }

    /**
     * Generate full tournament (all rounds at once)
     *
     * @param Championship $championship
     * @param TournamentConfig|null $config
     * @return array Summary of generated matches
     */
    public function generateFullTournament(Championship $championship, ?TournamentConfig $config = null): array
    {
        // Check if tournament already generated
        if ($championship->isTournamentGenerated()) {
            throw new \InvalidArgumentException(
                'Tournament has already been fully generated. Use regenerate if you want to recreate all rounds.'
            );
        }

        // Get or create configuration
        if (!$config) {
            $config = $championship->getOrCreateTournamentConfig();
        }

        // Validate configuration
        $errors = $config->validate();
        if (!empty($errors)) {
            throw new \InvalidArgumentException('Invalid tournament configuration: ' . implode(', ', $errors));
        }

        // Get participants
        $participants = $championship->participants()->with('user')->get();

        if ($participants->count() < 2) {
            throw new \InvalidArgumentException('At least 2 participants required to generate tournament');
        }

        // Initialize pair history tracking
        $pairHistory = [];
        $summary = [
            'total_rounds' => count($config->roundStructure),
            'total_matches' => 0,
            'rounds' => [],
            'participants' => $participants->count(),
        ];

        DB::transaction(function () use ($championship, $config, $participants, &$pairHistory, &$summary) {
            // Generate ALL rounds upfront
            // Swiss rounds: Create matches with assigned players
            // Elimination rounds: Create placeholder matches with TBD players
            foreach ($config->roundStructure as $roundConfig) {
                $roundNumber = $roundConfig['round'];

                Log::info("Generating round {$roundNumber}", [
                    'championship_id' => $championship->id,
                    'round_config' => $roundConfig,
                ]);

                $roundSummary = $this->generateRound(
                    $championship,
                    $roundNumber,
                    $roundConfig,
                    $participants,
                    $pairHistory
                );

                $summary['rounds'][] = $roundSummary;
                $summary['total_matches'] += $roundSummary['matches_created'];
            }

            // Save configuration to championship
            $championship->setTournamentConfig($config);
            $championship->markTournamentAsGenerated();
            $championship->save();
        });

        Log::info("Full tournament generated successfully", [
            'championship_id' => $championship->id,
            'summary' => $summary,
        ]);

        return $summary;
    }


    /**
     * Generate a single round based on configuration
     */
    private function generateRound(
        Championship $championship,
        int $roundNumber,
        array $roundConfig,
        Collection $allParticipants,
        array &$pairHistory
    ): array {

        // Map round type string to ChampionshipRoundType enum
        $roundTypeEnum = $this->mapRoundTypeToEnum($roundConfig['type'] ?? 'swiss');
        // Check for coverage enforcement first
        if (isset($roundConfig['enforce_coverage']) && $roundConfig['enforce_coverage']) {
            return $this->generateCoverageEnforcedRound(
                $championship,
                $roundNumber,
                $roundConfig,
                $allParticipants
            );
        }

        // Select participants for this round
        $selectedParticipants = $this->selectParticipantsForRound(
            $championship,
            $roundConfig['participant_selection'],
            $allParticipants
        );

        Log::info("Selected participants for round", [
            'round' => $roundNumber,
            'selected' => $selectedParticipants->count(),
            'selection_rule' => $roundConfig['participant_selection'],
        ]);

        // Generate pairings based on method
        $pairings = $this->generatePairings(
            $championship,
            $roundNumber,
            $selectedParticipants,
            $roundConfig,
            $pairHistory
        );

        // Create matches with correct round type
        $matches = $this->createMatches($championship, $roundNumber, $pairings, $roundTypeEnum);

        // Update pair history (skip placeholder matches)
        foreach ($pairings as $pairing) {
            // Skip byes and placeholders
            if (isset($pairing['is_bye']) && $pairing['is_bye']) {
                continue;
            }
            if (isset($pairing['is_placeholder']) && $pairing['is_placeholder']) {
                continue;
            }

            // Only track pair history for regular matches with actual player IDs
            if (isset($pairing['player1_id']) && isset($pairing['player2_id'])) {
                $pairKey = $this->getPairKey($pairing['player1_id'], $pairing['player2_id']);
                $pairHistory[$pairKey] = ($pairHistory[$pairKey] ?? 0) + 1;
            }
        }

        return [
            'round' => $roundNumber,
            'type' => $roundConfig['type'],
            'participants' => $selectedParticipants->count(),
            'matches_created' => $matches->count(),
            'byes' => $this->countByes($pairings),
        ];
    }

    /**
     * Select participants for a specific round based on selection rule
     */
    private function selectParticipantsForRound(
        Championship $championship,
        $selectionRule,
        Collection $allParticipants
    ): Collection {
        // If selection is 'all', return all participants
        if ($selectionRule === 'all') {
            return $allParticipants;
        }

        // If selection is array with top_k
        if (is_array($selectionRule) && isset($selectionRule['top_k'])) {
            return $this->getTopKParticipants($championship, $allParticipants, $selectionRule['top_k']);
        }

        // If selection is array with top_percent
        if (is_array($selectionRule) && isset($selectionRule['top_percent'])) {
            $topK = (int)ceil($allParticipants->count() * $selectionRule['top_percent'] / 100);
            return $this->getTopKParticipants($championship, $allParticipants, $topK);
        }

        // Default: return all
        return $allParticipants;
    }

    /**
     * Get top K participants based on standings
     */
    private function getTopKParticipants(Championship $championship, Collection $participants, int $topK): Collection
    {
        // Cap topK to available participants
        $topK = min($topK, $participants->count());

        // Get standings
        $standings = $championship->standings()
            ->whereIn('user_id', $participants->pluck('user_id'))
            ->orderByDesc('points')
            ->orderByDesc('buchholz_score')
            ->orderByDesc('sonneborn_berger')
            ->limit($topK)
            ->get();

        $topUserIds = $standings->pluck('user_id');

        // If no standings yet (first round), use rating
        if ($topUserIds->isEmpty()) {
            return $participants->sortByDesc(function ($participant) {
                return $participant->user->rating ?? 1200;
            })->take($topK);
        }

        // Filter participants to top K
        $selected = $participants->filter(function ($participant) use ($topUserIds) {
            return $topUserIds->contains($participant->user_id);
        });

        // If we got fewer than requested, fill with remaining participants by rating
        if ($selected->count() < $topK) {
            $remaining = $participants->filter(function ($participant) use ($selected) {
                return !$selected->contains('user_id', $participant->user_id);
            })->sortByDesc(function ($participant) {
                return $participant->user->rating ?? 1200;
            })->take($topK - $selected->count());

            $selected = $selected->merge($remaining);
        }

        return $selected->take($topK);
    }

    /**
     * Generate pairings based on pairing method
     *
     * For selective rounds (top_k, top_percent), creates placeholder matches instead of fixed pairings
     */
    private function generatePairings(
        Championship $championship,
        int $roundNumber,
        Collection $participants,
        array $roundConfig,
        array $pairHistory
    ): array {
        $method = $roundConfig['pairing_method'];
        $matchesPerPlayer = $roundConfig['matches_per_player'];

        // 🎯 CRITICAL FIX: Check round type FIRST before checking selective
        $roundType = $roundConfig['type'] ?? 'swiss';

        // For elimination rounds (semi-final, final), use selective pairing
        if (in_array($roundType, ['semi_final', 'final', 'elimination'])) {
            Log::info("Using elimination pairing for round", [
                'championship_id' => $championship->id,
                'round_number' => $roundNumber,
                'round_type' => $roundType,
            ]);
            return $this->generatePlaceholderPairings($roundConfig);
        }

        // Check if this is a selective round that should use placeholders
        $isSelectiveRound = $this->isSelectiveRound($roundConfig);

        // For selective rounds (round 3+), create placeholder pairings
        if ($isSelectiveRound) {
            return $this->generatePlaceholderPairings($roundConfig);
        }

        // 🎯 CRITICAL FIX: For Swiss rounds beyond Round 1, create placeholder pairings
        // These will be assigned dynamically when the previous round completes
        // Check both PAIRING_SWISS and PAIRING_STANDINGS_BASED (which is also used for Swiss rounds)
        $isSwissRound = ($method === TournamentConfig::PAIRING_SWISS ||
                         $method === TournamentConfig::PAIRING_STANDINGS_BASED);

        // Generate Swiss pairings with proper tournament progression logic
        if ($isSwissRound && $roundConfig['type'] === 'swiss') {
            if ($roundNumber === 1) {
                // Round 1: Pair by rating (highest vs lowest, etc.)
                Log::info("Creating Round 1 pairings by rating", [
                    'championship_id' => $championship->id,
                    'round_number' => $roundNumber,
                    'pairing_method' => $method,
                ]);
                return $this->swissService->generatePairings($championship, $roundNumber);
            } else {
                // Round 2+: Create TBD placeholder matches (will be assigned after previous round completion)
                Log::info("Creating TBD placeholder matches for future Swiss round", [
                    'championship_id' => $championship->id,
                    'round_number' => $roundNumber,
                    'pairing_method' => $method,
                ]);
                return $this->generateSwissPlaceholderPairings($participants->count());
            }
        }

        // For early rounds (round 1), create fixed pairings
        switch ($method) {
            case TournamentConfig::PAIRING_RANDOM:
                return $this->pairRandom($participants, $matchesPerPlayer);

            case TournamentConfig::PAIRING_RANDOM_SEEDED:
                return $this->pairRandomSeeded($participants, $matchesPerPlayer);

            case TournamentConfig::PAIRING_RATING_BASED:
                return $this->pairByRating($participants, $matchesPerPlayer, $pairHistory);

            case TournamentConfig::PAIRING_STANDINGS_BASED:
                // Check for complete round-robin special case
                if (isset($roundConfig['force_complete_round_robin']) && $roundConfig['force_complete_round_robin']) {
                    return $this->pairCompleteRoundRobin($participants);
                }
                return $this->pairByStandings($championship, $participants, $matchesPerPlayer, $pairHistory);

            case TournamentConfig::PAIRING_DIRECT:
                return $this->pairDirect($participants);

            case TournamentConfig::PAIRING_SWISS:
                // Use existing Swiss pairing service for Round 1
                return $this->swissService->generatePairings($championship, $roundNumber);

            case TournamentConfig::PAIRING_ROUND_ROBIN_TOP_K:
                return $this->pairRoundRobinTopK($roundConfig);

            default:
                throw new \InvalidArgumentException("Unknown pairing method: {$method}");
        }
    }

    /**
     * Check if a round is selective (uses top_k or top_percent)
     */
    private function isSelectiveRound(array $roundConfig): bool
    {
        $selection = $roundConfig['participant_selection'];

        return is_array($selection) && (
            isset($selection['top_k']) || isset($selection['top_percent'])
        );
    }

    /**
     * Generate placeholder pairings for Swiss rounds (Round 2+)
     *
     * Creates TBD matches that will be assigned when previous round completes
     * Number of matches = floor(participants / 2)
     */
    private function generateSwissPlaceholderPairings(int $participantCount): array
    {
        $matchCount = (int)floor($participantCount / 2);
        $pairings = [];

        Log::info("Generating Swiss placeholder pairings", [
            'participant_count' => $participantCount,
            'match_count' => $matchCount,
        ]);

        // Create placeholder matches (will be assigned based on Swiss pairings later)
        for ($i = 0; $i < $matchCount; $i++) {
            $pairings[] = [
                'is_placeholder' => true,
                'player1_rank' => null, // Will be determined by Swiss algorithm
                'player2_rank' => null,
                'match_index' => $i + 1,
            ];
        }

        return $pairings;
    }

    /**
     * Generate placeholder pairings for selective rounds
     *
     * Creates match pairings with rank positions instead of actual player IDs
     */
    private function generatePlaceholderPairings(array $roundConfig): array
    {
        $selection = $roundConfig['participant_selection'];
        $topK = isset($selection['top_k']) ? $selection['top_k'] : null;

        if (!$topK) {
            // Calculate top_k from top_percent if needed
            // For now, we'll require top_k to be set
            throw new \InvalidArgumentException('Placeholder rounds require top_k to be set');
        }

        $pairings = [];
        $matchesPerPlayer = $roundConfig['matches_per_player'];

        // For selective rounds, create placeholder matches based on rankings
        // Example: Round 3 with top 3 players -> Rank #1 vs Rank #2, Rank #2 vs #3, Rank #1 vs #3

        if ($topK == 2) {
            // Simple final: rank 1 vs rank 2
            $pairings[] = [
                'is_placeholder' => true,
                'player1_rank' => 1,
                'player2_rank' => 2,
            ];
        } elseif ($topK == 3) {
            // Three players: multiple match possibilities
            if ($matchesPerPlayer == 1) {
                // Top 2 play final, 3rd place match or bye
                $pairings[] = [
                    'is_placeholder' => true,
                    'player1_rank' => 1,
                    'player2_rank' => 2,
                ];
            } else {
                // Round-robin: all play each other
                $pairings[] = [
                    'is_placeholder' => true,
                    'player1_rank' => 1,
                    'player2_rank' => 2,
                ];
                $pairings[] = [
                    'is_placeholder' => true,
                    'player1_rank' => 1,
                    'player2_rank' => 3,
                ];
                $pairings[] = [
                    'is_placeholder' => true,
                    'player1_rank' => 2,
                    'player2_rank' => 3,
                ];
            }
        } else {
            // General case: pair top players
            // For simplicity, pair sequentially: 1v2, 3v4, etc.
            for ($i = 1; $i <= $topK; $i += 2) {
                if ($i + 1 <= $topK) {
                    $pairings[] = [
                        'is_placeholder' => true,
                        'player1_rank' => $i,
                        'player2_rank' => $i + 1,
                    ];
                }
            }
        }

        return $pairings;
    }

    /**
     * Pair participants randomly
     */
    private function pairRandom(Collection $participants, int $matchesPerPlayer): array
    {
        $pairings = [];
        $participantList = $participants->shuffle()->values();

        // For each participant, try to create required number of matches
        $assignedMatches = collect();

        foreach ($participantList as $participant) {
            $playerId = $participant->user_id;
            $matchesCreated = 0;

            foreach ($participantList as $opponent) {
                if ($matchesCreated >= $matchesPerPlayer) {
                    break;
                }

                $opponentId = $opponent->user_id;

                if ($playerId === $opponentId) {
                    continue;
                }

                $pairKey = $this->getPairKey($playerId, $opponentId);

                if (!$assignedMatches->contains($pairKey)) {
                    $pairings[] = [
                        'player1_id' => $playerId,
                        'player2_id' => $opponentId,
                    ];

                    $assignedMatches->push($pairKey);
                    $matchesCreated++;
                }
            }
        }

        return $this->removeDuplicatePairs($pairings);
    }

    /**
     * Pair participants randomly but seeded by rating
     */
    private function pairRandomSeeded(Collection $participants, int $matchesPerPlayer): array
    {
        // Sort by rating first
        $sorted = $participants->sortByDesc(function ($participant) {
            return $participant->user->rating ?? 1200;
        })->values();

        // Divide into pools based on rating
        $poolSize = max(3, (int)ceil($sorted->count() / 4));
        $pools = $sorted->chunk($poolSize);

        $pairings = [];
        $assignedMatches = collect();

        // Within each pool, create random pairings
        foreach ($pools as $pool) {
            $poolPairings = $this->generateDenseMatchesInPool(
                $pool,
                $matchesPerPlayer,
                $assignedMatches
            );

            $pairings = array_merge($pairings, $poolPairings);
        }

        // If matches per player is high, allow cross-pool pairings
        if ($matchesPerPlayer >= 3) {
            $crossPoolPairings = $this->generateCrossPoolPairings(
                $sorted,
                $matchesPerPlayer,
                $assignedMatches,
                $pairings
            );

            $pairings = array_merge($pairings, $crossPoolPairings);
        }

        return $this->handleOddParticipant($pairings, $sorted);
    }

    /**
     * Generate dense matches within a pool
     */
    private function generateDenseMatchesInPool(
        Collection $pool,
        int $matchesPerPlayer,
        Collection $assignedMatches
    ): array {
        $pairings = [];
        $poolArray = $pool->values();

        for ($i = 0; $i < $poolArray->count(); $i++) {
            $player = $poolArray[$i];
            $matchesCreated = 0;

            for ($j = 0; $j < $poolArray->count() && $matchesCreated < $matchesPerPlayer; $j++) {
                if ($i === $j) {
                    continue;
                }

                $opponent = $poolArray[$j];
                $pairKey = $this->getPairKey($player->user_id, $opponent->user_id);

                if (!$assignedMatches->contains($pairKey)) {
                    $pairings[] = [
                        'player1_id' => $player->user_id,
                        'player2_id' => $opponent->user_id,
                    ];

                    $assignedMatches->push($pairKey);
                    $matchesCreated++;
                }
            }
        }

        return $pairings;
    }

    /**
     * Generate complete round-robin pairings for all participants
     * Creates all C(n,2) possible matches between participants
     */
    private function pairCompleteRoundRobin(Collection $participants): array
    {
        $pairings = [];
        $participantArray = $participants->values();
        $count = $participantArray->count();

        Log::info("Generating complete round-robin", [
            'participant_count' => $count,
        ]);

        for ($i = 0; $i < $count; $i++) {
            for ($j = $i + 1; $j < $count; $j++) {
                $player1 = $participantArray[$i];
                $player2 = $participantArray[$j];

                $pairings[] = [
                    'player1_id' => $player1->user_id,
                    'player2_id' => $player2->user_id,
                ];

                Log::debug("Created round-robin pairing", [
                    'player1' => $player1->user_id,
                    'player2' => $player2->user_id,
                ]);
            }
        }

        Log::info("Complete round-robin generated", [
            'total_pairs' => count($pairings),
            'expected_pairs' => ($count * ($count - 1)) / 2,
        ]);

        return $pairings;
    }

    /**
     * Generate cross-pool pairings if needed
     */
    private function generateCrossPoolPairings(
        Collection $participants,
        int $matchesPerPlayer,
        Collection $assignedMatches,
        array $existingPairings
    ): array {
        $pairings = [];

        // Count matches per player from existing pairings
        $matchCounts = [];
        foreach ($existingPairings as $pairing) {
            $matchCounts[$pairing['player1_id']] = ($matchCounts[$pairing['player1_id']] ?? 0) + 1;
            $matchCounts[$pairing['player2_id']] = ($matchCounts[$pairing['player2_id']] ?? 0) + 1;
        }

        // Try to fill remaining matches
        foreach ($participants as $player) {
            $playerId = $player->user_id;
            $currentMatches = $matchCounts[$playerId] ?? 0;

            if ($currentMatches >= $matchesPerPlayer) {
                continue;
            }

            foreach ($participants as $opponent) {
                if ($currentMatches >= $matchesPerPlayer) {
                    break;
                }

                $opponentId = $opponent->user_id;

                if ($playerId === $opponentId) {
                    continue;
                }

                $pairKey = $this->getPairKey($playerId, $opponentId);

                if (!$assignedMatches->contains($pairKey)) {
                    $pairings[] = [
                        'player1_id' => $playerId,
                        'player2_id' => $opponentId,
                    ];

                    $assignedMatches->push($pairKey);
                    $currentMatches++;
                    $matchCounts[$playerId] = $currentMatches;
                    $matchCounts[$opponentId] = ($matchCounts[$opponentId] ?? 0) + 1;
                }
            }
        }

        return $pairings;
    }

    /**
     * Pair by rating
     */
    private function pairByRating(Collection $participants, int $matchesPerPlayer, array $pairHistory): array
    {
        $sorted = $participants->sortByDesc(function ($participant) {
            return $participant->user->rating ?? 1200;
        })->values();

        return $this->generateDenseMatchesByRank($sorted, $matchesPerPlayer, $pairHistory);
    }

    /**
     * Pair by standings
     */
    private function pairByStandings(
        Championship $championship,
        Collection $participants,
        int $matchesPerPlayer,
        array $pairHistory
    ): array {
        // Get standings
        $standings = $championship->standings()
            ->whereIn('user_id', $participants->pluck('user_id'))
            ->orderByDesc('points')
            ->orderByDesc('buchholz_score')
            ->orderByDesc('sonneborn_berger')
            ->get()
            ->keyBy('user_id');

        // Sort participants by standings
        $sorted = $participants->sortByDesc(function ($participant) use ($standings) {
            $standing = $standings->get($participant->user_id);
            return $standing ? $standing->points * 1000 + $standing->buchholz_score : 0;
        })->values();

        return $this->generateDenseMatchesByRank($sorted, $matchesPerPlayer, $pairHistory);
    }

    /**
     * Generate dense matches by rank (rating or standings)
     */
    private function generateDenseMatchesByRank(
        Collection $sorted,
        int $matchesPerPlayer,
        array $pairHistory
    ): array {
        $pairings = [];
        $assignedMatches = collect();

        foreach ($sorted as $index => $player) {
            $playerId = $player->user_id;
            $matchesCreated = 0;

            // Try to pair with players close in rank first
            $opponents = $this->getOpponentsByProximity($sorted, $index, $matchesPerPlayer * 2);

            foreach ($opponents as $opponent) {
                if ($matchesCreated >= $matchesPerPlayer) {
                    break;
                }

                $opponentId = $opponent->user_id;
                $pairKey = $this->getPairKey($playerId, $opponentId);

                if (!$assignedMatches->contains($pairKey)) {
                    $pairings[] = [
                        'player1_id' => $playerId,
                        'player2_id' => $opponentId,
                        'avoid_repeat' => isset($pairHistory[$pairKey]),
                    ];

                    $assignedMatches->push($pairKey);
                    $matchesCreated++;
                }
            }
        }

        return $this->removeDuplicatePairs($pairings);
    }

    /**
     * Get opponents by proximity in ranking
     */
    private function getOpponentsByProximity(Collection $sorted, int $playerIndex, int $count): Collection
    {
        $opponents = collect();
        $totalParticipants = $sorted->count();

        // Get nearby opponents (those close in rank)
        $range = (int)ceil($count / 2);

        for ($i = 1; $i <= $range; $i++) {
            // Try below
            if ($playerIndex + $i < $totalParticipants) {
                $opponents->push($sorted[$playerIndex + $i]);
            }

            // Try above
            if ($playerIndex - $i >= 0) {
                $opponents->push($sorted[$playerIndex - $i]);
            }

            if ($opponents->count() >= $count) {
                break;
            }
        }

        return $opponents->shuffle()->take($count);
    }

    /**
     * Direct pairing (for finals - top 2-4 players)
     *
     * Handles finals with 2, 3, or 4 participants:
     * - 2 participants: Single final match
     * - 3 participants: Top 2 play, 3rd gets bronze match or bye
     * - 4 participants: Two semi-finals
     */
    private function pairDirect(Collection $participants): array
    {
        $count = $participants->count();

        if ($count < 2 || $count > 4) {
            throw new \InvalidArgumentException('Direct pairing requires 2-4 participants');
        }

        $players = $participants->values();
        $pairings = [];

        if ($count === 2) {
            // Simple final: 1 vs 2
            $pairings[] = [
                'player1_id' => $players[0]->user_id,
                'player2_id' => $players[1]->user_id,
            ];
        } elseif ($count === 3) {
            // 3-way final: 1 vs 2, 3rd player gets bye (or could be 1v2 + 2v3)
            // Standard approach: Top 2 play final, 3rd place determined
            $pairings[] = [
                'player1_id' => $players[0]->user_id,
                'player2_id' => $players[1]->user_id,
            ];
            // Player 3 gets automatic 3rd place (bye)
            $pairings[] = [
                'player1_id' => $players[2]->user_id,
                'player2_id' => null,
                'is_bye' => true,
            ];
        } else { // count === 4
            // Semi-finals: 1 vs 4, 2 vs 3
            $pairings[] = [
                'player1_id' => $players[0]->user_id,
                'player2_id' => $players[3]->user_id,
            ];
            $pairings[] = [
                'player1_id' => $players[1]->user_id,
                'player2_id' => $players[2]->user_id,
            ];
        }

        return $pairings;
    }

    /**
     * Create matches from pairings
     *
     * Handles both fixed pairings (with player IDs) and placeholder pairings (with rank positions)
     */
    private function createMatches(Championship $championship, int $roundNumber, array $pairings, ChampionshipRoundType $roundTypeEnum): Collection
    {
        $matches = collect();

        // Get base start date - handle both string and Carbon inputs
        $baseDate = $championship->starts_at
            ? (is_string($championship->starts_at) ? Carbon::parse($championship->starts_at) : $championship->starts_at)
            : now();

        // Calculate round start date with 1-day gap between rounds
        $roundStartDate = $baseDate->copy()->addDays($roundNumber - 1);

        // Set specific time for round based on round number
        $roundStartTime = $this->getRoundStartTime($roundNumber);
        $roundStartDate->setTime($roundStartTime['hour'], $roundStartTime['minute']);

        foreach ($pairings as $pairing) {
            // Handle bye
            if (isset($pairing['is_bye']) && $pairing['is_bye']) {
                // Skip byes for now or create special bye matches if needed
                continue;
            }

            // Calculate individual match start time within the round
            $matchStartTime = $this->calculateMatchStartTime($roundStartDate, $matches->count());

            // Check if this is a placeholder pairing
            if (isset($pairing['is_placeholder']) && $pairing['is_placeholder']) {
                // Create placeholder match
                $match = $this->createPlaceholderMatch(
                    $championship,
                    $roundNumber,
                    $pairing,
                    $roundTypeEnum,
                    $matchStartTime,
                    $roundStartDate
                );
            } else {
                // Create regular match with fixed players
                // Validate that player IDs exist
                if (!isset($pairing['player1_id']) || !isset($pairing['player2_id'])) {
                    Log::error("Invalid pairing - missing player IDs", [
                        'championship_id' => $championship->id,
                        'round_number' => $roundNumber,
                        'pairing' => $pairing,
                    ]);
                    throw new \InvalidArgumentException(
                        "Pairing missing player IDs. Got: " . json_encode($pairing)
                    );
                }

                $colors = $this->swissService->assignColorsPub($championship, $pairing['player1_id'], $pairing['player2_id']);

                $match = ChampionshipMatch::create([
                    'championship_id' => $championship->id,
                    'round_number' => $roundNumber,
                    'round_type' => $roundTypeEnum,
                    'player1_id' => $pairing['player1_id'],
                    'player2_id' => $pairing['player2_id'],
                    'white_player_id' => $colors['white'],
                    'black_player_id' => $colors['black'],
                    'color_assignment_method' => $championship->getColorAssignmentMethod(),
                    'auto_generated' => true,
                    'is_placeholder' => false,
                    'scheduled_at' => $matchStartTime,
                    'deadline' => $roundStartDate->copy()->addHours($championship->match_time_window_hours),
                    'status' => ChampionshipMatchStatus::PENDING,
                ]);
            }

            $matches->push($match);
        }

        return $matches;
    }

    /**
     * Create a placeholder match with rank positions instead of player IDs
     */
    private function createPlaceholderMatch(
        Championship $championship,
        int $roundNumber,
        array $pairing,
        ChampionshipRoundType $roundTypeEnum,
        Carbon $matchStartTime,
        Carbon $roundStartDate
    ): ChampionshipMatch {
        $placeholderPositions = [
            'player1' => 'rank_' . $pairing['player1_rank'],
            'player2' => 'rank_' . $pairing['player2_rank'],
        ];

        Log::info("Creating placeholder match", [
            'championship_id' => $championship->id,
            'round_number' => $roundNumber,
            'positions' => $placeholderPositions,
        ]);

        return ChampionshipMatch::create([
            'championship_id' => $championship->id,
            'round_number' => $roundNumber,
            'round_type' => $roundTypeEnum,
            'player1_id' => null, // Will be assigned later based on rankings
            'player2_id' => null,
            'white_player_id' => null,
            'black_player_id' => null,
            'color_assignment_method' => $championship->getColorAssignmentMethod(),
            'auto_generated' => true,
            'is_placeholder' => true,
            'placeholder_positions' => $placeholderPositions,
            'determined_by_round' => $roundNumber - 1, // Previous round determines this match
            'scheduled_at' => $matchStartTime,
            'deadline' => $roundStartDate->copy()->addHours($championship->match_time_window_hours),
            'status' => ChampionshipMatchStatus::PENDING,
        ]);
    }

    /**
     * Get round start time based on round number
     */
    private function getRoundStartTime(int $roundNumber): array
    {
        // Different start times for different rounds to avoid overlap
        $roundTimes = [
            1 => ['hour' => 10, 'minute' => 0],   // 10:00 AM
            2 => ['hour' => 14, 'minute' => 0],   // 2:00 PM
            3 => ['hour' => 10, 'minute' => 0],   // 10:00 AM
            4 => ['hour' => 14, 'minute' => 0],   // 2:00 PM
            5 => ['hour' => 10, 'minute' => 0],   // 10:00 AM
            6 => ['hour' => 14, 'minute' => 0],   // 2:00 PM
        ];

        // Default to 10:00 AM for rounds beyond 6
        return $roundTimes[$roundNumber] ?? ['hour' => 10, 'minute' => 0];
    }

    /**
     * Calculate individual match start time within a round
     */
    private function calculateMatchStartTime(Carbon $roundStartDate, int $matchIndex): Carbon
    {
        // Stagger matches by 30 minutes to avoid all matches starting at exactly the same time
        // This gives players time to prepare between games if they're watching others
        $staggerMinutes = $matchIndex * 30;

        // Don't stagger too much - reset every 2 hours to avoid very late start times
        if ($staggerMinutes >= 120) {
            $staggerMinutes = $staggerMinutes % 120;
        }

        return $roundStartDate->copy()->addMinutes($staggerMinutes);
    }

    /**
     * Get pair key for tracking history
     */
    private function getPairKey(int $player1Id, int $player2Id): string
    {
        $ids = [$player1Id, $player2Id];
        sort($ids);
        return implode('_', $ids);
    }

    /**
     * Remove duplicate pairs
     */
    private function removeDuplicatePairs(array $pairings): array
    {
        $seen = [];
        $unique = [];

        foreach ($pairings as $pairing) {
            if (isset($pairing['is_bye']) && $pairing['is_bye']) {
                $unique[] = $pairing;
                continue;
            }

            $pairKey = $this->getPairKey($pairing['player1_id'], $pairing['player2_id']);

            if (!isset($seen[$pairKey])) {
                $seen[$pairKey] = true;
                $unique[] = $pairing;
            }
        }

        return $unique;
    }

    /**
     * Handle odd number of participants (add bye)
     */
    private function handleOddParticipant(array $pairings, Collection $participants): array
    {
        // Count how many matches each participant has
        $matchCounts = [];
        foreach ($pairings as $pairing) {
            $matchCounts[$pairing['player1_id']] = ($matchCounts[$pairing['player1_id']] ?? 0) + 1;
            $matchCounts[$pairing['player2_id']] = ($matchCounts[$pairing['player2_id']] ?? 0) + 1;
        }

        // Find participant with fewest matches
        $byeRecipient = null;
        $minMatches = PHP_INT_MAX;

        foreach ($participants as $participant) {
            $count = $matchCounts[$participant->user_id] ?? 0;
            if ($count < $minMatches) {
                $minMatches = $count;
                $byeRecipient = $participant;
            }
        }

        // Add bye if someone has no matches
        if ($byeRecipient && $minMatches === 0) {
            $pairings[] = [
                'is_bye' => true,
                'player1_id' => $byeRecipient->user_id,
                'player2_id' => null,
            ];
        }

        return $pairings;
    }

    /**
     * Count byes in pairings
     */
    private function countByes(array $pairings): int
    {
        return count(array_filter($pairings, function ($pairing) {
            return isset($pairing['is_bye']) && $pairing['is_bye'];
        }));
    }

    /**
     * Preview tournament structure without creating matches
     */
    public function previewTournamentStructure(Championship $championship, ?TournamentConfig $config = null): array
    {
        if (!$config) {
            $config = $championship->getOrCreateTournamentConfig();
        }

        $participants = $championship->participants()->count();

        // Guard against zero participants
        if ($participants === 0) {
            return [
                'config' => $config->toArray(),
                'participants' => 0,
                'total_rounds' => count($config->roundStructure),
                'estimated_total_matches' => 0,
                'rounds' => [],
                'coverage_analysis' => [],
                'participant_progression' => [],
                'warnings' => ['No participants registered for this championship'],
                'validation' => [
                    'monotonic_reduction' => true,
                    'top_k_coverage' => true,
                    'errors' => ['Cannot generate tournament without participants'],
                ],
            ];
        }

        $preview = [
            'config' => $config->toArray(),
            'participants' => $participants,
            'total_rounds' => count($config->roundStructure),
            'estimated_total_matches' => $config->calculateTotalMatches($participants),
            'rounds' => [],
            'coverage_analysis' => $this->generateCoverageAnalysis($config),
            'participant_progression' => [],
            'warnings' => [],
            'validation' => [
                'monotonic_reduction' => true,
                'top_k_coverage' => true,
                'errors' => [],
            ],
        ];

        // Generate participant progression and validate structure
        $lastParticipantCount = null;
        foreach ($config->roundStructure as $roundConfig) {
            $participantCount = $this->calculateRoundParticipants($participants, $roundConfig['participant_selection']);
            $matchesPerPlayer = $roundConfig['matches_per_player'];
            $estimatedMatches = (int)ceil(($participantCount * $matchesPerPlayer) / 2);

            // Check for monotonic reduction violations
            if ($lastParticipantCount !== null && $participantCount > $lastParticipantCount) {
                $preview['warnings'][] = "Round {$roundConfig['round']}: Participants increase from {$lastParticipantCount} to {$participantCount}. Tournament should show progressive reduction.";
                $preview['validation']['monotonic_reduction'] = false;
            }

            $preview['rounds'][] = [
                'round' => $roundConfig['round'],
                'type' => $roundConfig['type'],
                'participants' => $participantCount,
                'matches_per_player' => $matchesPerPlayer,
                'estimated_matches' => $estimatedMatches,
                'pairing_method' => $roundConfig['pairing_method'],
                'selection_rule' => $roundConfig['participant_selection'],
                'coverage_impact' => $this->getRoundCoverageImpact($roundConfig, $participantCount),
            ];

            $preview['participant_progression'][] = [
                'round' => $roundConfig['round'],
                'participants' => $participantCount,
                'reduction_from_previous' => $lastParticipantCount ? ($lastParticipantCount - $participantCount) : 0,
                'percentage_of_original' => $participants > 0 ? round(($participantCount / $participants) * 100, 1) : 0,
            ];

            $lastParticipantCount = $participantCount;
        }

        // Validate top-K coverage
        $topKCovErrors = $config->validateTopKCoverage($config->coverageEnforcement ?? 3);
        if (!empty($topKCovErrors)) {
            $preview['validation']['top_k_coverage'] = false;
            $preview['validation']['errors'] = array_merge($preview['validation']['errors'], $topKCovErrors);
        }

        // Validate monotonic reduction using TournamentConfig method
        $monotonicErrors = $config->validateMonotonicReduction();
        if (!empty($monotonicErrors)) {
            $preview['validation']['monotonic_reduction'] = false;
            $preview['validation']['errors'] = array_merge($preview['validation']['errors'], $monotonicErrors);
        }

        // Add specific warnings for potential issues
        $preview['warnings'] = array_merge($preview['warnings'], $this->generateStructureWarnings($config, $participants));

        return $preview;
    }

    /**
     * Generate coverage analysis for the tournament structure
     */
    private function generateCoverageAnalysis(TournamentConfig $config): array
    {
        $coverage = [
            'top_k_coverage_rounds' => [],
            'pairing_methods' => [],
            'selective_rounds_count' => 0,
            'round_robin_rounds' => 0,
        ];

        $roundRobinMethods = [
            TournamentConfig::PAIRING_ROUND_ROBIN_TOP_K,
        ];

        foreach ($config->roundStructure as $roundConfig) {
            // Track pairing methods
            $method = $roundConfig['pairing_method'];
            if (!isset($coverage['pairing_methods'][$method])) {
                $coverage['pairing_methods'][$method] = 0;
            }
            $coverage['pairing_methods'][$method]++;

            // Check if this is a selective round
            $isSelective = is_array($roundConfig['participant_selection']) && (
                isset($roundConfig['participant_selection']['top_k']) ||
                isset($roundConfig['participant_selection']['top_percent'])
            );

            if ($isSelective) {
                $coverage['selective_rounds_count']++;

                if (in_array($method, $roundRobinMethods)) {
                    $coverage['round_robin_rounds']++;
                    $coverage['top_k_coverage_rounds'][] = [
                        'round' => $roundConfig['round'],
                        'type' => $roundConfig['type'],
                        'selection' => $roundConfig['participant_selection'],
                        'pairing_method' => $method,
                    ];
                }
            }
        }

        return $coverage;
    }

    /**
     * Get coverage impact for a specific round
     */
    private function getRoundCoverageImpact(array $roundConfig, int $participantCount): array
    {
        $impact = [
            'type' => 'standard',
            'description' => 'Standard match pairing',
        ];

        // Check if this round contributes to top-K coverage
        if ($roundConfig['pairing_method'] === TournamentConfig::PAIRING_ROUND_ROBIN_TOP_K) {
            $impact = [
                'type' => 'top_k_coverage',
                'description' => 'Ensures top players play each other',
                'top_k' => $roundConfig['participant_selection']['top_k'] ?? $participantCount,
                'total_pairs' => $this->calculateCombinations($roundConfig['participant_selection']['top_k'] ?? $participantCount, 2),
            ];
        } elseif (is_array($roundConfig['participant_selection']) && isset($roundConfig['participant_selection']['top_k'])) {
            $impact = [
                'type' => 'selective',
                'description' => 'Top players selected for this round',
                'top_k' => $roundConfig['participant_selection']['top_k'],
            ];
        }

        return $impact;
    }

    /**
     * Calculate combinations (n choose k)
     */
    private function calculateCombinations(int $n, int $k): int
    {
        if ($k > $n) {
            return 0;
        }
        if ($k === 0 || $k === $n) {
            return 1;
        }

        $result = 1;
        for ($i = 0; $i < $k; $i++) {
            $result = $result * ($n - $i) / ($i + 1);
        }

        return (int)$result;
    }

    /**
     * Generate structure-specific warnings
     */
    private function generateStructureWarnings(TournamentConfig $config, int $participantCount): array
    {
        $warnings = [];

        // Check for potential issues with small tournaments
        if ($participantCount <= 4) {
            $warnings[] = "Small tournament ({$participantCount} participants): Consider using direct knockout format for better player experience.";
        }

        // Check for excessive rounds relative to participants
        $totalRounds = count($config->roundStructure);
        if ($totalRounds > $participantCount) {
            $warnings[] = "More rounds ({$totalRounds}) than participants ({$participantCount}). Some rounds may have minimal activity.";
        }

        // Check for tournament length
        if ($totalRounds > 8) {
            $warnings[] = "Long tournament ({$totalRounds} rounds): Consider player fatigue and tournament duration.";
        }

        // Check for coverage gaps in selective rounds
        $selectiveRounds = array_filter($config->roundStructure, function ($round) {
            return is_array($round['participant_selection']) && (
                isset($round['participant_selection']['top_k']) ||
                isset($round['participant_selection']['top_percent'])
            );
        });

        $roundRobinRounds = array_filter($selectiveRounds, function ($round) {
            return $round['pairing_method'] === TournamentConfig::PAIRING_ROUND_ROBIN_TOP_K;
        });

        if (count($selectiveRounds) > 0 && count($roundRobinRounds) === 0) {
            $warnings[] = "Selective rounds found but no round-robin coverage. Top players may not play each other.";
        }

        return $warnings;
    }

    /**
     * Calculate participants for a specific round
     */
    private function calculateRoundParticipants(int $baseCount, $selection): int
    {
        if ($selection === 'all') {
            return $baseCount;
        }

        if (is_array($selection) && isset($selection['top_k'])) {
            return min($selection['top_k'], $baseCount);
        }

        if (is_array($selection) && isset($selection['top_percent'])) {
            return (int)ceil($baseCount * $selection['top_percent'] / 100);
        }

        return $baseCount;
    }

    /**
     * Regenerate tournament (delete all matches and regenerate)
     */
    public function regenerateTournament(Championship $championship, ?TournamentConfig $config = null): array
    {
        DB::transaction(function () use ($championship) {
            // Delete all matches
            $championship->matches()->delete();

            // Reset tournament generated flag
            $championship->update([
                'tournament_generated' => false,
                'tournament_generated_at' => null,
            ]);

            Log::info("Tournament regeneration: deleted all matches", [
                'championship_id' => $championship->id,
            ]);
        });

        // Generate fresh tournament
        return $this->generateFullTournament($championship, $config);
    }

    /**
     * Generate round-robin pairings for top-K participants
     *
     * Creates all C(k,2) possible pairings for top-K players
     * and distributes them across available rounds
     */
    public function pairRoundRobinTopK(array $roundConfig): array
    {
        $selection = $roundConfig['participant_selection'];
        $topK = $selection['top_k'] ?? 3;

        if ($topK < 2 || $topK > 6) {
            throw new \InvalidArgumentException("Round-robin top-K requires 2-6 participants, got {$topK}");
        }

        // Generate all possible pairs
        $allPairs = $this->generateTopKPairings($topK);

        // Special case: Complete round-robin in single round
        if (isset($roundConfig['round_robin_complete']) && $roundConfig['round_robin_complete']) {
            // For complete round-robin, return all pairs for this round
            return $allPairs;
        }

        // Distribute pairs across rounds (conservative approach)
        $roundsLeft = $this->calculateRoundsLeft($roundConfig);
        $minPairsPerRound = 2;

        return $this->distributePairsAcrossRounds($allPairs, $roundsLeft, $minPairsPerRound);
    }

    /**
     * Generate all C(k,2) possible pairings for top-K players
     *
     * @param int $k Number of top players
     * @return array Array of [player1_rank, player2_rank] pairs
     */
    private function generateTopKPairings(int $k): array
    {
        $pairs = [];

        for ($i = 1; $i <= $k; $i++) {
            for ($j = $i + 1; $j <= $k; $j++) {
                $pairs[] = [
                    'is_placeholder' => true,
                    'player1_rank' => $i,
                    'player2_rank' => $j,
                ];
            }
        }

        return $pairs;
    }

    /**
     * Distribute pairs across available rounds using conservative approach
     *
     * @param array $pairs All pairs to distribute
     * @param int $roundsLeft Number of rounds remaining
     * @param int $minPairsPerRound Minimum pairs per round
     * @return array Array distributed for current round
     */
    private function distributePairsAcrossRounds(array $pairs, int $roundsLeft, int $minPairsPerRound): array
    {
        $totalPairs = count($pairs);

        if ($roundsLeft <= 0) {
            // No rounds left, distribute all pairs now
            return $pairs;
        }

        // Calculate pairs for this round (at least minimum)
        $avgPairsPerRound = ceil($totalPairs / $roundsLeft);
        $pairsForThisRound = max($minPairsPerRound, min($avgPairsPerRound, $totalPairs));

        // Take first N pairs for this round
        return array_slice($pairs, 0, $pairsForThisRound);
    }

    /**
     * Calculate remaining rounds from current round configuration
     */
    private function calculateRoundsLeft(array $roundConfig): int
    {
        // For now, assume we have 2 rounds left for round-robin coverage
        // This could be enhanced to calculate based on tournament structure
        return 2;
    }

    /**
     * Validate tournament coverage post-generation
     *
     * Checks that top-3 pairwise coverage is complete before finals
     */
    public function validateTournamentCoverage(Championship $championship): array
    {
        $coverage = [
            'valid' => true,
            'warnings' => [],
            'top3_pairs_found' => [],
            'missing_pairs' => [],
        ];

        // Get all matches up to but not including finals
        $matches = $championship->matches()
            ->where('is_placeholder', false)
            ->whereHas('roundType', function ($query) {
                $query->where('code', '!=', 'final');
            })
            ->with(['player1', 'player2'])
            ->get();

        // Get top 3 players by standings
        $top3Standings = $championship->standings()
            ->orderByDesc('points')
            ->orderByDesc('buchholz_score')
            ->limit(3)
            ->get();

        if ($top3Standings->count() < 3) {
            $coverage['warnings'][] = 'Fewer than 3 players with standings found';
            return $coverage;
        }

        $top3PlayerIds = $top3Standings->pluck('user_id')->toArray();

        // Generate all required pairs for top 3
        $requiredPairs = [
            [$top3PlayerIds[0], $top3PlayerIds[1]], // 1v2
            [$top3PlayerIds[0], $top3PlayerIds[2]], // 1v3
            [$top3PlayerIds[1], $top3PlayerIds[2]], // 2v3
        ];

        // Check which pairs exist in matches
        foreach ($requiredPairs as $pair) {
            $pairExists = $matches->contains(function ($match) use ($pair) {
                return (
                    ($match->player1_id === $pair[0] && $match->player2_id === $pair[1]) ||
                    ($match->player1_id === $pair[1] && $match->player2_id === $pair[0])
                );
            });

            if ($pairExists) {
                $coverage['top3_pairs_found'][] = $pair;
            } else {
                $coverage['missing_pairs'][] = $pair;
                $coverage['valid'] = false;
            }
        }

        if (!$coverage['valid']) {
            $coverage['warnings'][] = 'Missing top-3 pairwise coverage. Some top players have not played each other.';
        }

        return $coverage;
    }

    /**
     * Generate coverage-enforced round with specific pairings
     *
     * Creates placeholder matches for required rank-based pairings
     * to ensure top-K coverage before finals
     */
    private function generateCoverageEnforcedRound(
        Championship $championship,
        int $roundNumber,
        array $roundConfig,
        Collection $allParticipants
    ): array {
        $coveragePairs = $roundConfig['coverage_pairs'] ?? [];
        $determinedByRound = $roundConfig['determined_by_round'] ?? $roundNumber - 1;

        $pairings = [];

        Log::info("Generating coverage-enforced round", [
            'championship_id' => $championship->id,
            'round_number' => $roundNumber,
            'coverage_pairs' => $coveragePairs,
            'determined_by_round' => $determinedByRound,
        ]);

        foreach ($coveragePairs as $pair) {
            [$rank1, $rank2] = $pair;

            $pairings[] = [
                'is_placeholder' => true,
                'player1_rank' => $rank1,
                'player2_rank' => $rank2,
                'determined_by_round' => $determinedByRound,
                'round_number' => $roundNumber,
                'championship_id' => $championship->id,
            ];
        }

        // Create matches from coverage pairings (using Swiss as default for coverage rounds)
        $matches = $this->createMatches($championship, $roundNumber, $pairings, ChampionshipRoundType::SWISS);

        return [
            'round' => $roundNumber,
            'type' => $roundConfig['type'],
            'participants' => count($coveragePairs) * 2, // Each pair has 2 participants
            'matches_created' => $matches->count(),
            'byes' => 0, // Coverage rounds don't have byes
            'coverage_pairs_enforced' => count($coveragePairs),
            'determined_by_round' => $determinedByRound,
        ];
    }

    /**
     * Map round type string to ChampionshipRoundType enum
     */
    private function mapRoundTypeToEnum(string $roundType): ChampionshipRoundType
    {
        return match($roundType) {
            'swiss' => ChampionshipRoundType::SWISS,
            'round_of_16' => ChampionshipRoundType::ROUND_OF_16,
            'quarter_final' => ChampionshipRoundType::QUARTER_FINAL,
            'semi_final' => ChampionshipRoundType::SEMI_FINAL,
            'final' => ChampionshipRoundType::FINAL,
            'third_place' => ChampionshipRoundType::THIRD_PLACE,
            default => ChampionshipRoundType::SWISS, // Fallback to Swiss for unknown types
        };
    }
}
