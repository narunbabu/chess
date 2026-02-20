<?php

namespace App\Console\Commands;

use App\Models\SubscriptionPlan;
use Illuminate\Console\Command;

class RazorpayCreatePlans extends Command
{
    protected $signature = 'razorpay:create-plans';
    protected $description = 'Upsert Razorpay plan IDs from .env into subscription_plans table';

    /**
     * Env key → [tier, interval] mapping.
     */
    private const PLAN_MAP = [
        'RAZORPAY_PLAN_FREE'          => ['tier' => 'free',   'interval' => 'lifetime'],
        'RAZORPAY_PLAN_SILVER_MONTHLY' => ['tier' => 'silver', 'interval' => 'monthly'],
        'RAZORPAY_PLAN_SILVER_YEARLY'  => ['tier' => 'silver', 'interval' => 'yearly'],
        'RAZORPAY_PLAN_GOLD_MONTHLY'   => ['tier' => 'gold',   'interval' => 'monthly'],
        'RAZORPAY_PLAN_GOLD_YEARLY'    => ['tier' => 'gold',   'interval' => 'yearly'],
    ];

    public function handle(): int
    {
        $this->info('Reading Razorpay plan IDs from .env...');
        $this->newLine();

        $updated = 0;
        $skipped = 0;
        $missing = 0;

        foreach (self::PLAN_MAP as $envKey => $match) {
            $planId = env($envKey);

            if (empty($planId)) {
                $this->warn("  {$envKey} — not set, skipping");
                $skipped++;
                continue;
            }

            $plan = SubscriptionPlan::where('tier', $match['tier'])
                ->where('interval', $match['interval'])
                ->first();

            if (!$plan) {
                $this->error("  {$envKey} — no subscription_plans row for tier={$match['tier']} interval={$match['interval']}");
                $missing++;
                continue;
            }

            $plan->update(['razorpay_plan_id' => $planId]);
            $this->info("  {$envKey} → {$planId}  (tier={$match['tier']}, interval={$match['interval']})");
            $updated++;
        }

        $this->newLine();
        $this->info("Updated: {$updated}  Skipped: {$skipped}  Missing rows: {$missing}");
        $this->newLine();

        // Summary table of all plans
        $plans = SubscriptionPlan::orderByRaw("CASE tier WHEN 'free' THEN 0 WHEN 'silver' THEN 1 WHEN 'gold' THEN 2 ELSE 3 END")
            ->orderByRaw("CASE `interval` WHEN 'lifetime' THEN 0 WHEN 'monthly' THEN 1 WHEN 'yearly' THEN 2 ELSE 3 END")
            ->get();

        if ($plans->isEmpty()) {
            $this->warn('No subscription plans found. Run the SubscriptionPlanSeeder first.');
            return self::FAILURE;
        }

        $this->table(
            ['ID', 'Tier', 'Interval', 'Price', 'Razorpay Plan ID', 'Active'],
            $plans->map(fn ($p) => [
                $p->id,
                $p->tier,
                $p->interval,
                $p->getFormattedPrice() . $p->getIntervalLabel(),
                $p->razorpay_plan_id ?: '—',
                $p->is_active ? 'Yes' : 'No',
            ])
        );

        return self::SUCCESS;
    }
}
