<?php

namespace App\ValueObjects;

use Illuminate\Contracts\Support\Arrayable;
use Illuminate\Contracts\Support\Jsonable;

/**
 * Value Object for Tournament Configuration
 *
 * Represents comprehensive tournament structure configuration
 * including round-specific rules, pairing methods, and progression logic
 */
class TournamentConfig implements Arrayable, Jsonable, \JsonSerializable
{
    public string $mode;
    public array $roundStructure;
    public bool $avoidRepeatMatches;
    public bool $colorBalanceStrict;
    public string $byeHandling;
    public float $byePoints;
    public bool $autoAdvanceEnabled;
    public string $preset;

    // Adaptive tournament configuration
    public string $pairingPolicy;
    public int $coverageEnforcement;
    public int $minPairsPerSelectiveRound;

    /**
     * Pairing Policies
     */
    public const POLICY_ADAPTIVE = 'adaptive';
    public const POLICY_CONSERVATIVE = 'conservative';
    public const POLICY_AGGRESSIVE = 'aggressive';

    /**
     * Preset Templates
     */
    public const PRESET_SMALL = 'small_tournament';
    public const PRESET_MEDIUM = 'medium_tournament';
    public const PRESET_LARGE = 'large_tournament';
    public const PRESET_CUSTOM = 'custom';

    /**
     * Tournament Modes
     */
    public const MODE_ROUND_ROBIN = 'round_robin';
    public const MODE_SWISS = 'swiss';
    public const MODE_PROGRESSIVE = 'progressive';
    public const MODE_POOL_KNOCKOUT = 'pool_knockout';

    /**
     * Round Types
     */
    public const ROUND_TYPE_DENSE = 'dense';
    public const ROUND_TYPE_NORMAL = 'normal';
    public const ROUND_TYPE_SELECTIVE = 'selective';
    public const ROUND_TYPE_FINAL = 'final';

    /**
     * Pairing Methods (Algorithms)
     */
    public const PAIRING_RANDOM = 'random';
    public const PAIRING_RANDOM_SEEDED = 'random_seeded';
    public const PAIRING_RATING_BASED = 'rating_based';
    public const PAIRING_STANDINGS_BASED = 'standings_based';
    public const PAIRING_DIRECT = 'direct';
    public const PAIRING_SWISS = 'swiss';
    public const PAIRING_ROUND_ROBIN_TOP_K = 'round_robin_top_k';

    // Simplified algorithm names (primary)
    public const ALG_RANDOM = 'random';
    public const ALG_RANDOM_SEEDED = 'random_seeded';
    public const ALG_RATING = 'rating';
    public const ALG_STANDINGS = 'standings';
    public const ALG_DIRECT = 'direct';
    public const ALG_SWISS = 'swiss';

    /**
     * Participant Selection Types
     */
    public const SEL_ALL = 'all';
    public const SEL_TOP_K = 'top_k';
    public const SEL_TOP_PERCENT = 'top_percent';

    /**
     * Simple tournament configuration properties (for testing)
     */
    public ?string $pairing_algorithm = null;
    public ?string $participant_selection = null;
    public ?int $selection_value = null;
    public ?int $rounds = null;
    public ?int $seed = null;

    /**
     * Constructor supporting both array and preset initialization
     */
    public function __construct(array $config = [])
    {
        // Initialize default values for all properties to avoid typed property errors
        $this->mode = self::MODE_SWISS;
        $this->roundStructure = [];
        $this->avoidRepeatMatches = true;
        $this->colorBalanceStrict = true;
        $this->byeHandling = 'automatic';
        $this->byePoints = 1.0;
        $this->autoAdvanceEnabled = false;
        $this->preset = self::PRESET_CUSTOM;

        // Initialize new adaptive properties
        $this->pairingPolicy = self::POLICY_ADAPTIVE;
        $this->coverageEnforcement = 3;
        $this->minPairsPerSelectiveRound = 2;

        // Simple configuration (for testing/API)
        if (isset($config['pairing_algorithm'])) {
            $this->validateSimpleConfig($config);
            $this->pairing_algorithm = $config['pairing_algorithm'];
            $this->participant_selection = $config['participant_selection'] ?? self::SEL_ALL;
            $this->selection_value = $config['selection_value'] ?? null;
            $this->rounds = $config['rounds'] ?? 1;
            $this->seed = $config['seed'] ?? null;

            // Override adaptive configuration if provided
            $this->pairingPolicy = $config['pairing_policy'] ?? self::POLICY_ADAPTIVE;
            $this->coverageEnforcement = $config['coverage_enforcement'] ?? 3;
            $this->minPairsPerSelectiveRound = $config['min_pairs_per_selective_round'] ?? 2;
        }
    }

    /**
     * Validate simple configuration format
     */
    private function validateSimpleConfig(array $config): void
    {
        // Validate pairing algorithm
        $validAlgorithms = [
            self::ALG_RANDOM,
            self::ALG_RANDOM_SEEDED,
            self::ALG_RATING,
            self::ALG_STANDINGS,
            self::ALG_DIRECT,
            self::ALG_SWISS,
        ];

        if (!in_array($config['pairing_algorithm'], $validAlgorithms, true)) {
            throw new \InvalidArgumentException(
                "Invalid pairing algorithm. Must be one of: " . implode(', ', $validAlgorithms)
            );
        }

        // Validate participant selection
        $participantSelection = $config['participant_selection'] ?? self::SEL_ALL;
        $validSelections = [self::SEL_ALL, self::SEL_TOP_K, self::SEL_TOP_PERCENT];

        if (!in_array($participantSelection, $validSelections, true)) {
            throw new \InvalidArgumentException(
                "Invalid participant selection. Must be one of: " . implode(', ', $validSelections)
            );
        }

        // Validate selection value requirements
        if ($participantSelection === self::SEL_TOP_K && (!isset($config['selection_value']) || $config['selection_value'] === null)) {
            throw new \InvalidArgumentException("Selection value required for TOP_K selection");
        }

        if ($participantSelection === self::SEL_TOP_PERCENT && (!isset($config['selection_value']) || $config['selection_value'] === null)) {
            throw new \InvalidArgumentException("Selection value required for TOP_PERCENT selection");
        }

        // Validate selection value ranges
        if (isset($config['selection_value']) && $config['selection_value'] !== null) {
            $value = $config['selection_value'];

            if ($participantSelection === self::SEL_TOP_K) {
                if ($value < 2) {
                    throw new \InvalidArgumentException("Minimum 2 participants required for TOP_K");
                }
                if ($value > 1000) {
                    throw new \InvalidArgumentException("Maximum 1000 participants allowed for TOP_K");
                }
            }

            if ($participantSelection === self::SEL_TOP_PERCENT) {
                if ($value < 1) {
                    throw new \InvalidArgumentException("Minimum 1 percent required for TOP_PERCENT");
                }
                if ($value > 100) {
                    throw new \InvalidArgumentException("Maximum 100 percent allowed for TOP_PERCENT");
                }
            }
        }

        // Validate rounds
        if (isset($config['rounds'])) {
            if ($config['rounds'] < 1) {
                throw new \InvalidArgumentException("Minimum 1 round required");
            }
            if ($config['rounds'] > 50) {
                throw new \InvalidArgumentException("Maximum 50 rounds allowed");
            }
        }

        // Validate seed
        if (isset($config['seed'])) {
            if ($config['seed'] < 0) {
                throw new \InvalidArgumentException("Seed must be non-negative");
            }
            if ($config['seed'] > 4294967295) { // 2^32 - 1
                throw new \InvalidArgumentException("Seed must be less than 2^32");
            }
        }
    }

    /**
     * Create from preset template
     */
    public static function fromPreset(string $preset, int $totalRounds, int $participantCount): self
    {
        $config = new self();
        $config->preset = $preset;
        $config->avoidRepeatMatches = true;
        $config->colorBalanceStrict = true;
        $config->byeHandling = 'automatic';
        $config->byePoints = 1.0;
        $config->autoAdvanceEnabled = false;

        // Initialize new adaptive properties
        $config->pairingPolicy = self::POLICY_ADAPTIVE;
        $config->coverageEnforcement = 3;
        $config->minPairsPerSelectiveRound = 2;

        switch ($preset) {
            case self::PRESET_SMALL:
                // For 16 or fewer players, use Swiss + Elimination
                if ($participantCount <= 16) {
                    $config->mode = self::MODE_SWISS;
                    $config->roundStructure = self::generateSwissEliminationStructure($participantCount);
                } else {
                    $config->mode = self::MODE_PROGRESSIVE;
                    $config->roundStructure = self::generateSmallTournamentStructure($totalRounds, $participantCount);
                }
                break;

            case self::PRESET_MEDIUM:
                $config->mode = self::MODE_PROGRESSIVE;
                $config->roundStructure = self::generateMediumTournamentStructure($totalRounds, $participantCount);
                break;

            case self::PRESET_LARGE:
                $config->mode = self::MODE_PROGRESSIVE;
                $config->roundStructure = self::generateLargeTournamentStructure($totalRounds, $participantCount);
                break;

            case 'universal':
                $config->mode = self::MODE_PROGRESSIVE;
                $config->roundStructure = self::generateUniversalTournamentStructure($participantCount, $totalRounds);
                $config->preset = 'universal';
                break;

            default:
                $config->mode = self::MODE_SWISS;
                $config->roundStructure = self::generateSwissStructure($totalRounds);
                break;
        }

        return $config;
    }

    /**
     * Create from universal preset (automatic selection based on participant count)
     */
    public static function fromUniversal(int $participantCount, int $totalRounds = 5): self
    {
        return self::fromPreset('universal', $totalRounds, $participantCount);
    }

    /**
     * Small tournament structure (3-10 participants)
     *
     * Focus: Multiple matches per player in early rounds, progressive reduction in later rounds
     * Ensures consistent match reduction: early rounds have ≥ middle rounds ≥ final rounds
     */
    private static function generateSmallTournamentStructure(int $totalRounds, int $participantCount): array
    {
        $structure = [];

        // Special handling for 3-player tournaments - Option A implementation
        if ($participantCount === 3) {
            return self::generateThreePlayerOptionAStructure($totalRounds);
        }

        for ($round = 1; $round <= $totalRounds; $round++) {
            if ($round === 1) {
                // Round 1: Dense - each player vs 2 opponents (or all if ≤5)
                $matchesPerPlayer = $participantCount <= 5 ? $participantCount - 1 : 2;
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_DENSE,
                    'participant_selection' => 'all',
                    'matches_per_player' => $matchesPerPlayer,
                    'pairing_method' => self::PAIRING_RANDOM_SEEDED,
                ];
            } elseif ($round === 2) {
                // Round 2: Normal - each player vs 1-2 opponents
                $matchesPerPlayer = $participantCount <= 5 ? 1 : 2;
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_NORMAL,
                    'participant_selection' => 'all',
                    'matches_per_player' => $matchesPerPlayer,
                    'pairing_method' => self::PAIRING_STANDINGS_BASED,
                ];
            } elseif ($round === $totalRounds) {
                // Final round: Top 2-4 (adaptive based on participant count)
                $finalTopK = min(4, max(2, $participantCount));
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_FINAL,
                    'participant_selection' => ['top_k' => $finalTopK],
                    'matches_per_player' => 1,
                    'pairing_method' => self::PAIRING_DIRECT,
                ];
            } elseif ($round === $totalRounds - 1) {
                // Semi-final: Top 3-4 (ensure not smaller than final round participants)
                $finalTopK = min(4, max(2, $participantCount));
                $semiFinalTopK = min(4, max($finalTopK, (int)ceil($participantCount / 2)));
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_SELECTIVE,
                    'participant_selection' => ['top_k' => $semiFinalTopK],
                    'matches_per_player' => 1,
                    'pairing_method' => self::PAIRING_STANDINGS_BASED,
                ];
            } else {
                // Middle rounds: Progressive filtering ensuring monotonic reduction
                // Calculate progressive top_k that ensures: early ≥ middle ≥ final
                $finalTopK = min(4, max(2, $participantCount));
                $roundsFromStart = $round - 1; // Rounds completed before this one
                $roundsToEnd = $totalRounds - $round; // Rounds remaining after this one

                // Progressive reduction: start with all participants, gradually reduce to finalTopK
                $progress = $roundsFromStart / ($totalRounds - 1); // 0 to 1
                $topK = (int)ceil($participantCount - ($participantCount - $finalTopK) * $progress);

                // Ensure minimum of 2 and maximum of participant count
                $topK = max(2, min($topK, $participantCount));

                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_SELECTIVE,
                    'participant_selection' => ['top_k' => $topK],
                    'matches_per_player' => 1,
                    'pairing_method' => self::PAIRING_STANDINGS_BASED,
                ];
            }
        }

        return $structure;
    }

    /**
     * Generate 3-Player Tournament Structure with Option A Coverage Enforcement
     *
     * Implements strict compliance with minimum 2 matches per pre-final round
     * while ensuring complete top-3 pair coverage
     */
    private static function generateThreePlayerOptionAStructure(int $totalRounds): array
    {
        $structure = [];

        for ($round = 1; $round <= $totalRounds; $round++) {
            if ($round === 1) {
                // Round 1: Complete round-robin - all 3 possible pairs with actual players
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_DENSE,
                    'participant_selection' => 'all',
                    'matches_per_player' => 2, // Each player plays both opponents
                    'pairing_method' => self::PAIRING_STANDINGS_BASED, // Use actual players
                    'force_complete_round_robin' => true, // Flag for complete round-robin
                ];
            } elseif ($round === 2) {
                // Round 2: Partial round-robin - ensure minimum 2 matches
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_NORMAL,
                    'participant_selection' => 'all',
                    'matches_per_player' => 2, // Ensure minimum 2 matches
                    'pairing_method' => self::PAIRING_STANDINGS_BASED,
                ];
            } elseif ($round === $totalRounds) {
                // Final round: Rank 1 vs Rank 2
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_FINAL,
                    'participant_selection' => ['top_k' => 2],
                    'matches_per_player' => 1,
                    'pairing_method' => self::PAIRING_DIRECT,
                ];
            } elseif ($round === $totalRounds - 1) {
                // Option A: Rank 1 vs Rank 3, Rank 2 vs Rank 3
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_SELECTIVE,
                    'participant_selection' => ['top_k' => 3],
                    'matches_per_player' => 2, // Option A: ensure 2 matches
                    'pairing_method' => self::PAIRING_DIRECT,
                    // Option A specific coverage pairs
                    'coverage_pairs' => [
                        [1, 3], // Rank 1 vs Rank 3
                        [2, 3], // Rank 2 vs Rank 3
                    ],
                    'enforce_coverage' => true,
                    'determined_by_round' => $round - 1,
                ];
            } else {
                // Middle rounds: Rank 1 vs Rank 2, Rank 2 vs Rank 3
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_SELECTIVE,
                    'participant_selection' => ['top_k' => 3],
                    'matches_per_player' => 2, // Minimum 2 matches requirement
                    'pairing_method' => self::PAIRING_STANDINGS_BASED,
                    // Top-3 coverage pairs for fairness
                    'coverage_pairs' => [
                        [1, 2], // Rank 1 vs Rank 2
                        [2, 3], // Rank 2 vs Rank 3
                    ],
                    'enforce_coverage' => true,
                    'determined_by_round' => $round - 1,
                ];
            }
        }

        return $structure;
    }

    /**
     * Medium tournament structure (11-30 participants)
     *
     * Ensures progressive reduction: early rounds have ≥ middle rounds ≥ final rounds
     */
    private static function generateMediumTournamentStructure(int $totalRounds, int $participantCount): array
    {
        $structure = [];

        for ($round = 1; $round <= $totalRounds; $round++) {
            if ($round === 1) {
                // Round 1: Dense - each vs 5 opponents
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_DENSE,
                    'participant_selection' => 'all',
                    'matches_per_player' => min(5, $participantCount - 1),
                    'pairing_method' => self::PAIRING_RANDOM_SEEDED,
                ];
            } elseif ($round === 2) {
                // Round 2: Dense - each vs 3 opponents
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_DENSE,
                    'participant_selection' => 'all',
                    'matches_per_player' => min(3, $participantCount - 1),
                    'pairing_method' => self::PAIRING_RATING_BASED,
                ];
            } elseif ($round === $totalRounds) {
                // Final: Top 2
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_FINAL,
                    'participant_selection' => ['top_k' => 2],
                    'matches_per_player' => 1,
                    'pairing_method' => self::PAIRING_DIRECT,
                ];
            } elseif ($round === $totalRounds - 1) {
                // Semi-final: Top 4-6 (ensure progressive reduction from middle rounds)
                $roundsFromStart = $round - 1;
                $totalRoundsMinusOne = $totalRounds - 1;
                $progress = $roundsFromStart / $totalRoundsMinusOne;
                $semiFinalTopK = (int)ceil($participantCount - ($participantCount - 4) * $progress);
                $semiFinalTopK = max(4, min($semiFinalTopK, $participantCount));

                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_SELECTIVE,
                    'participant_selection' => ['top_k' => $semiFinalTopK],
                    'matches_per_player' => 2,
                    'pairing_method' => self::PAIRING_STANDINGS_BASED,
                ];
            } else {
                // Middle rounds: Progressive filtering ensuring monotonic reduction
                $roundsFromStart = $round - 1;
                $totalRoundsMinusOne = $totalRounds - 1;
                $progress = $roundsFromStart / $totalRoundsMinusOne; // 0 to 1

                // Start with higher participation for early middle rounds, reduce to 4 by semi-finals
                $startTopK = min($participantCount, max(8, (int)ceil($participantCount * 0.6)));
                $endTopK = 4;
                $topK = (int)ceil($startTopK - ($startTopK - $endTopK) * $progress);
                $topK = max(6, min($topK, $participantCount));

                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_SELECTIVE,
                    'participant_selection' => ['top_k' => $topK],
                    'matches_per_player' => 2,
                    'pairing_method' => self::PAIRING_STANDINGS_BASED,
                ];
            }
        }

        return $structure;
    }

    /**
     * Large tournament structure (>30 participants)
     *
     * Ensures progressive reduction: early rounds have ≥ middle rounds ≥ final rounds
     */
    private static function generateLargeTournamentStructure(int $totalRounds, int $participantCount): array
    {
        $structure = [];

        for ($round = 1; $round <= $totalRounds; $round++) {
            if ($round === 1) {
                // Round 1: Dense sampling - each vs 5 opponents
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_DENSE,
                    'participant_selection' => 'all',
                    'matches_per_player' => 5,
                    'pairing_method' => self::PAIRING_RANDOM_SEEDED,
                ];
            } elseif ($round === 2) {
                // Round 2: Dense sampling - each vs 4 opponents
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_DENSE,
                    'participant_selection' => 'all',
                    'matches_per_player' => 4,
                    'pairing_method' => self::PAIRING_STANDINGS_BASED,
                ];
            } elseif ($round === $totalRounds) {
                // Final: Top 2
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_FINAL,
                    'participant_selection' => ['top_k' => 2],
                    'matches_per_player' => 1,
                    'pairing_method' => self::PAIRING_DIRECT,
                ];
            } elseif ($round === $totalRounds - 1) {
                // Semi-final: Top 4-6 (ensure progressive reduction from middle rounds)
                $roundsFromStart = $round - 1;
                $totalRoundsMinusOne = $totalRounds - 1;
                $progress = $roundsFromStart / $totalRoundsMinusOne;
                $semiFinalTopK = (int)ceil($participantCount - ($participantCount - 6) * $progress);
                $semiFinalTopK = max(6, min($semiFinalTopK, $participantCount));

                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_SELECTIVE,
                    'participant_selection' => ['top_k' => $semiFinalTopK],
                    'matches_per_player' => 2,
                    'pairing_method' => self::PAIRING_STANDINGS_BASED,
                ];
            } else {
                // Middle rounds: Progressive filtering ensuring monotonic reduction
                $roundsFromStart = $round - 1;
                $totalRoundsMinusOne = $totalRounds - 1;
                $progress = $roundsFromStart / $totalRoundsMinusOne; // 0 to 1

                // Start with 50% for early middle rounds, reduce to 6 by semi-finals
                $startTopK = min($participantCount, max(12, (int)ceil($participantCount * 0.5)));
                $endTopK = 6;
                $topK = (int)ceil($startTopK - ($startTopK - $endTopK) * $progress);
                $topK = max(10, min($topK, $participantCount));

                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_SELECTIVE,
                    'participant_selection' => ['top_k' => $topK],
                    'matches_per_player' => 2,
                    'pairing_method' => self::PAIRING_STANDINGS_BASED,
                ];
            }
        }

        return $structure;
    }

    /**
     * Standard Swiss tournament structure
     */
    private static function generateSwissStructure(int $totalRounds): array
    {
        $structure = [];

        for ($round = 1; $round <= $totalRounds; $round++) {
            $structure[] = [
                'round' => $round,
                'type' => self::ROUND_TYPE_NORMAL,
                'participant_selection' => 'all',
                'matches_per_player' => 1,
                'pairing_method' => $round === 1 ? self::PAIRING_RANDOM_SEEDED : self::PAIRING_SWISS,
            ];
        }

        return $structure;
    }

    /**
     * Generate Swiss + Elimination structure
     *
     * @param int $participantCount Total participants
     * @param int $swissRounds Number of Swiss rounds (default: calculated by formula)
     * @return array Round structure configuration
     */
    public static function generateSwissEliminationStructure(int $participantCount, ?int $swissRounds = null): array
    {
        // Import the TournamentStructureCalculator
        $calculator = new \App\Services\TournamentStructureCalculator();

        // Calculate structure if swiss rounds not specified
        if ($swissRounds === null) {
            $structure = $calculator::calculateStructure($participantCount);
            $swissRounds = $structure['swiss_rounds'];
        } else {
            // Use custom swiss rounds
            $structure = $calculator::generateCustomStructure($participantCount, $swissRounds);
        }

        $roundStructure = [];

        // Phase 1: Swiss Rounds (all players)
        for ($round = 1; $round <= $swissRounds; $round++) {
            $roundStructure[] = [
                'round' => $round,
                'type' => 'swiss',  // Mark as Swiss type
                'participant_selection' => 'all',  // All players participate
                'matches_per_player' => 1,
                'pairing_method' => $round === 1 ? self::PAIRING_RANDOM_SEEDED : self::PAIRING_SWISS,
            ];
        }

        // Phase 2: Elimination Rounds (Top K)
        $currentTopK = $structure['top_k'];
        $roundNumber = $swissRounds + 1;

        while ($currentTopK >= 2) {
            $stageType = $currentTopK == 2 ? 'final' : ($currentTopK == 4 ? 'semi_final' : 'elimination');

            $roundStructure[] = [
                'round' => $roundNumber,
                'type' => $stageType,  // Explicit type
                'participant_selection' => ['top_k' => $currentTopK],
                'matches_per_player' => 1,
                'pairing_method' => self::PAIRING_DIRECT,  // 1v4, 2v3, etc.
                'round_description' => self::getEliminationStageName($currentTopK),
            ];

            $currentTopK /= 2;
            $roundNumber++;
        }

        return $roundStructure;
    }

    /**
     * Get elimination stage name based on participant count
     */
    private static function getEliminationStageName(int $participantCount): string
    {
        $names = [
            2 => 'Finals (Winners of semi-finals)',
            4 => 'Semi-finals (Top 4 from Swiss rounds)',
            8 => 'Quarter-finals (Top 8 from Swiss rounds)',
            16 => 'Round of 16 (Top 16 from Swiss rounds)',
            32 => 'Round of 32 (Top 32 from Swiss rounds)',
        ];

        return $names[$participantCount] ?? "Top {$participantCount} from Swiss rounds";
    }

    /**
     * Generate adaptive tournament structure based on participant count
     *
     * Uses fixed thresholds for small, medium, and large tournaments
     * with guaranteed top-K pairwise coverage
     */
    public static function generateAdaptiveTournamentStructure(int $participantCount): array
    {
        $structure = [];

        // Determine tournament size category and calculate rounds
        if ($participantCount <= 10) {
            return self::generateAdaptiveSmallTournament($participantCount);
        } elseif ($participantCount <= 30) {
            return self::generateAdaptiveMediumTournament($participantCount);
        } else {
            return self::generateAdaptiveLargeTournament($participantCount);
        }
    }

    /**
     * Small tournament adaptive structure (3-10 participants)
     * Threshold: [N, N, 3, 3, 2]
     */
    private static function generateAdaptiveSmallTournament(int $participantCount): array
    {
        $structure = [];
        $totalRounds = min(5, max(3, $participantCount));

        for ($round = 1; $round <= $totalRounds; $round++) {
            if ($round === 1) {
                // Round 1: All participants, maximum matches
                $matchesPerPlayer = min($participantCount - 1, 3);
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_DENSE,
                    'participant_selection' => 'all',
                    'matches_per_player' => $matchesPerPlayer,
                    'pairing_method' => self::PAIRING_RANDOM_SEEDED,
                ];
            } elseif ($round === 2) {
                // Round 2: All participants
                $matchesPerPlayer = min($participantCount - 1, 2);
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_DENSE,
                    'participant_selection' => 'all',
                    'matches_per_player' => $matchesPerPlayer,
                    'pairing_method' => self::PAIRING_STANDINGS_BASED,
                ];
            } elseif ($round === 3) {
                // Round 3: Top 3 with coverage enforcement (minimum 2 pairs)
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_SELECTIVE,
                    'participant_selection' => ['top_k' => 3],
                    'pairing_method' => self::PAIRING_ROUND_ROBIN_TOP_K,
                    'enforce_coverage' => true,
                    'coverage_pairs' => [
                        ['rank_1', 'rank_2'],
                        ['rank_2', 'rank_3'],
                    ],
                    'determined_by_round' => 2,
                ];
            } elseif ($round === 4) {
                // Round 4: Top 3 with complete coverage + extra match (ensure minimum 2)
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_SELECTIVE,
                    'participant_selection' => ['top_k' => 3],
                    'pairing_method' => self::PAIRING_ROUND_ROBIN_TOP_K,
                    'enforce_coverage' => true,
                    'coverage_pairs' => [
                        ['rank_1', 'rank_3'],  // Primary: complete the required set
                        ['rank_2', 'rank_3'],  // Secondary: extra data point (repeat allowed)
                    ],
                    'determined_by_round' => 3,
                ];
            } else {
                // Round 5+: Top 2 finals
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_FINAL,
                    'participant_selection' => ['top_k' => 2],
                    'matches_per_player' => 1,
                    'pairing_method' => self::PAIRING_DIRECT,
                ];
            }
        }

        return $structure;
    }

    /**
     * Medium tournament adaptive structure (11-30 participants)
     * Threshold: [N, N, ceil(N*0.4), 4, 2]
     */
    private static function generateAdaptiveMediumTournament(int $participantCount): array
    {
        $structure = [];
        $totalRounds = min(5, max(4, (int)ceil($participantCount / 6)));

        for ($round = 1; $round <= $totalRounds; $round++) {
            if ($round === 1) {
                // Round 1: All participants
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_DENSE,
                    'participant_selection' => 'all',
                    'matches_per_player' => min(4, $participantCount - 1),
                    'pairing_method' => self::PAIRING_RANDOM_SEEDED,
                ];
            } elseif ($round === 2) {
                // Round 2: All participants
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_DENSE,
                    'participant_selection' => 'all',
                    'matches_per_player' => min(3, $participantCount - 1),
                    'pairing_method' => self::PAIRING_STANDINGS_BASED,
                ];
            } elseif ($round === 3) {
                // Round 3: Top 40% or minimum 6
                $topK = max(6, (int)ceil($participantCount * 0.4));
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_SELECTIVE,
                    'participant_selection' => ['top_k' => $topK],
                    'matches_per_player' => 2,
                    'pairing_method' => self::PAIRING_STANDINGS_BASED,
                ];
            } elseif ($round === 4) {
                // Round 4: Top 4-6 with round-robin coverage for top-K
                $topK = min($participantCount, 4);
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_SELECTIVE,
                    'participant_selection' => ['top_k' => $topK],
                    'matches_per_player' => 1,
                    'pairing_method' => self::PAIRING_ROUND_ROBIN_TOP_K,
                ];
            } else {
                // Final rounds: Top 2
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_FINAL,
                    'participant_selection' => ['top_k' => 2],
                    'matches_per_player' => 1,
                    'pairing_method' => self::PAIRING_DIRECT,
                ];
            }
        }

        return $structure;
    }

    /**
     * Large tournament adaptive structure (31-100 participants)
     * Threshold: [N, N, ceil(N*0.5), 6, 2]
     */
    private static function generateAdaptiveLargeTournament(int $participantCount): array
    {
        $structure = [];
        $totalRounds = min(6, max(5, (int)ceil($participantCount / 8)));

        for ($round = 1; $round <= $totalRounds; $round++) {
            if ($round === 1) {
                // Round 1: All participants
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_DENSE,
                    'participant_selection' => 'all',
                    'matches_per_player' => min(5, $participantCount - 1),
                    'pairing_method' => self::PAIRING_RANDOM_SEEDED,
                ];
            } elseif ($round === 2) {
                // Round 2: All participants
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_DENSE,
                    'participant_selection' => 'all',
                    'matches_per_player' => min(4, $participantCount - 1),
                    'pairing_method' => self::PAIRING_STANDINGS_BASED,
                ];
            } elseif ($round === 3) {
                // Round 3: Top 50% or minimum 8
                $topK = max(8, (int)ceil($participantCount * 0.5));
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_SELECTIVE,
                    'participant_selection' => ['top_k' => $topK],
                    'matches_per_player' => 2,
                    'pairing_method' => self::PAIRING_STANDINGS_BASED,
                ];
            } elseif ($round === 4) {
                // Round 4: Top 6-8
                $topK = max(6, min(8, (int)ceil($participantCount * 0.25)));
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_SELECTIVE,
                    'participant_selection' => ['top_k' => $topK],
                    'matches_per_player' => 2,
                    'pairing_method' => self::PAIRING_STANDINGS_BASED,
                ];
            } elseif ($round === 5) {
                // Round 5: Top 6 with round-robin coverage for top-K
                $topK = min($participantCount, 6);
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_SELECTIVE,
                    'participant_selection' => ['top_k' => $topK],
                    'matches_per_player' => 1,
                    'pairing_method' => self::PAIRING_ROUND_ROBIN_TOP_K,
                ];
            } else {
                // Final rounds: Top 2
                $structure[] = [
                    'round' => $round,
                    'type' => self::ROUND_TYPE_FINAL,
                    'participant_selection' => ['top_k' => 2],
                    'matches_per_player' => 1,
                    'pairing_method' => self::PAIRING_DIRECT,
                ];
            }
        }

        return $structure;
    }

    /**
     * Validate monotonic reduction in tournament structure
     */
    public function validateMonotonicReduction(): array
    {
        $errors = [];
        $lastParticipantCount = null;

        foreach ($this->roundStructure as $roundConfig) {
            $participantCount = $this->calculateRoundParticipants(100, $roundConfig['participant_selection']); // Use 100 as max for 'all'

            if ($lastParticipantCount !== null && $participantCount > $lastParticipantCount) {
                $errors[] = "Round {$roundConfig['round']}: Participants increase from {$lastParticipantCount} to {$participantCount}. Tournament should show progressive reduction.";
            }

            $lastParticipantCount = $participantCount;
        }

        return $errors;
    }

    /**
     * Validate top-K coverage requirements
     */
    public function validateTopKCoverage(int $topK): array
    {
        $errors = [];

        if ($topK < 2 || $topK > 6) {
            $errors[] = "Top-K coverage must be between 2 and 6 players";
        }

        // Check if structure includes round-robin pairing for top-K
        $hasRoundRobinTopK = false;
        foreach ($this->roundStructure as $roundConfig) {
            if ($roundConfig['pairing_method'] === self::PAIRING_ROUND_ROBIN_TOP_K) {
                $hasRoundRobinTopK = true;
                break;
            }
        }

        if (!$hasRoundRobinTopK) {
            $errors[] = "Tournament structure missing round-robin pairing for top-K coverage";
        }

        return $errors;
    }

    /**
     * Validate coverage requirements for tournament structure
     */
    public function validateCoverageRequirements(): array
    {
        $errors = [];
        $allPairs = [];

        // Collect all coverage pairs from selective rounds
        foreach ($this->roundStructure as $roundConfig) {
            if (isset($roundConfig['coverage_pairs']) && is_array($roundConfig['coverage_pairs'])) {
                foreach ($roundConfig['coverage_pairs'] as $pair) {
                    if (is_array($pair) && count($pair) === 2) {
                        $pairKey = implode('_vs_', $pair);
                        $allPairs[$pairKey] = true;
                    } else {
                        $errors[] = "Invalid coverage pair format in round {$roundConfig['round']}: " . json_encode($pair);
                    }
                }
            }
        }

        // Check if this is a small tournament that requires top-3 coverage
        $participantCount = $this->estimateParticipantCount();
        if ($participantCount <= 10) {
            // For small tournaments, ensure all 3 top-3 pairs are covered
            $requiredPairs = [
                'rank_1_vs_rank_2',
                'rank_1_vs_rank_3',
                'rank_2_vs_rank_3',
            ];

            foreach ($requiredPairs as $required) {
                if (!isset($allPairs[$required])) {
                    $errors[] = "Missing required top-3 pairing: {$required}";
                }
            }

            // Validate minimum 2 matches per pre-final round requirement
            $finalRound = max(array_column($this->roundStructure, 'round'));
            $preFinalRounds = array_filter($this->roundStructure, function($round) use ($finalRound) {
                return $round['round'] < $finalRound;
            });

            foreach ($preFinalRounds as $roundConfig) {
                $roundNumber = $roundConfig['round'];
                $expectedMatches = 0;

                if (isset($roundConfig['coverage_pairs'])) {
                    $expectedMatches = count($roundConfig['coverage_pairs']);
                } elseif (isset($roundConfig['matches_per_player'])) {
                    $participants = $this->calculateRoundParticipants($participantCount, $roundConfig['participant_selection']);
                    $expectedMatches = (int)ceil(($participants * $roundConfig['matches_per_player']) / 2);
                }

                if ($expectedMatches < 2) {
                    $errors[] = "Round {$roundNumber}: Only {$expectedMatches} matches generated. Minimum 2 matches required for pre-final rounds.";
                }
            }
        }

        return $errors;
    }

    /**
     * Estimate participant count for validation
     */
    private function estimateParticipantCount(): int
    {
        // Find the maximum participant count across all rounds
        $maxCount = 0;
        foreach ($this->roundStructure as $roundConfig) {
            $count = $this->estimateRoundParticipants($roundConfig['participant_selection']);
            $maxCount = max($maxCount, $count);
        }
        return $maxCount;
    }

    /**
     * Calculate expected participants for a given round
     */
    public function calculateRoundParticipants(int $baseCount, $selection): int
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
     * Create from array
     */
    public static function fromArray(array $data): self
    {
        $config = new self();
        $config->mode = $data['mode'] ?? self::MODE_SWISS;
        $config->roundStructure = $data['round_structure'] ?? [];

        // Normalize round structure: convert frontend field names to backend expected names
        // Frontend sends different field names than backend expects
        foreach ($config->roundStructure as $index => &$round) {
            // Handle round_number -> round mapping
            if (isset($round['round_number']) && !isset($round['round'])) {
                $round['round'] = $round['round_number'];
            }

            // Ensure round field exists with default value (use index + 1)
            if (!isset($round['round'])) {
                $round['round'] = $index + 1;
            }

            // Add missing type field with default value
            if (!isset($round['type'])) {
                $round['type'] = 'swiss'; // Default to swiss type
            }

            // Handle selection_rule -> participant_selection mapping
            if (isset($round['selection_rule']) && !isset($round['participant_selection'])) {
                // Map frontend selection_rule values to backend participant_selection format
                switch ($round['selection_rule']) {
                    case 'all_participants':
                    case 'all':
                        $round['participant_selection'] = 'all';
                        break;
                    case 'top_k':
                        $round['participant_selection'] = isset($round['selection_value'])
                            ? ['top_k' => $round['selection_value']]
                            : 'all';
                        break;
                    case 'top_percent':
                        $round['participant_selection'] = isset($round['selection_value'])
                            ? ['top_percent' => $round['selection_value']]
                            : 'all';
                        break;
                    default:
                        // Default to all participants if unknown selection rule
                        $round['participant_selection'] = 'all';
                }
            }

            // Ensure participant_selection exists with default value
            if (!isset($round['participant_selection'])) {
                $round['participant_selection'] = 'all';
            }

            // Handle pairing_method -> pairing_algorithm mapping if needed
            if (isset($round['pairing_method']) && !isset($round['pairing_algorithm'])) {
                $round['pairing_algorithm'] = $round['pairing_method'];
            }

            // Ensure pairing_method exists with default value
            if (!isset($round['pairing_method'])) {
                $round['pairing_method'] = $round['pairing_algorithm'] ?? 'random';
            }

            // Ensure matches_per_player exists with default value
            if (!isset($round['matches_per_player']) || $round['matches_per_player'] < 1) {
                $round['matches_per_player'] = 1;
            }

            // Add missing 'type' field for round type validation
            if (!isset($round['type'])) {
                // Default to 'swiss' for custom configurations since most custom rounds use Swiss pairing
                $round['type'] = 'swiss';
            }
        }
        unset($round); // Break reference

        $config->avoidRepeatMatches = $data['avoid_repeat_matches'] ?? true;
        $config->colorBalanceStrict = $data['color_balance_strict'] ?? true;
        $config->byeHandling = $data['bye_handling'] ?? 'automatic';
        $config->byePoints = $data['bye_points'] ?? 1.0;
        $config->autoAdvanceEnabled = $data['auto_advance_enabled'] ?? false;
        $config->preset = $data['preset'] ?? self::PRESET_CUSTOM;

        // Adaptive configuration
        $config->pairingPolicy = $data['pairing_policy'] ?? self::POLICY_ADAPTIVE;
        $config->coverageEnforcement = $data['coverage_enforcement'] ?? 3;
        $config->minPairsPerSelectiveRound = $data['min_pairs_per_selective_round'] ?? 2;

        return $config;
    }

    /**
     * Convert to array
     */
    public function toArray(): array
    {
        // If using simple configuration, return only simple fields
        if ($this->pairing_algorithm !== null) {
            return [
                'pairing_algorithm' => $this->pairing_algorithm,
                'participant_selection' => $this->participant_selection,
                'selection_value' => $this->selection_value,
                'rounds' => $this->rounds,
                'seed' => $this->seed,
            ];
        }

        // Otherwise return complex configuration
        return [
            'mode' => $this->mode,
            'round_structure' => $this->roundStructure,
            'avoid_repeat_matches' => $this->avoidRepeatMatches,
            'color_balance_strict' => $this->colorBalanceStrict,
            'bye_handling' => $this->byeHandling,
            'bye_points' => $this->byePoints,
            'auto_advance_enabled' => $this->autoAdvanceEnabled,
            'preset' => $this->preset,
            'pairing_policy' => $this->pairingPolicy,
            'coverage_enforcement' => $this->coverageEnforcement,
            'min_pairs_per_selective_round' => $this->minPairsPerSelectiveRound,
        ];
    }

    /**
     * JsonSerializable implementation
     */
    public function jsonSerialize(): array
    {
        return $this->toArray();
    }

    /**
     * Convert to JSON
     */
    public function toJson($options = 0): string
    {
        return json_encode($this->toArray(), $options);
    }

    /**
     * Get round configuration by round number
     */
    public function getRoundConfig(int $roundNumber): ?array
    {
        foreach ($this->roundStructure as $roundConfig) {
            if ($roundConfig['round'] === $roundNumber) {
                return $roundConfig;
            }
        }

        return null;
    }

    /**
     * Calculate total expected matches for the tournament
     */
    public function calculateTotalMatches(int $participantCount): int
    {
        $totalMatches = 0;

        foreach ($this->roundStructure as $roundConfig) {
            $participants = $this->calculateRoundParticipants($participantCount, $roundConfig['participant_selection']);
            $matchesPerPlayer = $roundConfig['matches_per_player'];

            // Each match involves 2 players, so divide by 2
            $roundMatches = (int)ceil(($participants * $matchesPerPlayer) / 2);
            $totalMatches += $roundMatches;
        }

        return $totalMatches;
    }

    // calculateRoundParticipants method is already defined as public above (line 764)
// Removed duplicate private method to prevent fatal PHP error

    /**
     * Calculate K4 (Round 4 contenders) using universal formula
     */
    public static function calculateK4(int $N): int
    {
        if ($N <= 4) return 3;
        if ($N <= 12) return 4;
        if ($N <= 24) return 6;
        if ($N <= 48) return 8;
        return 12;
    }

    /**
     * Generate universal tournament structure (3-100 players)
     * Following Swiss + cut + finals pattern
     */
    public static function generateUniversalTournamentStructure(int $participantCount, int $totalRounds = 5): array
    {
        // Special case for 3 players - use existing optimized structure
        if ($participantCount === 3) {
            return self::generateThreePlayerUniversalStructure($totalRounds);
        }

        $structure = [];
        $K4 = self::calculateK4($participantCount);

        // Ensure we have enough rounds for the structure
        $actualRounds = max($totalRounds, 5);

        // Rounds 1-3: Qualification Swiss (full field)
        for ($round = 1; $round <= 3; $round++) {
            $structure[] = [
                'round' => $round,
                'type' => self::ROUND_TYPE_NORMAL,
                'participant_selection' => 'all',
                'matches_per_player' => 1,
                'pairing_method' => $round === 1 ? self::PAIRING_RANDOM_SEEDED : self::PAIRING_STANDINGS_BASED,
                'avoid_repeat_matches' => true,
                'color_balance_strict' => true,
            ];
        }

        // Round 4: Contender Swiss (top K4)
        $structure[] = [
            'round' => 4,
            'type' => self::ROUND_TYPE_SELECTIVE,
            'participant_selection' => ['top_k' => $K4],
            'matches_per_player' => 1,
            'pairing_method' => self::PAIRING_STANDINGS_BASED,
            'avoid_repeat_matches' => true,
        ];

        // Round 5: Final (top 2)
        $structure[] = [
            'round' => 5,
            'type' => self::ROUND_TYPE_FINAL,
            'participant_selection' => ['top_k' => 2],
            'matches_per_player' => 1,
            'pairing_method' => self::PAIRING_DIRECT,
        ];

        // Handle additional rounds beyond 5 if specified
        for ($round = 6; $round <= $actualRounds; $round++) {
            $structure[] = [
                'round' => $round,
                'type' => self::ROUND_TYPE_NORMAL,
                'participant_selection' => 'all',
                'matches_per_player' => 1,
                'pairing_method' => self::PAIRING_STANDINGS_BASED,
                'avoid_repeat_matches' => true,
            ];
        }

        return $structure;
    }

    /**
     * Generate special 3-player structure following universal pattern
     */
    private static function generateThreePlayerUniversalStructure(int $totalRounds): array
    {
        if ($totalRounds < 5) {
            // Fallback to standard structure for fewer rounds
            return self::generateUniversalTournamentStructure(3, $totalRounds);
        }

        return [
            // Round 1: Dense Swiss (all 3 players)
            [
                'round' => 1,
                'type' => self::ROUND_TYPE_DENSE,
                'participant_selection' => 'all',
                'matches_per_player' => 2,
                'pairing_method' => self::PAIRING_STANDINGS_BASED,
                'force_complete_round_robin' => true,
            ],
            // Round 2: Swiss (all 3 players)
            [
                'round' => 2,
                'type' => self::ROUND_TYPE_NORMAL,
                'participant_selection' => 'all',
                'matches_per_player' => 2,
                'pairing_method' => self::PAIRING_STANDINGS_BASED,
            ],
            // Round 3: Top 3 with coverage pairs [[1,2],[2,3]]
            [
                'round' => 3,
                'type' => self::ROUND_TYPE_SELECTIVE,
                'participant_selection' => ['top_k' => 3],
                'matches_per_player' => 2,
                'pairing_method' => 'standings_based',
                'coverage_pairs' => [[1, 2], [2, 3]],
                'enforce_coverage' => true,
                'determined_by_round' => 2,
            ],
            // Round 4: Top 3 with coverage pairs [[1,3],[2,3]]
            [
                'round' => 4,
                'type' => self::ROUND_TYPE_SELECTIVE,
                'participant_selection' => ['top_k' => 3],
                'matches_per_player' => 2,
                'pairing_method' => 'direct',
                'coverage_pairs' => [[1, 3], [2, 3]],
                'enforce_coverage' => true,
                'determined_by_round' => 3,
            ],
            // Round 5: Final (top 2)
            [
                'round' => 5,
                'type' => self::ROUND_TYPE_FINAL,
                'participant_selection' => ['top_k' => 2],
                'matches_per_player' => 1,
                'pairing_method' => self::PAIRING_DIRECT,
            ],
        ];
    }

    /**
     * Validate configuration
     */
    public function validate(): array
    {
        $errors = [];

        if (empty($this->roundStructure)) {
            $errors[] = 'Round structure cannot be empty';
        }

        $lastRoundParticipants = null;

        foreach ($this->roundStructure as $index => $roundConfig) {
            if (!isset($roundConfig['round'])) {
                $errors[] = "Round {$index}: Missing round number";
            }

            if (!isset($roundConfig['type'])) {
                $errors[] = "Round {$index}: Missing round type";
            }

            if (!isset($roundConfig['participant_selection'])) {
                $errors[] = "Round {$index}: Missing participant selection rule";
            }

            if (!isset($roundConfig['matches_per_player']) || $roundConfig['matches_per_player'] < 1) {
                $errors[] = "Round {$index}: Invalid matches_per_player";
            }

            if (!isset($roundConfig['pairing_method'])) {
                $errors[] = "Round {$index}: Missing pairing method";
            }

            // Validate progressive reduction: later rounds should not have more participants than earlier rounds
            $currentRoundParticipants = $this->estimateRoundParticipants($roundConfig['participant_selection']);

            if ($lastRoundParticipants !== null && $currentRoundParticipants > $lastRoundParticipants) {
                $errors[] = "Round {$roundConfig['round']}: Has more participants ({$currentRoundParticipants}) than previous round ({$lastRoundParticipants}). Tournament should show progressive reduction in participants.";
            }

            $lastRoundParticipants = $currentRoundParticipants;
        }

        return $errors;
    }

    /**
     * Estimate participant count for validation (using conservative estimates)
     */
    private function estimateRoundParticipants($selection): int
    {
        if ($selection === 'all') {
            return 100; // High value to represent 'all'
        }

        if (is_array($selection) && isset($selection['top_k'])) {
            return $selection['top_k'];
        }

        if (is_array($selection) && isset($selection['top_percent'])) {
            return (int)ceil($selection['top_percent']);
        }

        return 50; // Conservative default
    }
}
