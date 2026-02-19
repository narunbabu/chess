<?php

namespace App\Services;

use App\Enums\PaymentStatus;
use App\Enums\SubscriptionTier;
use App\Models\SubscriptionPayment;
use App\Models\SubscriptionPlan;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SubscriptionService
{
    /**
     * Check if running in mock mode (no real Razorpay)
     */
    public function isMockMode(): bool
    {
        return config('services.razorpay.mock_mode', true);
    }

    /**
     * Get all active plans grouped by tier
     */
    public function getPlans(): array
    {
        $query = SubscriptionPlan::active();

        if (config('database.default') === 'sqlite') {
            $query->orderByRaw("CASE tier WHEN 'free' THEN 1 WHEN 'standard' THEN 2 WHEN 'premium' THEN 3 ELSE 4 END")
                  ->orderByRaw("CASE \"interval\" WHEN 'lifetime' THEN 1 WHEN 'monthly' THEN 2 WHEN 'yearly' THEN 3 ELSE 4 END");
        } else {
            $query->orderByRaw("FIELD(tier, 'free', 'standard', 'premium')")
                  ->orderByRaw("FIELD(`interval`, 'lifetime', 'monthly', 'yearly')");
        }

        $plans = $query->get();

        return $plans->groupBy('tier')->map->values()->toArray();
    }

    /**
     * Get user's current subscription details
     */
    public function getCurrentSubscription(User $user): array
    {
        $activePlan = null;

        if ($user->hasActiveSubscription()) {
            $activePlan = SubscriptionPlan::where('tier', $user->subscription_tier)
                ->where('interval', '!=', 'lifetime')
                ->first();
        }

        $latestPayment = $user->subscriptionPayments()
            ->completed()
            ->with('plan')
            ->latest()
            ->first();

        return [
            'tier' => $user->subscription_tier ?? 'free',
            'tier_label' => $user->getSubscriptionTierEnum()->label(),
            'is_active' => $user->hasActiveSubscription(),
            'expires_at' => $user->subscription_expires_at?->toISOString(),
            'days_remaining' => $user->subscriptionDaysRemaining(),
            'auto_renew' => $user->subscription_auto_renew,
            'current_plan' => $activePlan,
            'latest_payment' => $latestPayment,
        ];
    }

    /**
     * Initiate a subscription checkout
     */
    public function initiateCheckout(User $user, SubscriptionPlan $plan): array
    {
        if ($plan->isFree()) {
            throw new \InvalidArgumentException('Cannot checkout for a free plan');
        }

        // Create a pending payment record
        $payment = SubscriptionPayment::create([
            'user_id' => $user->id,
            'subscription_plan_id' => $plan->id,
            'payment_status' => PaymentStatus::PENDING->value,
            'amount' => $plan->price,
            'currency' => $plan->currency,
            'interval' => $plan->interval,
        ]);

        if ($this->isMockMode()) {
            return $this->createMockCheckout($user, $plan, $payment);
        }

        return $this->createRazorpayCheckout($user, $plan, $payment);
    }

    /**
     * Create mock checkout data for testing
     */
    protected function createMockCheckout(User $user, SubscriptionPlan $plan, SubscriptionPayment $payment): array
    {
        $mockSubscriptionId = 'sub_mock_' . Str::random(14);

        $payment->update([
            'razorpay_subscription_id' => $mockSubscriptionId,
        ]);

        return [
            'message' => 'Subscription checkout initiated',
            'payment_id' => $payment->id,
            'checkout' => [
                'subscription_id' => $mockSubscriptionId,
                'key_id' => config('services.razorpay.key_id', 'rzp_test_mock'),
                'plan' => [
                    'tier' => $plan->tier,
                    'name' => $plan->name,
                    'price' => $plan->price,
                    'interval' => $plan->interval,
                ],
            ],
            'mock_mode' => true,
        ];
    }

    /**
     * Create real Razorpay subscription checkout
     */
    protected function createRazorpayCheckout(User $user, SubscriptionPlan $plan, SubscriptionPayment $payment): array
    {
        $keyId = config('services.razorpay.key_id');
        $keySecret = config('services.razorpay.key_secret');

        // Create or retrieve Razorpay customer
        $customerId = $user->razorpay_customer_id;
        if (!$customerId) {
            $customerData = $this->createRazorpayCustomer($user, $keyId, $keySecret);
            $customerId = $customerData['id'];
            $user->update(['razorpay_customer_id' => $customerId]);
        }

        // Verify plan has a Razorpay plan ID configured
        if (empty($plan->razorpay_plan_id)) {
            Log::error('Razorpay plan ID missing for subscription plan', [
                'plan_id' => $plan->id,
                'tier' => $plan->tier,
                'interval' => $plan->interval,
            ]);
            throw new \RuntimeException('Subscription plan is not configured for payments. Please contact support.');
        }

        // Create Razorpay subscription
        $subscriptionData = $this->createRazorpaySubscription(
            $plan->razorpay_plan_id,
            $customerId,
            $keyId,
            $keySecret
        );

        $payment->update([
            'razorpay_subscription_id' => $subscriptionData['id'],
        ]);

        return [
            'message' => 'Subscription checkout initiated',
            'payment_id' => $payment->id,
            'checkout' => [
                'subscription_id' => $subscriptionData['id'],
                'key_id' => $keyId,
                'plan' => [
                    'tier' => $plan->tier,
                    'name' => $plan->name,
                    'price' => $plan->price,
                    'interval' => $plan->interval,
                ],
            ],
            'mock_mode' => false,
        ];
    }

    /**
     * Create a Razorpay customer via API
     */
    protected function createRazorpayCustomer(User $user, string $keyId, string $keySecret): array
    {
        $ch = curl_init('https://api.razorpay.com/v1/customers');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_USERPWD => "{$keyId}:{$keySecret}",
            CURLOPT_POSTFIELDS => json_encode([
                'name' => $user->name,
                'email' => $user->email,
            ]),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            Log::error('Razorpay customer creation failed', ['response' => $response]);
            throw new \RuntimeException('Failed to create Razorpay customer');
        }

        return json_decode($response, true);
    }

    /**
     * Create a Razorpay subscription via API
     */
    protected function createRazorpaySubscription(string $planId, string $customerId, string $keyId, string $keySecret): array
    {
        $ch = curl_init('https://api.razorpay.com/v1/subscriptions');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_USERPWD => "{$keyId}:{$keySecret}",
            CURLOPT_POSTFIELDS => json_encode([
                'plan_id' => $planId,
                'customer_id' => $customerId,
                'total_count' => 12,
                'customer_notify' => 1,
            ]),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            Log::error('Razorpay subscription creation failed', ['response' => $response]);
            throw new \RuntimeException('Failed to create Razorpay subscription');
        }

        return json_decode($response, true);
    }

    /**
     * Handle Razorpay webhook events
     */
    public function handleWebhook(array $payload): void
    {
        $event = $payload['event'] ?? null;
        $subscriptionEntity = $payload['payload']['subscription']['entity'] ?? null;

        if (!$event || !$subscriptionEntity) {
            Log::warning('Subscription webhook: missing event or entity', $payload);
            return;
        }

        $razorpaySubscriptionId = $subscriptionEntity['id'] ?? null;

        Log::info("Subscription webhook: {$event}", [
            'subscription_id' => $razorpaySubscriptionId,
        ]);

        match($event) {
            'subscription.authenticated' => $this->handleSubscriptionAuthenticated($subscriptionEntity),
            'subscription.activated' => $this->handleSubscriptionActivated($subscriptionEntity, $payload),
            'subscription.charged' => $this->handleSubscriptionCharged($subscriptionEntity, $payload),
            'subscription.cancelled' => $this->handleSubscriptionCancelled($subscriptionEntity),
            'subscription.halted' => $this->handleSubscriptionHalted($subscriptionEntity),
            default => Log::info("Subscription webhook: unhandled event {$event}"),
        };
    }

    protected function handleSubscriptionAuthenticated(array $subscription): void
    {
        Log::info('Subscription authenticated', ['id' => $subscription['id']]);
    }

    protected function handleSubscriptionActivated(array $subscription, array $payload): void
    {
        $razorpaySubId = $subscription['id'];
        $razorpayPaymentId = $payload['payload']['payment']['entity']['id'] ?? null;

        // Find the pending payment
        $payment = SubscriptionPayment::where('razorpay_subscription_id', $razorpaySubId)
            ->whereHas('paymentStatusRelation', fn($q) => $q->where('code', 'pending'))
            ->first();

        if (!$payment) {
            Log::warning('Subscription activated: no pending payment found', ['sub_id' => $razorpaySubId]);
            return;
        }

        // Skip if this payment already processed (idempotent)
        if ($razorpayPaymentId) {
            $exists = SubscriptionPayment::where('razorpay_payment_id', $razorpayPaymentId)->exists();
            if ($exists) {
                Log::info('Subscription activated: payment already processed', ['payment_id' => $razorpayPaymentId]);
                return;
            }
        }

        $plan = $payment->plan;
        $user = $payment->user;

        // Update payment record
        $payment->update([
            'razorpay_payment_id' => $razorpayPaymentId,
            'payment_status' => PaymentStatus::COMPLETED->value,
            'paid_at' => now(),
            'period_start' => now(),
            'period_end' => $plan->interval === 'monthly' ? now()->addMonth() : now()->addYear(),
        ]);

        // Activate user subscription
        $user->activateSubscription($plan, $razorpaySubId);

        Log::info('Subscription activated for user', [
            'user_id' => $user->id,
            'tier' => $plan->tier,
            'interval' => $plan->interval,
        ]);
    }

    protected function handleSubscriptionCharged(array $subscription, array $payload): void
    {
        $razorpaySubId = $subscription['id'];
        $razorpayPaymentId = $payload['payload']['payment']['entity']['id'] ?? null;

        // Idempotent: skip if payment already recorded
        if ($razorpayPaymentId) {
            $exists = SubscriptionPayment::where('razorpay_payment_id', $razorpayPaymentId)->exists();
            if ($exists) {
                Log::info('Subscription charged: payment already recorded', ['payment_id' => $razorpayPaymentId]);
                return;
            }
        }

        // Find existing payment for this subscription to get user and plan
        $existingPayment = SubscriptionPayment::where('razorpay_subscription_id', $razorpaySubId)
            ->completed()
            ->latest()
            ->first();

        if (!$existingPayment) {
            Log::warning('Subscription charged: no existing payment found', ['sub_id' => $razorpaySubId]);
            return;
        }

        $user = $existingPayment->user;
        $plan = $existingPayment->plan;

        // Create new payment record for this renewal
        SubscriptionPayment::create([
            'user_id' => $user->id,
            'subscription_plan_id' => $plan->id,
            'razorpay_subscription_id' => $razorpaySubId,
            'razorpay_payment_id' => $razorpayPaymentId,
            'payment_status' => PaymentStatus::COMPLETED->value,
            'amount' => $plan->price,
            'currency' => $plan->currency,
            'interval' => $plan->interval,
            'paid_at' => now(),
            'period_start' => now(),
            'period_end' => $plan->interval === 'monthly' ? now()->addMonth() : now()->addYear(),
        ]);

        // Extend user subscription
        $user->extendSubscription($plan->interval);

        Log::info('Subscription renewed for user', [
            'user_id' => $user->id,
            'tier' => $plan->tier,
        ]);
    }

    protected function handleSubscriptionCancelled(array $subscription): void
    {
        $razorpaySubId = $subscription['id'];

        $user = User::where('razorpay_subscription_id', $razorpaySubId)->first();
        if (!$user) {
            Log::warning('Subscription cancelled: user not found', ['sub_id' => $razorpaySubId]);
            return;
        }

        // Mark as non-renewal but keep active until expiry
        $user->update(['subscription_auto_renew' => false]);

        Log::info('Subscription cancelled (will expire at end of cycle)', [
            'user_id' => $user->id,
            'expires_at' => $user->subscription_expires_at,
        ]);
    }

    protected function handleSubscriptionHalted(array $subscription): void
    {
        $razorpaySubId = $subscription['id'];

        $user = User::where('razorpay_subscription_id', $razorpaySubId)->first();
        if (!$user) {
            Log::warning('Subscription halted: user not found', ['sub_id' => $razorpaySubId]);
            return;
        }

        // All retries exhausted — downgrade to free
        $user->downgradeToFree();

        Log::info('Subscription halted — user downgraded to free', [
            'user_id' => $user->id,
        ]);
    }

    /**
     * Process mock checkout completion (for testing)
     */
    public function completeMockCheckout(SubscriptionPayment $payment): void
    {
        $plan = $payment->plan;
        $user = $payment->user;

        $mockPaymentId = 'pay_mock_' . Str::random(14);

        $payment->update([
            'razorpay_payment_id' => $mockPaymentId,
            'payment_status' => PaymentStatus::COMPLETED->value,
            'paid_at' => now(),
            'period_start' => now(),
            'period_end' => $plan->interval === 'monthly' ? now()->addMonth() : now()->addYear(),
        ]);

        $user->activateSubscription($plan, $payment->razorpay_subscription_id);

        Log::info('Mock subscription checkout completed', [
            'user_id' => $user->id,
            'tier' => $plan->tier,
            'interval' => $plan->interval,
        ]);
    }

    /**
     * Cancel a user's subscription
     */
    public function cancelSubscription(User $user): array
    {
        if (!$user->hasActiveSubscription()) {
            throw new \InvalidArgumentException('No active subscription to cancel');
        }

        if (!$this->isMockMode() && $user->razorpay_subscription_id) {
            $this->cancelRazorpaySubscription($user->razorpay_subscription_id);
        }

        $user->update(['subscription_auto_renew' => false]);

        return [
            'message' => 'Subscription will be cancelled at the end of the current billing cycle',
            'expires_at' => $user->subscription_expires_at?->toISOString(),
            'days_remaining' => $user->subscriptionDaysRemaining(),
        ];
    }

    /**
     * Cancel subscription on Razorpay
     */
    protected function cancelRazorpaySubscription(string $subscriptionId): void
    {
        $keyId = config('services.razorpay.key_id');
        $keySecret = config('services.razorpay.key_secret');

        $ch = curl_init("https://api.razorpay.com/v1/subscriptions/{$subscriptionId}/cancel");
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_USERPWD => "{$keyId}:{$keySecret}",
            CURLOPT_POSTFIELDS => json_encode(['cancel_at_cycle_end' => 1]),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            Log::error('Razorpay subscription cancellation failed', [
                'subscription_id' => $subscriptionId,
                'response' => $response,
            ]);
        }
    }

    /**
     * Expire stale subscriptions (daily cron)
     */
    public function expireStaleSubscriptions(): int
    {
        // Find users whose subscription has expired (past grace period of 3 days)
        $expiredUsers = User::where('subscription_tier', '!=', 'free')
            ->whereNotNull('subscription_expires_at')
            ->where('subscription_expires_at', '<', now()->subDays(3))
            ->get();

        $count = 0;
        foreach ($expiredUsers as $user) {
            $user->downgradeToFree();
            $count++;

            Log::info('Subscription expired — downgraded to free', [
                'user_id' => $user->id,
                'expired_at' => $user->subscription_expires_at,
            ]);
        }

        return $count;
    }
}
