<?php

namespace App\Http\Controllers;

use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipParticipant;
use App\Models\User;
use App\Services\TournamentGenerationService;
use App\Services\StandingsCalculatorService;
use App\Services\PlaceholderMatchAssignmentService;
use App\ValueObjects\TournamentConfig;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Tournament Visualizer Controller
 *
 * Provides API endpoints for creating and managing test tournaments
 * for visualization and testing purposes. Separate from production championship APIs.
 */
class TournamentVisualizerController extends Controller
{
    public function __construct(
        private TournamentGenerationService $tournamentGenerator,
        private StandingsCalculatorService $standingsCalculator,
        private PlaceholderMatchAssignmentService $placeholderService
    ) {}

    /**
     * Create a test tournament with preset configuration
     * POST /api/visualizer/tournaments/create
     *
     * Body: {
     *   "player_count": 3|5|10|50,
     *   "title": "Optional custom title"
     * }
     */
    public function createTournament(Request $request): JsonResponse
    {
        // Production safety check
        if (config('app.env') === 'production') {
            return response()->json([
                'error' => 'Visualizer API is disabled in production'
            ], 403);
        }

        $validated = $request->validate([
            'player_count' => 'required|integer|min:3|max:1000',
            'title' => 'nullable|string|max:255',
            'championship_id' => 'nullable|integer|exists:championships,id'
        ]);

        $playerCount = $validated['player_count'];
        $title = $validated['title'] ?? "[VISUALIZER] {$playerCount}-Player Test Tournament";
        $useExistingChampionship = !empty($validated['championship_id']);

        Log::info('🏆 [TOURNAMENT CREATION] Starting tournament generation', [
            'player_count' => $playerCount,
            'use_existing_championship' => $useExistingChampionship,
            'championship_id' => $validated['championship_id'] ?? null,
            'title' => $title
        ]);

        try {
            DB::beginTransaction();

            // Get tournament configuration based on player count
            $config = $this->getTournamentConfigForPlayerCount($playerCount);

            // DEBUG: Log the structure being generated
            Log::info("TournamentVisualizer: Generated config", [
                'player_count' => $playerCount,
                'total_rounds' => count($config['rounds']),
                'structure' => $config,
            ]);

            // Use existing championship or create new one
            if ($useExistingChampionship) {
                $championship = Championship::findOrFail($validated['championship_id']);

                Log::info("🏆 [TOURNAMENT] Using existing championship", [
                    'championship_id' => $championship->id,
                    'title' => $championship->title,
                    'current_participants' => $championship->participants()->count()
                ]);

                // Safety check: Reset tournament_generated flag if no matches exist
                // This handles cases where generation failed after flag was set
                if ($championship->tournament_generated && $championship->matches()->count() === 0) {
                    Log::warning("⚠️ [TOURNAMENT] Resetting tournament_generated flag - no matches found", [
                        'championship_id' => $championship->id,
                    ]);
                    $championship->update([
                        'tournament_generated' => false,
                        'tournament_generated_at' => null,
                    ]);
                }

                // Check if we should regenerate (delete existing matches)
                if ($request->input('force_regenerate', false)) {
                    Log::info("🔄 [TOURNAMENT] Force regenerating - deleting existing matches");
                    $championship->matches()->delete();
                    $championship->update([
                        'tournament_generated' => false,
                        'tournament_generated_at' => null,
                    ]);
                }

                // Update championship with tournament settings
                // NOTE: tournament_generated flag is set by TournamentGenerationService after successful generation
                $championship->update([
                    'format_id' => 1, // Swiss + Elimination
                    'status_id' => \App\Enums\ChampionshipStatus::IN_PROGRESS->getId(),
                    'total_rounds' => count($config['rounds']),
                    'swiss_rounds' => $this->countSwissRounds($config['rounds']),
                    'top_qualifiers' => $this->getTopQualifiers($config['rounds']),
                ]);
            } else {
                // Create championship
                $championship = Championship::create([
                    'title' => $title,
                    'description' => 'Test tournament created via visualizer',
                    'format_id' => 1, // Swiss + Elimination
                    'status_id' => \App\Enums\ChampionshipStatus::REGISTRATION_OPEN->getId(),
                    'start_date' => now()->addDays(7),
                    'registration_deadline' => now()->addDays(5),
                    'entry_fee' => 0,
                    'max_participants' => $playerCount,
                    'total_rounds' => count($config['rounds']),
                    'swiss_rounds' => $this->countSwissRounds($config['rounds']),
                    'top_qualifiers' => $this->getTopQualifiers($config['rounds']),
                    'created_by' => 1, // System user
                    'is_test_tournament' => true, // MARKER FIELD
                ]);

            }

            // Generate tournament structure - convert rounds to round_structure for TournamentConfig
            $tournamentConfigData = [
                'round_structure' => $config['rounds'],
                'mode' => 'progressive',
                'avoid_repeat_matches' => true,
                'color_balance_strict' => true,
                'bye_handling' => 'automatic',
                'bye_points' => 1.0,
                'auto_advance_enabled' => false,
                'preset' => 'custom',
            ];
            $tournamentConfig = TournamentConfig::fromArray($tournamentConfigData);
            $summary = $this->tournamentGenerator->generateFullTournament($championship, $tournamentConfig);

            // Create test users and participants for new championships only
            if (!$useExistingChampionship) {
                $participants = $this->createTestParticipants($championship, $playerCount);
            }

            // Initialize standings
            $this->standingsCalculator->updateStandings($championship);

            DB::commit();

            // Return full tournament data
            return $this->getTournament($championship->id);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to create visualizer tournament', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'error' => 'Failed to create tournament',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get complete tournament data
     * GET /api/visualizer/tournaments/{id}
     */
    public function getTournament(int $id): JsonResponse
    {
        try {
            $championship = Championship::with([
                'participants.user',
                'matches.player1',
                'matches.player2',
                'matches.winner',
                'standings.user'
            ])->findOrFail($id);

            // Format data for visualizer
            $data = [
                'tournament_info' => [
                    'id' => $championship->id,
                    'name' => $championship->title,
                    'players' => $championship->participants->count(),
                    'rounds' => $championship->total_rounds,
                    'format' => 'Swiss + Elimination',
                    'status' => $championship->getStatusEnum()->name,
                ],
                'participants' => $championship->participants->map(fn($p) => [
                    'id' => $p->user_id,
                    'name' => $p->user->name,
                    'rating' => $p->user->rating,
                    'email' => $p->user->email,
                ])->toArray(),
                'rounds' => $this->formatRoundsData($championship),
                'matches' => $this->formatMatchesData($championship),
                'initial_standings' => $championship->standings->map(fn($s) => [
                    'id' => $s->user_id,
                    'player_id' => $s->user_id,
                    'player_name' => $s->user->name,
                    'name' => $s->user->name,
                    'rating' => $s->user->rating,
                    'rank' => $s->rank,
                    'points' => $s->points,
                    'wins' => $s->wins,
                    'losses' => $s->losses,
                    'draws' => $s->draws,
                    'matches_played' => $s->matches_played,
                    'buchholz' => $s->buchholz_score,
                    'sonneborn_berger' => $s->sonneborn_berger,
                ])->toArray(),
            ];

            return response()->json($data);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['error' => 'Tournament not found'], 404);
        }
    }

    /**
     * Update match result
     * PUT /api/visualizer/matches/{matchId}/result
     *
     * Body: {
     *   "winner_id": int|null (null for draw)
     * }
     */
    public function updateMatchResult(Request $request, int $matchId): JsonResponse
    {
        if (config('app.env') === 'production') {
            return response()->json([
                'error' => 'Visualizer API is disabled in production'
            ], 403);
        }

        $validated = $request->validate([
            'winner_id' => 'nullable|integer|exists:users,id'
        ]);

        $winnerId = $validated['winner_id'];

        try {
            Log::info('🎯 [BACKEND] Starting match result update', [
                'match_id' => $matchId,
                'winner_id' => $winnerId,
                'request_data' => $validated,
                'timestamp' => now()->toISOString()
            ]);

            $match = ChampionshipMatch::with(['championship', 'player1', 'player2'])->findOrFail($matchId);

            Log::info('📋 [BACKEND] Match found', [
                'match_id' => $match->id,
                'championship_id' => $match->championship_id,
                'round_number' => $match->round_number,
                'round_type' => $match->round_type,
                'player1_id' => $match->player1_id,
                'player2_id' => $match->player2_id,
                'current_status' => $match->status_id,
                'current_winner' => $match->winner_id,
                'is_placeholder' => $match->is_placeholder ?? false
            ]);

            DB::beginTransaction();

            // Update match result
            if ($winnerId === null) {
                // Draw
                Log::info('🎨 [BACKEND] Processing draw result');
                $match->update([
                    'status_id' => \App\Enums\ChampionshipMatchStatus::COMPLETED->getId(),
                    'winner_id' => null,
                    'player1_result_type_id' => \App\Enums\ChampionshipResultType::DRAW->getId(),
                    'player2_result_type_id' => \App\Enums\ChampionshipResultType::DRAW->getId(),
                    'completed_at' => now(),
                ]);
            } else {
                // Win/Loss
                $loserId = $winnerId === $match->player1_id ? $match->player2_id : $match->player1_id;

                Log::info('🏆 [BACKEND] Processing win/loss result', [
                    'winner_id' => $winnerId,
                    'loser_id' => $loserId,
                    'is_player1_winner' => $winnerId === $match->player1_id,
                    'is_player2_winner' => $winnerId === $match->player2_id
                ]);

                $match->update([
                    'status_id' => \App\Enums\ChampionshipMatchStatus::COMPLETED->getId(),
                    'winner_id' => $winnerId,
                    'player1_result_type_id' => $winnerId === $match->player1_id
                        ? \App\Enums\ChampionshipResultType::COMPLETED->getId()
                        : \App\Enums\ChampionshipResultType::FORFEIT_PLAYER1->getId(),
                    'player2_result_type_id' => $winnerId === $match->player2_id
                        ? \App\Enums\ChampionshipResultType::COMPLETED->getId()
                        : \App\Enums\ChampionshipResultType::FORFEIT_PLAYER2->getId(),
                    'completed_at' => now(),
                ]);
            }

            Log::info('✅ [BACKEND] Match updated successfully', [
                'match_id' => $match->id,
                'new_status' => $match->status_id,
                'new_winner' => $match->winner_id,
                'completed_at' => $match->completed_at
            ]);

            // Recalculate standings
            Log::info('📊 [BACKEND] Updating standings for championship', [
                'championship_id' => $match->championship_id
            ]);
            $this->standingsCalculator->updateStandings($match->championship);

            // Check for round progression
            Log::info('🔄 [BACKEND] Checking round progression', [
                'championship_id' => $match->championship_id,
                'round_number' => $match->round_number
            ]);
            $progressionService = app(\App\Services\ChampionshipRoundProgressionService::class);
            $progressionResult = $progressionService->checkChampionshipRoundProgression($match->championship);

            DB::commit();

            Log::info('🏁 [BACKEND] Transaction committed', [
                'progression_result' => $progressionResult ? (is_array($progressionResult) ? 'array' : get_class($progressionResult)) : 'null',
                'progression_action' => $progressionResult ? ($progressionResult['action'] ?? 'none') : 'none'
            ]);

            // Return updated tournament data with basic progression info
            $tournamentResponse = $this->getTournament($match->championship_id);
            $tournamentData = $tournamentResponse->getData(true); // true to get array, not object

            // Add debug info
            $tournamentData['debug'] = [
                'progression_triggered' => $progressionResult !== null,
                'progression_action' => $progressionResult ? ($progressionResult['action'] ?? 'none') : 'none',
                'assigned_count' => $progressionResult && isset($progressionResult['assignment_result']) ? ($progressionResult['assignment_result']['assigned_count'] ?? 0) : 0,
                'current_round' => $match->championship->current_round ?? 'not set',
                'debug_note' => 'Check server logs (storage/logs/laravel.log) for detailed info. Look for "[BACKEND]" logs.',
                'match_updated' => [
                    'id' => $match->id,
                    'round' => $match->round_number,
                    'status' => $match->status_id,
                    'winner' => $match->winner_id
                ]
            ];

            Log::info('📤 [BACKEND] Sending response', [
                'match_count_in_response' => count($tournamentData['matches'] ?? []),
                'debug_info' => $tournamentData['debug']
            ]);

            return response()->json($tournamentData);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to update match result', [
                'match_id' => $matchId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to update match result',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get standings for specific round
     * GET /api/visualizer/tournaments/{id}/standings?round_number=N
     */
    public function getStandings(Request $request, int $id): JsonResponse
    {
        try {
            $championship = Championship::findOrFail($id);
            $roundNumber = $request->query('round_number');

            // If no round specified, return current standings
            if (!$roundNumber) {
                $standings = $championship->standings()
                    ->with('user')
                    ->orderBy('rank')
                    ->get();

                return response()->json([
                    'standings' => $standings->map(fn($s) => [
                        'id' => $s->user_id,
                        'name' => $s->user->name,
                        'rating' => $s->user->rating,
                        'points' => $s->points,
                        'wins' => $s->wins,
                        'losses' => $s->losses,
                        'draws' => $s->draws,
                        'matches_played' => $s->matches_played,
                        'buchholz' => $s->buchholz_score,
                        'rank' => $s->rank,
                    ])
                ]);
            }

            // Calculate standings up to specific round
            $standingsUpToRound = $this->calculateStandingsUpToRound($championship, $roundNumber);

            return response()->json([
                'round_number' => $roundNumber,
                'standings' => $standingsUpToRound
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to get standings',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Export tournament as JSON file
     * GET /api/visualizer/tournaments/{id}/export
     */
    public function exportTournament(int $id): JsonResponse
    {
        try {
            $championship = Championship::with([
                'participants.user',
                'matches.player1',
                'matches.player2',
                'matches.winner',
                'standings.user'
            ])->findOrFail($id);

            $data = $this->getTournament($id)->getData();

            $filename = "tournament_{$id}_export_" . now()->format('Y_m_d_His') . ".json";

            return response()->json($data)
                ->header('Content-Disposition', "attachment; filename=\"{$filename}\"")
                ->header('Content-Type', 'application/json');

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to export tournament',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete test tournament
     * DELETE /api/visualizer/tournaments/{id}
     */
    public function deleteTournament(int $id): JsonResponse
    {
        if (config('app.env') === 'production') {
            return response()->json([
                'error' => 'Visualizer API is disabled in production'
            ], 403);
        }

        try {
            $championship = Championship::findOrFail($id);

            // Safety check: only delete test tournaments
            if (!$championship->is_test_tournament && !str_starts_with($championship->title, '[TEST]')) {
                return response()->json([
                    'error' => 'Cannot delete non-test tournament via visualizer'
                ], 403);
            }

            DB::beginTransaction();

            // Delete related records
            $championship->matches()->delete();
            $championship->standings()->delete();
            $championship->participants()->delete();
            $championship->delete();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "Tournament #{$id} deleted successfully"
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'error' => 'Failed to delete tournament',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * List all test tournaments
     * GET /api/visualizer/tournaments/list
     */
    public function listTournaments(): JsonResponse
    {
        if (config('app.env') === 'production') {
            return response()->json([
                'error' => 'Visualizer API is disabled in production'
            ], 403);
        }

        try {
            $tournaments = Championship::where('is_test_tournament', true)
                ->orWhere('title', 'LIKE', '[TEST]%')
                ->orWhere('title', 'LIKE', '[VISUALIZER]%')
                ->with('participants')
                ->orderBy('created_at', 'desc')
                ->get()
                ->map(fn($c) => [
                    'id' => $c->id,
                    'title' => $c->title,
                    'players' => $c->participants->count(),
                    'rounds' => $c->total_rounds,
                    'status' => $c->getStatusEnum()->name,
                    'created_at' => $c->created_at->toISOString(),
                ]);

            return response()->json([
                'tournaments' => $tournaments,
                'total' => $tournaments->count()
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to list tournaments',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    // ==================== PRIVATE HELPER METHODS ====================

    private function getTournamentConfigForPlayerCount(int $playerCount): array
    {
        // Use TournamentStructureCalculator for dynamic configuration
        $structure = \App\Services\TournamentStructureCalculator::calculateStructure($playerCount);

        $rounds = [];
        $roundNumber = 1;

        // Generate Swiss rounds
        for ($i = 1; $i <= $structure['swiss_rounds']; $i++) {
            $rounds[] = [
                'round' => $roundNumber,
                'name' => "Round $roundNumber",
                'type' => 'swiss',
                'participant_selection' => 'all',
                'pairing_method' => $i === 1 ? 'swiss' : 'standings_based',
                'matches_per_player' => 1,
            ];
            $roundNumber++;
        }

        // Generate elimination rounds based on top_k
        if ($structure['top_k'] > 1) {
            $topK = $structure['top_k'];

            // Generate elimination bracket rounds
            while ($topK >= 2) {
                $roundType = $this->getEliminationRoundType($topK);
                $roundName = $this->getEliminationRoundName($topK);

                $rounds[] = [
                    'round' => $roundNumber,
                    'name' => $roundName,
                    'type' => $roundType,
                    'participant_selection' => ['top_k' => $topK],
                    'pairing_method' => 'standings_based',
                    'matches_per_player' => 1,
                ];

                $roundNumber++;
                $topK = $topK / 2;
            }
        }

        return ['rounds' => $rounds];
    }

    private function getEliminationRoundType(int $topK): string
    {
        return match($topK) {
            32 => 'round_of_32',
            16 => 'round_of_16',
            8 => 'quarter_final',
            4 => 'semi_final',
            2 => 'final',
            default => 'swiss',
        };
    }

    private function getEliminationRoundName(int $topK): string
    {
        return match($topK) {
            32 => 'Round of 32',
            16 => 'Round of 16',
            8 => 'Quarter Finals',
            4 => 'Semi Finals',
            2 => 'Final',
            default => "Top $topK",
        };
    }

    private function countSwissRounds(array $rounds): int
    {
        return count(array_filter($rounds, fn($r) => $r['type'] === 'swiss'));
    }

    private function getTopQualifiers(array $rounds): int
    {
        $eliminationRounds = array_filter($rounds, fn($r) => $r['type'] !== 'swiss');
        if (empty($eliminationRounds)) {
            return 0;
        }
        $firstElimination = array_values($eliminationRounds)[0];
        return $firstElimination['participant_selection']['top_k'] ?? 4;
    }

    private function createTestParticipants(Championship $championship, int $count): array
    {
        $participants = [];
        $baseUserId = 1000 + ($championship->id * 100); // Unique IDs

        for ($i = 1; $i <= $count; $i++) {
            $userId = $baseUserId + $i;

            // Create or find test user
            $user = User::firstOrCreate(
                ['id' => $userId],
                [
                    'name' => "Test Player " . chr(64 + $i), // A, B, C...
                    'email' => "test_visualizer_{$championship->id}_{$i}@example.com",
                    'password' => bcrypt('password'),
                    'rating' => 1500 - ($i - 1) * 50,
                ]
            );

            // Create participant
            $participant = ChampionshipParticipant::create([
                'championship_id' => $championship->id,
                'user_id' => $user->id,
                'payment_status_id' => \App\Enums\PaymentStatus::COMPLETED->getId(),
                'registration_date' => now(),
            ]);

            $participants[] = $participant;
        }

        return $participants;
    }

    private function formatRoundsData(Championship $championship): array
    {
        $rounds = [];
        // Sort matches by round number first, then group
        $matchesByRound = $championship->matches->sortBy('round_number')->groupBy('round_number');

        foreach ($matchesByRound as $roundNumber => $matches) {
            $firstMatch = $matches->first();
            $roundType = $firstMatch->getRoundTypeEnum();

            $rounds[] = [
                'round_number' => $roundNumber,
                'name' => $this->getRoundName($roundNumber, $roundType->name),
                'round_type' => strtolower($roundType->name),
                'matches' => $matches->map(fn($m) => $this->formatMatchForRound($m))->toArray(),
            ];
        }

        return $rounds;
    }

    private function formatMatchesData(Championship $championship): array
    {
        return $championship->matches->map(fn($m) => [
            'id' => $m->id,
            'round_number' => $m->round_number,
            'round_type' => strtolower($m->getRoundTypeEnum()->name),
            'player1_id' => $m->player1_id,
            'player2_id' => $m->player2_id,
            'status' => strtolower($m->getStatusEnum()->name),
            'winner_id' => $m->winner_id,
            'is_placeholder' => $m->is_placeholder,
            'created_at' => $m->created_at->toISOString(),
        ])->toArray();
    }

    private function formatMatchForRound(ChampionshipMatch $match): array
    {
        $result = [
            'id' => $match->id,
            'round_number' => $match->round_number,
            'round_type' => strtolower($match->getRoundTypeEnum()->name),
            'is_placeholder' => $match->is_placeholder,
            'status' => strtolower($match->getStatusEnum()->name),
            'player1_id' => $match->player1_id,
            'player2_id' => $match->player2_id,
        ];

        if ($match->player1) {
            $result['player1'] = [
                'id' => $match->player1->id,
                'name' => $match->player1->name,
                'rating' => $match->player1->rating,
            ];
        }

        if ($match->player2) {
            $result['player2'] = [
                'id' => $match->player2->id,
                'name' => $match->player2->name,
                'rating' => $match->player2->rating,
            ];
        }

        if ($match->getStatusEnum()->isFinished()) {
            if ($match->winner_id) {
                $result['player1_result'] = $match->winner_id === $match->player1_id ? 'win' : 'loss';
                $result['player2_result'] = $match->winner_id === $match->player2_id ? 'win' : 'loss';
                $result['winner_id'] = $match->winner_id;
            } else {
                $result['player1_result'] = 'draw';
                $result['player2_result'] = 'draw';
            }
        }

        if ($match->is_placeholder) {
            // Extract bracket positions from placeholder_positions JSON
            $positions = $match->placeholder_positions ?? [];
            $result['player1_bracket_position'] = $this->extractBracketPosition($positions, 'player1', 1);
            $result['player2_bracket_position'] = $this->extractBracketPosition($positions, 'player2', 2);
            $result['determined_by_round'] = $match->determined_by_round;
            $result['placeholder_positions'] = $positions;
        }

        return $result;
    }

    /**
     * Extract bracket position from placeholder positions JSON
     */
    private function extractBracketPosition(array $positions, string $playerKey, int $default): int
    {
        if (isset($positions[$playerKey])) {
            // Extract numeric rank from positions like "rank_1", "rank_2"
            $positionStr = $positions[$playerKey];
            if (preg_match('/rank_(\d+)/', $positionStr, $matches)) {
                return (int) $matches[1];
            }
        }
        return $default;
    }

    private function getRoundName(int $roundNumber, string $roundType): string
    {
        $names = [
            'SWISS' => "Round $roundNumber",
            'FINAL' => 'Final',
            'SEMI_FINAL' => 'Semi Final',
            'QUARTER_FINAL' => 'Quarter Final',
            'ROUND_OF_16' => 'Round of 16',
            'THIRD_PLACE' => 'Third Place',
        ];

        return $names[$roundType] ?? "Round $roundNumber";
    }

    private function calculateStandingsUpToRound(Championship $championship, int $roundNumber): array
    {
        $participants = $championship->participants()->with('user')->get();
        $matches = $championship->matches()
            ->where('round_number', '<=', $roundNumber)
            ->where('status_id', \App\Enums\ChampionshipMatchStatus::COMPLETED->getId())
            ->get();

        $standings = [];

        foreach ($participants as $participant) {
            $userId = $participant->user_id;
            $userMatches = $matches->filter(fn($m) =>
                $m->player1_id === $userId || $m->player2_id === $userId
            );

            $points = 0;
            $wins = 0;
            $draws = 0;
            $losses = 0;
            $opponents = [];

            foreach ($userMatches as $match) {
                $opponentId = $match->player1_id === $userId ? $match->player2_id : $match->player1_id;
                $opponents[] = $opponentId;

                if ($match->winner_id === $userId) {
                    $wins++;
                    $points += 1;
                } elseif ($match->winner_id === null) {
                    $draws++;
                    $points += 0.5;
                } else {
                    $losses++;
                }
            }

            // Calculate Buchholz (sum of opponents' points)
            $buchholz = 0;
            foreach ($opponents as $oppId) {
                $oppStanding = $standings[$oppId] ?? null;
                if ($oppStanding) {
                    $buchholz += $oppStanding['points'];
                }
            }

            $standings[$userId] = [
                'id' => $userId,
                'name' => $participant->user->name,
                'rating' => $participant->user->rating,
                'points' => $points,
                'wins' => $wins,
                'losses' => $losses,
                'draws' => $draws,
                'matches_played' => $userMatches->count(),
                'buchholz' => $buchholz,
            ];
        }

        // Sort standings
        usort($standings, function ($a, $b) {
            if ($b['points'] !== $a['points']) return $b['points'] <=> $a['points'];
            if ($b['buchholz'] !== $a['buchholz']) return $b['buchholz'] <=> $a['buchholz'];
            return $b['rating'] <=> $a['rating'];
        });

        return array_values($standings);
    }

    /**
     * Get all championships for player assignment
     */
    public function getChampionships(): JsonResponse
    {
        Log::info('📋 [ASSIGNMENT] Getting all championships');

        $championships = Championship::select([
            'id', 'name', 'status', 'current_round', 'participant_limit',
            'registration_open', 'created_at', 'updated_at'
        ])
        ->withCount('participants as participant_count')
        ->orderBy('created_at', 'desc')
        ->get()
        ->map(function ($championship) {
            return [
                'id' => $championship->id,
                'name' => $championship->name,
                'status' => $championship->status,
                'current_round' => $championship->current_round,
                'participant_limit' => $championship->participant_limit,
                'participant_count' => $championship->participant_count,
                'registration_open' => $championship->registration_open,
                'created_at' => $championship->created_at->toISOString(),
                'updated_at' => $championship->updated_at->toISOString(),
            ];
        });

        Log::info('✅ [ASSIGNMENT] Championships retrieved', [
            'count' => $championships->count()
        ]);

        return response()->json($championships);
    }

    /**
     * Get all users available for assignment
     */
    public function getUsers(): JsonResponse
    {
        Log::info('👥 [ASSIGNMENT] Getting all users');

        $users = User::select(['id', 'name', 'email', 'rating'])
        ->orderBy('name')
        ->get()
        ->map(function ($user) {
            return [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'rating' => $user->rating ?? 0,
            ];
        });

        Log::info('✅ [ASSIGNMENT] Users retrieved', [
            'count' => $users->count()
        ]);

        return response()->json($users);
    }

    /**
     * Assign players to a championship
     */
    public function assignPlayersToChampionship(Request $request, int $championshipId): JsonResponse
    {
        Log::info('🎯 [ASSIGNMENT] Starting player assignment', [
            'championship_id' => $championshipId,
            'user_ids' => $request->input('user_ids')
        ]);

        $validated = $request->validate([
            'user_ids' => 'required|array|min:1',
            'user_ids.*' => 'integer|exists:users,id'
        ]);

        try {
            $championship = Championship::findOrFail($championshipId);

            Log::info('📋 [ASSIGNMENT] Championship found', [
                'championship_id' => $championship->id,
                'name' => $championship->name,
                'status' => $championship->status,
                'current_participants' => $championship->participants()->count()
            ]);

            // Check if championship is in a state that allows player assignment
            $registrationDeadline = $championship->registration_deadline;
            $now = now();
            $deadlinePassed = $now->greaterThan($registrationDeadline);

            Log::info('🔍 [ASSIGNMENT] Registration check', [
                'championship_id' => $championshipId,
                'status_id' => $championship->status_id,
                'status_code' => $championship->status,
                'registration_deadline' => $registrationDeadline->toISOString(),
                'current_time' => $now->toISOString(),
                'deadline_passed' => $deadlinePassed,
                'is_registration_open' => $championship->is_registration_open,
                'allow_public_registration' => $championship->allow_public_registration
            ]);

            if ($deadlinePassed || $championship->status_id !== \App\Enums\ChampionshipStatus::REGISTRATION_OPEN->getId()) {
                Log::warning('⚠️ [ASSIGNMENT] Championship registration is closed', [
                    'championship_id' => $championshipId,
                    'reason' => $deadlinePassed ? 'registration_deadline_passed' : 'status_not_registration_open',
                    'deadline_passed' => $deadlinePassed,
                    'current_status_id' => $championship->status_id
                ]);
                return response()->json([
                    'message' => 'Cannot assign players: championship registration is closed'
                ], 403);
            }

            DB::beginTransaction();

            $assignedCount = 0;
            $skippedCount = 0;
            $duplicateCount = 0;

            foreach ($validated['user_ids'] as $userId) {
                // Check if user is already a participant
                $existingParticipant = ChampionshipParticipant::where('championship_id', $championshipId)
                    ->where('user_id', $userId)
                    ->first();

                if ($existingParticipant) {
                    Log::info('⏭️ [ASSIGNMENT] User already a participant', [
                        'championship_id' => $championshipId,
                        'user_id' => $userId
                    ]);
                    $duplicateCount++;
                    continue;
                }

                // Create new participant with COMPLETED payment status
                $participant = ChampionshipParticipant::create([
                    'championship_id' => $championshipId,
                    'user_id' => $userId,
                    'registration_status' => 'registered',
                    'registered_at' => now(),
                    'payment_status_id' => 2, // COMPLETED - automatically mark as paid for tournament assignment
                ]);

                Log::info('✅ [ASSIGNMENT] Participant created with COMPLETED payment status', [
                    'championship_id' => $championshipId,
                    'user_id' => $userId,
                    'participant_id' => $participant->id,
                    'payment_status_id' => $participant->payment_status_id,
                    'payment_status_code' => $participant->payment_status
                ]);

                $assignedCount++;
            }

            // Note: participants_count is not a real column, it's a virtual computed field
            // No need to update championship record after participant assignment

            DB::commit();

            Log::info('🏁 [ASSIGNMENT] Assignment completed', [
                'championship_id' => $championshipId,
                'assigned_count' => $assignedCount,
                'duplicate_count' => $duplicateCount,
                'total_participants' => $championship->participants()->count()
            ]);

            return response()->json([
                'message' => 'Players assigned successfully',
                'assigned_count' => $assignedCount,
                'duplicate_count' => $duplicateCount,
                'total_participants' => $championship->participants()->count(),
                'championship_id' => $championshipId
            ]);

        } catch (\Exception $e) {
            DB::rollBack();

            Log::error('❌ [ASSIGNMENT] Assignment failed', [
                'championship_id' => $championshipId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'message' => 'Failed to assign players: ' . $e->getMessage()
            ], 500);
        }
    }
}
