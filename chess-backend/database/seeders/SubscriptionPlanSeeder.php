<?php

namespace Database\Seeders;

use App\Models\SubscriptionPlan;
use Illuminate\Database\Seeder;

class SubscriptionPlanSeeder extends Seeder
{
    public function run(): void
    {
        $plans = [
            [
                'tier' => 'free',
                'name' => 'Free',
                'interval' => 'lifetime',
                'price' => 0,
                'undo_limit' => 5,
                'ad_free' => false,
                'priority_matchmaking' => false,
                'can_create_tournaments' => false,
                'advanced_analytics' => false,
                'synthetic_opponents' => false,
                'features' => ['Play vs computer', '5 games/day online', 'Public tournaments', 'Basic game stats', '5 undos per game'],
            ],
            [
                'tier' => 'standard',
                'name' => 'Standard Monthly',
                'interval' => 'monthly',
                'price' => 99,
                'razorpay_plan_id' => env('RAZORPAY_PLAN_STANDARD_MONTHLY', 'plan_SHvIP5LGojTzsx'),
                'undo_limit' => null,
                'ad_free' => true,
                'priority_matchmaking' => true,
                'can_create_tournaments' => false,
                'advanced_analytics' => false,
                'synthetic_opponents' => false,
                'features' => ['Unlimited games', 'All tournaments', 'ELO tracking', 'Full game history', 'Ad-free experience', 'Unlimited undos', 'Priority matchmaking', 'Custom board themes'],
            ],
            [
                'tier' => 'standard',
                'name' => 'Standard Yearly',
                'interval' => 'yearly',
                'price' => 999,
                'razorpay_plan_id' => env('RAZORPAY_PLAN_STANDARD_YEARLY', 'plan_SHvJYPNUsEgLve'),
                'undo_limit' => null,
                'ad_free' => true,
                'priority_matchmaking' => true,
                'can_create_tournaments' => false,
                'advanced_analytics' => false,
                'synthetic_opponents' => false,
                'features' => ['Unlimited games', 'All tournaments', 'ELO tracking', 'Full game history', 'Ad-free experience', 'Unlimited undos', 'Priority matchmaking', 'Custom board themes', 'Save 16% vs monthly'],
            ],
            [
                'tier' => 'premium',
                'name' => 'Premium Monthly',
                'interval' => 'monthly',
                'price' => 499,
                'razorpay_plan_id' => env('RAZORPAY_PLAN_PREMIUM_MONTHLY', 'plan_SHvKFtM137rz2o'),
                'undo_limit' => null,
                'ad_free' => true,
                'priority_matchmaking' => true,
                'can_create_tournaments' => true,
                'advanced_analytics' => true,
                'synthetic_opponents' => true,
                'features' => ['Everything in Standard', 'Org/school affiliation', 'Priority support', 'Advanced analytics', 'AI opponent', 'Opening explorer', 'Game annotations'],
            ],
            [
                'tier' => 'premium',
                'name' => 'Premium Yearly',
                'interval' => 'yearly',
                'price' => 4999,
                'razorpay_plan_id' => env('RAZORPAY_PLAN_PREMIUM_YEARLY', 'plan_SHvKp4jGG32bNP'),
                'undo_limit' => null,
                'ad_free' => true,
                'priority_matchmaking' => true,
                'can_create_tournaments' => true,
                'advanced_analytics' => true,
                'synthetic_opponents' => true,
                'features' => ['Everything in Standard', 'Org/school affiliation', 'Priority support', 'Advanced analytics', 'AI opponent', 'Opening explorer', 'Game annotations', 'Save 16% vs monthly'],
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
