<?php

namespace App\Http\Controllers;

use App\Models\Championship;
use App\ValueObjects\TournamentConfig;
use App\Services\TiebreakPolicyService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Championship Admin Controller
 *
 * Provides administrative controls for tournament configuration,
 * structure selection, and tiebreak policy management.
 */
class ChampionshipAdminController extends Controller
{
    /**
     * Update tournament structure for a championship
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function updateTournamentStructure(Request $request, int $id): JsonResponse
    {
        $championship = Championship::findOrFail($id);

        // Authorization check
        Gate::authorize('update', $championship);

        // Prevent changes if tournament has started
        if ($championship->matches()->exists()) {
            return response()->json([
                'error' => 'Cannot update structure',
                'message' => 'Tournament structure cannot be modified after matches have been created',
            ], 422);
        }

        $validator = validator($request->all(), [
            'structure_type' => ['required', 'string', Rule::in(['preset', 'universal', 'custom'])],
            'use_universal_structure' => 'nullable|boolean',
            'k4_override' => 'nullable|integer|min:2|max:64',
            'custom_round_structure' => 'nullable|array',
            'custom_round_structure.*.round' => 'required|integer|min:1',
            'custom_round_structure.*.type' => 'required|string',
            'custom_round_structure.*.participant_selection' => 'required|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Validation failed',
                'messages' => $validator->errors(),
            ], 422);
        }

        try {
            DB::transaction(function () use ($championship, $request) {
                $data = $request->all();

                // Update structure settings
                $championship->update([
                    'structure_type' => $data['structure_type'],
                    'use_universal_structure' => $data['use_universal_structure'] ?? false,
                    'k4_override' => $data['k4_override'] ?? null,
                ]);

                // Handle custom structure
                if ($data['structure_type'] === 'custom' && isset($data['custom_round_structure'])) {
                    $customConfig = new TournamentConfig([
                        'mode' => 'progressive',
                        'preset' => 'custom',
                        'roundStructure' => $data['custom_round_structure'],
                    ]);

                    $championship->setTournamentConfig($customConfig);
                    $championship->update(['tournament_generated' => true]);
                } elseif ($data['use_universal_structure'] && $championship->shouldUseUniversalStructure()) {
                    // Generate new universal configuration
                    $config = $championship->generateAutomaticTournamentConfig();
                }

                Log::info('Tournament structure updated', [
                    'championship_id' => $championship->id,
                    'structure_type' => $data['structure_type'],
                    'use_universal_structure' => $data['use_universal_structure'] ?? false,
                    'updated_by' => Auth::id(),
                ]);
            });

            return response()->json([
                'message' => 'Tournament structure updated successfully',
                'championship' => $championship->fresh(),
                'structure_info' => $championship->getStructureExplanation(),
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to update tournament structure', [
                'championship_id' => $championship->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Failed to update tournament structure',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update tiebreak configuration for a championship
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function updateTiebreakConfig(Request $request, int $id): JsonResponse
    {
        $championship = Championship::findOrFail($id);

        // Authorization check
        Gate::authorize('update', $championship);

        $validator = validator($request->all(), [
            'tiebreak_order' => 'nullable|array',
            'tiebreak_order.*' => ['required', 'string', Rule::in([
                'points', 'buchholz_score', 'sonneborn_berger', 'head_to_head', 'rating', 'random'
            ])],
            'expand_band_for_ties' => 'nullable|boolean',
            'playoff_for_first_place' => 'nullable|boolean',
            'custom_tiebreak_rules' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Validation failed',
                'messages' => $validator->errors(),
            ], 422);
        }

        try {
            $tiebreakConfig = [
                'version' => '1.0',
                'order' => $request->input('tiebreak_order', [
                    'points', 'buchholz_score', 'sonneborn_berger', 'head_to_head', 'rating', 'random'
                ]),
                'expand_band_for_ties' => $request->input('expand_band_for_ties', $championship->use_universal_structure),
                'playoff_for_first_place' => $request->input('playoff_for_first_place', false),
                'custom_rules' => $request->input('custom_tiebreak_rules', []),
            ];

            $championship->update([
                'tiebreak_config' => json_encode($tiebreakConfig),
            ]);

            Log::info('Tiebreak configuration updated', [
                'championship_id' => $championship->id,
                'tiebreak_order' => $tiebreakConfig['order'],
                'expand_band_for_ties' => $tiebreakConfig['expand_band_for_ties'],
                'updated_by' => Auth::id(),
            ]);

            return response()->json([
                'message' => 'Tiebreak configuration updated successfully',
                'tiebreak_config' => $tiebreakConfig,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to update tiebreak configuration', [
                'championship_id' => $championship->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Failed to update tiebreak configuration',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Preview tournament structure for different participant counts
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function previewStructure(Request $request, int $id): JsonResponse
    {
        $championship = Championship::findOrFail($id);

        // Authorization check
        Gate::authorize('view', $championship);

        $validator = validator($request->all(), [
            'participant_count' => 'required|integer|min:2|max:1024',
            'structure_type' => ['nullable', 'string', Rule::in(['preset', 'universal'])],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Validation failed',
                'messages' => $validator->errors(),
            ], 422);
        }

        try {
            $participantCount = $request->input('participant_count');
            $structureType = $request->input('structure_type', 'universal');

            // Generate preview structure
            if ($structureType === 'universal' && $participantCount >= 3 && $participantCount <= 100) {
                $structure = TournamentConfig::generateUniversalTournamentStructure($participantCount, $championship->total_rounds ?? 5);
                $k4 = TournamentConfig::calculateK4($participantCount);

                $preview = [
                    'type' => 'universal',
                    'participant_count' => $participantCount,
                    'k4_value' => $k4,
                    'k4_formula' => 'N≤4:3 | N≤12:4 | N≤24:6 | N≤48:8 | N>48:12',
                    'structure_pattern' => 'Swiss + Cut + Finals',
                    'round_structure' => $structure,
                    'estimated_matches' => array_reduce($structure, function ($total, $round) use ($participantCount) {
                        $participants = is_array($round['participant_selection'])
                            ? min($round['participant_selection']['top_k'], $participantCount)
                            : $participantCount;
                        $matches = ceil(($participants * $round['matches_per_player']) / 2);
                        return $total + $matches;
                    }, 0),
                ];
            } else {
                // Fallback to preset estimation
                $preset = $participantCount <= 10 ? 'small_tournament' :
                          ($participantCount <= 30 ? 'medium_tournament' : 'large_tournament');

                $preview = [
                    'type' => 'preset',
                    'participant_count' => $participantCount,
                    'preset' => $preset,
                    'structure_pattern' => 'Progressive reduction',
                    'estimated_rounds' => $championship->total_rounds ?? 5,
                    'estimated_matches_per_round' => ceil($participantCount / 2),
                    'estimated_total_matches' => ($championship->total_rounds ?? 5) * ceil($participantCount / 2),
                ];
            }

            return response()->json([
                'message' => 'Structure preview generated successfully',
                'preview' => $preview,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to generate structure preview', [
                'championship_id' => $championship->id,
                'participant_count' => $request->input('participant_count'),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Failed to generate structure preview',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Regenerate tournament configuration
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function regenerateConfiguration(Request $request, int $id): JsonResponse
    {
        $championship = Championship::findOrFail($id);

        // Authorization check
        Gate::authorize('update', $championship);

        // Prevent regeneration if tournament has significant progress
        if ($championship->matches()->where('status', 'completed')->count() > 0) {
            return response()->json([
                'error' => 'Cannot regenerate configuration',
                'message' => 'Configuration cannot be regenerated after matches have been completed',
            ], 422);
        }

        try {
            DB::transaction(function () use ($championship) {
                $config = $championship->generateAutomaticTournamentConfig();

                $championship->update([
                    'tournament_generated' => true,
                    'tournament_generated_at' => now(),
                ]);

                Log::info('Tournament configuration regenerated', [
                    'championship_id' => $championship->id,
                    'structure_type' => $config->preset,
                    'participant_count' => $championship->getEligibleParticipantCount(),
                    'regenerated_by' => Auth::id(),
                ]);
            });

            return response()->json([
                'message' => 'Tournament configuration regenerated successfully',
                'championship' => $championship->fresh(),
                'structure_info' => $championship->getStructureExplanation(),
                'tournament_config' => $championship->getTournamentConfig(),
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to regenerate tournament configuration', [
                'championship_id' => $championship->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Failed to regenerate tournament configuration',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get championship analytics and recommendations
     *
     * @param int $id
     * @return JsonResponse
     */
    public function getAnalytics(int $id): JsonResponse
    {
        $championship = Championship::findOrFail($id);

        // Authorization check
        Gate::authorize('view', $championship);

        try {
            $participantCount = $championship->getEligibleParticipantCount();
            $structureExplanation = $championship->getStructureExplanation();

            // Calculate recommendations
            $recommendations = [];

            if ($participantCount < 3) {
                $recommendations[] = 'Consider increasing minimum participants to 3 for optimal tournament structure';
            } elseif ($participantCount > 100) {
                $recommendations[] = 'Large tournament detected. Consider using multiple stages or qualifying rounds';
            } elseif ($participantCount >= 3 && $participantCount <= 100 && !$championship->use_universal_structure) {
                $recommendations[] = 'Tournament would benefit from universal structure for optimal pairings';
            }

            // Analyze tiebreak configuration
            $tiebreakConfig = json_decode($championship->tiebreak_config ?? '{}', true);
            if (empty($tiebreakConfig) || !isset($tiebreakConfig['order'])) {
                $recommendations[] = 'Configure tiebreak policy for fair ranking resolution';
            }

            $analytics = [
                'participant_count' => $participantCount,
                'structure_info' => $structureExplanation,
                'current_structure_type' => $championship->structure_type,
                'uses_universal_structure' => $championship->use_universal_structure,
                'has_tournament_config' => !empty($championship->tournament_config),
                'has_matches' => $championship->matches()->exists(),
                'completed_matches' => $championship->matches()->where('status', 'completed')->count(),
                'recommendations' => $recommendations,
                'k4_calculation' => $participantCount >= 3 && $participantCount <= 100 ? [
                    'current' => TournamentConfig::calculateK4($participantCount),
                    'formula' => 'N≤4:3 | N≤12:4 | N≤24:6 | N≤48:8 | N>48:12',
                    'optimal_for_participants' => true,
                ] : [
                    'current' => null,
                    'formula' => 'Not applicable for ' . $participantCount . ' participants',
                    'optimal_for_participants' => false,
                ],
            ];

            return response()->json([
                'analytics' => $analytics,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to generate championship analytics', [
                'championship_id' => $championship->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Failed to generate analytics',
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}