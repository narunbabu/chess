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
    const COMMISSION_RATE = 0.10; // 10%

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

        // Link the user
        $newUser->update([
            'referred_by_user_id' => $referralCode->user_id,
            'referred_by_code_id' => $referralCode->id,
        ]);

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
     * Record a referral earning when a referred user makes a subscription payment.
     * Called from SubscriptionService after successful payment.
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

        $earningAmount = round($payment->amount * self::COMMISSION_RATE, 2);

        $earning = ReferralEarning::create([
            'referral_code_id' => $user->referred_by_code_id,
            'referrer_user_id' => $user->referred_by_user_id,
            'referred_user_id' => $user->id,
            'subscription_payment_id' => $payment->id,
            'payment_amount' => $payment->amount,
            'commission_rate' => self::COMMISSION_RATE,
            'earning_amount' => $earningAmount,
            'currency' => $payment->currency ?? 'INR',
            'status' => 'pending',
        ]);

        Log::info('Referral earning recorded', [
            'earning_id' => $earning->id,
            'referrer_id' => $user->referred_by_user_id,
            'referred_id' => $user->id,
            'payment_id' => $payment->id,
            'earning_amount' => $earningAmount,
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
            'commission_rate' => self::COMMISSION_RATE * 100 . '%',
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
