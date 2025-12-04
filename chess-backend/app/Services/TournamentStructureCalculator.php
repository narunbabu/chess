<?php

namespace App\Services;

/**
 * Tournament Structure Calculator
 *
 * Calculates optimal Swiss + Elimination tournament structures
 * based on player count using mathematical formulas.
 */
class TournamentStructureCalculator
{
    /**
     * Calculate optimal tournament structure
     *
     * @param int $playerCount Total number of players
     * @return array ['swiss_rounds' => int, 'top_k' => int, 'elimination_rounds' => int, 'total_rounds' => int, 'structure_name' => string]
     */
    public static function calculateStructure(int $playerCount): array
    {
        // Step 1: Calculate Swiss Rounds
        $swissRounds = self::calculateSwissRounds($playerCount);

        // Step 2: Calculate Top K for elimination
        $topK = self::calculateTopK($playerCount);

        // Step 3: Calculate Elimination Rounds
        $eliminationRounds = $topK > 0 ? (int) log($topK, 2) : 0;

        // Step 4: Calculate Total
        $totalRounds = $swissRounds + $eliminationRounds;

        return [
            'swiss_rounds' => $swissRounds,
            'top_k' => $topK,
            'elimination_rounds' => $eliminationRounds,
            'total_rounds' => $totalRounds,
            'structure_name' => self::generateStructureName($swissRounds, $topK),
        ];
    }

    /**
     * Generate complete round structure for tournament
     *
     * @param int $playerCount Total players
     * @return array Array of round configurations
     */
    public static function generateSwissEliminationStructure(int $playerCount): array
    {
        $structure = self::calculateStructure($playerCount);
        $rounds = [];

        // Generate Swiss Rounds
        for ($i = 1; $i <= $structure['swiss_rounds']; $i++) {
            $rounds[] = [
                'round_number' => $i,
                'round_type' => 'swiss',
                'format' => 'swiss',
                'participant_count' => $playerCount,
                'matches_per_participant' => 1,
                'match_count' => (int) ceil($playerCount / 2),
                'top_k' => null, // All players
                'description' => "Swiss Round {$i}",
                'participant_selection' => 'all',
                'pairing_method' => $i === 1 ? 'random_seeded' : 'swiss',
            ];
        }

        // Generate Elimination Rounds
        $currentTopK = $structure['top_k'];
        $roundNumber = $structure['swiss_rounds'] + 1;

        while ($currentTopK >= 2) {
            $stageName = self::getEliminationStageName($currentTopK);
            $roundType = $currentTopK == 2 ? 'final' : ($currentTopK == 4 ? 'semi_final' : 'elimination');

            $rounds[] = [
                'round_number' => $roundNumber,
                'round_type' => $roundType,
                'format' => $currentTopK == 2 ? 'final' : 'bracket',
                'participant_count' => $currentTopK,
                'matches_per_participant' => 1,
                'match_count' => (int) ($currentTopK / 2),
                'top_k' => $currentTopK,
                'description' => $stageName,
                'participant_selection' => ['top_k' => $currentTopK],
                'pairing_method' => 'direct',
            ];

            $currentTopK /= 2;
            $roundNumber++;
        }

        return $rounds;
    }

    /**
     * Calculate optimal number of Swiss rounds
     *
     * @param int $playerCount
     * @return int
     */
    private static function calculateSwissRounds(int $playerCount): int
    {
        if ($playerCount <= 4) {
            return 2; // Minimum for very small tournaments
        }

        if ($playerCount <= 10) {
            return 3; // Standard minimum for fair seeding (10 players = 3 Swiss rounds)
        }

        if ($playerCount <= 16) {
            return 4;
        }

        if ($playerCount <= 32) {
            return 5;
        }

        if ($playerCount <= 64) {
            return 6;
        }

        // For very large tournaments (65-128)
        return 7;
    }

    /**
     * Calculate Top K players for elimination (must be power of 2)
     *
     * @param int $playerCount
     * @return int
     */
    private static function calculateTopK(int $playerCount): int
    {
        // Minimum tournament size
        if ($playerCount < 4) {
            return $playerCount; // Too small for elimination
        }

        // Aim for roughly 25-50% of players in elimination
        // But must be power of 2 and at least 4

        if ($playerCount <= 8) {
            return 4; // Minimum bracket size
        }

        if ($playerCount <= 10) {
            return 4; // For 10 players, Top 4 goes to elimination
        } elseif ($playerCount <= 16) {
            return min(8, self::nearestPowerOf2($playerCount / 2));
        }

        if ($playerCount <= 32) {
            return 8;
        }

        if ($playerCount <= 48) {
            return 16;
        }

        if ($playerCount <= 100) {
            return 32;
        }

        // For very large tournaments
        return 32; // Cap at 32 for practical reasons
    }

    /**
     * Find nearest power of 2
     *
     * @param float $number
     * @return int
     */
    private static function nearestPowerOf2(float $number): int
    {
        $power = (int) ceil(log($number, 2));
        return (int) pow(2, $power);
    }

    /**
     * Generate human-readable structure name
     *
     * @param int $swissRounds
     * @param int $topK
     * @return string
     */
    private static function generateStructureName(int $swissRounds, int $topK): string
    {
        $parts = ["{$swissRounds} Swiss Rounds"];

        // Generate elimination stage names
        $eliminationRounds = $topK > 0 ? (int) log($topK, 2) : 0;

        $stageNames = [
            5 => 'Round of 32',
            4 => 'Round of 16',
            3 => 'Quarterfinals',
            2 => 'Semifinals',
            1 => 'Final',
        ];

        for ($i = $eliminationRounds; $i >= 1; $i--) {
            if (isset($stageNames[$i])) {
                $parts[] = $stageNames[$i];
            }
        }

        return implode(' → ', $parts);
    }

    /**
     * Get elimination stage name based on participant count
     */
    private static function getEliminationStageName(int $participantCount): string
    {
        $names = [
            2 => 'Final',
            4 => 'Semifinals',
            8 => 'Quarterfinals',
            16 => 'Round of 16',
            32 => 'Round of 32',
            64 => 'Round of 64',
        ];

        return $names[$participantCount] ?? "Top {$participantCount}";
    }

    /**
     * Generate custom structure with overrides
     *
     * @param int $playerCount
     * @param int|null $swissRounds
     * @param int|null $topK
     * @return array
     */
    public static function generateCustomStructure(
        int $playerCount,
        ?int $swissRounds = null,
        ?int $topK = null
    ): array {
        $default = self::calculateStructure($playerCount);

        // Override Swiss rounds if specified
        if ($swissRounds !== null) {
            $default['swiss_rounds'] = max(2, min(10, $swissRounds));
        }

        // Override Top K if specified (must be power of 2)
        if ($topK !== null) {
            // Validate power of 2
            if (($topK & ($topK - 1)) === 0 && $topK >= 4) {
                $default['top_k'] = min($topK, $playerCount);
                $default['elimination_rounds'] = (int) log($default['top_k'], 2);
            }
        }

        $default['total_rounds'] = $default['swiss_rounds'] + $default['elimination_rounds'];

        return $default;
    }
}