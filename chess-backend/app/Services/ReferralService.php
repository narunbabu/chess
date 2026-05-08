<?php

namespace App\Services;

use App\Models\ReferralCode;
use App\Models\ReferralEarning;
use App\Models\ReferralPayout;
use App\Models\SubscriptionPayment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ReferralService
{
    /**
     * Time-decaying commission rates per subscription year.
     * Index 0 = Y1 (first 365 days since referred user's first paid subscription).
     * Y5+ pays nothing — referrer ages out.
     */
    public const SUBSCRIPTION_RATE_BY_YEAR = [
        1 => 0.10,
        2 => 0.05,
        3 => 0.02,
        4 => 0.02,
    ];

    /** Activity milestone amounts in INR (rupees). */
    public const MILESTONE_SIGNUP_PHONE   = 2.00;  // referred user registers with phone filled
    public const MILESTONE_FIRST_ACTIVITY = 3.00;  // first rated game (≥10 plies) OR first puzzle solved
    public const MILESTONE_ACTIVITY_100   = 5.00;  // (rated_games + unique_puzzles_solved) ≥ 100

    /** Minimum half-moves for a rated game to count toward first_activity. */
    public const RATED_GAME_MIN_PLIES = 10;

    /** Combined activity threshold for the ₹5 milestone. */
    public const ACTIVITY_100_THRESHOLD = 100;

    const COMMISSION_RATE = 0.10; // legacy fallback (deprecated, kept for old callers)

    /**
     * Generate a new referral code for a user.
     */
    public function generateCode(User $user, ?string $label = null, ?int $maxUses = null, ?string $expiresAt = null): ReferralCode
    {
        return ReferralCode::create([
            'user_id' => $user->id,
            'code' => $this->generateUniqueCode(),
            'label' => $label,
            'max_uses' => $maxUses,
            'expires_at' => $expiresAt,
        ]);
    }

    /**
     * Validate a referral code and return it if valid.
     */
    public function validateCode(string $code): ?ReferralCode
    {
        $referralCode = ReferralCode::where('code', strtoupper($code))->first();

        if (!$referralCode || !$referralCode->isUsable()) {
            return null;
        }

        return $referralCode;
    }

    /**
     * Link a newly registered user to a referrer via referral code.
     * Called during registration.
     */
    public function linkReferral(User $newUser, string $code): bool
    {
        $referralCode = $this->validateCode($code);

        if (!$referralCode) {
            Log::warning('Invalid referral code used during registration', [
                'code' => $code,
                'user_id' => $newUser->id,
            ]);
            return false;
        }

        // Prevent self-referral
        if ($referralCode->user_id === $newUser->id) {
            return false;
        }

        // Build update data
        $updateData = [
            'referred_by_user_id' => $referralCode->user_id,
            'referred_by_code_id' => $referralCode->id,
        ];

        // Auto-assign organization if the referrer is an org admin
        $referrer = User::find($referralCode->user_id);
        if ($referrer && $referrer->organization_id && $referrer->hasRole('organization_admin')) {
            $updateData['organization_id'] = $referrer->organization_id;
        }

        // Link the user
        $newUser->update($updateData);

        // Increment code usage
        $referralCode->incrementUsage();

        Log::info('Referral linked', [
            'referrer_id' => $referralCode->user_id,
            'referred_id' => $newUser->id,
            'code' => $code,
        ]);

        return true;
    }

    /**
     * Commission rate for a given subscription year (1-indexed).
     * Y5+ returns 0 — referrer ages out four years after the user's first paid
     * subscription.
     */
    public function rateForSubscriptionYear(int $year): float
    {
        return self::SUBSCRIPTION_RATE_BY_YEAR[$year] ?? 0.0;
    }

    /**
     * Determine which subscription year (1..N) a payment falls into for the
     * referred user, measured from the user's *first* successful subscription
     * payment. Year boundaries are 365-day windows.
     */
    public function subscriptionYearForPayment(SubscriptionPayment $payment): int
    {
        $firstPayment = SubscriptionPayment::where('user_id', $payment->user_id)
            ->where('status', 'paid')
            ->whereNotNull('paid_at')
            ->orderBy('paid_at')
            ->first();

        if (!$firstPayment || !$payment->paid_at) {
            return 1;
        }

        $daysSince = $firstPayment->paid_at->diffInDays($payment->paid_at);
        return (int) floor($daysSince / 365) + 1;
    }

    /**
     * Record a referral earning when a referred user makes a subscription
     * payment. Rate is the time-decaying year-based rate computed from the
     * referred user's first subscription payment date. Called from
     * SubscriptionService after a successful payment.
     */
    public function recordEarning(SubscriptionPayment $payment): ?ReferralEarning
    {
        $user = $payment->user;

        // Check if this user was referred
        if (!$user->referred_by_user_id || !$user->referred_by_code_id) {
            return null;
        }

        // Prevent duplicate earnings for the same payment
        $existing = ReferralEarning::where('subscription_payment_id', $payment->id)->first();
        if ($existing) {
            return $existing;
        }

        // Time-decaying rate: Y1 10% → Y2 5% → Y3-4 2% → Y5+ 0%.
        $year = $this->subscriptionYearForPayment($payment);
        $commissionRate = $this->rateForSubscriptionYear($year);

        if ($commissionRate <= 0) {
            Log::info('Referral subscription earning skipped — referrer aged out', [
                'referrer_id' => $user->referred_by_user_id,
                'referred_id' => $user->id,
                'payment_id' => $payment->id,
                'subscription_year' => $year,
            ]);
            return null;
        }

        $earningAmount = round($payment->amount * $commissionRate, 2);

        $earning = ReferralEarning::create([
            'referral_code_id' => $user->referred_by_code_id,
            'referrer_user_id' => $user->referred_by_user_id,
            'referred_user_id' => $user->id,
            'event_type' => 'subscription',
            'event_ref_id' => null,
            'subscription_payment_id' => $payment->id,
            'subscription_year' => $year,
            'payment_amount' => $payment->amount,
            'commission_rate' => $commissionRate,
            'earning_amount' => $earningAmount,
            'currency' => $payment->currency ?? 'INR',
            'status' => 'pending', // released by daily cron after 7-day refund hold
        ]);

        Log::info('Referral earning recorded', [
            'earning_id' => $earning->id,
            'referrer_id' => $user->referred_by_user_id,
            'referred_id' => $user->id,
            'payment_id' => $payment->id,
            'subscription_year' => $year,
            'commission_rate' => $commissionRate,
            'earning_amount' => $earningAmount,
        ]);

        return $earning;
    }

    /**
     * Record a one-time activity-milestone earning for a referred user, if
     * eligible. Idempotent: a (referred_user, event_type) pair earns at most
     * once. Returns the created earning, or null if the user wasn't referred
     * or the milestone was already paid.
     *
     * @param string $eventType One of: signup_phone | first_activity | activity_100
     * @param int|null $eventRefId Optional ref id (e.g. game_id, puzzle_attempt_id)
     */
    public function recordMilestone(User $referredUser, string $eventType, ?int $eventRefId = null): ?ReferralEarning
    {
        if (!$referredUser->referred_by_user_id || !$referredUser->referred_by_code_id) {
            return null;
        }

        $amount = match ($eventType) {
            'signup_phone'   => self::MILESTONE_SIGNUP_PHONE,
            'first_activity' => self::MILESTONE_FIRST_ACTIVITY,
            'activity_100'   => self::MILESTONE_ACTIVITY_100,
            default          => null,
        };

        if ($amount === null) {
            Log::warning('Unknown referral milestone type', ['event_type' => $eventType]);
            return null;
        }

        // Idempotency: skip if this user already earned this milestone for this
        // referrer. Using a query rather than a unique constraint so future
        // policy changes (e.g. resetting a milestone) don't fight the schema.
        $existing = ReferralEarning::where('referred_user_id', $referredUser->id)
            ->where('event_type', $eventType)
            ->first();

        if ($existing) {
            return $existing;
        }

        $earning = ReferralEarning::create([
            'referral_code_id' => $referredUser->referred_by_code_id,
            'referrer_user_id' => $referredUser->referred_by_user_id,
            'referred_user_id' => $referredUser->id,
            'event_type' => $eventType,
            'event_ref_id' => $eventRefId,
            'subscription_payment_id' => null,
            'subscription_year' => null,
            'payment_amount' => 0,
            'commission_rate' => 0,
            'earning_amount' => $amount,
            'currency' => 'INR',
            'status' => 'approved', // milestones approve immediately — no refund window
        ]);

        Log::info('Referral milestone earned', [
            'earning_id' => $earning->id,
            'referrer_id' => $referredUser->referred_by_user_id,
            'referred_id' => $referredUser->id,
            'event_type' => $eventType,
            'event_ref_id' => $eventRefId,
            'amount' => $amount,
        ]);

        return $earning;
    }

    /**
     * Calculate and create monthly payouts for all referrers.
     * Runs on the 1st of each month for the previous month's earnings.
     */
    public function calculateMonthlyPayouts(?string $period = null): array
    {
        $period = $period ?? now()->subMonth()->format('Y-m');

        $startOfMonth = \Carbon\Carbon::createFromFormat('Y-m', $period)->startOfMonth();
        $endOfMonth = $startOfMonth->copy()->endOfMonth();

        // Get all approved/pending earnings for the period grouped by referrer
        $earningsByReferrer = ReferralEarning::whereIn('status', ['pending', 'approved'])
            ->whereNull('payout_id')
            ->whereBetween('created_at', [$startOfMonth, $endOfMonth])
            ->select('referrer_user_id')
            ->selectRaw('SUM(earning_amount) as total')
            ->selectRaw('COUNT(*) as count')
            ->groupBy('referrer_user_id')
            ->get();

        $payouts = [];

        DB::transaction(function () use ($earningsByReferrer, $period, &$payouts) {
            foreach ($earningsByReferrer as $group) {
                if ($group->total <= 0) {
                    continue;
                }

                // Check if payout already exists for this period
                $existingPayout = ReferralPayout::where('referrer_user_id', $group->referrer_user_id)
                    ->where('period', $period)
                    ->first();

                if ($existingPayout) {
                    continue;
                }

                // Create payout record
                $payout = ReferralPayout::create([
                    'referrer_user_id' => $group->referrer_user_id,
                    'period' => $period,
                    'total_amount' => $group->total,
                    'earnings_count' => $group->count,
                    'status' => 'pending',
                ]);

                // Link earnings to this payout
                ReferralEarning::whereIn('status', ['pending', 'approved'])
                    ->whereNull('payout_id')
                    ->where('referrer_user_id', $group->referrer_user_id)
                    ->whereBetween('created_at', [
                        \Carbon\Carbon::createFromFormat('Y-m', $period)->startOfMonth(),
                        \Carbon\Carbon::createFromFormat('Y-m', $period)->endOfMonth(),
                    ])
                    ->update([
                        'payout_id' => $payout->id,
                        'status' => 'approved',
                    ]);

                $payouts[] = $payout;
            }
        });

        Log::info('Monthly referral payouts calculated', [
            'period' => $period,
            'payout_count' => count($payouts),
            'total_amount' => collect($payouts)->sum('total_amount'),
        ]);

        return $payouts;
    }

    /**
     * Get referral stats for a user (used in dashboard).
     */
    public function getUserStats(User $user): array
    {
        $referredCount = User::where('referred_by_user_id', $user->id)->count();

        $totalEarnings = ReferralEarning::where('referrer_user_id', $user->id)
            ->sum('earning_amount');

        $pendingEarnings = ReferralEarning::where('referrer_user_id', $user->id)
            ->whereIn('status', ['pending', 'approved'])
            ->sum('earning_amount');

        $paidEarnings = ReferralEarning::where('referrer_user_id', $user->id)
            ->where('status', 'paid')
            ->sum('earning_amount');

        $codes = ReferralCode::where('user_id', $user->id)->get();

        return [
            'referred_users_count' => $referredCount,
            'total_earnings' => round($totalEarnings, 2),
            'pending_earnings' => round($pendingEarnings, 2),
            'paid_earnings' => round($paidEarnings, 2),
            'commission_schedule' => self::SUBSCRIPTION_RATE_BY_YEAR,
            'codes' => $codes,
            'user_referral_code' => $user->referral_code,
        ];
    }

    /**
     * Admin: Get overview of all referral activity.
     */
    public function getAdminOverview(?string $period = null): array
    {
        $query = ReferralEarning::query();

        if ($period) {
            $start = \Carbon\Carbon::createFromFormat('Y-m', $period)->startOfMonth();
            $end = $start->copy()->endOfMonth();
            $query->whereBetween('created_at', [$start, $end]);
        }

        $totalEarnings = (clone $query)->sum('earning_amount');
        $pendingEarnings = (clone $query)->whereIn('status', ['pending', 'approved'])->sum('earning_amount');
        $paidEarnings = (clone $query)->where('status', 'paid')->sum('earning_amount');
        $earningsCount = (clone $query)->count();

        // Top referrers
        $topReferrers = ReferralEarning::select('referrer_user_id')
            ->selectRaw('SUM(earning_amount) as total_earned')
            ->selectRaw('COUNT(DISTINCT referred_user_id) as referred_count')
            ->groupBy('referrer_user_id')
            ->orderByDesc('total_earned')
            ->limit(20)
            ->with('referrer:id,name,email')
            ->get();

        // Pending payouts
        $pendingPayouts = ReferralPayout::where('status', 'pending')
            ->with('referrer:id,name,email')
            ->orderByDesc('total_amount')
            ->get();

        // Recent earnings
        $recentEarnings = ReferralEarning::with([
            'referrer:id,name,email',
            'referredUser:id,name,email',
            'referralCode:id,code,label',
        ])
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        return [
            'total_earnings' => round($totalEarnings, 2),
            'pending_earnings' => round($pendingEarnings, 2),
            'paid_earnings' => round($paidEarnings, 2),
            'earnings_count' => $earningsCount,
            'total_referred_users' => User::whereNotNull('referred_by_user_id')->count(),
            'total_referral_codes' => ReferralCode::count(),
            'top_referrers' => $topReferrers,
            'pending_payouts' => $pendingPayouts,
            'recent_earnings' => $recentEarnings,
        ];
    }

    private function generateUniqueCode(): string
    {
        do {
            $code = strtoupper(Str::random(8));
        } while (ReferralCode::where('code', $code)->exists());

        return $code;
    }
}
