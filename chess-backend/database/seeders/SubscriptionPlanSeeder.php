<?php

namespace Database\Seeders;

use App\Models\SubscriptionPlan;
use Illuminate\Database\Seeder;

class SubscriptionPlanSeeder extends Seeder
{
    public function run(): void
    {
        $plans = [
            // ── Free ──────────────────────────────────────────────────────────
            [
                'tier'                  => 'free',
                'name'                  => 'Free',
                'interval'              => 'lifetime',
                'price'                 => 0,
                'is_active'             => true,
                'undo_limit'            => 5,
                'ad_free'               => false,
                'priority_matchmaking'  => false,
                'can_create_tournaments'=> false,
                'advanced_analytics'    => false,
                'synthetic_opponents'   => false,
                'features'              => [
                    'Play vs computer',
                    '5 games/day online',
                    'Public tournaments',
                    'Basic game stats',
                    '5 undos per game',
                ],
            ],

            // ── Silver monthly (₹99) ──────────────────────────────────────────
            [
                'tier'                  => 'silver',
                'name'                  => 'Silver Monthly',
                'interval'              => 'monthly',
                'price'                 => 99,
                'is_active'             => true,
                'razorpay_plan_id'      => env('RAZORPAY_PLAN_SILVER_MONTHLY', 'plan_SHvIP5LGojTzsx'),
                'undo_limit'            => null,
                'ad_free'               => true,
                'priority_matchmaking'  => true,
                'can_create_tournaments'=> false,
                'advanced_analytics'    => true,
                'synthetic_opponents'   => false,
                'features'              => [
                    'Unlimited online games',
                    'Ad-free experience',
                    'Tournament priority matchmaking',
                    'Advanced stats & ELO tracking',
                    'Full game history',
                    'Unlimited undos',
                    'Custom board themes',
                ],
            ],

            // ── Silver yearly (₹999) ──────────────────────────────────────────
            [
                'tier'                  => 'silver',
                'name'                  => 'Silver Yearly',
                'interval'              => 'yearly',
                'price'                 => 999,
                'is_active'             => true,
                'razorpay_plan_id'      => env('RAZORPAY_PLAN_SILVER_YEARLY', 'plan_SHvJYPNUsEgLve'),
                'undo_limit'            => null,
                'ad_free'               => true,
                'priority_matchmaking'  => true,
                'can_create_tournaments'=> false,
                'advanced_analytics'    => true,
                'synthetic_opponents'   => false,
                'features'              => [
                    'Unlimited online games',
                    'Ad-free experience',
                    'Tournament priority matchmaking',
                    'Advanced stats & ELO tracking',
                    'Full game history',
                    'Unlimited undos',
                    'Custom board themes',
                    'Save 16% vs monthly',
                ],
            ],

            // ── Gold monthly (₹499) ───────────────────────────────────────────
            [
                'tier'                  => 'gold',
                'name'                  => 'Gold Monthly',
                'interval'              => 'monthly',
                'price'                 => 499,
                'is_active'             => true,
                'razorpay_plan_id'      => env('RAZORPAY_PLAN_GOLD_MONTHLY', 'plan_SHvKFtM137rz2o'),
                'undo_limit'            => null,
                'ad_free'               => true,
                'priority_matchmaking'  => true,
                'can_create_tournaments'=> true,
                'advanced_analytics'    => true,
                'synthetic_opponents'   => true,
                'features'              => [
                    'Everything in Silver',
                    'AI analysis (post-game)',
                    'Unlimited tournament entries',
                    'Create & manage tournaments',
                    'AI coaching & hints',
                    'Opening explorer',
                    'Game annotations',
                    'Org/school affiliation badge',
                    'Priority support',
                ],
            ],

            // ── Gold yearly (₹4999) ───────────────────────────────────────────
            [
                'tier'                  => 'gold',
                'name'                  => 'Gold Yearly',
                'interval'              => 'yearly',
                'price'                 => 4999,
                'is_active'             => true,
                'razorpay_plan_id'      => env('RAZORPAY_PLAN_GOLD_YEARLY', 'plan_SHvKp4jGG32bNP'),
                'undo_limit'            => null,
                'ad_free'               => true,
                'priority_matchmaking'  => true,
                'can_create_tournaments'=> true,
                'advanced_analytics'    => true,
                'synthetic_opponents'   => true,
                'features'              => [
                    'Everything in Silver',
                    'AI analysis (post-game)',
                    'Unlimited tournament entries',
                    'Create & manage tournaments',
                    'AI coaching & hints',
                    'Opening explorer',
                    'Game annotations',
                    'Org/school affiliation badge',
                    'Priority support',
                    'Save 16% vs monthly',
                ],
            ],
        ];

        foreach ($plans as $plan) {
            SubscriptionPlan::updateOrCreate(
                ['tier' => $plan['tier'], 'interval' => $plan['interval']],
                $plan
            );
        }
    }
}
