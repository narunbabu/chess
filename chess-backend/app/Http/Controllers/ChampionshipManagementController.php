<?php

namespace App\Http\Controllers;

use App\Models\Championship;
use App\Models\ChampionshipParticipant;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipStanding;
use App\Services\MatchSchedulerService;
use App\Services\StandingsCalculatorService;
use App\Services\SwissPairingService;
use App\Services\EliminationBracketService;
use App\Jobs\GenerateNextRoundJob;
use App\Jobs\SendChampionshipNotificationJob;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use App\Enums\ChampionshipStatus;

/**
 * Championship Management Controller
 *
 * Handles administrative championship operations:
 * - Start/pause/complete championships
 * - Generate pairings
 * - Manage tournament brackets
 * - Update standings
 * - Archive championships
 */
class ChampionshipManagementController extends Controller
{
    public function __construct(
        private MatchSchedulerService $scheduler,
        private StandingsCalculatorService $standingsCalculator,
        private SwissPairingService $swissService,
        private EliminationBracketService $eliminationService
    ) {}

    /**
     * Start a championship
     *
     * @param Request $request
     * @param int $championshipId
     * @return JsonResponse
     */
    public function start(Request $request, int $championshipId): JsonResponse
    {
        try {
            $user = Auth::guard('sanctum')->user();

            if (!$user) {
                return response()->json([
                    'error' => 'Unauthorized',
                    'message' => 'Authentication required',
                ], 401);
            }

            $championship = Championship::findOrFail($championshipId);

            // Authorize management access
            $this->authorizeManagement($championship, $user);

            // Validate start request
            $validator = Validator::make($request->all(), [
                'auto_generate_pairings' => 'boolean',
                'send_notifications' => 'boolean',
                'start_immediately' => 'boolean',
                'custom_start_time' => 'nullable|date|after:now',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Validation Error',
                    'message' => 'Invalid input data',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $validated = $validator->validated();

            // Check if championship can be started
            $this->validateChampionshipStart($championship);

            $startTime = $validated['start_immediately'] || !$validated['custom_start_time'] ?
                now() :
                new \Carbon\Carbon($validated['custom_start_time']);

            DB::transaction(function () use ($championship, $user, $validated, $startTime) {
                // Update championship status
                $championship->status = ChampionshipStatus::IN_PROGRESS;
                $championship->started_at = $startTime;
                $championship->started_by = $user->id;
                $championship->save();

                // Initialize first round if auto-generate is requested
                if ($validated['auto_generate_pairings']) {
                    $this->generateInitialRound($championship);
                }

                // Send start notifications
                if ($validated['send_notifications']) {
                    $this->sendStartNotifications($championship, $user, $startTime);
                }
            });

            Log::info('Championship started', [
                'championship_id' => $championshipId,
                'user_id' => $user->id,
                'start_time' => $startTime,
            ]);

            return response()->json([
                'championship' => $championship->fresh(),
                'message' => 'Championship started successfully',
                'start_time' => $startTime,
            ]);

        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json([
                'error' => 'Forbidden',
                'message' => $e->getMessage(),
            ], 403);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'error' => 'Not Found',
                'message' => 'Championship not found',
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error starting championship', [
                'championship_id' => $championshipId,
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'error' => 'Server Error',
                'message' => 'Failed to start championship',
            ], 500);
        }
    }

    /**
     * Pause a championship
     *
     * @param Request $request
     * @param int $championshipId
     * @return JsonResponse
     */
    public function pause(Request $request, int $championshipId): JsonResponse
    {
        try {
            $user = Auth::guard('sanctum')->user();

            if (!$user) {
                return response()->json([
                    'error' => 'Unauthorized',
                    'message' => 'Authentication required',
                ], 401);
            }

            $championship = Championship::findOrFail($championshipId);

            $this->authorizeManagement($championship, $user);

            // Validate pause request
            $validator = Validator::make($request->all(), [
                'reason' => 'nullable|string|max:1000',
                'notify_participants' => 'boolean',
                'resume_time' => 'nullable|date|after:now',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Validation Error',
                    'message' => 'Invalid input data',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $validated = $validator->validated();

            // Check if championship can be paused
            $this->validateChampionshipPause($championship);

            DB::transaction(function () use ($championship, $user, $validated) {
                // Update championship status
                $championship->status = ChampionshipStatus::PAUSED;
                $championship->paused_at = now();
                $championship->paused_by = $user->id;
                $championship->pause_reason = $validated['reason'] ?? null;
                $championship->planned_resume_at = $validated['resume_time'] ?? null;
                $championship->save();

                // Cancel pending match invitations
                $this->cancelPendingInvitations($championship);

                // Send pause notifications
                if ($validated['notify_participants']) {
                    $this->sendPauseNotifications($championship, $user, $validated['reason'] ?? null);
                }
            });

            Log::info('Championship paused', [
                'championship_id' => $championshipId,
                'user_id' => $user->id,
                'reason' => $validated['reason'] ?? null,
            ]);

            return response()->json([
                'championship' => $championship->fresh(),
                'message' => 'Championship paused successfully',
                'planned_resume_time' => $championship->planned_resume_at,
            ]);

        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json([
                'error' => 'Forbidden',
                'message' => $e->getMessage(),
            ], 403);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'error' => 'Not Found',
                'message' => 'Championship not found',
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error pausing championship', [
                'championship_id' => $championshipId,
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Server Error',
                'message' => 'Failed to pause championship',
            ], 500);
        }
    }

    /**
     * Complete a championship
     *
     * @param Request $request
     * @param int $championshipId
     * @return JsonResponse
     */
    public function complete(Request $request, int $championshipId): JsonResponse
    {
        try {
            $user = Auth::guard('sanctum')->user();

            if (!$user) {
                return response()->json([
                    'error' => 'Unauthorized',
                    'message' => 'Authentication required',
                ], 401);
            }

            $championship = Championship::findOrFail($championshipId);

            $this->authorizeManagement($championship, $user);

            // Validate completion request
            $validator = Validator::make($request->all(), [
                'generate_final_standings' => 'boolean',
                'awards_mode' => 'required|in:automatic,manual,none',
                'awards_data' => 'nullable|array',
                'completion_notes' => 'nullable|string|max:2000',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Validation Error',
                    'message' => 'Invalid input data',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $validated = $validator->validated();

            // Check if championship can be completed
            $this->validateChampionshipCompletion($championship);

            DB::transaction(function () use ($championship, $user, $validated) {
                // Generate final standings if requested
                $finalStandings = [];
                if ($validated['generate_final_standings']) {
                    $finalStandings = $this->generateFinalStandings($championship);
                }

                // Update championship status
                $championship->status = ChampionshipStatus::COMPLETED;
                $championship->completed_at = now();
                $championship->completed_by = $user->id;
                $championship->completion_notes = $validated['completion_notes'] ?? null;
                $championship->awards_mode = $validated['awards_mode'];
                $championship->awards_data = $validated['awards_data'] ?? null;
                $championship->save();

                // Send completion notifications
                $this->sendCompletionNotifications($championship, $user, $finalStandings);

                return $finalStandings;
            });

            Log::info('Championship completed', [
                'championship_id' => $championshipId,
                'user_id' => $user->id,
                'awards_mode' => $validated['awards_mode'],
            ]);

            return response()->json([
                'championship' => $championship->fresh()->load(['standings']),
                'message' => 'Championship completed successfully',
            ]);

        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json([
                'error' => 'Forbidden',
                'message' => $e->getMessage(),
            ], 403);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'error' => 'Not Found',
                'message' => 'Championship not found',
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error completing championship', [
                'championship_id' => $championshipId,
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'error' => 'Server Error',
                'message' => 'Failed to complete championship',
            ], 500);
        }
    }

    /**
     * Generate pairings for a specific round
     *
     * @param Request $request
     * @param int $championshipId
     * @return JsonResponse
     */
    public function generatePairings(Request $request, int $championshipId): JsonResponse
    {
        try {
            $user = Auth::guard('sanctum')->user();

            if (!$user) {
                return response()->json([
                    'error' => 'Unauthorized',
                    'message' => 'Authentication required',
                ], 401);
            }

            $championship = Championship::findOrFail($championshipId);

            $this->authorizeManagement($championship, $user);

            // Validate pairing request
            $validator = Validator::make($request->all(), [
                'round_number' => 'nullable|integer|min:1',
                'pairing_method' => 'nullable|string|in:balanced,score_only,random,manual',
                'custom_pairings' => 'nullable|array',
                'custom_pairings.*.white_player_id' => 'required|integer|exists:users,id',
                'custom_pairings.*.black_player_id' => 'required|integer|exists:users,id,different:white_player_id',
                'confirm_generation' => 'required|boolean',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Validation Error',
                    'message' => 'Invalid input data',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $validated = $validator->validated();

            if (!$validated['confirm_generation']) {
                return response()->json([
                    'error' => 'Confirmation Required',
                    'message' => 'Please confirm pairing generation to proceed',
                ], 422);
            }

            // Determine round number
            $roundNumber = $validated['round_number'] ?? $this->getNextRoundNumber($championship);

            // Check if pairings can be generated
            $this->validatePairingGeneration($championship, $roundNumber);

            // Generate pairings based on format and round
            $pairings = $this->generateRoundPairings($championship, $roundNumber, $validated);

            // Create matches from pairings
            $createdMatches = DB::transaction(function () use ($championship, $roundNumber, $pairings) {
                $matches = [];

                foreach ($pairings as $pairing) {
                    $match = ChampionshipMatch::create([
                        'championship_id' => $championship->id,
                        'round_number' => $roundNumber,
                        'round_type' => $this->getRoundType($championship, $roundNumber),
                        'white_player_id' => $pairing['white_player_id'],
                        'black_player_id' => $pairing['black_player_id'],
                        'player1_id' => $pairing['white_player_id'], // Legacy support
                        'player2_id' => $pairing['black_player_id'], // Legacy support
                        'color_assignment_method' => $championship->color_assignment_method ?? 'balanced',
                        'auto_generated' => true,
                        'deadline' => $this->calculateMatchDeadline($championship, $roundNumber),
                        'status' => 'pending',
                    ]);

                    $matches[] = $match->load(['whitePlayer', 'blackPlayer']);
                }

                // Update championship current round
                $championship->current_round = $roundNumber;
                $championship->save();

                return $matches;
            });

            Log::info('Championship pairings generated', [
                'championship_id' => $championshipId,
                'round_number' => $roundNumber,
                'matches_count' => count($createdMatches),
                'user_id' => $user->id,
            ]);

            return response()->json([
                'matches' => $createdMatches,
                'round_number' => $roundNumber,
                'message' => 'Pairings generated successfully',
            ]);

        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json([
                'error' => 'Forbidden',
                'message' => $e->getMessage(),
            ], 403);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'error' => 'Not Found',
                'message' => 'Championship not found',
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error generating pairings', [
                'championship_id' => $championshipId,
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'error' => 'Server Error',
                'message' => 'Failed to generate pairings',
            ], 500);
        }
    }

    /**
     * Archive a championship
     *
     * @param Request $request
     * @param int $championshipId
     * @return JsonResponse
     */
    public function archive(Request $request, int $championshipId): JsonResponse
    {
        try {
            $user = Auth::guard('sanctum')->user();

            if (!$user) {
                return response()->json([
                    'error' => 'Unauthorized',
                    'message' => 'Authentication required',
                ], 401);
            }

            $championship = Championship::findOrFail($championshipId);

            $this->authorizeArchiveAccess($championship, $user);

            // Validate archive request
            $validator = Validator::make($request->all(), [
                'archive_reason' => 'nullable|string|max:1000',
                'keep_data_years' => 'nullable|integer|min:1|max:10',
                'notify_participants' => 'boolean',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Validation Error',
                    'message' => 'Invalid input data',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $validated = $validator->validated();

            // Check if championship can be archived
            $this->validateChampionshipArchive($championship);

            DB::transaction(function () use ($championship, $user, $validated) {
                // Archive championship
                $championship->deleted_by = $user->id;
                $championship->archive_reason = $validated['archive_reason'] ?? null;
                $championship->data_retention_years = $validated['keep_data_years'] ?? 5;
                $championship->archived_at = now();
                $championship->delete();

                // Send archive notifications to key stakeholders
                if ($validated['notify_participants']) {
                    $this->sendArchiveNotifications($championship, $user);
                }
            });

            Log::info('Championship archived', [
                'championship_id' => $championshipId,
                'user_id' => $user->id,
                'archive_reason' => $validated['archive_reason'] ?? null,
            ]);

            return response()->json([
                'message' => 'Championship archived successfully',
                'data_retention_years' => $championship->data_retention_years,
            ]);

        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json([
                'error' => 'Forbidden',
                'message' => $e->getMessage(),
            ], 403);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'error' => 'Not Found',
                'message' => 'Championship not found',
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error archiving championship', [
                'championship_id' => $championshipId,
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'error' => 'Server Error',
                'message' => 'Failed to archive championship',
            ], 500);
        }
    }

    // Helper Methods (continued in next response due to length limits)
    // ... (Helper methods will be implemented in a second response)
}