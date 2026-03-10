<?php

namespace App\Console\Commands;

use App\Services\ReferralService;
use Illuminate\Console\Command;

class CalculateReferralPayouts extends Command
{
    protected $signature = 'referrals:calculate-payouts {--period= : Month in YYYY-MM format (defaults to previous month)}';
    protected $description = 'Calculate monthly referral payouts for all referrers';

    public function handle(ReferralService $referralService): int
    {
        $period = $this->option('period') ?? now()->subMonth()->format('Y-m');

        $this->info("Calculating referral payouts for period: {$period}");

        $payouts = $referralService->calculateMonthlyPayouts($period);

        if (empty($payouts)) {
            $this->info('No referral earnings found for this period.');
            return 0;
        }

        $totalAmount = collect($payouts)->sum('total_amount');

        $this->info("Created " . count($payouts) . " payout(s) totaling ₹" . number_format($totalAmount, 2));

        $this->table(
            ['Referrer', 'Amount', 'Earnings Count'],
            collect($payouts)->map(fn ($p) => [
                $p->referrer->name ?? "User #{$p->referrer_user_id}",
                '₹' . number_format($p->total_amount, 2),
                $p->earnings_count,
            ])
        );

        return 0;
    }
}
