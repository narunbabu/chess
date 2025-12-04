# Database-Connected Tournament Visualizer - Full Implementation Plan

## 🎯 Project Overview

**Goal**: Create a full-stack tournament management system that connects directly to the Laravel backend database, replacing the static JSON-based visualizer with real-time database operations.

**Key Benefits**:
- ✅ Single source of truth (backend handles all logic)
- ✅ Real-time database persistence
- ✅ No JSON file management headaches
- ✅ Direct testing of backend tournament logic
- ✅ One-click tournament creation with presets

---

## 📋 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (HTML/JS)                        │
│              tournament_db_visualizer.html                   │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Tournament  │  │    Match     │  │   Standings  │      │
│  │   Creation   │  │  Visualizer  │  │    Display   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└───────────────────────────┬─────────────────────────────────┘
                            │ API Calls (Fetch)
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                   Backend API Layer                          │
│       TournamentVisualizerController.php                     │
│                                                               │
│  POST   /api/visualizer/tournaments/create                   │
│  GET    /api/visualizer/tournaments/{id}                     │
│  PUT    /api/visualizer/matches/{id}/result                  │
│  GET    /api/visualizer/tournaments/{id}/standings           │
│  GET    /api/visualizer/tournaments/{id}/export              │
│  DELETE /api/visualizer/tournaments/{id}                     │
│  GET    /api/visualizer/tournaments/list                     │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    Backend Services                          │
│                                                               │
│  • TournamentGenerationService (existing)                    │
│  • StandingsCalculatorService (existing)                     │
│  • PlaceholderMatchAssignmentService (existing)              │
└──────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                      Database                                │
│                                                               │
│  • championships                                             │
│  • championship_participants                                 │
│  • championship_matches                                      │
│  • championship_standings                                    │
└──────────────────────────────────────────────────────────────┘
```

---

## 🗂️ Phase 1: Backend API Development

### 1.1 Create TournamentVisualizerController

**File**: `app/Http/Controllers/TournamentVisualizerController.php`

**Purpose**: Dedicated controller for visualizer operations, separate from production championship APIs.

**Marker Strategy**: All test tournaments will have:
- Title prefix: `[TEST]` or `[VISUALIZER]`
- Custom field in database: Add `is_test_tournament` boolean column
- Easy identification for cleanup

#### Controller Methods:

```php
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
            'player_count' => 'required|integer|in:3,5,10,50',
            'title' => 'nullable|string|max:255'
        ]);

        $playerCount = $validated['player_count'];
        $title = $validated['title'] ?? "[VISUALIZER] {$playerCount}-Player Test Tournament";

        try {
            DB::beginTransaction();

            // Get tournament configuration based on player count
            $config = $this->getTournamentConfigForPlayerCount($playerCount);

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

            // Create test users and participants
            $participants = $this->createTestParticipants($championship, $playerCount);

            // Generate tournament structure
            $tournamentConfig = TournamentConfig::fromArray($config);
            $summary = $this->tournamentGenerator->generateFullTournament($championship, $tournamentConfig);

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

        try {
            $match = ChampionshipMatch::with(['championship', 'player1', 'player2'])->findOrFail($matchId);
            $winnerId = $validated['winner_id'];

            DB::beginTransaction();

            // Update match result
            if ($winnerId === null) {
                // Draw
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

                $match->update([
                    'status_id' => \App\Enums\ChampionshipMatchStatus::COMPLETED->getId(),
                    'winner_id' => $winnerId,
                    'player1_result_type_id' => $winnerId === $match->player1_id
                        ? \App\Enums\ChampionshipResultType::WIN->getId()
                        : \App\Enums\ChampionshipResultType::LOSS->getId(),
                    'player2_result_type_id' => $winnerId === $match->player2_id
                        ? \App\Enums\ChampionshipResultType::WIN->getId()
                        : \App\Enums\ChampionshipResultType::LOSS->getId(),
                    'completed_at' => now(),
                ]);
            }

            // Recalculate standings
            $this->standingsCalculator->updateStandings($match->championship);

            // Check and resolve placeholder matches
            $this->placeholderService->assignPlaceholderMatches($match->championship);

            DB::commit();

            // Return updated tournament data
            return $this->getTournament($match->championship_id);

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
        $configs = [
            3 => [
                'rounds' => [
                    ['round' => 1, 'name' => 'Round 1', 'type' => 'swiss', 'participant_selection' => 'all', 'pairing_method' => 'random_seeded'],
                    ['round' => 2, 'name' => 'Final', 'type' => 'final', 'participant_selection' => ['top_k' => 2], 'pairing_method' => 'standings_based', 'determined_by' => 1],
                ],
            ],
            5 => [
                'rounds' => [
                    ['round' => 1, 'name' => 'Round 1', 'type' => 'swiss', 'participant_selection' => 'all', 'pairing_method' => 'random_seeded'],
                    ['round' => 2, 'name' => 'Semi Final', 'type' => 'semi_final', 'participant_selection' => ['top_k' => 4], 'pairing_method' => 'standings_based', 'determined_by' => 1],
                    ['round' => 3, 'name' => 'Final', 'type' => 'final', 'participant_selection' => ['top_k' => 2], 'pairing_method' => 'standings_based', 'determined_by' => 2],
                ],
            ],
            10 => [
                'rounds' => [
                    ['round' => 1, 'name' => 'Round 1', 'type' => 'swiss', 'participant_selection' => 'all', 'pairing_method' => 'random_seeded'],
                    ['round' => 2, 'name' => 'Round 2', 'type' => 'swiss', 'participant_selection' => 'all', 'pairing_method' => 'standings_based'],
                    ['round' => 3, 'name' => 'Quarter Final', 'type' => 'quarter_final', 'participant_selection' => ['top_k' => 8], 'pairing_method' => 'standings_based', 'determined_by' => 2],
                    ['round' => 4, 'name' => 'Semi Final', 'type' => 'semi_final', 'participant_selection' => ['top_k' => 4], 'pairing_method' => 'standings_based', 'determined_by' => 3],
                    ['round' => 5, 'name' => 'Third Place', 'type' => 'third_place', 'participant_selection' => ['top_k' => 2], 'pairing_method' => 'standings_based', 'determined_by' => 4],
                    ['round' => 6, 'name' => 'Final', 'type' => 'final', 'participant_selection' => ['top_k' => 2], 'pairing_method' => 'standings_based', 'determined_by' => 4],
                ],
            ],
            50 => [
                'rounds' => [
                    ['round' => 1, 'name' => 'Round 1', 'type' => 'swiss', 'participant_selection' => 'all', 'pairing_method' => 'random_seeded'],
                    ['round' => 2, 'name' => 'Round 2', 'type' => 'swiss', 'participant_selection' => 'all', 'pairing_method' => 'standings_based'],
                    ['round' => 3, 'name' => 'Round of 16', 'type' => 'round_of_16', 'participant_selection' => ['top_k' => 16], 'pairing_method' => 'standings_based', 'determined_by' => 2],
                    ['round' => 4, 'name' => 'Quarter Final', 'type' => 'quarter_final', 'participant_selection' => ['top_k' => 8], 'pairing_method' => 'standings_based', 'determined_by' => 3],
                    ['round' => 5, 'name' => 'Semi Final', 'type' => 'semi_final', 'participant_selection' => ['top_k' => 4], 'pairing_method' => 'standings_based', 'determined_by' => 4],
                    ['round' => 6, 'name' => 'Third Place', 'type' => 'third_place', 'participant_selection' => ['top_k' => 2], 'pairing_method' => 'standings_based', 'determined_by' => 5],
                    ['round' => 7, 'name' => 'Final', 'type' => 'final', 'participant_selection' => ['top_k' => 2], 'pairing_method' => 'standings_based', 'determined_by' => 5],
                ],
            ],
        ];

        return $configs[$playerCount];
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
        $matchesByRound = $championship->matches->groupBy('round_number');

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
            'is_placeholder' => $m->is_placeholder_match,
            'created_at' => $m->created_at->toISOString(),
        ])->toArray();
    }

    private function formatMatchForRound(ChampionshipMatch $match): array
    {
        $result = [
            'id' => $match->id,
            'round_number' => $match->round_number,
            'round_type' => strtolower($match->getRoundTypeEnum()->name),
            'is_placeholder' => $match->is_placeholder_match,
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

        if ($match->is_placeholder_match) {
            $result['player1_bracket_position'] = $match->player1_seed ?? 1;
            $result['player2_bracket_position'] = $match->player2_seed ?? 2;
            $result['determined_by_round'] = $match->determined_by_round;
            $result['requires_top_k'] = $match->requires_top_k;
        }

        return $result;
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
}
```

### 1.2 Add Migration for Test Tournament Marker

**File**: `database/migrations/YYYY_MM_DD_HHMMSS_add_is_test_tournament_to_championships.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('championships', function (Blueprint $table) {
            $table->boolean('is_test_tournament')->default(false)->after('created_by');
            $table->index('is_test_tournament'); // For efficient querying
        });
    }

    public function down(): void
    {
        Schema::table('championships', function (Blueprint $table) {
            $table->dropIndex(['is_test_tournament']);
            $table->dropColumn('is_test_tournament');
        });
    }
};
```

### 1.3 Add API Routes

**File**: `routes/api.php` (add after existing championship routes)

```php
// Tournament Visualizer API (internal testing only - disabled in production)
Route::prefix('visualizer')->group(function () {
    Route::post('/tournaments/create', [\App\Http\Controllers\TournamentVisualizerController::class, 'createTournament']);
    Route::get('/tournaments/list', [\App\Http\Controllers\TournamentVisualizerController::class, 'listTournaments']);
    Route::get('/tournaments/{id}', [\App\Http\Controllers\TournamentVisualizerController::class, 'getTournament']);
    Route::put('/matches/{matchId}/result', [\App\Http\Controllers\TournamentVisualizerController::class, 'updateMatchResult']);
    Route::get('/tournaments/{id}/standings', [\App\Http\Controllers\TournamentVisualizerController::class, 'getStandings']);
    Route::get('/tournaments/{id}/export', [\App\Http\Controllers\TournamentVisualizerController::class, 'exportTournament']);
    Route::delete('/tournaments/{id}', [\App\Http\Controllers\TournamentVisualizerController::class, 'deleteTournament']);
});
```

### 1.4 Update CORS Configuration

**File**: `config/cors.php`

Ensure localhost access is allowed for development:

```php
'paths' => ['api/*', 'sanctum/csrf-cookie', 'visualizer/*'],

'allowed_origins' => [
    'http://localhost',
    'http://localhost:8000',
    'http://127.0.0.1',
    'http://127.0.0.1:8000',
    env('FRONTEND_URL'),
],
```

---

## 🎨 Phase 2: Frontend Development

### 2.1 Create tournament_db_visualizer.html

**File**: `chess-backend/public/tournament_db_visualizer.html`

**Structure**: Based on `tournament_visualizer_v3.html` with API integration

#### Key Components:

1. **Tournament Creation Panel** (top section)
2. **Tournament Management Panel** (list, delete, export)
3. **Match Visualization** (bracket display with click-to-win)
4. **Standings Display** (real-time, API-driven)
5. **API Client Layer** (JavaScript class for all API calls)

#### Complete HTML Structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database Tournament Visualizer</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }

        header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }

        header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
        }

        header p {
            font-size: 1.1rem;
            opacity: 0.9;
        }

        .creation-panel {
            background: #f8f9fa;
            padding: 30px;
            border-bottom: 3px solid #e9ecef;
        }

        .creation-panel h2 {
            color: #333;
            margin-bottom: 20px;
            font-size: 1.8rem;
        }

        .preset-buttons {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
        }

        .btn {
            padding: 15px 30px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            display: inline-flex;
            align-items: center;
            gap: 10px;
        }

        .btn-create {
            background: #28a745;
            color: white;
        }

        .btn-create:hover {
            background: #218838;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(40, 167, 69, 0.3);
        }

        .btn-create:disabled {
            background: #ccc;
            cursor: not-allowed;
            transform: none;
        }

        .management-panel {
            background: white;
            padding: 30px;
            border-bottom: 3px solid #e9ecef;
        }

        .management-panel h2 {
            color: #333;
            margin-bottom: 20px;
        }

        .tournament-actions {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-bottom: 20px;
        }

        .btn-list {
            background: #007bff;
            color: white;
        }

        .btn-list:hover {
            background: #0056b3;
        }

        .btn-export {
            background: #17a2b8;
            color: white;
        }

        .btn-export:hover {
            background: #138496;
        }

        .btn-delete {
            background: #dc3545;
            color: white;
        }

        .btn-delete:hover {
            background: #c82333;
        }

        .tournament-list {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 20px;
            max-height: 300px;
            overflow-y: auto;
        }

        .tournament-item {
            background: white;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 5px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border: 1px solid #e9ecef;
        }

        .tournament-info {
            flex: 1;
        }

        .tournament-info h4 {
            color: #333;
            margin-bottom: 5px;
        }

        .tournament-info p {
            color: #666;
            font-size: 14px;
        }

        .tournament-item-actions {
            display: flex;
            gap: 10px;
        }

        .btn-small {
            padding: 8px 16px;
            font-size: 14px;
        }

        .visualizer-panel {
            padding: 30px;
        }

        .status-bar {
            background: #e9ecef;
            padding: 15px 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #dee2e6;
        }

        .status-item {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }

        .status-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            font-weight: 600;
        }

        .status-value {
            font-size: 18px;
            color: #333;
            font-weight: bold;
        }

        .tournament-view {
            padding: 30px;
        }

        .rounds-container {
            display: flex;
            gap: 30px;
            overflow-x: auto;
            padding-bottom: 20px;
        }

        .round {
            min-width: 300px;
            background: #f8f9fa;
            border-radius: 10px;
            padding: 20px;
        }

        .round-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
        }

        .round-header h3 {
            font-size: 1.2rem;
            margin-bottom: 5px;
        }

        .round-header p {
            font-size: 0.9rem;
            opacity: 0.9;
        }

        .match-card {
            background: white;
            border: 2px solid #dee2e6;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            cursor: pointer;
            transition: all 0.3s;
        }

        .match-card:hover {
            border-color: #667eea;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
            transform: translateY(-2px);
        }

        .match-card.completed {
            background: #e8f5e9;
            border-color: #4caf50;
        }

        .match-card.placeholder {
            background: #fff3cd;
            border-color: #ffc107;
            border-style: dashed;
        }

        .player {
            padding: 10px;
            border-radius: 5px;
            margin: 5px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: all 0.2s;
        }

        .player:hover {
            background: #f8f9fa;
        }

        .player.winner {
            background: #d4edda;
            font-weight: bold;
            border: 2px solid #28a745;
        }

        .player.loser {
            background: #f8d7da;
            opacity: 0.7;
        }

        .player-name {
            font-size: 16px;
            color: #333;
        }

        .player-rating {
            font-size: 14px;
            color: #666;
            background: #e9ecef;
            padding: 3px 8px;
            border-radius: 3px;
        }

        .match-vs {
            text-align: center;
            color: #666;
            font-weight: bold;
            font-size: 14px;
            margin: 5px 0;
        }

        .standings-section {
            margin-top: 40px;
            padding: 30px;
            background: #f8f9fa;
            border-radius: 10px;
        }

        .standings-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .standings-header h2 {
            color: #333;
            font-size: 1.8rem;
        }

        .standings-table {
            width: 100%;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .standings-table table {
            width: 100%;
            border-collapse: collapse;
        }

        .standings-table th {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px;
            text-align: left;
            font-weight: 600;
        }

        .standings-table td {
            padding: 15px;
            border-bottom: 1px solid #e9ecef;
        }

        .standings-table tr:hover {
            background: #f8f9fa;
        }

        .rank-badge {
            display: inline-block;
            width: 30px;
            height: 30px;
            line-height: 30px;
            text-align: center;
            border-radius: 50%;
            font-weight: bold;
            color: white;
        }

        .rank-1 { background: #ffd700; }
        .rank-2 { background: #c0c0c0; }
        .rank-3 { background: #cd7f32; }
        .rank-other { background: #6c757d; }

        .loading {
            text-align: center;
            padding: 40px;
            font-size: 18px;
            color: #666;
        }

        .loading::after {
            content: '...';
            animation: dots 1.5s steps(4, end) infinite;
        }

        @keyframes dots {
            0%, 20% { content: '.'; }
            40% { content: '..'; }
            60%, 100% { content: '...'; }
        }

        .error {
            background: #f8d7da;
            color: #721c24;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            border: 1px solid #f5c6cb;
        }

        .success {
            background: #d4edda;
            color: #155724;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            border: 1px solid #c3e6cb;
        }

        .hidden {
            display: none;
        }

        /* Modal Styles */
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            animation: fadeIn 0.3s;
        }

        .modal.active {
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .modal-content {
            background: white;
            padding: 30px;
            border-radius: 10px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            animation: slideIn 0.3s;
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes slideIn {
            from { transform: translateY(-50px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }

        .modal-header {
            margin-bottom: 20px;
        }

        .modal-header h3 {
            color: #333;
            font-size: 1.5rem;
        }

        .modal-close {
            float: right;
            font-size: 28px;
            font-weight: bold;
            color: #aaa;
            cursor: pointer;
        }

        .modal-close:hover {
            color: #333;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🏆 Database Tournament Visualizer</h1>
            <p>Real-time tournament management connected to Laravel backend</p>
        </header>

        <!-- Tournament Creation Panel -->
        <div class="creation-panel">
            <h2>🎮 Create New Tournament</h2>
            <div class="preset-buttons">
                <button class="btn btn-create" onclick="createTournament(3)">
                    <span>🎲</span> Create 3-Player Tournament
                </button>
                <button class="btn btn-create" onclick="createTournament(5)">
                    <span>🎯</span> Create 5-Player Tournament
                </button>
                <button class="btn btn-create" onclick="createTournament(10)">
                    <span>🎪</span> Create 10-Player Tournament
                </button>
                <button class="btn btn-create" onclick="createTournament(50)">
                    <span>🏟️</span> Create 50-Player Tournament
                </button>
            </div>
            <div id="creation-message"></div>
        </div>

        <!-- Tournament Management Panel -->
        <div class="management-panel">
            <h2>📋 Tournament Management</h2>
            <div class="tournament-actions">
                <button class="btn btn-list" onclick="listTournaments()">
                    <span>📜</span> List All Test Tournaments
                </button>
                <button class="btn btn-export" onclick="exportCurrentTournament()" id="exportBtn" disabled>
                    <span>💾</span> Export Current Tournament (JSON)
                </button>
                <button class="btn btn-delete" onclick="deleteCurrentTournament()" id="deleteBtn" disabled>
                    <span>🗑️</span> Delete Current Tournament
                </button>
            </div>
            <div id="tournament-list" class="tournament-list hidden"></div>
        </div>

        <!-- Status Bar -->
        <div class="status-bar">
            <div class="status-item">
                <span class="status-label">Tournament</span>
                <span class="status-value" id="tournamentStatus">No tournament loaded</span>
            </div>
            <div class="status-item">
                <span class="status-label">Players</span>
                <span class="status-value" id="playerCount">-</span>
            </div>
            <div class="status-item">
                <span class="status-label">Total Matches</span>
                <span class="status-value" id="totalMatches">-</span>
            </div>
            <div class="status-item">
                <span class="status-label">Completed</span>
                <span class="status-value" id="completedMatches">-</span>
            </div>
        </div>

        <!-- Tournament Visualization -->
        <div class="visualizer-panel">
            <div id="loading" class="loading hidden">Loading tournament data</div>
            <div id="error" class="error hidden"></div>
            <div id="tournament-view" class="tournament-view hidden">
                <div id="rounds-container" class="rounds-container"></div>
            </div>
        </div>

        <!-- Standings Section -->
        <div id="standings-section" class="standings-section hidden">
            <div class="standings-header">
                <h2>📊 Current Standings</h2>
                <button class="btn btn-list btn-small" onclick="showStandingsModal()">
                    View Round-by-Round
                </button>
            </div>
            <div class="standings-table" id="standings-table"></div>
        </div>
    </div>

    <!-- Standings Modal -->
    <div id="standingsModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <span class="modal-close" onclick="closeStandingsModal()">&times;</span>
                <h3>📈 Round-by-Round Standings</h3>
            </div>
            <div id="modal-standings-content"></div>
        </div>
    </div>

    <script>
        // ===================== CONFIGURATION =====================
        const API_BASE_URL = 'http://localhost:8000/api/visualizer';

        // ===================== STATE =====================
        let currentTournament = null;
        let currentStandings = [];

        // ===================== API CLIENT =====================
        class TournamentAPI {
            static async createTournament(playerCount) {
                const response = await fetch(`${API_BASE_URL}/tournaments/create`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ player_count: playerCount })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to create tournament');
                }

                return await response.json();
            }

            static async getTournament(id) {
                const response = await fetch(`${API_BASE_URL}/tournaments/${id}`);

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to fetch tournament');
                }

                return await response.json();
            }

            static async updateMatchResult(matchId, winnerId) {
                const response = await fetch(`${API_BASE_URL}/matches/${matchId}/result`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ winner_id: winnerId })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to update match result');
                }

                return await response.json();
            }

            static async getStandings(tournamentId, roundNumber = null) {
                const url = roundNumber
                    ? `${API_BASE_URL}/tournaments/${tournamentId}/standings?round_number=${roundNumber}`
                    : `${API_BASE_URL}/tournaments/${tournamentId}/standings`;

                const response = await fetch(url);

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to fetch standings');
                }

                return await response.json();
            }

            static async exportTournament(id) {
                const response = await fetch(`${API_BASE_URL}/tournaments/${id}/export`);

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to export tournament');
                }

                const data = await response.json();
                const filename = `tournament_${id}_export_${new Date().toISOString()}.json`;

                // Trigger download
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                window.URL.revokeObjectURL(url);
            }

            static async deleteTournament(id) {
                const response = await fetch(`${API_BASE_URL}/tournaments/${id}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to delete tournament');
                }

                return await response.json();
            }

            static async listTournaments() {
                const response = await fetch(`${API_BASE_URL}/tournaments/list`);

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to list tournaments');
                }

                return await response.json();
            }
        }

        // ===================== TOURNAMENT CREATION =====================
        async function createTournament(playerCount) {
            showLoading();
            hideError();
            showMessage('creation-message', `Creating ${playerCount}-player tournament...`, 'info');

            try {
                const data = await TournamentAPI.createTournament(playerCount);
                currentTournament = data;

                showMessage('creation-message',
                    `✅ Tournament created successfully! ID: ${data.tournament_info.id}`,
                    'success'
                );

                loadTournamentData(data);

            } catch (error) {
                console.error('Failed to create tournament:', error);
                showError('Failed to create tournament: ' + error.message);
                showMessage('creation-message',
                    `❌ Error: ${error.message}`,
                    'error'
                );
            } finally {
                hideLoading();
            }
        }

        // ===================== TOURNAMENT MANAGEMENT =====================
        async function listTournaments() {
            showLoading();
            hideError();

            try {
                const data = await TournamentAPI.listTournaments();
                displayTournamentList(data.tournaments);
            } catch (error) {
                console.error('Failed to list tournaments:', error);
                showError('Failed to list tournaments: ' + error.message);
            } finally {
                hideLoading();
            }
        }

        function displayTournamentList(tournaments) {
            const container = document.getElementById('tournament-list');

            if (tournaments.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #666;">No test tournaments found</p>';
                container.classList.remove('hidden');
                return;
            }

            const html = tournaments.map(t => `
                <div class="tournament-item">
                    <div class="tournament-info">
                        <h4>${t.title}</h4>
                        <p>ID: ${t.id} | Players: ${t.players} | Rounds: ${t.rounds} | Status: ${t.status}</p>
                        <p style="font-size: 12px; color: #999;">Created: ${new Date(t.created_at).toLocaleString()}</p>
                    </div>
                    <div class="tournament-item-actions">
                        <button class="btn btn-list btn-small" onclick="loadTournamentById(${t.id})">Load</button>
                        <button class="btn btn-delete btn-small" onclick="deleteTournamentById(${t.id})">Delete</button>
                    </div>
                </div>
            `).join('');

            container.innerHTML = html;
            container.classList.remove('hidden');
        }

        async function loadTournamentById(id) {
            showLoading();
            hideError();

            try {
                const data = await TournamentAPI.getTournament(id);
                currentTournament = data;
                loadTournamentData(data);
            } catch (error) {
                console.error('Failed to load tournament:', error);
                showError('Failed to load tournament: ' + error.message);
            } finally {
                hideLoading();
            }
        }

        async function exportCurrentTournament() {
            if (!currentTournament) {
                alert('No tournament loaded');
                return;
            }

            try {
                await TournamentAPI.exportTournament(currentTournament.tournament_info.id);
                alert('Tournament exported successfully!');
            } catch (error) {
                console.error('Failed to export tournament:', error);
                alert('Failed to export tournament: ' + error.message);
            }
        }

        async function deleteCurrentTournament() {
            if (!currentTournament) {
                alert('No tournament loaded');
                return;
            }

            const confirmed = confirm(
                `⚠️ WARNING: This will permanently delete tournament #${currentTournament.tournament_info.id}\n\n` +
                `"${currentTournament.tournament_info.name}"\n\n` +
                `This action cannot be undone. Are you sure?`
            );

            if (!confirmed) return;

            try {
                await TournamentAPI.deleteTournament(currentTournament.tournament_info.id);
                alert('Tournament deleted successfully!');

                // Clear current tournament
                currentTournament = null;
                document.getElementById('tournament-view').classList.add('hidden');
                document.getElementById('standings-section').classList.add('hidden');
                document.getElementById('tournamentStatus').textContent = 'No tournament loaded';
                document.getElementById('exportBtn').disabled = true;
                document.getElementById('deleteBtn').disabled = true;

            } catch (error) {
                console.error('Failed to delete tournament:', error);
                alert('Failed to delete tournament: ' + error.message);
            }
        }

        async function deleteTournamentById(id) {
            const confirmed = confirm(`⚠️ Are you sure you want to delete tournament #${id}?`);
            if (!confirmed) return;

            try {
                await TournamentAPI.deleteTournament(id);
                alert('Tournament deleted successfully!');
                listTournaments(); // Refresh list
            } catch (error) {
                console.error('Failed to delete tournament:', error);
                alert('Failed to delete tournament: ' + error.message);
            }
        }

        // ===================== MATCH INTERACTION =====================
        async function handlePlayerClick(matchId, playerId, playerName) {
            if (!currentTournament) return;

            const match = findMatchById(matchId);
            if (!match) return;

            // Don't allow clicking on completed matches
            if (match.status === 'completed') {
                alert('This match is already completed!');
                return;
            }

            // Don't allow clicking on placeholder matches without players
            if (match.is_placeholder && (!match.player1_id || !match.player2_id)) {
                alert('This match is waiting for players from previous rounds!');
                return;
            }

            const confirmed = confirm(`Set ${playerName} as winner of this match?`);
            if (!confirmed) return;

            showLoading();
            hideError();

            try {
                const data = await TournamentAPI.updateMatchResult(matchId, playerId);
                currentTournament = data;
                loadTournamentData(data);
                alert(`✅ ${playerName} wins! Standings updated.`);
            } catch (error) {
                console.error('Failed to update match result:', error);
                showError('Failed to update match result: ' + error.message);
            } finally {
                hideLoading();
            }
        }

        // ===================== DATA RENDERING =====================
        function loadTournamentData(data) {
            currentTournament = data;
            currentStandings = data.initial_standings || [];

            // Update status bar
            document.getElementById('tournamentStatus').textContent =
                `${data.tournament_info.name} (#${data.tournament_info.id})`;
            document.getElementById('playerCount').textContent = data.tournament_info.players;
            document.getElementById('totalMatches').textContent = data.matches.length;

            const completedCount = data.matches.filter(m => m.status === 'completed').length;
            document.getElementById('completedMatches').textContent = completedCount;

            // Enable management buttons
            document.getElementById('exportBtn').disabled = false;
            document.getElementById('deleteBtn').disabled = false;

            // Render rounds
            renderRounds(data.rounds);

            // Render standings
            renderStandings(data.initial_standings || []);

            // Show tournament view
            document.getElementById('tournament-view').classList.remove('hidden');
            document.getElementById('standings-section').classList.remove('hidden');
        }

        function renderRounds(rounds) {
            const container = document.getElementById('rounds-container');

            const html = rounds.map(round => `
                <div class="round">
                    <div class="round-header">
                        <h3>${round.name}</h3>
                        <p>Round ${round.round_number} - ${round.round_type}</p>
                    </div>
                    ${round.matches.map(match => renderMatch(match)).join('')}
                </div>
            `).join('');

            container.innerHTML = html;
        }

        function renderMatch(match) {
            const isCompleted = match.status === 'completed';
            const isPlaceholder = match.is_placeholder && (!match.player1_id || !match.player2_id);

            const classes = ['match-card'];
            if (isCompleted) classes.push('completed');
            if (isPlaceholder) classes.push('placeholder');

            let player1HTML, player2HTML;

            if (isPlaceholder) {
                player1HTML = `<div class="player">
                    <span class="player-name">TBD - Position ${match.player1_bracket_position || 1}</span>
                </div>`;
                player2HTML = `<div class="player">
                    <span class="player-name">TBD - Position ${match.player2_bracket_position || 2}</span>
                </div>`;
            } else {
                const player1 = match.player1;
                const player2 = match.player2;

                const player1Classes = ['player'];
                const player2Classes = ['player'];

                if (isCompleted) {
                    if (match.player1_result === 'win') {
                        player1Classes.push('winner');
                        player2Classes.push('loser');
                    } else if (match.player2_result === 'win') {
                        player2Classes.push('winner');
                        player1Classes.push('loser');
                    }
                }

                player1HTML = `<div class="${player1Classes.join(' ')}"
                    onclick="handlePlayerClick(${match.id}, ${player1.id}, '${player1.name}')">
                    <span class="player-name">${player1.name}</span>
                    <span class="player-rating">${player1.rating}</span>
                </div>`;

                player2HTML = `<div class="${player2Classes.join(' ')}"
                    onclick="handlePlayerClick(${match.id}, ${player2.id}, '${player2.name}')">
                    <span class="player-name">${player2.name}</span>
                    <span class="player-rating">${player2.rating}</span>
                </div>`;
            }

            let statusBadge = '';
            if (isCompleted) {
                statusBadge = '<div style="text-align: center; color: #28a745; font-weight: bold;">✅ Completed</div>';
            } else if (isPlaceholder) {
                statusBadge = '<div style="text-align: center; color: #ffc107; font-weight: bold;">⏳ Waiting</div>';
            }

            return `
                <div class="${classes.join(' ')}">
                    ${player1HTML}
                    <div class="match-vs">VS</div>
                    ${player2HTML}
                    ${statusBadge}
                </div>
            `;
        }

        function renderStandings(standings) {
            if (!standings || standings.length === 0) return;

            const html = `
                <table>
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Player</th>
                            <th>Rating</th>
                            <th>Points</th>
                            <th>W-L-D</th>
                            <th>Matches</th>
                            <th>Buchholz</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${standings.map((player, index) => {
                            const rank = index + 1;
                            const rankClass = rank <= 3 ? `rank-${rank}` : 'rank-other';
                            return `
                                <tr>
                                    <td><span class="rank-badge ${rankClass}">${rank}</span></td>
                                    <td><strong>${player.name}</strong></td>
                                    <td>${player.rating}</td>
                                    <td><strong>${player.points}</strong></td>
                                    <td>${player.wins}-${player.losses}-${player.draws}</td>
                                    <td>${player.matches_played}</td>
                                    <td>${player.buchholz || 0}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;

            document.getElementById('standings-table').innerHTML = html;
        }

        // ===================== STANDINGS MODAL =====================
        async function showStandingsModal() {
            if (!currentTournament) return;

            const modal = document.getElementById('standingsModal');
            const content = document.getElementById('modal-standings-content');

            modal.classList.add('active');
            content.innerHTML = '<div class="loading">Loading round-by-round standings</div>';

            try {
                const totalRounds = currentTournament.tournament_info.rounds;
                let html = '';

                for (let round = 1; round <= totalRounds; round++) {
                    const data = await TournamentAPI.getStandings(
                        currentTournament.tournament_info.id,
                        round
                    );

                    html += `
                        <h4>After Round ${round}</h4>
                        <table style="width: 100%; margin-bottom: 20px; border-collapse: collapse;">
                            <thead>
                                <tr style="background: #f8f9fa;">
                                    <th style="padding: 10px;">Rank</th>
                                    <th style="padding: 10px;">Player</th>
                                    <th style="padding: 10px;">Points</th>
                                    <th style="padding: 10px;">W-L-D</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.standings.map((p, i) => `
                                    <tr>
                                        <td style="padding: 10px;">${i + 1}</td>
                                        <td style="padding: 10px;">${p.name}</td>
                                        <td style="padding: 10px;"><strong>${p.points}</strong></td>
                                        <td style="padding: 10px;">${p.wins}-${p.losses}-${p.draws}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `;
                }

                content.innerHTML = html;

            } catch (error) {
                console.error('Failed to load standings:', error);
                content.innerHTML = `<div class="error">Failed to load standings: ${error.message}</div>`;
            }
        }

        function closeStandingsModal() {
            document.getElementById('standingsModal').classList.remove('active');
        }

        // ===================== UTILITY FUNCTIONS =====================
        function findMatchById(matchId) {
            if (!currentTournament) return null;

            for (const round of currentTournament.rounds) {
                const match = round.matches.find(m => m.id === matchId);
                if (match) return match;
            }
            return null;
        }

        function showLoading() {
            document.getElementById('loading').classList.remove('hidden');
        }

        function hideLoading() {
            document.getElementById('loading').classList.add('hidden');
        }

        function showError(message) {
            const errorDiv = document.getElementById('error');
            errorDiv.textContent = message;
            errorDiv.classList.remove('hidden');
        }

        function hideError() {
            document.getElementById('error').classList.add('hidden');
        }

        function showMessage(containerId, message, type) {
            const container = document.getElementById(containerId);
            container.innerHTML = `<div class="${type === 'success' ? 'success' : type === 'error' ? 'error' : 'info'}">${message}</div>`;

            // Auto-hide after 5 seconds
            setTimeout(() => {
                container.innerHTML = '';
            }, 5000);
        }

        // ===================== INITIALIZATION =====================
        console.log('🏆 Database Tournament Visualizer Loaded');
        console.log('API Base URL:', API_BASE_URL);
    </script>
</body>
</html>
```

---

## 🧪 Phase 3: Testing & Validation

### 3.1 Backend Testing

**Create**: `tests/Feature/TournamentVisualizerTest.php`

```php
<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;

class TournamentVisualizerTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function it_creates_tournament_with_preset()
    {
        $response = $this->postJson('/api/visualizer/tournaments/create', [
            'player_count' => 5
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'tournament_info',
                'participants',
                'rounds',
                'matches'
            ]);

        $this->assertDatabaseHas('championships', [
            'is_test_tournament' => true
        ]);
    }

    /** @test */
    public function it_updates_match_result()
    {
        // Create tournament
        $tournament = $this->postJson('/api/visualizer/tournaments/create', [
            'player_count' => 3
        ])->json();

        $matchId = $tournament['matches'][0]['id'];
        $winnerId = $tournament['participants'][0]['id'];

        // Update match result
        $response = $this->putJson("/api/visualizer/matches/{$matchId}/result", [
            'winner_id' => $winnerId
        ]);

        $response->assertStatus(200);

        $this->assertDatabaseHas('championship_matches', [
            'id' => $matchId,
            'winner_id' => $winnerId
        ]);
    }

    /** @test */
    public function it_blocks_visualizer_in_production()
    {
        config(['app.env' => 'production']);

        $response = $this->postJson('/api/visualizer/tournaments/create', [
            'player_count' => 5
        ]);

        $response->assertStatus(403);
    }
}
```

### 3.2 Frontend Testing Checklist

1. **Tournament Creation**
   - [ ] Click each preset button (3, 5, 10, 50 players)
   - [ ] Verify tournament created in database
   - [ ] Verify correct number of participants
   - [ ] Verify correct number of rounds
   - [ ] Verify all matches created

2. **Match Updates**
   - [ ] Click player in Round 1 match
   - [ ] Verify match marked as completed
   - [ ] Verify standings updated
   - [ ] Verify placeholder matches resolved
   - [ ] Complete all matches in tournament

3. **Standings Display**
   - [ ] Verify initial standings show correctly
   - [ ] Click round-by-round standings
   - [ ] Verify cumulative standings calculation
   - [ ] Verify Buchholz calculation

4. **Tournament Management**
   - [ ] List all tournaments
   - [ ] Load tournament from list
   - [ ] Export tournament to JSON
   - [ ] Delete tournament with confirmation

5. **Error Handling**
   - [ ] Try updating completed match (should show alert)
   - [ ] Try clicking TBD placeholder (should show alert)
   - [ ] Test with no internet connection
   - [ ] Test with invalid tournament ID

---

## 📝 Phase 4: Documentation

### 4.1 Create User Guide

**File**: `chess-backend/public/VISUALIZER_USER_GUIDE.md`

```markdown
# Database Tournament Visualizer - User Guide

## Overview

The Database Tournament Visualizer is an internal testing tool that allows you to create, manage, and test tournament logic directly with the Laravel backend database.

## Features

- ✅ One-click tournament creation (3, 5, 10, 50 players)
- ✅ Visual bracket display with real-time updates
- ✅ Click-to-win match result recording
- ✅ Automatic standings calculation
- ✅ Placeholder match resolution
- ✅ JSON export functionality
- ✅ Test tournament cleanup

## Getting Started

### 1. Start the Backend Server

```bash
cd chess-backend
php artisan serve
```

### 2. Open the Visualizer

Navigate to: `http://localhost:8000/tournament_db_visualizer.html`

### 3. Create a Tournament

Click one of the preset buttons:
- 🎲 3-Player Tournament (1 swiss round + final)
- 🎯 5-Player Tournament (1 swiss + semi-finals + final)
- 🎪 10-Player Tournament (2 swiss + quarter/semi/third/final)
- 🏟️ 50-Player Tournament (2 swiss + round of 16/quarter/semi/third/final)

### 4. Play Through Matches

- Click on any player's name in a match to mark them as winner
- Matches turn green when completed
- Placeholder matches (yellow dashed border) automatically resolve when previous rounds complete

### 5. View Standings

- Current standings appear at bottom of page
- Click "View Round-by-Round" to see cumulative standings after each round
- Buchholz tiebreaker calculated automatically

### 6. Export or Delete

- Export: Download tournament data as JSON file
- Delete: Permanently remove test tournament (with confirmation)

## API Endpoints

All endpoints are prefixed with `/api/visualizer` and disabled in production.

- `POST /tournaments/create` - Create test tournament
- `GET /tournaments/{id}` - Get tournament data
- `PUT /matches/{id}/result` - Update match result
- `GET /tournaments/{id}/standings` - Get standings
- `GET /tournaments/{id}/export` - Export as JSON
- `DELETE /tournaments/{id}` - Delete tournament
- `GET /tournaments/list` - List all test tournaments

## Troubleshooting

**"Failed to create tournament"**
- Check that Laravel server is running
- Check database connection
- Check that migrations have run

**"Placeholder match not resolving"**
- Complete all matches in the previous round first
- Check PlaceholderMatchAssignmentService logs

**"Cannot delete tournament"**
- Tournament must be marked as test tournament
- Check `is_test_tournament` flag in database

## Development Notes

- All test tournaments have `is_test_tournament = true`
- Test tournaments prefixed with `[VISUALIZER]` in title
- API completely disabled in production environment
- CORS configured to allow localhost access
```

### 4.2 Create Developer Guide

**File**: `chess-backend/public/VISUALIZER_DEVELOPER_GUIDE.md`

```markdown
# Database Tournament Visualizer - Developer Guide

## Architecture

### Backend Components

1. **TournamentVisualizerController** (`app/Http/Controllers/TournamentVisualizerController.php`)
   - Handles all visualizer API requests
   - Production safety checks
   - Delegates to existing services

2. **API Routes** (`routes/api.php`)
   - Prefixed with `/api/visualizer`
   - No authentication required (internal tool)
   - CORS enabled for localhost

3. **Database Marker** (`is_test_tournament` column)
   - Boolean flag on `championships` table
   - Indexed for efficient querying
   - Used for safety checks on delete operations

### Frontend Components

1. **TournamentAPI Class** (JavaScript)
   - Encapsulates all API calls
   - Handles errors and responses
   - Single source of truth for API URLs

2. **State Management**
   - `currentTournament`: Full tournament data object
   - `currentStandings`: Cached standings array
   - Re-fetched after every match update

3. **UI Components**
   - Creation Panel: Preset buttons
   - Management Panel: List/export/delete
   - Visualization: Rounds and matches display
   - Standings: Table and modal views

## Data Flow

```
User Click → API Call → Controller Method → Service Layer → Database
                ↓
         Response JSON → State Update → UI Re-render
```

### Example: Match Result Update

1. User clicks player name in match card
2. `handlePlayerClick()` called with match ID and player ID
3. Confirmation dialog shown
4. `TournamentAPI.updateMatchResult()` called
5. Backend: `TournamentVisualizerController@updateMatchResult`
6. Service: `StandingsCalculatorService->updateStandings()`
7. Service: `PlaceholderMatchAssignmentService->assignPlaceholderMatches()`
8. Response: Full updated tournament data
9. Frontend: `loadTournamentData()` re-renders everything

## Key Design Decisions

### Why Separate Controller?

- Isolates testing code from production APIs
- Easy to disable/remove later
- Different security model (no auth required)

### Why Full Tournament Reload After Each Update?

- Simplicity over optimization
- Ensures UI always in sync with DB
- Backend does all calculations
- Acceptable for internal tool

### Why No Authentication?

- Internal testing tool only
- Blocked in production
- Runs on localhost only
- CORS restrictions provide security

## Adding New Features

### Add New Tournament Preset

1. Update `getTournamentConfigForPlayerCount()` in controller
2. Add button in frontend creation panel
3. Test full tournament flow

### Add New API Endpoint

1. Add method to `TournamentVisualizerController`
2. Add route to `routes/api.php` in visualizer group
3. Add method to `TournamentAPI` class in frontend
4. Add UI trigger (button, etc.)

### Customize Match Display

Modify `renderMatch()` function:
- Add custom CSS classes
- Show additional match metadata
- Change click behavior

## Testing Workflow

1. Create tournament via API
2. Verify data structure in response
3. Complete matches via UI clicks
4. Verify standings calculation
5. Export and inspect JSON
6. Delete tournament

## Database Cleanup

### Manual Cleanup (SQL)

```sql
-- Delete all test tournaments and related data
DELETE FROM championship_matches WHERE championship_id IN
  (SELECT id FROM championships WHERE is_test_tournament = true);

DELETE FROM championship_standings WHERE championship_id IN
  (SELECT id FROM championships WHERE is_test_tournament = true);

DELETE FROM championship_participants WHERE championship_id IN
  (SELECT id FROM championships WHERE is_test_tournament = true);

DELETE FROM championships WHERE is_test_tournament = true;
```

### Artisan Command (Future Enhancement)

```php
php artisan tournament:cleanup-test
```

## Production Deployment

**IMPORTANT**: Visualizer API is automatically disabled in production.

No additional steps needed. The controller checks:

```php
if (config('app.env') === 'production') {
    return response()->json(['error' => 'Disabled in production'], 403);
}
```

## Troubleshooting

### CORS Errors

Check `config/cors.php`:
```php
'allowed_origins' => [
    'http://localhost',
    'http://localhost:8000',
]
```

### Placeholder Matches Not Resolving

1. Check `PlaceholderMatchAssignmentService` logs
2. Verify `determined_by_round` field set correctly
3. Verify standings calculated before assignment

### Standings Not Updating

1. Check `StandingsCalculatorService` logs
2. Verify match status changed to COMPLETED
3. Verify winner_id or result_type_id set correctly
```

---

## 🚀 Phase 5: Deployment & Cleanup

### 5.1 Migration Command

```bash
# Create migration
php artisan make:migration add_is_test_tournament_to_championships

# Edit migration file (see Phase 1.2)

# Run migration
php artisan migrate
```

### 5.2 Test the System

```bash
# 1. Start Laravel server
cd chess-backend
php artisan serve

# 2. Open browser
# Navigate to: http://localhost:8000/tournament_db_visualizer.html

# 3. Create test tournament
# Click "Create 5-Player Tournament"

# 4. Play through matches
# Click player names to mark winners

# 5. Verify standings update

# 6. Export and inspect JSON

# 7. Delete tournament
```

### 5.3 Cleanup Script (Optional)

**File**: `chess-backend/app/Console/Commands/CleanupTestTournaments.php`

```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Championship;
use Illuminate\Support\Facades\DB;

class CleanupTestTournaments extends Command
{
    protected $signature = 'tournament:cleanup-test {--force : Skip confirmation}';
    protected $description = 'Delete all test tournaments created via visualizer';

    public function handle()
    {
        if (!$this->option('force')) {
            if (!$this->confirm('This will delete ALL test tournaments. Continue?')) {
                $this->info('Aborted.');
                return;
            }
        }

        DB::beginTransaction();

        try {
            $count = Championship::where('is_test_tournament', true)
                ->orWhere('title', 'LIKE', '[TEST]%')
                ->orWhere('title', 'LIKE', '[VISUALIZER]%')
                ->count();

            if ($count === 0) {
                $this->info('No test tournaments found.');
                return;
            }

            // Delete related data first
            $championships = Championship::where('is_test_tournament', true)
                ->orWhere('title', 'LIKE', '[TEST]%')
                ->orWhere('title', 'LIKE', '[VISUALIZER]%')
                ->get();

            foreach ($championships as $championship) {
                $championship->matches()->delete();
                $championship->standings()->delete();
                $championship->participants()->delete();
                $championship->delete();
            }

            DB::commit();

            $this->info("✅ Deleted {$count} test tournaments and related data.");

        } catch (\Exception $e) {
            DB::rollBack();
            $this->error("Failed to cleanup: {$e->getMessage()}");
        }
    }
}
```

---

## 📊 Summary

### Files Created/Modified

**Backend (7 files)**:
1. `app/Http/Controllers/TournamentVisualizerController.php` (NEW)
2. `database/migrations/YYYY_MM_DD_add_is_test_tournament.php` (NEW)
3. `routes/api.php` (MODIFIED - add visualizer routes)
4. `config/cors.php` (MODIFIED - add localhost)
5. `tests/Feature/TournamentVisualizerTest.php` (NEW)
6. `app/Console/Commands/CleanupTestTournaments.php` (NEW - optional)

**Frontend (3 files)**:
7. `public/tournament_db_visualizer.html` (NEW)
8. `public/VISUALIZER_USER_GUIDE.md` (NEW)
9. `public/VISUALIZER_DEVELOPER_GUIDE.md` (NEW)

### API Endpoints Created

- `POST /api/visualizer/tournaments/create`
- `GET /api/visualizer/tournaments/{id}`
- `PUT /api/visualizer/matches/{matchId}/result`
- `GET /api/visualizer/tournaments/{id}/standings`
- `GET /api/visualizer/tournaments/{id}/export`
- `DELETE /api/visualizer/tournaments/{id}`
- `GET /api/visualizer/tournaments/list`

### Key Features

✅ One-click tournament creation (4 presets)
✅ Real-time database updates
✅ Click-to-win match recording
✅ Automatic standings calculation
✅ Placeholder match resolution
✅ Round-by-round standings view
✅ JSON export functionality
✅ Test tournament management
✅ Production safety checks
✅ Comprehensive error handling

### Security

- ✅ Disabled in production (ENV check)
- ✅ CORS restricted to localhost
- ✅ Test tournament marker for safety
- ✅ Delete confirmation dialogs
- ✅ Only affects test tournaments

### Testing Coverage

- ✅ Backend PHPUnit tests
- ✅ Frontend manual test checklist
- ✅ API endpoint validation
- ✅ Error scenario handling
- ✅ Production blocking verification

---

## 🎯 Next Steps for Your Developer

1. **Phase 1 (Backend)**: Create controller, migration, routes (~2-3 hours)
2. **Phase 2 (Frontend)**: Create HTML file with API client (~3-4 hours)
3. **Phase 3 (Testing)**: Write tests and validate all features (~2 hours)
4. **Phase 4 (Documentation)**: Create user and developer guides (~1 hour)
5. **Phase 5 (Deployment)**: Run migrations, test system (~1 hour)

**Total Estimated Time**: 9-11 hours

---

## 📞 Support

For questions or issues:
1. Check browser console for JavaScript errors
2. Check Laravel logs: `storage/logs/laravel.log`
3. Verify CORS configuration
4. Ensure database migrations ran successfully
5. Test API endpoints directly with Postman/Insomnia

---

**End of Plan**
