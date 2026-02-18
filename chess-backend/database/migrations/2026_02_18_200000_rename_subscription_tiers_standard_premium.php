<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Rename subscription tiers: premium → standard, pro → premium.
     *
     * Order matters: rename 'premium' first (to 'standard') so that
     * renaming 'pro' to 'premium' does not collide.
     */
    public function up(): void
    {
        // Step 1: premium → standard
        DB::table('users')
            ->where('subscription_tier', 'premium')
            ->update(['subscription_tier' => 'standard']);

        DB::table('subscription_plans')
            ->where('tier', 'premium')
            ->update(['tier' => 'standard']);

        // Step 2: pro → premium
        DB::table('users')
            ->where('subscription_tier', 'pro')
            ->update(['subscription_tier' => 'premium']);

        DB::table('subscription_plans')
            ->where('tier', 'pro')
            ->update(['tier' => 'premium']);

        // Update plan display names
        DB::table('subscription_plans')
            ->where('tier', 'standard')
            ->where('interval', 'monthly')
            ->update(['name' => 'Standard Monthly']);

        DB::table('subscription_plans')
            ->where('tier', 'standard')
            ->where('interval', 'yearly')
            ->update(['name' => 'Standard Yearly']);

        DB::table('subscription_plans')
            ->where('tier', 'premium')
            ->where('interval', 'monthly')
            ->update(['name' => 'Premium Monthly']);

        DB::table('subscription_plans')
            ->where('tier', 'premium')
            ->where('interval', 'yearly')
            ->update(['name' => 'Premium Yearly']);
    }

    /**
     * Reverse: premium → pro, standard → premium.
     */
    public function down(): void
    {
        // Step 1: premium → pro
        DB::table('users')
            ->where('subscription_tier', 'premium')
            ->update(['subscription_tier' => 'pro']);

        DB::table('subscription_plans')
            ->where('tier', 'premium')
            ->update(['tier' => 'pro']);

        // Step 2: standard → premium
        DB::table('users')
            ->where('subscription_tier', 'standard')
            ->update(['subscription_tier' => 'premium']);

        DB::table('subscription_plans')
            ->where('tier', 'standard')
            ->update(['tier' => 'premium']);

        // Restore original plan display names
        DB::table('subscription_plans')
            ->where('tier', 'premium')
            ->where('interval', 'monthly')
            ->update(['name' => 'Premium Monthly']);

        DB::table('subscription_plans')
            ->where('tier', 'premium')
            ->where('interval', 'yearly')
            ->update(['name' => 'Premium Yearly']);

        DB::table('subscription_plans')
            ->where('tier', 'pro')
            ->where('interval', 'monthly')
            ->update(['name' => 'Pro Monthly']);

        DB::table('subscription_plans')
            ->where('tier', 'pro')
            ->where('interval', 'yearly')
            ->update(['name' => 'Pro Yearly']);
    }
};
