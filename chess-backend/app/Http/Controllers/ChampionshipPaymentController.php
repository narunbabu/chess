<?php

namespace App\Http\Controllers;

use App\Models\Championship;
use App\Models\ChampionshipParticipant;
use App\Services\RazorpayService;
use App\Enums\PaymentStatus;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class ChampionshipPaymentController extends Controller
{
    public function __construct(
        private RazorpayService $razorpayService
    ) {}

    /**
     * Initiate championship registration and payment
     *
     * @param Request $request
     * @param int $championshipId
     * @return JsonResponse
     */
    public function initiatePayment(Request $request, int $championshipId): JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json([
                    'error' => 'Unauthorized',
                    'message' => 'You must be logged in to register for a championship'
                ], 401);
            }

            // Find championship
            $championship = Championship::findOrFail($championshipId);

            // Validate registration eligibility
            if (!$championship->canRegister($user->id)) {
                $reasons = [];

                if (!$championship->is_registration_open) {
                    $reasons[] = 'Registration is not open for this championship';
                }

                if ($championship->isFull()) {
                    $reasons[] = 'Championship is full';
                }

                if ($championship->isUserRegistered($user->id)) {
                    $reasons[] = 'You are already registered for this championship';
                }

                return response()->json([
                    'error' => 'Registration not allowed',
                    'message' => implode('. ', $reasons),
                ], 422);
            }

            // Create participant record
            $participant = DB::transaction(function () use ($championship, $user) {
                // Double-check within transaction — only active registrations block
                $existing = ChampionshipParticipant::where('championship_id', $championship->id)
                    ->where('user_id', $user->id)
                    ->active()
                    ->lockForUpdate()
                    ->first();

                if ($existing) {
                    throw ValidationException::withMessages([
                        'championship' => ['You are already registered for this championship'],
                    ]);
                }

                // Free entry: mark as completed + registered atomically
                if ($championship->entry_fee == 0) {
                    return ChampionshipParticipant::create([
                        'championship_id' => $championship->id,
                        'user_id' => $user->id,
                        'amount_paid' => 0,
                        'payment_status' => PaymentStatus::COMPLETED->value,
                        'registration_status' => 'registered',
                        'registered_at' => now(),
                    ]);
                }

                return ChampionshipParticipant::create([
                    'championship_id' => $championship->id,
                    'user_id' => $user->id,
                    'amount_paid' => 0,
                    'payment_status' => PaymentStatus::PENDING->value,
                    'registration_status' => 'payment_pending',
                    'registered_at' => now(),
                ]);
            });

            // If free entry, already completed — return immediately
            if ($championship->entry_fee == 0) {
                return response()->json([
                    'message' => 'Registration successful (free entry)',
                    'participant_id' => $participant->id,
                    'payment_required' => false,
                ]);
            }

            // Create Razorpay order
            $orderDetails = $this->razorpayService->createOrder(
                $championship->entry_fee,
                $championship->id,
                $user->id
            );

            // Update participant with order ID
            $participant->update([
                'razorpay_order_id' => $orderDetails['order_id'],
                'amount_paid' => $championship->entry_fee,
            ]);

            return response()->json([
                'message' => 'Payment order created successfully',
                'participant_id' => $participant->id,
                'payment_required' => true,
                'order_details' => $orderDetails,
                'championship' => [
                    'id' => $championship->id,
                    'title' => $championship->title,
                    'entry_fee' => $championship->entry_fee,
                ],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'error' => 'Validation failed',
                'message' => $e->getMessage(),
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            Log::error('Payment initiation failed', [
                'error' => $e->getMessage(),
                'championship_id' => $championshipId,
                'user_id' => Auth::id(),
            ]);

            return response()->json([
                'error' => 'Payment initiation failed',
                'message' => 'Unable to initiate payment. Please try again later.',
            ], 500);
        }
    }

    /**
     * Handle payment callback from Razorpay
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function handleCallback(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'razorpay_payment_id' => 'required|string',
                'razorpay_order_id' => 'required|string',
                'razorpay_signature' => 'required|string',
            ]);

            $user = Auth::user();

            if (!$user) {
                return response()->json([
                    'error' => 'Unauthorized',
                    'message' => 'You must be logged in'
                ], 401);
            }

            // Find participant by order ID
            $participant = ChampionshipParticipant::where('razorpay_order_id', $request->razorpay_order_id)
                ->where('user_id', $user->id)
                ->firstOrFail();

            // Verify payment signature
            $attributes = [
                'razorpay_order_id' => $request->razorpay_order_id,
                'razorpay_payment_id' => $request->razorpay_payment_id,
                'razorpay_signature' => $request->razorpay_signature,
            ];

            if (!$this->razorpayService->verifyPaymentSignature($attributes)) {
                Log::warning('Payment signature verification failed', [
                    'order_id' => $request->razorpay_order_id,
                    'user_id' => $user->id,
                ]);

                return response()->json([
                    'error' => 'Payment verification failed',
                    'message' => 'Payment signature verification failed. Please contact support.',
                ], 400);
            }

            // Process successful payment
            $this->razorpayService->processSuccessfulPayment(
                $participant,
                $request->razorpay_payment_id,
                $request->razorpay_signature
            );

            return response()->json([
                'message' => 'Payment successful! You are now registered for the championship.',
                'participant_id' => $participant->id,
                'championship_id' => $participant->championship_id,
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'error' => 'Participant not found',
                'message' => 'Registration not found for this payment',
            ], 404);
        } catch (\Exception $e) {
            Log::error('Payment callback handling failed', [
                'error' => $e->getMessage(),
                'order_id' => $request->razorpay_order_id ?? null,
                'user_id' => Auth::id(),
            ]);

            return response()->json([
                'error' => 'Payment processing failed',
                'message' => 'Unable to process payment. Please contact support.',
            ], 500);
        }
    }

    /**
     * Handle Razorpay webhook events
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function handleWebhook(Request $request): JsonResponse
    {
        try {
            $signature = $request->header('X-Razorpay-Signature');
            $body = $request->getContent();

            // Verify webhook signature
            if (!$this->razorpayService->verifyWebhookSignature($body, $signature)) {
                Log::warning('Webhook signature verification failed');
                return response()->json(['error' => 'Invalid signature'], 400);
            }

            $payload = json_decode($body, true);
            $event = $payload['event'] ?? null;

            // Handle different webhook events
            switch ($event) {
                case 'payment.captured':
                    $this->razorpayService->handleWebhookPaymentCaptured($payload);
                    break;

                case 'payment.failed':
                    $this->razorpayService->handleWebhookPaymentFailed($payload);
                    break;

                default:
                    Log::info('Unhandled webhook event', ['event' => $event]);
            }

            return response()->json(['status' => 'ok']);
        } catch (\Exception $e) {
            Log::error('Webhook handling failed', [
                'error' => $e->getMessage(),
            ]);

            // Return 200 to prevent Razorpay from retrying
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 200);
        }
    }

    /**
     * Issue refund for a participant
     *
     * @param Request $request
     * @param int $participantId
     * @return JsonResponse
     */
    public function issueRefund(Request $request, int $participantId): JsonResponse
    {
        try {
            $user = Auth::user();

            // Authorization: Must have issue-refunds permission
            if (!\Illuminate\Support\Facades\Gate::allows('issue-refunds')) {
                return response()->json([
                    'error' => 'Forbidden',
                    'message' => 'You do not have permission to issue refunds',
                ], 403);
            }

            $request->validate([
                'reason' => 'sometimes|string|max:255',
            ]);

            $participant = ChampionshipParticipant::findOrFail($participantId);

            if (!$participant->isPaid()) {
                return response()->json([
                    'error' => 'Cannot refund',
                    'message' => 'Participant payment is not completed',
                ], 422);
            }

            $refundDetails = $this->razorpayService->issueRefund(
                $participant,
                $request->input('reason', 'Championship cancelled')
            );

            return response()->json([
                'message' => 'Refund issued successfully',
                'refund_details' => $refundDetails,
            ]);
        } catch (\Exception $e) {
            Log::error('Refund failed', [
                'error' => $e->getMessage(),
                'participant_id' => $participantId,
            ]);

            return response()->json([
                'error' => 'Refund failed',
                'message' => 'Unable to process refund. Please try again later.',
            ], 500);
        }
    }
}
