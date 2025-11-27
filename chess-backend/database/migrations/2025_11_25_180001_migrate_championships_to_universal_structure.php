<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * This migration updates existing championships to use the universal tournament structure
     * where appropriate, while maintaining backward compatibility.
     */
    public function up(): void
    {
        if (!Schema::hasColumn('championships', 'use_universal_structure')) {
            return; // Skip if previous migration hasn't run
        }

        // Get all existing championships
        $championships = DB::table('championships')
            ->select([
                'id',
                'title',
                'max_participants',
                'total_rounds',
                'format_id',
                'status_id',
                'created_at'
            ])
            ->get();

        $updatedCount = 0;
        $migratedToUniversal = 0;
        $keptAsPreset = 0;

        foreach ($championships as $championship) {
            // Get actual participant count
            $participantCount = DB::table('championship_participants')
                ->where('championship_id', $championship->id)
                ->where('payment_status_id', 1) // Completed payment
                ->count();

            // Determine if championship should use universal structure
            $shouldUseUniversal = $this->shouldUseUniversalStructure(
                $participantCount,
                $championship->status_id,
                $championship->created_at
            );

            // Generate tournament configuration
            $tournamentConfig = $this->generateTournamentConfig($participantCount, $championship->total_rounds);

            // Update championship
            $updateData = [
                'use_universal_structure' => $shouldUseUniversal,
                'structure_type' => $shouldUseUniversal ? 'universal' : 'preset',
                'tournament_config' => json_encode($tournamentConfig),
                'tiebreak_config' => json_encode([
                    'version' => '1.0',
                    'order' => ['points', 'buchholz_score', 'sonneborn_berger', 'head_to_head', 'rating', 'random'],
                    'expand_band_for_ties' => $shouldUseUniversal,
                    'playoff_for_first_place' => false,
                    'k4_calculation' => $shouldUseUniversal ? $this->getK4Explanation($participantCount) : null
                ])
            ];

            DB::table('championships')
                ->where('id', $championship->id)
                ->update($updateData);

            $updatedCount++;
            if ($shouldUseUniversal) {
                $migratedToUniversal++;
            } else {
                $keptAsPreset++;
            }

            // Log migration details for auditing
            $structureType = $shouldUseUniversal ? 'universal' : 'preset';
            DB::table('championships')
                ->where('id', $championship->id)
                ->update([
                    'tournament_settings' => DB::raw("JSON_SET(
                        COALESCE(tournament_settings, '{}'),
                        '$.migration_details',
                        JSON_OBJECT(
                            'migrated_at', NOW(),
                            'participant_count', {$participantCount},
                            'structure_type', '{$structureType}',
                            'migration_version', '1.0'
                        )
                    )")
                ]);
        }

        // Log migration summary (using Laravel's log system instead of non-existent system_logs table)
        \Illuminate\Support\Facades\Log::info('Championship universal structure migration completed', [
            'total_championships' => $updatedCount,
            'migrated_to_universal' => $migratedToUniversal,
            'kept_as_preset' => $keptAsPreset,
            'migration_timestamp' => now()->toISOString()
        ]);
    }

    /**
     * Determine if championship should use universal structure
     */
    private function shouldUseUniversalStructure(int $participantCount, int $statusId, string $createdAt): bool
    {
        // Only apply to championships with 3-100 participants
        if ($participantCount < 3 || $participantCount > 100) {
            return false;
        }

        // Don't migrate already completed championships to avoid disruption
        $completedStatusId = 5; // Assuming 5 is completed status
        if ($statusId === $completedStatusId) {
            return false;
        }

        // Don't migrate very old championships (created before implementation)
        $implementationDate = '2025-11-25';
        if ($createdAt < $implementationDate) {
            return false;
        }

        return true;
    }

    /**
     * Generate tournament configuration for championship
     */
    private function generateTournamentConfig(int $participantCount, ?int $totalRounds): array
    {
        $rounds = $totalRounds ?? 5;

        // Special case for 3 players
        if ($participantCount === 3) {
            return [
                'mode' => 'progressive',
                'preset' => 'universal',
                'round_structure' => [
                    [
                        'round' => 1,
                        'type' => 'dense',
                        'participant_selection' => 'all',
                        'matches_per_player' => 2,
                        'pairing_method' => 'standings_based',
                        'force_complete_round_robin' => true,
                    ],
                    [
                        'round' => 2,
                        'type' => 'normal',
                        'participant_selection' => 'all',
                        'matches_per_player' => 2,
                        'pairing_method' => 'standings_based',
                    ],
                    [
                        'round' => 3,
                        'type' => 'selective',
                        'participant_selection' => ['top_k' => 3],
                        'matches_per_player' => 2,
                        'pairing_method' => 'standings_based',
                        'coverage_pairs' => [[1, 2], [2, 3]],
                        'enforce_coverage' => true,
                        'determined_by_round' => 2,
                    ],
                    [
                        'round' => 4,
                        'type' => 'selective',
                        'participant_selection' => ['top_k' => 3],
                        'matches_per_player' => 2,
                        'pairing_method' => 'direct',
                        'coverage_pairs' => [[1, 3], [2, 3]],
                        'enforce_coverage' => true,
                        'determined_by_round' => 3,
                    ],
                    [
                        'round' => 5,
                        'type' => 'final',
                        'participant_selection' => ['top_k' => 2],
                        'matches_per_player' => 1,
                        'pairing_method' => 'direct',
                    ],
                ],
                'participant_count' => $participantCount,
                'structure_pattern' => 'special_3_player'
            ];
        }

        // Universal structure for 4-100 players
        $k4 = $this->calculateK4($participantCount);
        $structure = [];

        // Rounds 1-3: Swiss (all participants)
        for ($round = 1; $round <= 3; $round++) {
            $structure[] = [
                'round' => $round,
                'type' => 'normal',
                'participant_selection' => 'all',
                'matches_per_player' => 1,
                'pairing_method' => $round === 1 ? 'random_seeded' : 'standings_based',
                'avoid_repeat_matches' => true,
                'color_balance_strict' => true,
            ];
        }

        // Round 4: Selective (top K4)
        $structure[] = [
            'round' => 4,
            'type' => 'selective',
            'participant_selection' => ['top_k' => $k4],
            'matches_per_player' => 1,
            'pairing_method' => 'standings_based',
            'avoid_repeat_matches' => true,
            'k4_value' => $k4,
            'k4_formula' => 'N≤4:3 | N≤12:4 | N≤24:6 | N≤48:8 | N>48:12'
        ];

        // Round 5: Final (top 2)
        $structure[] = [
            'round' => 5,
            'type' => 'final',
            'participant_selection' => ['top_k' => 2],
            'matches_per_player' => 1,
            'pairing_method' => 'direct',
        ];

        return [
            'mode' => 'progressive',
            'preset' => 'universal',
            'round_structure' => $structure,
            'participant_count' => $participantCount,
            'k4_value' => $k4,
            'structure_pattern' => 'swiss_cut_finals'
        ];
    }

    /**
     * Calculate K4 value using universal formula
     */
    private function calculateK4(int $N): int
    {
        if ($N <= 4) return 3;
        if ($N <= 12) return 4;
        if ($N <= 24) return 6;
        if ($N <= 48) return 8;
        return 12;
    }

    /**
     * Get K4 calculation explanation
     */
    private function getK4Explanation(int $participantCount): array
    {
        $k4 = $this->calculateK4($participantCount);
        $range = $this->getK4Range($participantCount);

        return [
            'participant_count' => $participantCount,
            'k4_value' => $k4,
            'formula' => 'N≤4:3 | N≤12:4 | N≤24:6 | N≤48:8 | N>48:12',
            'range_applied' => $range,
            'calculation' => "{$participantCount} participants → K4 = {$k4} ({$range} range)"
        ];
    }

    /**
     * Get K4 range description
     */
    private function getK4Range(int $participantCount): string
    {
        if ($participantCount <= 4) return 'small (≤4)';
        if ($participantCount <= 12) return 'medium (5-12)';
        if ($participantCount <= 24) return 'large (13-24)';
        if ($participantCount <= 48) return 'very large (25-48)';
        return 'massive (>48)';
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('championships', 'use_universal_structure')) {
            // Reset all championships to preset mode
            DB::table('championships')
                ->where('use_universal_structure', true)
                ->update([
                    'use_universal_structure' => false,
                    'structure_type' => 'preset'
                ]);

            // Remove migration details from tournament_settings
            DB::table('championships')->update([
                'tournament_settings' => DB::raw("JSON_REMOVE(COALESCE(tournament_settings, '{}'), '$.migration_details')")
            ]);
        }
    }
};