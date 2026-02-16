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
                'features' => ['Basic game stats', 'Play vs computer', 'Online multiplayer', '5 undos per game'],
            ],
            [
                'tier' => 'premium',
                'name' => 'Premium Monthly',
                'interval' => 'monthly',
                'price' => 99,
                'undo_limit' => null,
                'ad_free' => true,
                'priority_matchmaking' => true,
                'can_create_tournaments' => false,
                'advanced_analytics' => false,
                'synthetic_opponents' => false,
                'features' => ['Ad-free experience', 'Unlimited undos', 'Full game statistics', 'Priority matchmaking', 'Custom board themes'],
            ],
            [
                'tier' => 'premium',
                'name' => 'Premium Yearly',
                'interval' => 'yearly',
                'price' => 999,
                'undo_limit' => null,
                'ad_free' => true,
                'priority_matchmaking' => true,
                'can_create_tournaments' => false,
                'advanced_analytics' => false,
                'synthetic_opponents' => false,
                'features' => ['Ad-free experience', 'Unlimited undos', 'Full game statistics', 'Priority matchmaking', 'Custom board themes', 'Save 16% vs monthly'],
            ],
            [
                'tier' => 'pro',
                'name' => 'Pro Monthly',
                'interval' => 'monthly',
                'price' => 499,
                'undo_limit' => null,
                'ad_free' => true,
                'priority_matchmaking' => true,
                'can_create_tournaments' => true,
                'advanced_analytics' => true,
                'synthetic_opponents' => true,
                'features' => ['Everything in Premium', 'Create tournaments', 'Advanced analytics', 'Synthetic AI opponents', 'Opening explorer', 'Game annotations'],
            ],
            [
                'tier' => 'pro',
                'name' => 'Pro Yearly',
                'interval' => 'yearly',
                'price' => 4999,
                'undo_limit' => null,
                'ad_free' => true,
                'priority_matchmaking' => true,
                'can_create_tournaments' => true,
                'advanced_analytics' => true,
                'synthetic_opponents' => true,
                'features' => ['Everything in Premium', 'Create tournaments', 'Advanced analytics', 'Synthetic AI opponents', 'Opening explorer', 'Game annotations', 'Save 16% vs monthly'],
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
