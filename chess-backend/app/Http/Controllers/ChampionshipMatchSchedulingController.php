<?php

namespace App\Http\Controllers;

use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipMatchSchedule;
use App\Services\ChampionshipMatchSchedulingService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class ChampionshipMatchSchedulingController extends Controller
{
    protected ChampionshipMatchSchedulingService $schedulingService;

    public function __construct(ChampionshipMatchSchedulingService $schedulingService)
    {
        $this->schedulingService = $schedulingService;
    }

    /**
     * Propose a schedule for a championship match
     */
    public function proposeSchedule(Request $request, Championship $championship, ChampionshipMatch $match): JsonResponse
    {
        try {
            $request->validate([
                'proposed_time' => 'required|date|after:now',
                'message' => 'nullable|string|max:500',
            ]);

            $proposedTime = Carbon::parse($request->input('proposed_time'));
            $message = $request->input('message');

            $schedule = $this->schedulingService->proposeMatchSchedule(
                $match,
                Auth::user(),
                $proposedTime,
                $message
            );

            // Broadcast the proposal to the opponent
            $this->broadcastScheduleProposal($schedule, $match, 'proposed');

            return response()->json([
                'success' => true,
                'message' => 'Schedule proposal sent successfully',
                'schedule' => $schedule->load(['proposer', 'championshipMatch'])
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to propose schedule', [
                'match_id' => $match->id,
                'user_id' => Auth::id(),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Accept a schedule proposal
     */
    public function acceptSchedule(Request $request, Championship $championship, ChampionshipMatch $match, ChampionshipMatchSchedule $schedule): JsonResponse
    {
        try {
            $request->validate([
                'message' => 'nullable|string|max:500',
            ]);

            $message = $request->input('message');

            $acceptedSchedule = $this->schedulingService->acceptScheduleProposal(
                $schedule,
                Auth::user(),
                $message
            );

            // Broadcast acceptance to proposer
            $this->broadcastScheduleProposal($acceptedSchedule, $match, 'accepted');

            return response()->json([
                'success' => true,
                'message' => 'Schedule proposal accepted',
                'schedule' => $acceptedSchedule->load(['proposer', 'responder', 'championshipMatch'])
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to accept schedule', [
                'schedule_id' => $schedule->id,
                'user_id' => Auth::id(),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Propose an alternative time
     */
    public function proposeAlternative(Request $request, Championship $championship, ChampionshipMatch $match, ChampionshipMatchSchedule $schedule): JsonResponse
    {
        try {
            $request->validate([
                'alternative_time' => 'required|date|after:now',
                'message' => 'nullable|string|max:500',
            ]);

            $alternativeTime = Carbon::parse($request->input('alternative_time'));
            $message = $request->input('message');

            $updatedSchedule = $this->schedulingService->proposeAlternativeTime(
                $schedule,
                Auth::user(),
                $alternativeTime,
                $message
            );

            // Broadcast alternative proposal to original proposer
            $this->broadcastScheduleProposal($updatedSchedule, $match, 'alternative_proposed');

            return response()->json([
                'success' => true,
                'message' => 'Alternative time proposed',
                'schedule' => $updatedSchedule->load(['proposer', 'responder', 'championshipMatch'])
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to propose alternative time', [
                'schedule_id' => $schedule->id,
                'user_id' => Auth::id(),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Confirm a match schedule (after both parties agree)
     */
    public function confirmSchedule(Request $request, Championship $championship, ChampionshipMatch $match): JsonResponse
    {
        try {
            $request->validate([
                'scheduled_time' => 'required|date|after:now',
            ]);

            $scheduledTime = Carbon::parse($request->input('scheduled_time'));

            $updatedMatch = $this->schedulingService->confirmMatchSchedule($match, $scheduledTime);

            // Broadcast confirmation to both players
            $this->broadcastMatchConfirmation($updatedMatch);

            return response()->json([
                'success' => true,
                'message' => 'Match schedule confirmed',
                'match' => $updatedMatch->load(['player1', 'player2'])
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to confirm schedule', [
                'match_id' => $match->id,
                'user_id' => Auth::id(),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Create an immediate game if both players are online
     */
    public function playImmediate(Request $request, Championship $championship, ChampionshipMatch $match): JsonResponse
    {
        try {
            $game = $this->schedulingService->createImmediateGame($match, Auth::user());

            // Broadcast game creation to both players
            $this->broadcastImmediateGame($game, $match);

            return response()->json([
                'success' => true,
                'message' => 'Game created successfully',
                'game' => $game->load(['whitePlayer', 'blackPlayer']),
                'redirect_url' => "/play/{$game->id}"
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to create immediate game', [
                'match_id' => $match->id,
                'user_id' => Auth::id(),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Get schedule proposals for a match
     */
    public function getScheduleProposals(Championship $championship, ChampionshipMatch $match): JsonResponse
    {
        try {
            $proposals = ChampionshipMatchSchedule::where('championship_match_id', $match->id)
                ->with(['proposer', 'responder'])
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json([
                'success' => true,
                'proposals' => $proposals,
                'current_schedule' => $match->currentSchedule
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to get schedule proposals', [
                'match_id' => $match->id,
                'user_id' => Auth::id(),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to retrieve schedule proposals'
            ], 500);
        }
    }

    /**
     * Get user's championship schedule information
     */
    public function getUserSchedule(Championship $championship): JsonResponse
    {
        try {
            $user = Auth::user();
            $scheduleData = $this->schedulingService->getUserMatches($championship, $user);

            return response()->json([
                'success' => true,
                'matches' => $scheduleData,
                'championship' => [
                    'id' => $championship->id,
                    'title' => $championship->title,
                    'scheduling_instructions' => $championship->scheduling_instructions,
                    'play_instructions' => $championship->play_instructions,
                    'allow_early_play' => $championship->allow_early_play,
                    'default_grace_period_minutes' => $championship->default_grace_period_minutes,
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to get user schedule', [
                'championship_id' => $championship->id,
                'user_id' => Auth::id(),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to retrieve schedule information'
            ], 500);
        }
    }

    /**
     * Broadcast schedule proposal to relevant users
     */
    private function broadcastScheduleProposal(ChampionshipMatchSchedule $schedule, ChampionshipMatch $match, string $action): void
    {
        $opponent = $schedule->proposer_id === Auth::id()
            ? ($match->player1_id === Auth::id() ? $match->player2 : $match->player1)
            : $schedule->proposer;

        if ($opponent) {
            broadcast(new \App\Events\ChampionshipScheduleProposalUpdated(
                $match,
                $schedule,
                $action,
                Auth::user()
            ))->toOthers();
        }
    }

    /**
     * Broadcast match confirmation to both players
     */
    private function broadcastMatchConfirmation(ChampionshipMatch $match): void
    {
        broadcast(new \App\Events\ChampionshipMatchScheduled(
            $match,
            Auth::user()
        ))->toOthers();
    }

    /**
     * Broadcast immediate game creation
     */
    private function broadcastImmediateGame(\App\Models\Game $game, ChampionshipMatch $match): void
    {
        // Broadcast to BOTH players - remove ->toOthers() so both requester and accepter receive the event
        broadcast(new \App\Events\ChampionshipGameCreated(
            $game,
            $match,
            Auth::user()
        ));
    }
}
