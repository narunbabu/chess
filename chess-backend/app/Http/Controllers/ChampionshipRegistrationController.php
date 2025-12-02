<?php

namespace App\Http\Controllers;

use App\Models\Championship;
use App\Models\ChampionshipParticipant;
use App\Jobs\SendChampionshipInvitationJob;
use App\Services\PaymentService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use App\Enums\PaymentStatus;
use App\Enums\ChampionshipStatus;

/**
 * Championship Registration Controller
 *
 * Handles all registration-related operations:
 * - User registration for championships
 * - Registration status management
 * - Payment processing
 * - Registration invitations
 * - Participant management
 */
class ChampionshipRegistrationController extends Controller
{
    public function __construct(
        private PaymentService $paymentService
    ) {}

    /**
     * Register a user for a championship
     *
     * @param Request $request
     * @param int $championshipId
     * @return JsonResponse
     */
    public function register(Request $request, int $championshipId): JsonResponse
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

            // Check if registration is allowed
            $this->authorizeRegistration($championship, $user);

            // Check if already registered
            $existingParticipant = ChampionshipParticipant::where('championship_id', $championshipId)
                ->where('user_id', $user->id)
                ->first();

            if ($existingParticipant) {
                return response()->json([
                    'error' => 'Already Registered',
                    'message' => 'You are already registered for this championship',
                    'participant' => $existingParticipant,
                ], 409);
            }

            // Validate registration data
            $validator = Validator::make($request->all(), [
                'accept_terms' => 'required|accepted',
                'accept_code_of_conduct' => 'required|accepted',
                'rating_confirmation' => 'required|boolean',
                'availability_note' => 'nullable|string|max:1000',
                'preferred_color' => 'nullable|string|in:white,black,no_preference',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Validation Error',
                    'message' => 'Invalid registration data',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $validated = $validator->validated();

            // Check championship capacity
            $currentParticipants = ChampionshipParticipant::where('championship_id', $championshipId)->count();
            if ($currentParticipants >= $championship->max_participants) {
                return response()->json([
                    'error' => 'Championship Full',
                    'message' => 'This championship has reached its maximum capacity',
                ], 422);
            }

            // Handle payment if required
            $paymentStatus = PaymentStatus::PENDING;
            $paymentReference = null;

            if ($championship->entry_fee > 0) {
                $paymentResult = $this->paymentService->processRegistrationPayment(
                    $user,
                    $championship,
                    $championship->entry_fee
                );

                if (!$paymentResult['success']) {
                    return response()->json([
                        'error' => 'Payment Failed',
                        'message' => $paymentResult['message'],
                    ], 422);
                }

                $paymentStatus = $paymentResult['status'];
                $paymentReference = $paymentResult['reference'];
            }

            // Create participant record
            $participant = DB::transaction(function () use ($championship, $user, $validated, $paymentStatus, $paymentReference) {
                $participant = ChampionshipParticipant::create([
                    'championship_id' => $championship->id,
                    'user_id' => $user->id,
                    'status' => $paymentStatus === PaymentStatus::COMPLETED ? 'registered' : 'payment_pending',
                    'payment_status' => $paymentStatus,
                    'payment_reference' => $paymentReference,
                    'rating_at_registration' => $user->rating ?? 0,
                    'accept_terms' => true,
                    'accept_code_of_conduct' => true,
                    'rating_confirmation' => $validated['rating_confirmation'],
                    'availability_note' => $validated['availability_note'] ?? null,
                    'preferred_color' => $validated['preferred_color'] ?? 'no_preference',
                    'registered_at' => now(),
                ]);

                // Update championship participant count
                $championship->increment('participants_count');

                return $participant;
            });

            // Send confirmation
            $this->sendRegistrationConfirmation($championship, $user, $participant);

            Log::info('User registered for championship', [
                'championship_id' => $championshipId,
                'user_id' => $user->id,
                'participant_id' => $participant->id,
                'payment_status' => $paymentStatus,
            ]);

            return response()->json([
                'participant' => $participant->load('user'),
                'championship' => $championship->load(['participants']),
                'payment_status' => $paymentStatus,
                'message' => $this->getRegistrationSuccessMessage($paymentStatus),
            ], 201);

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
            Log::error('Error in championship registration', [
                'championship_id' => $championshipId,
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'error' => 'Server Error',
                'message' => 'Failed to process registration',
            ], 500);
        }
    }

    /**
     * Get user's registrations
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function myRegistrations(Request $request): JsonResponse
    {
        try {
            $user = Auth::guard('sanctum')->user();

            if (!$user) {
                return response()->json([
                    'error' => 'Unauthorized',
                    'message' => 'Authentication required',
                ], 401);
            }

            $participants = ChampionshipParticipant::with([
                'championship.organization',
                'championship.matches' => function ($query) use ($user) {
                    $query->where(function ($q) use ($user) {
                        $q->where('white_player_id', $user->id)
                          ->orWhere('black_player_id', $user->id)
                          ->orWhere('player1_id', $user->id)
                          ->orWhere('player2_id', $user->id);
                    });
                }
            ])
            ->where('user_id', $user->id)
            ->orderBy('created_at', 'desc')
            ->paginate($request->input('per_page', 15));

            return response()->json([
                'data' => $participants->items(),
                'pagination' => [
                    'current_page' => $participants->currentPage(),
                    'last_page' => $participants->lastPage(),
                    'per_page' => $participants->perPage(),
                    'total' => $participants->total(),
                    'from' => $participants->firstItem(),
                    'to' => $participants->lastItem(),
                ],
            ]);

        } catch (\Exception $e) {
            Log::error('Error fetching user registrations', [
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Server Error',
                'message' => 'Failed to fetch registrations',
            ], 500);
        }
    }

    /**
     * Cancel a registration
     *
     * @param Request $request
     * @param int $championshipId
     * @return JsonResponse
     */
    public function cancel(Request $request, int $championshipId): JsonResponse
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

            $participant = ChampionshipParticipant::where('championship_id', $championshipId)
                ->where('user_id', $user->id)
                ->firstOrFail();

            // Check if cancellation is allowed
            $this->authorizeCancellation($championship, $participant, $user);

            DB::transaction(function () use ($championship, $participant, $user) {
                // Process refund if applicable
                if ($participant->payment_status === PaymentStatus::COMPLETED && $championship->entry_fee > 0) {
                    $refundResult = $this->paymentService->processRefund(
                        $participant->payment_reference,
                        $user,
                        $championship->entry_fee
                    );

                    if ($refundResult['success']) {
                        $participant->refund_status = $refundResult['status'];
                        $participant->refund_reference = $refundResult['reference'];
                        $participant->refund_processed_at = now();
                    }
                }

                // Update participant status
                $participant->status = 'cancelled';
                $participant->cancelled_at = now();
                $participant->cancellation_reason = $request->input('reason', 'User cancelled');
                $participant->save();

                // Update championship participant count
                $championship->decrement('participants_count');
            });

            // Send cancellation notification
            $this->sendCancellationNotification($championship, $user, $participant);

            Log::info('User cancelled championship registration', [
                'championship_id' => $championshipId,
                'user_id' => $user->id,
                'participant_id' => $participant->id,
            ]);

            return response()->json([
                'message' => 'Registration cancelled successfully',
                'refund_status' => $participant->refund_status ?? 'not_applicable',
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'error' => 'Not Found',
                'message' => 'Registration not found',
            ], 404);
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json([
                'error' => 'Forbidden',
                'message' => $e->getMessage(),
            ], 403);
        } catch (\Exception $e) {
            Log::error('Error cancelling registration', [
                'championship_id' => $championshipId,
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Server Error',
                'message' => 'Failed to cancel registration',
            ], 500);
        }
    }

    /**
     * Get registration instructions for a championship
     *
     * @param Request $request
     * @param int $championshipId
     * @return JsonResponse
     */
    public function getInstructions(Request $request, int $championshipId): JsonResponse
    {
        try {
            $championship = Championship::findOrFail($championshipId);

            $user = Auth::guard('sanctum')->user();
            $this->authorizeViewInstructions($championship, $user);

            $instructions = [
                'registration_deadline' => $championship->registration_deadline,
                'entry_fee' => $championship->entry_fee,
                'currency' => $championship->currency ?? 'USD',
                'max_participants' => $championship->max_participants,
                'current_participants' => $championship->participants_count,
                'requirements' => [
                    'must_accept_terms' => true,
                    'must_accept_code_of_conduct' => true,
                    'rating_confirmation' => $championship->requires_rating_verification ?? false,
                    'payment_required' => $championship->entry_fee > 0,
                ],
                'timeline' => [
                    'registration_opens' => $championship->registration_start_date ?? $championship->created_at,
                    'registration_closes' => $championship->registration_deadline,
                    'championship_starts' => $championship->start_date,
                    'estimated_duration' => $this->calculateEstimatedDuration($championship),
                ],
                'scheduling' => [
                    'match_time_window_hours' => $championship->match_time_window_hours,
                    'default_grace_period_minutes' => $championship->default_grace_period_minutes,
                    'allow_early_play' => $championship->allow_early_play,
                    'require_confirmation' => $championship->require_confirmation,
                    'instructions' => $championship->scheduling_instructions,
                ],
                'rules' => [
                    'time_control' => $this->formatTimeControl($championship),
                    'format' => $championship->format,
                    'total_rounds' => $championship->total_rounds,
                    'bye_points' => $championship->bye_points ?? 1.0,
                    'color_assignment' => $championship->color_assignment_method,
                    'play_instructions' => $championship->play_instructions,
                ],
            ];

            return response()->json([
                'championship' => $championship->only(['id', 'name', 'status']),
                'instructions' => $instructions,
                'can_register' => $this->canUserRegister($championship, $user),
                'registration_status' => $user ? $this->getUserRegistrationStatus($championship, $user) : null,
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'error' => 'Not Found',
                'message' => 'Championship not found',
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error fetching registration instructions', [
                'championship_id' => $championshipId,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Server Error',
                'message' => 'Failed to fetch registration instructions',
            ], 500);
        }
    }

    // Helper Methods

    /**
     * Authorize registration access
     */
    private function authorizeRegistration(Championship $championship, $user): void
    {
        // Check if championship is in a state that allows registration
        if (!in_array($championship->status, [ChampionshipStatus::UPCOMING, ChampionshipStatus::REGISTRATION_OPEN])) {
            throw new \Illuminate\Auth\Access\AuthorizationException(
                'This championship is not accepting registrations'
            );
        }

        // Check registration deadline
        if ($championship->registration_deadline && now()->greaterThan($championship->registration_deadline)) {
            throw new \Illuminate\Auth\Access\AuthorizationException(
                'Registration deadline has passed'
            );
        }

        // Check public registration
        if (!$championship->allow_public_registration && !$user->hasAnyRole(['platform_admin', 'organization_admin'])) {
            throw new \Illuminate\Auth\Access\AuthorizationException(
                'This championship requires invitation'
            );
        }

        // Check capacity
        if ($championship->participants_count >= $championship->max_participants) {
            throw new \Illuminate\Auth\Access\AuthorizationException(
                'Championship is full'
            );
        }

        // Check organization restrictions if applicable
        if ($championship->organization_id && !$this->isUserInOrganization($user, $championship->organization_id)) {
            throw new \Illuminate\Auth\Access\AuthorizationException(
                'This championship is restricted to organization members'
            );
        }
    }

    /**
     * Authorize cancellation access
     */
    private function authorizeCancellation(Championship $championship, ChampionshipParticipant $participant, $user): void
    {
        // Check if cancellation is allowed based on championship status
        if (in_array($championship->status, [ChampionshipStatus::IN_PROGRESS, ChampionshipStatus::COMPLETED, ChampionshipStatus::CANCELLED])) {
            throw new \Illuminate\Auth\Access\AuthorizationException(
                'Cannot cancel registration for a championship that has started or ended'
            );
        }

        // Check cancellation deadline (e.g., 24 hours before championship starts)
        $cancellationDeadline = $championship->start_date ?
            $championship->start_date->subHours(24) :
            $championship->registration_deadline;

        if ($cancellationDeadline && now()->greaterThan($cancellationDeadline)) {
            throw new \Illuminate\Auth\Access\AuthorizationException(
                'Cancellation deadline has passed'
            );
        }

        // Only the registered user can cancel their registration
        if ($participant->user_id !== $user->id) {
            throw new \Illuminate\Auth\Access\AuthorizationException(
                'You can only cancel your own registration'
            );
        }
    }

    /**
     * Authorize viewing instructions
     */
    private function authorizeViewInstructions(Championship $championship, $user): void
    {
        // Public championships allow anyone to view instructions
        if ($championship->visibility === 'public') {
            return;
        }

        // Private/unlisted championships require authentication
        if (!$user) {
            throw new \Illuminate\Auth\Access\AuthorizationException(
                'Authentication required to view instructions'
            );
        }

        // Organization members can view organization championships
        if ($championship->organization_id && $this->isUserInOrganization($user, $championship->organization_id)) {
            return;
        }

        // Admins can view any championship
        if ($user->hasAnyRole(['platform_admin', 'organization_admin'])) {
            return;
        }

        // Registered users can view instructions
        if ($this->getUserRegistrationStatus($championship, $user) === 'registered') {
            return;
        }

        throw new \Illuminate\Auth\Access\AuthorizationException(
            'You do not have permission to view these instructions'
        );
    }

    /**
     * Send registration confirmation
     */
    private function sendRegistrationConfirmation(Championship $championship, $user, ChampionshipParticipant $participant): void
    {
        try {
            // Send email notification
            SendChampionshipInvitationJob::dispatch($user->email, [
                'type' => 'registration_confirmation',
                'championship_name' => $championship->name,
                'championship_id' => $championship->id,
                'registration_status' => $participant->status,
                'payment_status' => $participant->payment_status,
                'deadline' => $championship->registration_deadline,
                'start_date' => $championship->start_date,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to send registration confirmation', [
                'user_id' => $user->id,
                'championship_id' => $championship->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Send cancellation notification
     */
    private function sendCancellationNotification(Championship $championship, $user, ChampionshipParticipant $participant): void
    {
        try {
            // Send email notification
            SendChampionshipInvitationJob::dispatch($user->email, [
                'type' => 'cancellation_confirmation',
                'championship_name' => $championship->name,
                'championship_id' => $championship->id,
                'refund_status' => $participant->refund_status ?? 'not_applicable',
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to send cancellation notification', [
                'user_id' => $user->id,
                'championship_id' => $championship->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Get registration success message
     */
    private function getRegistrationSuccessMessage(string $paymentStatus): string
    {
        return match ($paymentStatus) {
            PaymentStatus::COMPLETED => 'Registration completed successfully!',
            PaymentStatus::PENDING => 'Registration successful! Please complete payment to confirm your spot.',
            PaymentStatus::PROCESSING => 'Registration submitted! Payment is being processed.',
            default => 'Registration received! Status: ' . $paymentStatus,
        };
    }

    /**
     * Calculate estimated championship duration
     */
    private function calculateEstimatedDuration(Championship $championship): array
    {
        $roundsPerWeek = 1;
        $estimatedGameLength = ($championship->time_control_minutes ?? 10) + 2; // Add buffer time
        $totalWeeks = ceil($championship->total_rounds / $roundsPerWeek);

        return [
            'estimated_duration_weeks' => $totalWeeks,
            'rounds_per_week' => $roundsPerWeek,
            'average_game_length_minutes' => $estimatedGameLength,
            'estimated_completion_date' => now()->addWeeks($totalWeeks),
        ];
    }

    /**
     * Format time control for display
     */
    private function formatTimeControl(Championship $championship): string
    {
        $minutes = $championship->time_control_minutes ?? 10;
        $increment = $championship->time_control_increment ?? 0;

        return $increment > 0 ?
            sprintf('%d+%d minutes', $minutes, $increment) :
            sprintf('%d minutes', $minutes);
    }

    /**
     * Check if user can register
     */
    private function canUserRegister(Championship $championship, $user): bool
    {
        if (!$user) return false;

        if ($championship->participants_count >= $championship->max_participants) return false;

        if (!in_array($championship->status, [ChampionshipStatus::UPCOMING, ChampionshipStatus::REGISTRATION_OPEN])) return false;

        if ($championship->registration_deadline && now()->greaterThan($championship->registration_deadline)) return false;

        if (!$championship->allow_public_registration && !$user->hasAnyRole(['platform_admin', 'organization_admin'])) return false;

        if ($championship->organization_id && !$this->isUserInOrganization($user, $championship->organization_id)) return false;

        $existingRegistration = $this->getUserRegistrationStatus($championship, $user);
        return in_array($existingRegistration, [null, 'cancelled']);
    }

    /**
     * Get user's registration status
     */
    private function getUserRegistrationStatus(Championship $championship, $user): ?string
    {
        if (!$user) return null;

        $participant = ChampionshipParticipant::where('championship_id', $championship->id)
            ->where('user_id', $user->id)
            ->first();

        return $participant?->status;
    }

    /**
     * Check if user is in organization
     */
    private function isUserInOrganization($user, int $organizationId): bool
    {
        return $user->organization_id === $organizationId ||
               $user->hasAnyRole(['platform_admin']) ||
               $user->memberships()->where('organization_id', $organizationId)->exists();
    }
}