<?php

namespace App\Console\Commands;

use App\Models\ReferralEarning;
use Illuminate\Console\Command;

/**
 * Releases subscription-based referral earnings from the 7-day refund hold.
 *
 * Subscription earnings are recorded with status='pending'. After 7 days the
 * Razorpay refund window has closed, so we promote them to status='approved'
 * (ready to be rolled into the next monthly payout). Activity-milestone
 * earnings are written as 'approved' from the start and are not affected.
 */
class ReleaseHeldReferralEarnings extends Command
{
    protected $signature = 'referrals:release-held {--days=7 : Hold period in days}';
    protected $description = 'Promote pending subscription referral earnings older than the hold window to approved.';

    public function handle(): int
    {
        $days = max(0, (int) $this->option('days'));
        $cutoff = now()->subDays($days);

        $count = ReferralEarning::where('status', 'pending')
            ->where('event_type', 'subscription')
            ->where('created_at', '<=', $cutoff)
            ->update(['status' => 'approved', 'updated_at' => now()]);

        $this->info("Released {$count} subscription earning(s) older than {$days} day(s).");

        return Command::SUCCESS;
    }
}
