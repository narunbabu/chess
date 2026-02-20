<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Rename subscription tiers: standard → silver, premium → gold.
     *
     * Order: rename 'standard' first (to 'silver') so there is no collision
     * when renaming 'premium' (to 'gold').
     */
    public function up(): void
    {
        // ── users table ───────────────────────────────────────────────────────
        DB::table('users')
            ->where('subscription_tier', 'standard')
            ->update(['subscription_tier' => 'silver']);

        DB::table('users')
            ->where('subscription_tier', 'premium')
            ->update(['subscription_tier' => 'gold']);

        // ── subscription_plans table ──────────────────────────────────────────
        DB::table('subscription_plans')
            ->where('tier', 'standard')
            ->update(['tier' => 'silver']);

        DB::table('subscription_plans')
            ->where('tier', 'premium')
            ->update(['tier' => 'gold']);

        // ── Update display names ──────────────────────────────────────────────
        DB::table('subscription_plans')
            ->where('tier', 'silver')->where('interval', 'monthly')
            ->update(['name' => 'Silver Monthly']);

        DB::table('subscription_plans')
            ->where('tier', 'silver')->where('interval', 'yearly')
            ->update(['name' => 'Silver Yearly']);

        DB::table('subscription_plans')
            ->where('tier', 'gold')->where('interval', 'monthly')
            ->update(['name' => 'Gold Monthly']);

        DB::table('subscription_plans')
            ->where('tier', 'gold')->where('interval', 'yearly')
            ->update(['name' => 'Gold Yearly']);

        // ── user_subscriptions table (if rows exist) ──────────────────────────
        if (DB::getSchemaBuilder()->hasTable('user_subscriptions')) {
            DB::table('user_subscriptions')
                ->where('plan_name', 'standard')
                ->update(['plan_name' => 'silver']);

            DB::table('user_subscriptions')
                ->where('plan_name', 'premium')
                ->update(['plan_name' => 'gold']);
        }
    }

    /**
     * Reverse: silver → standard, gold → premium.
     */
    public function down(): void
    {
        DB::table('users')
            ->where('subscription_tier', 'gold')
            ->update(['subscription_tier' => 'premium']);

        DB::table('users')
            ->where('subscription_tier', 'silver')
            ->update(['subscription_tier' => 'standard']);

        DB::table('subscription_plans')
            ->where('tier', 'gold')
            ->update(['tier' => 'premium']);

        DB::table('subscription_plans')
            ->where('tier', 'silver')
            ->update(['tier' => 'standard']);

        DB::table('subscription_plans')
            ->where('tier', 'premium')->where('interval', 'monthly')
            ->update(['name' => 'Premium Monthly']);

        DB::table('subscription_plans')
            ->where('tier', 'premium')->where('interval', 'yearly')
            ->update(['name' => 'Premium Yearly']);

        DB::table('subscription_plans')
            ->where('tier', 'standard')->where('interval', 'monthly')
            ->update(['name' => 'Standard Monthly']);

        DB::table('subscription_plans')
            ->where('tier', 'standard')->where('interval', 'yearly')
            ->update(['name' => 'Standard Yearly']);

        if (DB::getSchemaBuilder()->hasTable('user_subscriptions')) {
            DB::table('user_subscriptions')
                ->where('plan_name', 'gold')
                ->update(['plan_name' => 'premium']);

            DB::table('user_subscriptions')
                ->where('plan_name', 'silver')
                ->update(['plan_name' => 'standard']);
        }
    }
};
