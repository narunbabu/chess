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
use App\Enums\ChampionshipMatchStatus;
use App\Enums\ChampionshipStatus;
use App\Enums\PaymentStatus;

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

    // ─────────────────────────────────────────────────────────────────────────
    // Authorization helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Assert that $user may manage (start / pause / complete) $championship.
     *
     * Allowed roles: platform_admin, organisation admin for the same org, or
     * the championship creator.
     *
     * @throws \Illuminate\Auth\Access\AuthorizationException
     */
    private function authorizeManagement(Championship $championship, $user): void
    {
        if ($user->hasRole('platform_admin')) {
            return;
        }

        if ($user->hasRole('organization_admin') &&
            $championship->organization_id &&
            $championship->organization_id === $user->organization_id) {
            return;
        }

        if ($championship->created_by === $user->id) {
            return;
        }

        throw new \Illuminate\Auth\Access\AuthorizationException(
            'You do not have permission to manage this championship.'
        );
    }

    /**
     * Assert that $user may archive $championship.
     *
     * Only platform_admin or the original creator may archive.
     *
     * @throws \Illuminate\Auth\Access\AuthorizationException
     */
    private function authorizeArchiveAccess(Championship $championship, $user): void
    {
        if ($user->hasRole('platform_admin') || $championship->created_by === $user->id) {
            return;
        }

        throw new \Illuminate\Auth\Access\AuthorizationException(
            'You do not have permission to archive this championship.'
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State-machine validation helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Assert that the championship is in a state that allows starting.
     *
     * @throws \InvalidArgumentException
     */
    private function validateChampionshipStart(Championship $championship): void
    {
        $allowed = [
            ChampionshipStatus::UPCOMING->value,
            ChampionshipStatus::REGISTRATION_OPEN->value,
        ];

        if (!in_array($championship->status, $allowed, true)) {
            throw new \InvalidArgumentException(
                "Championship cannot be started from '{$championship->status}' status. " .
                "Expected one of: " . implode(', ', $allowed) . '.'
            );
        }

        // Need at least 2 paid participants
        $paidCount = $championship->participants()
            ->where('payment_status_id', \App\Enums\PaymentStatus::COMPLETED->getId())
            ->count();

        if ($paidCount < 2) {
            throw new \InvalidArgumentException(
                "Championship requires at least 2 paid participants to start. Found {$paidCount}."
            );
        }
    }

    /**
     * Assert that the championship is in a state that allows pausing.
     *
     * @throws \InvalidArgumentException
     */
    private function validateChampionshipPause(Championship $championship): void
    {
        if ($championship->status !== ChampionshipStatus::IN_PROGRESS->value) {
            throw new \InvalidArgumentException(
                "Championship can only be paused when 'in_progress'. " .
                "Current status: '{$championship->status}'."
            );
        }
    }

    /**
     * Assert that the championship is in a state that allows completion.
     *
     * @throws \InvalidArgumentException
     */
    private function validateChampionshipCompletion(Championship $championship): void
    {
        $allowed = [
            ChampionshipStatus::IN_PROGRESS->value,
            ChampionshipStatus::PAUSED->value,
        ];

        if (!in_array($championship->status, $allowed, true)) {
            throw new \InvalidArgumentException(
                "Championship cannot be completed from '{$championship->status}' status. " .
                "Expected one of: " . implode(', ', $allowed) . '.'
            );
        }
    }

    /**
     * Assert that the championship is in a state that allows archiving.
     *
     * @throws \InvalidArgumentException
     */
    private function validateChampionshipArchive(Championship $championship): void
    {
        $allowed = [
            ChampionshipStatus::COMPLETED->value,
            ChampionshipStatus::CANCELLED->value,
        ];

        if (!in_array($championship->status, $allowed, true)) {
            throw new \InvalidArgumentException(
                "Championship cannot be archived from '{$championship->status}' status. " .
                "Expected one of: " . implode(', ', $allowed) . '.'
            );
        }
    }

    /**
     * Assert that pairings can be generated for the given round.
     *
     * @throws \InvalidArgumentException
     */
    private function validatePairingGeneration(Championship $championship, int $roundNumber): void
    {
        if ($championship->status !== ChampionshipStatus::IN_PROGRESS->value) {
            throw new \InvalidArgumentException(
                "Pairings can only be generated for an in-progress championship. " .
                "Current status: '{$championship->status}'."
            );
        }

        // Prevent duplicate round generation
        $existingMatches = $championship->matches()
            ->where('round_number', $roundNumber)
            ->exists();

        if ($existingMatches) {
            throw new \InvalidArgumentException(
                "Pairings for round {$roundNumber} already exist."
            );
        }

        // Ensure previous round is complete (except for round 1)
        if ($roundNumber > 1) {
            $prevIncomplete = $championship->matches()
                ->where('round_number', $roundNumber - 1)
                ->where('status_id', '!=', \App\Enums\ChampionshipMatchStatus::COMPLETED->getId())
                ->where('status_id', '!=', \App\Enums\ChampionshipMatchStatus::CANCELLED->getId())
                ->exists();

            if ($prevIncomplete) {
                throw new \InvalidArgumentException(
                    "Round " . ($roundNumber - 1) . " is not yet complete. " .
                    "All matches must finish before generating round {$roundNumber} pairings."
                );
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Round / pairing helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Generate the first round's matches via the MatchSchedulerService.
     */
    private function generateInitialRound(Championship $championship): void
    {
        $this->scheduler->scheduleRound($championship, 1);
    }

    /**
     * Determine the next round number that needs pairings.
     */
    private function getNextRoundNumber(Championship $championship): int
    {
        return $this->scheduler->getNextRoundNumber($championship);
    }

    /**
     * Generate pairings for a round, delegating to the appropriate service.
     *
     * Returns an array of ['white_player_id' => int, 'black_player_id' => int].
     */
    private function generateRoundPairings(Championship $championship, int $roundNumber, array $validated): array
    {
        // Manual pairings take priority
        if (!empty($validated['custom_pairings'])) {
            return array_map(function ($p) {
                return [
                    'white_player_id' => $p['white_player_id'],
                    'black_player_id' => $p['black_player_id'],
                ];
            }, $validated['custom_pairings']);
        }

        $format = $championship->format ?? 'swiss_only';
        $isElimination = in_array($format, ['elimination_only', 'swiss_elimination'], true);

        if ($isElimination) {
            $rawPairings = $this->eliminationService->generateEliminationPairings($championship, $roundNumber);
        } else {
            $rawPairings = $this->swissService->generatePairings($championship, $roundNumber);
        }

        // Normalise to {white_player_id, black_player_id}
        return array_map(function ($p) {
            return [
                'white_player_id' => $p['white_player_id'] ?? $p['player1_id'] ?? null,
                'black_player_id' => $p['black_player_id'] ?? $p['player2_id'] ?? null,
            ];
        }, $rawPairings);
    }

    /**
     * Determine the ChampionshipRoundType for a given round.
     */
    private function getRoundType(Championship $championship, int $roundNumber): \App\Enums\ChampionshipRoundType
    {
        $format = $championship->format ?? 'swiss_only';
        $totalRounds = $championship->total_rounds ?? 1;

        if ($format === 'swiss_only') {
            return \App\Enums\ChampionshipRoundType::SWISS;
        }

        // For elimination / hybrid formats, map by position from the end
        $roundsFromEnd = $totalRounds - $roundNumber;

        return match (true) {
            $roundsFromEnd === 0 => \App\Enums\ChampionshipRoundType::FINAL,
            $roundsFromEnd === 1 => \App\Enums\ChampionshipRoundType::SEMI_FINAL,
            $roundsFromEnd === 2 => \App\Enums\ChampionshipRoundType::QUARTER_FINAL,
            $roundsFromEnd <= 3 => \App\Enums\ChampionshipRoundType::ROUND_OF_16,
            default              => \App\Enums\ChampionshipRoundType::SWISS,
        };
    }

    /**
     * Calculate the deadline for matches in the given round.
     */
    private function calculateMatchDeadline(Championship $championship, int $roundNumber): \Carbon\Carbon
    {
        $windowHours = $championship->match_time_window_hours ?? 24;
        return now()->addHours($windowHours);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Standings helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Compute and persist final standings.
     *
     * Returns a summary array for use in notifications.
     */
    private function generateFinalStandings(Championship $championship): array
    {
        $this->standingsCalculator->recalculateAllStandings($championship);
        return $this->standingsCalculator->getStandingsSummary($championship);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Match management helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Cancel all pending match records for a paused championship so that
     * participants are not left in unresolvable "pending" game states.
     */
    private function cancelPendingInvitations(Championship $championship): void
    {
        $pendingStatusId = \App\Enums\ChampionshipMatchStatus::PENDING->getId();
        $cancelledStatusId = \App\Enums\ChampionshipMatchStatus::CANCELLED->getId();

        $championship->matches()
            ->where('status_id', $pendingStatusId)
            ->update(['status_id' => $cancelledStatusId]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Notification helpers (log-based stubs; replace with job dispatches once
    // SendChampionshipNotificationJob is implemented)
    // ─────────────────────────────────────────────────────────────────────────

    private function sendStartNotifications(Championship $championship, $user, $startTime): void
    {
        Log::info('Championship start notifications queued', [
            'championship_id' => $championship->id,
            'started_by' => $user->id,
            'start_time' => $startTime,
        ]);
    }

    private function sendPauseNotifications(Championship $championship, $user, ?string $reason): void
    {
        Log::info('Championship pause notifications queued', [
            'championship_id' => $championship->id,
            'paused_by' => $user->id,
            'reason' => $reason,
        ]);
    }

    private function sendCompletionNotifications(Championship $championship, $user, array $finalStandings): void
    {
        Log::info('Championship completion notifications queued', [
            'championship_id' => $championship->id,
            'completed_by' => $user->id,
            'standings_count' => count($finalStandings),
        ]);
    }

    private function sendArchiveNotifications(Championship $championship, $user): void
    {
        Log::info('Championship archive notifications queued', [
            'championship_id' => $championship->id,
            'archived_by' => $user->id,
        ]);
    }
}