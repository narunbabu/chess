<?php

namespace App\Http\Controllers;

use App\Models\SubscriptionPayment;
use App\Models\SubscriptionPlan;
use App\Services\SubscriptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class SubscriptionController extends Controller
{
    public function __construct(
        protected SubscriptionService $subscriptionService
    ) {}

    /**
     * GET /api/subscriptions/plans
     * List all active plans grouped by tier (public)
     */
    public function plans(): JsonResponse
    {
        $plans = $this->subscriptionService->getPlans();

        return response()->json([
            'plans' => $plans,
            'mock_mode' => $this->subscriptionService->isMockMode(),
        ]);
    }

    /**
     * POST /api/subscriptions/create-order
     * Create a Razorpay order for one-time subscription payment
     */
    public function createOrder(Request $request): JsonResponse
    {
        $request->validate([
            'plan_id' => 'required|integer|exists:subscription_plans,id',
        ]);

        $plan = SubscriptionPlan::findOrFail($request->plan_id);

        if ($plan->isFree()) {
            return response()->json([
                'error'   => 'Invalid plan',
                'message' => 'Cannot create an order for the free plan',
            ], 400);
        }

        if (!$plan->is_active) {
            return response()->json([
                'error'   => 'Plan unavailable',
                'message' => 'This plan is not currently available',
            ], 400);
        }

        try {
            $orderData = $this->subscriptionService->createOrder($request->user(), $plan);
            return response()->json($orderData);
        } catch (\Exception $e) {
            Log::error('Subscription create-order failed', [
                'user_id' => $request->user()->id,
                'plan_id' => $plan->id,
                'error'   => $e->getMessage(),
            ]);
            return response()->json([
                'error'   => 'Order creation failed',
                'message' => 'Unable to create payment order. Please try again.',
            ], 500);
        }
    }

    /**
     * POST /api/subscriptions/verify-payment
     * Verify Razorpay payment signature and activate subscription
     */
    public function verifyPayment(Request $request): JsonResponse
    {
        $request->validate([
            'razorpay_payment_id' => 'required|string|max:255',
            'razorpay_order_id'   => 'required|string|max:255',
            'razorpay_signature'  => 'required|string|max:512',
            'plan_id'             => 'required|integer|exists:subscription_plans,id',
        ]);

        $plan = SubscriptionPlan::findOrFail($request->plan_id);

        try {
            $result = $this->subscriptionService->verifyAndActivate(
                $request->user(),
                $plan,
                $request->only(['razorpay_payment_id', 'razorpay_order_id', 'razorpay_signature'])
            );
            return response()->json($result);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'error'   => 'Verification failed',
                'message' => $e->getMessage(),
            ], 422);
        } catch (\Exception $e) {
            Log::error('Payment verification error', [
                'user_id' => $request->user()->id,
                'plan_id' => $plan->id,
                'error'   => $e->getMessage(),
            ]);
            return response()->json([
                'error'   => 'Verification error',
                'message' => 'Unable to verify payment. Please contact support.',
            ], 500);
        }
    }

    /**
     * GET /api/subscriptions/current
     * Get user's current subscription details
     */
    public function current(Request $request): JsonResponse
    {
        $subscription = $this->subscriptionService->getCurrentSubscription($request->user());

        return response()->json($subscription);
    }

    /**
     * POST /api/subscriptions/checkout
     * Initiate subscription checkout
     */
    public function checkout(Request $request): JsonResponse
    {
        $request->validate([
            'plan_id' => 'required|integer|exists:subscription_plans,id',
        ]);

        $plan = SubscriptionPlan::findOrFail($request->plan_id);

        if (!$plan->is_active) {
            return response()->json([
                'error' => 'Plan is not available',
                'message' => 'The selected plan is currently inactive',
            ], 400);
        }

        if ($plan->isFree()) {
            return response()->json([
                'error' => 'Invalid plan',
                'message' => 'Cannot checkout for a free plan',
            ], 400);
        }

        $user = $request->user();

        // Check if user already has the same or higher tier
        if ($user->hasActiveSubscription() && $user->subscription_tier === $plan->tier) {
            return response()->json([
                'error' => 'Already subscribed',
                'message' => "You already have an active {$plan->tier} subscription",
            ], 409);
        }

        try {
            $checkoutData = $this->subscriptionService->initiateCheckout($user, $plan);

            // In mock mode, auto-complete the payment
            if ($this->subscriptionService->isMockMode()) {
                $payment = SubscriptionPayment::find($checkoutData['payment_id']);
                if ($payment) {
                    $this->subscriptionService->completeMockCheckout($payment);
                    $checkoutData['auto_completed'] = true;
                    $checkoutData['subscription'] = $this->subscriptionService->getCurrentSubscription($user->fresh());
                }
            }

            return response()->json($checkoutData);
        } catch (\Exception $e) {
            Log::error('Subscription checkout failed', [
                'user_id' => $user->id,
                'plan_id' => $plan->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Checkout failed',
                'message' => 'Unable to initiate subscription checkout. Please try again.',
            ], 500);
        }
    }

    /**
     * POST /api/subscriptions/cancel
     * Cancel subscription at cycle end
     */
    public function cancel(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->hasActiveSubscription()) {
            return response()->json([
                'error' => 'No active subscription',
                'message' => 'You do not have an active subscription to cancel',
            ], 400);
        }

        try {
            $result = $this->subscriptionService->cancelSubscription($user);

            return response()->json($result);
        } catch (\Exception $e) {
            Log::error('Subscription cancellation failed', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Cancellation failed',
                'message' => 'Unable to cancel subscription. Please try again.',
            ], 500);
        }
    }

    /**
     * POST /api/subscriptions/webhook
     * Handle Razorpay webhook events (public endpoint)
     */
    public function webhook(Request $request): JsonResponse
    {
        $payload = $request->all();

        Log::info('Subscription webhook received', [
            'event' => $payload['event'] ?? 'unknown',
        ]);

        // Verify webhook signature in production
        if (!$this->subscriptionService->isMockMode()) {
            $webhookSecret = config('services.razorpay.webhook_secret');
            $signature = $request->header('X-Razorpay-Signature');

            if ($webhookSecret && $signature) {
                $expectedSignature = hash_hmac('sha256', $request->getContent(), $webhookSecret);
                if (!hash_equals($expectedSignature, $signature)) {
                    Log::warning('Subscription webhook: invalid signature');
                    return response()->json(['status' => 'invalid_signature'], 400);
                }
            }
        }

        try {
            $this->subscriptionService->handleWebhook($payload);
        } catch (\Exception $e) {
            Log::error('Subscription webhook processing failed', [
                'error' => $e->getMessage(),
                'payload' => $payload,
            ]);
        }

        // Always return 200 to prevent Razorpay retries
        return response()->json(['status' => 'ok']);
    }
}
