<?php

namespace App\Http\Controllers;

use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\Game;
use App\Services\MatchSchedulerService;
use App\Services\SwissPairingService;
use App\Services\EliminationBracketService;
use App\Services\StandingsCalculatorService;
use App\Jobs\GenerateNextRoundJob;
use App\Enums\ChampionshipMatchStatus;
use App\Enums\ChampionshipResultType;
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
        private StandingsCalculatorService $standingsCalculator
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
                    'status' => ChampionshipMatchStatus::IN_PROGRESS,
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
}