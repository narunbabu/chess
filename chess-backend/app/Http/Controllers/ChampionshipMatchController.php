<?php

namespace App\Http\Controllers;

use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\Game;
use App\Models\Invitation;
use App\Services\MatchSchedulerService;
use App\Services\SwissPairingService;
use App\Services\EliminationBracketService;
use App\Services\StandingsCalculatorService;
use App\Services\TournamentGenerationService;
use App\Services\PlaceholderMatchAssignmentService;
use App\Services\GameRoomService;
use App\Jobs\GenerateNextRoundJob;
use App\Enums\ChampionshipMatchStatus;
use App\Enums\ChampionshipResultType;
use App\ValueObjects\TournamentConfig;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class ChampionshipMatchController extends Controller
{
    public function __construct(
        private MatchSchedulerService $scheduler,
        private SwissPairingService $swissService,
        private EliminationBracketService $eliminationService,
        private StandingsCalculatorService $standingsCalculator,
        private TournamentGenerationService $tournamentGenerator,
        private PlaceholderMatchAssignmentService $placeholderAssignment,
        private GameRoomService $gameRoomService
    ) {}

    /**
     * Get matches for a championship
     */
    public function index(Request $request, Championship $championship): JsonResponse
    {
        $this->authorize('view', $championship);

        $matches = $championship->matches()
            ->with(['player1', 'player2', 'winner', 'game'])
            ->when($request->round, function ($query, $round) {
                $query->where('round_number', $round);
            })
            ->when($request->status, function ($query, $status) {
                // Convert status string to status_id for querying
                $statusId = \App\Models\ChampionshipMatchStatus::getIdByCode($status);
                $query->where('status_id', $statusId);
            })
            ->when($request->player_id, function ($query, $playerId) {
                $query->where(function ($q) use ($playerId) {
                    $q->where('player1_id', $playerId)
                      ->orWhere('player2_id', $playerId);
                });
            })
            ->orderBy('round_number')
            ->orderBy('id')
            ->paginate($request->per_page ?? 15);

        return response()->json([
            'matches' => $matches,
            'summary' => $this->scheduler->getSchedulingSummary($championship),
        ]);
    }

    /**
     * Get a specific match
     */
    public function show(Championship $championship, ChampionshipMatch $match): JsonResponse
    {
        $this->authorize('view', $championship);

        if ($match->championship_id !== $championship->id) {
            return response()->json(['error' => 'Match not found in this championship'], 404);
        }

        $match->load(['player1', 'player2', 'winner', 'game', 'championship']);

        return response()->json(['match' => $match]);
    }

    /**
     * Get user's matches in championships
     */
    public function myMatches(Request $request): JsonResponse
    {
        $user = Auth::user();

        $matches = ChampionshipMatch::where(function ($query) use ($user) {
                $query->where('player1_id', $user->id)
                      ->orWhere('player2_id', $user->id);
            })
            ->with(['championship', 'player1', 'player2', 'winner', 'game'])
            ->when($request->status, function ($query, $status) {
                // Convert status string to status_id for querying
                $statusId = \App\Models\ChampionshipMatchStatus::getIdByCode($status);
                $query->where('status_id', $statusId);
            })
            ->when($request->championship_id, function ($query, $championshipId) {
                $query->where('championship_id', $championshipId);
            })
            ->orderBy('deadline', 'asc')
            ->paginate($request->per_page ?? 15);

        return response()->json(['matches' => $matches]);
    }

    /**
     * Create a game for a championship match
     */
    public function createGame(Request $request, Championship $championship, ChampionshipMatch $match): JsonResponse
    {
        $this->authorize('participate', $championship);

        if ($match->championship_id !== $championship->id) {
            return response()->json(['error' => 'Match not found in this championship'], 404);
        }

        $user = Auth::user();
        if (!$match->hasPlayer($user->id)) {
            return response()->json(['error' => 'You are not a participant in this match'], 403);
        }

        if ($match->game_id) {
            return response()->json(['error' => 'Game already exists for this match'], 400);
        }

        if ($match->getStatusEnum()->isFinished()) {
            return response()->json(['error' => 'Match is already finished'], 400);
        }

        $request->validate([
            'time_control' => 'required|string|in:blitz,rapid,classical',
            'color' => ['required', 'string', 'in:white,black', Rule::unique('games')->where(function ($query) use ($match) {
                return $query->where('championship_match_id', $match->id);
            })],
        ]);

        try {
            DB::transaction(function () use ($request, $match, $user) {
                $game = Game::create([
                    'white_player_id' => $request->color === 'white' ? $user->id : ($match->player1_id === $user->id ? $match->player2_id : $match->player1_id),
                    'black_player_id' => $request->color === 'black' ? $user->id : ($match->player1_id === $user->id ? $match->player2_id : $match->player1_id),
                    'time_control' => $request->time_control,
                    'status' => 'waiting',
                    'championship_match_id' => $match->id,
                ]);

                $match->update([
                    'game_id' => $game->id,
                    // Keep status as PENDING/SCHEDULED until game actually starts (becomes active)
                    // Status will be updated to IN_PROGRESS when both players connect
                ]);

                Log::info("Created game for championship match", [
                    'match_id' => $match->id,
                    'game_id' => $game->id,
                    'user_id' => $user->id,
                ]);
            });

            $match->load('game');

            return response()->json([
                'message' => 'Game created successfully',
                'match' => $match,
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to create game for match", [
                'match_id' => $match->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['error' => 'Failed to create game'], 500);
        }
    }

    /**
     * Report match result
     */
    public function reportResult(Request $request, Championship $championship, ChampionshipMatch $match): JsonResponse
    {
        $this->authorize('participate', $championship);

        if ($match->championship_id !== $championship->id) {
            return response()->json(['error' => 'Match not found in this championship'], 404);
        }

        $user = Auth::user();
        if (!$match->hasPlayer($user->id)) {
            return response()->json(['error' => 'You are not a participant in this match'], 403);
        }

        if ($match->getStatusEnum()->isFinished()) {
            return response()->json(['error' => 'Match is already finished'], 400);
        }

        $request->validate([
            'result' => 'required|string|in:win,draw,loss',
            'opponent_agreed' => 'boolean',
        ]);

        try {
            $result = $request->result;
            $opponentId = $match->getOpponent($user->id)?->id;

            if (!$opponentId) {
                return response()->json(['error' => 'Opponent not found'], 404);
            }

            // For simplicity, auto-confirm results (in reality, you'd want opponent confirmation)
            $winnerId = match ($result) {
                'win' => $user->id,
                'loss' => $opponentId,
                'draw' => null,
                default => null,
            };

            $resultType = match ($result) {
                'win' => ($match->player1_id === $user->id)
                    ? ChampionshipResultType::NORMAL_WIN_PLAYER1
                    : ChampionshipResultType::NORMAL_WIN_PLAYER2,
                'draw' => ChampionshipResultType::DRAW,
                'loss' => ($match->player1_id === $user->id)
                    ? ChampionshipResultType::NORMAL_WIN_PLAYER2
                    : ChampionshipResultType::NORMAL_WIN_PLAYER1,
                default => null,
            };

            DB::transaction(function () use ($match, $winnerId, $resultType) {
                $match->update([
                    'winner_id' => $winnerId,
                    'result_type' => $resultType,
                    'status' => ChampionshipMatchStatus::COMPLETED,
                    'completed_at' => now(),
                ]);

                // Update standings if Swiss tournament
                if ($match->championship->getFormatEnum()->isSwiss()) {
                    $this->standingsCalculator->updateStandings($match->championship);
                }

                // Check if next round can be generated
                if ($this->scheduler->isRoundComplete($match->championship)) {
                    GenerateNextRoundJob::dispatch($match->championship);
                }
            });

            Log::info("Match result reported", [
                'match_id' => $match->id,
                'reporter_id' => $user->id,
                'result' => $result,
                'winner_id' => $winnerId,
            ]);

            $match->load(['player1', 'player2', 'winner']);

            return response()->json([
                'message' => 'Match result recorded successfully',
                'match' => $match,
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to record match result", [
                'match_id' => $match->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['error' => 'Failed to record result'], 500);
        }
    }

    /**
     * Schedule next round (admin only)
     */
    public function scheduleNextRound(Request $request, Championship $championship): JsonResponse
    {
        $this->authorize('manage', $championship);

        $request->validate([
            'force' => 'boolean',
            'schedule_time' => 'nullable|date|after:now',
        ]);

        try {
            if ($request->schedule_time) {
                // Schedule for specific time
                GenerateNextRoundJob::dispatch($championship, $request->force ?? false)
                    ->delay($request->schedule_time);

                return response()->json([
                    'message' => 'Next round scheduled successfully',
                    'scheduled_for' => $request->schedule_time,
                ]);
            } else {
                // Schedule immediately
                $nextRoundNumber = $this->scheduler->getNextRoundNumber($championship);
                $matchesScheduled = $this->scheduler->scheduleNextRound($championship);

                return response()->json([
                    'message' => 'Next round generated successfully',
                    'round_number' => $nextRoundNumber,
                    'matches_scheduled' => $matchesScheduled,
                    'summary' => $this->scheduler->getSchedulingSummary($championship),
                ]);
            }
        } catch (\Exception $e) {
            Log::error("Failed to schedule next round", [
                'championship_id' => $championship->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * Get pairings preview (admin only)
     */
    public function getPairingsPreview(Request $request, Championship $championship): JsonResponse
    {
        $this->authorize('manage', $championship);

        $roundNumber = $request->round ?? $this->scheduler->getNextRoundNumber($championship);

        try {
            $format = $championship->getFormatEnum();
            $pairings = [];

            switch ($format->value) {
                case 'swiss_only':
                case 'hybrid':
                    if ($roundNumber <= $championship->swiss_rounds || !$format->isHybrid()) {
                        $pairings = $this->swissService->generatePairings($championship, $roundNumber);
                    } else {
                        $pairings = $this->eliminationService->generateEliminationPairings($championship, $roundNumber);
                    }
                    break;
                case 'elimination_only':
                    $pairings = $this->eliminationService->generateEliminationPairings($championship, $roundNumber);
                    break;
            }

            // Filter out bye pairings and load user data for regular matches only
            $regularPairings = collect($pairings)->filter(function ($pairing) {
                return !($pairing['is_bye'] ?? false);
            });

            $pairingsWithUsers = $regularPairings->map(function ($pairing) {
                $player1 = \App\Models\User::find($pairing['player1_id']);
                $player2 = \App\Models\User::find($pairing['player2_id']);

                return array_merge($pairing, [
                    'player1' => $player1,
                    'player2' => $player2,
                ]);
            });

            return response()->json([
                'round_number' => $roundNumber,
                'pairings' => $pairingsWithUsers,
                'summary' => $this->swissService->getPairingsSummary($championship, $pairingsWithUsers->toArray()),
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to generate pairings preview", [
                'championship_id' => $championship->id,
                'round' => $roundNumber,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * Get bracket visualization (elimination tournaments)
     */
    public function getBracket(Championship $championship): JsonResponse
    {
        $this->authorize('view', $championship);

        if (!$championship->getFormatEnum()->isElimination()) {
            return response()->json(['error' => 'Bracket not available for this format'], 400);
        }

        $bracket = $this->eliminationService->getBracketVisualization($championship);

        return response()->json([
            'bracket' => $bracket,
            'championship' => $championship->load('participants.user'),
        ]);
    }

    /**
     * Reschedule match (admin only)
     */
    public function reschedule(Request $request, Championship $championship, ChampionshipMatch $match): JsonResponse
    {
        $this->authorize('manage', $championship);

        if ($match->championship_id !== $championship->id) {
            return response()->json(['error' => 'Match not found in this championship'], 404);
        }

        if ($match->getStatusEnum()->isFinished()) {
            return response()->json(['error' => 'Cannot reschedule finished match'], 400);
        }

        $request->validate([
            'scheduled_at' => 'required|date|after:now',
            'deadline' => 'required|date|after:scheduled_at',
        ]);

        try {
            $match->update([
                'scheduled_at' => $request->scheduled_at,
                'deadline' => $request->deadline,
            ]);

            Log::info("Match rescheduled", [
                'match_id' => $match->id,
                'scheduled_at' => $request->scheduled_at,
                'deadline' => $request->deadline,
            ]);

            return response()->json([
                'message' => 'Match rescheduled successfully',
                'match' => $match->fresh(),
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to reschedule match", [
                'match_id' => $match->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['error' => 'Failed to reschedule match'], 500);
        }
    }

    /**
     * Get match statistics
     */
    public function getStats(Championship $championship): JsonResponse
    {
        $this->authorize('view', $championship);

        $totalMatches = $championship->matches()->count();
        $completedMatches = $championship->matches()
            ->completed() // Use model scope instead of direct status query
            ->count();

        $pendingMatches = $championship->matches()
            ->pending() // Use model scope instead of direct status query
            ->count();

        $activeMatches = $championship->matches()
            ->inProgress() // Use model scope instead of direct status query
            ->count();

        $expiredMatches = $championship->matches()
            ->expired()
            ->count();

        $avgCompletionTime = $championship->matches()
            ->completed() // Use model scope instead of direct status query
            ->whereNotNull('scheduled_at')
            ->whereNotNull('completed_at')
            ->selectRaw('AVG(TIMESTAMPDIFF(MINUTE, scheduled_at, completed_at)) as avg_minutes')
            ->value('avg_minutes');

        return response()->json([
            'total_matches' => $totalMatches,
            'completed_matches' => $completedMatches,
            'pending_matches' => $pendingMatches,
            'active_matches' => $activeMatches,
            'expired_matches' => $expiredMatches,
            'completion_rate' => $totalMatches > 0 ? round(($completedMatches / $totalMatches) * 100, 1) : 0,
            'average_completion_time_minutes' => $avgCompletionTime ? round($avgCompletionTime, 1) : null,
        ]);
    }

    /**
     * Send invitations for a championship match
     */
    public function sendInvitation(Request $request, Championship $championship, ChampionshipMatch $match): JsonResponse
    {
        $this->authorize('manage', $championship);

        try {
            // Validate match belongs to championship
            if ($match->championship_id !== $championship->id) {
                return response()->json([
                    'error' => 'Match does not belong to this championship'
                ], 400);
            }

            // Check match status
            if ($match->status !== ChampionshipMatchStatus::SCHEDULED->value) {
                return response()->json([
                    'error' => 'Only scheduled matches can have invitations sent'
                ], 400);
            }

            // Check if invitations already exist
            $existingInvitations = \App\Models\Invitation::where('championship_match_id', $match->id)
                ->where('status', 'pending')
                ->count();

            if ($existingInvitations > 0) {
                return response()->json([
                    'error' => 'Invitations already exist for this match'
                ], 400);
            }

            // Use the championship match invitation service
            $service = new \App\Services\ChampionshipMatchInvitationService();

            $result = $service->sendMatchInvitations($match, [
                'priority' => 'normal',
                'auto_generated' => false
            ]);

            if ($result['success']) {
                return response()->json([
                    'message' => 'Invitations sent successfully',
                    'invitations_sent' => $result['invitations_sent'] ?? 0,
                    'match_id' => $match->id,
                    'players_notified' => $result['players_notified'] ?? []
                ]);
            } else {
                return response()->json([
                    'error' => $result['error'] ?? 'Failed to send invitations'
                ], 400);
            }

        } catch (\Exception $e) {
            Log::error('Failed to send championship match invitations', [
                'championship_id' => $championship->id,
                'match_id' => $match->id,
                'user_id' => Auth::id(),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to send invitations: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Generate full tournament (all rounds at once)
     * POST /api/championships/{id}/generate-full-tournament
     */
    public function generateFullTournament(Request $request, Championship $championship): JsonResponse
    {
        $this->authorize('manage', $championship);

        try {
            // Validate request
            $validated = $request->validate([
                'preset' => 'nullable|string|in:small_tournament,medium_tournament,large_tournament,custom',
                'config' => 'nullable|array',
                'config.mode' => 'nullable|string',
                'config.round_structure' => 'nullable|array',
                'config.avoid_repeat_matches' => 'nullable|boolean',
                'config.color_balance_strict' => 'nullable|boolean',
                'config.bye_handling' => 'nullable|string',
                'config.bye_points' => 'nullable|numeric',
                'force_regenerate' => 'nullable|boolean',
            ]);

            // Check if already generated
            if ($championship->isTournamentGenerated() && !($validated['force_regenerate'] ?? false)) {
                return response()->json([
                    'error' => 'Tournament has already been generated. Use force_regenerate=true to regenerate.',
                    'tournament_generated_at' => $championship->tournament_generated_at,
                ], 400);
            }

            // Get or create configuration
            $config = null;
            if (isset($validated['config'])) {
                $config = TournamentConfig::fromArray($validated['config']);
            } elseif (isset($validated['preset'])) {
                $participantCount = $championship->participants()->count();
                $config = TournamentConfig::fromPreset(
                    $validated['preset'],
                    $championship->total_rounds ?? 5,
                    $participantCount
                );
            }

            // Generate tournament
            if ($validated['force_regenerate'] ?? false) {
                $summary = $this->tournamentGenerator->regenerateTournament($championship, $config);
            } else {
                $summary = $this->tournamentGenerator->generateFullTournament($championship, $config);
            }

            return response()->json([
                'message' => 'Tournament generated successfully',
                'summary' => $summary,
                'championship' => $championship->fresh(),
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to generate full tournament", [
                'championship_id' => $championship->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'error' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Preview tournament structure before generating
     * GET /api/championships/{id}/tournament-preview
     */
    public function previewTournamentStructure(Request $request, Championship $championship): JsonResponse
    {
        $this->authorize('manage', $championship);

        try {
            // Validate request
            $validated = $request->validate([
                'preset' => 'nullable|string|in:small_tournament,medium_tournament,large_tournament,custom',
                'config' => 'nullable|array',
            ]);

            // Get or create configuration
            $config = null;
            if (isset($validated['config'])) {
                $config = TournamentConfig::fromArray($validated['config']);
            } elseif (isset($validated['preset'])) {
                $participantCount = $championship->participants()->count();
                $config = TournamentConfig::fromPreset(
                    $validated['preset'],
                    $championship->total_rounds ?? 5,
                    $participantCount
                );
            }

            $preview = $this->tournamentGenerator->previewTournamentStructure($championship, $config);

            return response()->json([
                'preview' => $preview,
                'championship' => $championship,
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to preview tournament structure", [
                'championship_id' => $championship->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Update tournament configuration
     * PUT /api/championships/{id}/tournament-config
     */
    public function updateTournamentConfig(Request $request, Championship $championship): JsonResponse
    {
        $this->authorize('manage', $championship);

        try {
            // Validate configuration
            $validated = $request->validate([
                'preset' => 'nullable|string|in:small_tournament,medium_tournament,large_tournament,custom',
                'config' => 'required|array',
                'config.mode' => 'required|string',
                'config.round_structure' => 'required|array',
                'config.avoid_repeat_matches' => 'nullable|boolean',
                'config.color_balance_strict' => 'nullable|boolean',
                'config.bye_handling' => 'nullable|string',
                'config.bye_points' => 'nullable|numeric',
            ]);

            $config = TournamentConfig::fromArray($validated['config']);

            // Validate
            $errors = $config->validate();
            if (!empty($errors)) {
                return response()->json([
                    'error' => 'Invalid configuration',
                    'validation_errors' => $errors,
                ], 400);
            }

            // Save configuration
            $championship->setTournamentConfig($config);
            $championship->save();

            return response()->json([
                'message' => 'Tournament configuration updated successfully',
                'config' => $config->toArray(),
                'championship' => $championship->fresh(),
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to update tournament configuration", [
                'championship_id' => $championship->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Get tournament configuration
     * GET /api/championships/{id}/tournament-config
     */
    public function getTournamentConfig(Championship $championship): JsonResponse
    {
        $this->authorize('view', $championship);

        $config = $championship->getTournamentConfig();

        if (!$config) {
            // Generate default config
            $config = $championship->getOrCreateTournamentConfig();
        }

        return response()->json([
            'config' => $config->toArray(),
            'tournament_generated' => $championship->isTournamentGenerated(),
            'tournament_generated_at' => $championship->tournament_generated_at,
        ]);
    }

    /**
     * Delete a specific match (admin only)
     * DELETE /api/championships/{championship}/matches/{match}
     */
    public function destroy(Championship $championship, ChampionshipMatch $match): JsonResponse
    {
        $this->authorize('manage', $championship);

        if ($match->championship_id !== $championship->id) {
            return response()->json(['error' => 'Match not found in this championship'], 404);
        }

        try {
            DB::transaction(function () use ($match, $championship) {
                // Delete associated game if exists
                if ($match->game_id) {
                    Game::find($match->game_id)?->delete();
                }

                // Delete the match
                $match->delete();

                // Recalculate standings if Swiss tournament
                if ($championship->getFormatEnum()->isSwiss()) {
                    $this->standingsCalculator->updateStandings($championship);
                }

                Log::info("Match deleted", [
                    'match_id' => $match->id,
                    'championship_id' => $championship->id,
                    'user_id' => Auth::id(),
                ]);
            });

            return response()->json([
                'message' => 'Match deleted successfully',
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to delete match", [
                'match_id' => $match->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['error' => 'Failed to delete match'], 500);
        }
    }

    /**
     * Delete all matches in a championship (admin only)
     * DELETE /api/championships/{championship}/matches
     */
    public function destroyAll(Championship $championship): JsonResponse
    {
        $this->authorize('manage', $championship);

        try {
            $deletedCount = DB::transaction(function () use ($championship) {
                // Get all matches with their game IDs
                $matches = $championship->matches()->with('game')->get();

                // Delete all associated games (using game_id from matches)
                $gameIds = $matches->pluck('game_id')->filter();
                if ($gameIds->isNotEmpty()) {
                    Game::whereIn('id', $gameIds)->delete();
                }

                // Delete all matches
                $deletedCount = $championship->matches()->delete();

                // Reset tournament generation status
                $championship->update([
                    'tournament_generated' => false, // Reset the boolean flag
                    'tournament_generated_at' => null,
                    'current_round' => 0,
                ]);

                // Clear all standings
                $championship->standings()->delete();

                Log::info("All matches deleted from championship", [
                    'championship_id' => $championship->id,
                    'matches_deleted' => $deletedCount,
                    'user_id' => Auth::id(),
                ]);

                return $deletedCount;
            });

            return response()->json([
                'message' => 'All matches deleted successfully',
                'matches_deleted' => $deletedCount,
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to delete all matches", [
                'championship_id' => $championship->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['error' => 'Failed to delete all matches'], 500);
        }
    }

    /**
     * Get tournament coverage analysis for top-K players
     * GET /api/championships/{id}/coverage-analysis
     */
    public function getCoverageAnalysis(Request $request, Championship $championship): JsonResponse
    {
        $this->authorize('manage', $championship);

        try {
            // Validate request
            $validated = $request->validate([
                'top_k' => 'nullable|integer|min:2|max:6',
            ]);

            $topK = $validated['top_k'] ?? 3;

            // Get coverage analysis
            $coverage = $this->placeholderAssignment->getTopKCoverageAnalysis($championship, $topK);

            // If tournament has generated matches, also validate existing coverage
            if ($championship->isTournamentGenerated()) {
                $tournamentCoverage = $this->tournamentGenerator->validateTournamentCoverage($championship);
                $coverage['tournament_validation'] = $tournamentCoverage;
            }

            return response()->json([
                'coverage' => $coverage,
                'championship' => [
                    'id' => $championship->id,
                    'title' => $championship->title,
                    'participants_count' => $championship->participants()->count(),
                    'tournament_generated' => $championship->isTournamentGenerated(),
                ],
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to get coverage analysis", [
                'championship_id' => $championship->id,
                'top_k' => $topK ?? 3,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Assign round-robin placeholder matches for top-K coverage
     * POST /api/championships/{id}/assign-round-robin-coverage
     */
    public function assignRoundRobinCoverage(Request $request, Championship $championship): JsonResponse
    {
        $this->authorize('manage', $championship);

        try {
            // Validate request
            $validated = $request->validate([
                'top_k' => 'required|integer|min:2|max:6',
                'round_numbers' => 'required|array|min:1',
                'round_numbers.*' => 'integer|min:1',
            ]);

            $topK = $validated['top_k'];
            $roundNumbers = $validated['round_numbers'];

            // Assign round-robin placeholders
            $assignment = $this->placeholderAssignment->assignRoundRobinPlaceholders(
                $championship,
                $topK,
                $roundNumbers
            );

            return response()->json([
                'assignment' => $assignment,
                'championship' => [
                    'id' => $championship->id,
                    'title' => $championship->title,
                ],
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to assign round-robin coverage", [
                'championship_id' => $championship->id,
                'top_k' => $validated['top_k'] ?? null,
                'round_numbers' => $validated['round_numbers'] ?? null,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Send play challenge for championship match (like regular Challenge feature)
     * POST /api/championships/{championship}/matches/{match}/challenge
     */
    public function sendChallenge(Request $request, Championship $championship, ChampionshipMatch $match): JsonResponse
    {
        try {
            $user = Auth::user();

            // Verify user is a participant in this match
            if ($match->player1_id !== $user->id && $match->player2_id !== $user->id) {
                return response()->json([
                    'success' => false,
                    'error' => 'You are not a participant in this match'
                ], 403);
            }

            // Verify match doesn't already have a game
            if ($match->game_id) {
                return response()->json([
                    'success' => false,
                    'error' => 'This match already has a game'
                ], 400);
            }

            // Get opponent
            $opponentId = $match->player1_id === $user->id ? $match->player2_id : $match->player1_id;
            $opponent = \App\Models\User::find($opponentId);

            if (!$opponent) {
                return response()->json([
                    'success' => false,
                    'error' => 'Opponent not found'
                ], 404);
            }

            // Validate request
            $validated = $request->validate([
                'color_preference' => 'nullable|string|in:white,black,random',
                'time_control' => 'nullable|string|in:bullet,blitz,rapid,classical'
            ]);

            $colorPreference = $validated['color_preference'] ?? 'random';
            $timeControl = $validated['time_control'] ?? ($championship->time_control ?? 'blitz');

            // Create invitation similar to lobby system to send WebSocket notification
            // This works like the regular Challenge feature but for championship matches
            $colorPreference = $colorPreference === 'random' ? (random_int(0, 1) ? 'white' : 'black') : $colorPreference;

            $invitation = Invitation::create([
                'inviter_id' => $user->id,
                'invited_id' => $opponentId,
                'status' => 'pending',
                'inviter_preferred_color' => $colorPreference,
                'type' => 'championship_match',
                'championship_match_id' => $match->id
            ]);

            // Broadcast invitation sent event to recipient in real-time (same as lobby)
            $freshInvitation = $invitation->fresh(['inviter', 'invited']);
            Log::info('📨 Broadcasting Championship InvitationSent event', [
                'invitation_id' => $freshInvitation->id,
                'championship_id' => $championship->id,
                'match_id' => $match->id,
                'invited_user_id' => $opponentId,
                'channel' => "App.Models.User.{$opponentId}",
                'event' => 'invitation.sent'
            ]);
            broadcast(new \App\Events\InvitationSent($freshInvitation));
            return response()->json([
                'success' => true,
                'message' => "Challenge sent to {$opponent->name}",
                'match_id' => $match->id,
                'opponent' => [
                    'id' => $opponent->id,
                    'name' => $opponent->name
                ],
                'settings' => [
                    'color_preference' => $colorPreference,
                    'time_control' => $timeControl
                ],
                'invitation' => $freshInvitation
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to send championship match challenge", [
                'championship_id' => $championship->id,
                'match_id' => $match->id,
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to send challenge: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Send request to opponent to start/resume the game
     * POST /api/championships/{championship}/matches/{match}/notify-start
     */
    public function notifyGameStart(Championship $championship, ChampionshipMatch $match): JsonResponse
    {
        try {
            $user = Auth::user();

            // Verify user is a participant in this match
            if ($match->player1_id !== $user->id && $match->player2_id !== $user->id) {
                return response()->json([
                    'success' => false,
                    'error' => 'You are not a participant in this match'
                ], 403);
            }

            // Verify match has a game
            if (!$match->game_id) {
                return response()->json([
                    'success' => false,
                    'error' => 'No game found for this match'
                ], 404);
            }

            // Get opponent
            $opponentId = $match->player1_id === $user->id ? $match->player2_id : $match->player1_id;
            $opponent = \App\Models\User::find($opponentId);

            if (!$opponent) {
                return response()->json([
                    'success' => false,
                    'error' => 'Opponent not found'
                ], 404);
            }

            // Auto-delete ALL old pending requests for this match (expired or not)
            // This allows new requests to replace old ones
            $deletedCount = \App\Models\ChampionshipGameResumeRequest::where('championship_match_id', $match->id)
                ->where('status', 'pending')
                ->delete();

            if ($deletedCount > 0) {
                Log::info('🧹 Deleted old pending requests', [
                    'championship_match_id' => $match->id,
                    'deleted_count' => $deletedCount
                ]);
            }

            // Create resume request (expires in 5 minutes)
            $request = \App\Models\ChampionshipGameResumeRequest::create([
                'championship_match_id' => $match->id,
                'game_id' => $match->game_id,
                'requester_id' => $user->id,
                'recipient_id' => $opponentId,
                'status' => 'pending',
                'expires_at' => now()->addMinutes(5),
            ]);

            // Broadcast request to opponent via WebSocket
            broadcast(new \App\Events\ChampionshipGameResumeRequestSent(
                $request->load(['requester', 'recipient', 'championshipMatch', 'game'])
            ));

            Log::info('🎮 Championship game resume request sent', [
                'championship_id' => $championship->id,
                'match_id' => $match->id,
                'game_id' => $match->game_id,
                'request_id' => $request->id,
                'requester_id' => $user->id,
                'recipient_id' => $opponentId
            ]);

            return response()->json([
                'success' => true,
                'message' => "Request sent to {$opponent->name}. Waiting for response...",
                'request' => $request->load(['requester', 'recipient'])
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to send game resume request", [
                'championship_id' => $championship->id,
                'match_id' => $match->id,
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to send request: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Accept a resume request
     * POST /api/championships/{championship}/matches/{match}/resume-request/accept
     */
    public function acceptResumeRequest(Championship $championship, ChampionshipMatch $match): JsonResponse
    {
        try {
            $user = Auth::user();

            // Find the pending request for this match where user is recipient
            $request = \App\Models\ChampionshipGameResumeRequest::where('championship_match_id', $match->id)
                ->where('recipient_id', $user->id)
                ->where('status', 'pending')
                ->where('expires_at', '>', now())
                ->first();

            if (!$request) {
                return response()->json([
                    'success' => false,
                    'error' => 'No pending request found'
                ], 404);
            }

            // Accept the request
            $request->accept();

            // Handle the underlying game if it exists
            if ($match->game_id) {
                $game = \App\Models\Game::find($match->game_id);
                if ($game) {
                    if ($game->status === 'paused') {
                        // Resume paused game
                        $this->gameRoomService->resumeGameFromInactivity($game->id, $user->id);
                        Log::info('Game resumed from championship acceptance', [
                            'game_id' => $game->id,
                            'match_id' => $match->id,
                            'user_id' => $user->id,
                            'previous_status' => 'paused'
                        ]);
                    } elseif ($game->status === 'waiting') {
                        // Activate waiting game - both players are now ready
                        $game->update([
                            'status' => 'active',
                            'last_heartbeat_at' => now(),
                            'turn' => 'white', // White always starts
                            'last_move_time' => now()
                        ]);
                        Log::info('Game activated from championship acceptance', [
                            'game_id' => $game->id,
                            'match_id' => $match->id,
                            'user_id' => $user->id,
                            'previous_status' => 'waiting'
                        ]);
                    }
                }
            }

            // Broadcast to requester that request was accepted
            broadcast(new \App\Events\ChampionshipGameResumeRequestAccepted(
                $request->load(['requester', 'recipient', 'championshipMatch', 'game'])
            ));

            Log::info('✅ Championship game resume request accepted', [
                'championship_id' => $championship->id,
                'match_id' => $match->id,
                'game_id' => $match->game_id,
                'request_id' => $request->id,
                'accepter_id' => $user->id
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Request accepted. Starting game...',
                'game_id' => $match->game_id
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to accept resume request", [
                'championship_id' => $championship->id,
                'match_id' => $match->id,
                'user_id' => Auth::id(),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to accept request: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Decline a resume request
     * POST /api/championships/{championship}/matches/{match}/resume-request/decline
     */
    public function declineResumeRequest(Championship $championship, ChampionshipMatch $match): JsonResponse
    {
        try {
            $user = Auth::user();

            // Find the pending request for this match where user is recipient
            $request = \App\Models\ChampionshipGameResumeRequest::where('championship_match_id', $match->id)
                ->where('recipient_id', $user->id)
                ->where('status', 'pending')
                ->where('expires_at', '>', now())
                ->first();

            if (!$request) {
                return response()->json([
                    'success' => false,
                    'error' => 'No pending request found'
                ], 404);
            }

            // Decline the request
            $request->decline();

            // Broadcast to requester that request was declined
            broadcast(new \App\Events\ChampionshipGameResumeRequestDeclined(
                $request->load(['requester', 'recipient', 'championshipMatch', 'game'])
            ));

            Log::info('❌ Championship game resume request declined', [
                'championship_id' => $championship->id,
                'match_id' => $match->id,
                'game_id' => $match->game_id,
                'request_id' => $request->id,
                'decliner_id' => $user->id
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Request declined'
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to decline resume request", [
                'championship_id' => $championship->id,
                'match_id' => $match->id,
                'user_id' => Auth::id(),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to decline request: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Check if a player can play a specific match (round progression check)
     */
    public function canPlay(Championship $championship, ChampionshipMatch $match): JsonResponse
    {
        try {
            $user = Auth::user();
            if (!$user) {
                return response()->json([
                    'canPlay' => false,
                    'reason' => 'Not authenticated'
                ], 401);
            }

            $result = $match->canPlayerPlay($user->id);

            return response()->json($result);
        } catch (\Exception $e) {
            Log::error("Failed to check if player can play match", [
                'championship_id' => $championship->id,
                'match_id' => $match->id,
                'user_id' => Auth::id(),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'canPlay' => false,
                'reason' => 'Error checking eligibility: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get leaderboard for a specific round
     */
    public function getRoundLeaderboard(Championship $championship, int $round): JsonResponse
    {
        try {
            $this->authorize('view', $championship);

            $leaderboard = ChampionshipMatch::getRoundLeaderboard($championship->id, $round);

            return response()->json([
                'championship_id' => $championship->id,
                'round' => $round,
                'leaderboard' => $leaderboard
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to get round leaderboard", [
                'championship_id' => $championship->id,
                'round' => $round,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to fetch leaderboard: ' . $e->getMessage()
            ], 500);
        }
    }
}
