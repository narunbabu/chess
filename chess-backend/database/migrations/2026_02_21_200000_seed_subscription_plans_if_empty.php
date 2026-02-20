<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Seed the subscription_plans table if it is empty.
 *
 * This migration runs as part of `php artisan migrate --force` so that
 * production deployments automatically populate the plan catalogue without
 * requiring a separate `db:seed` step. It is fully idempotent — if rows
 * already exist (e.g. from a previous seed run) the migration is a no-op.
 *
 * Razorpay plan IDs are left null here and can be filled afterwards by
 * running: `php artisan razorpay:create-plans`
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::table('subscription_plans')->count() > 0) {
            return; // already seeded — nothing to do
        }

        $now = now();

        DB::table('subscription_plans')->insert([
            // ── Free ─────────────────────────────────────────────────────
            [
                'tier'                   => 'free',
                'name'                   => 'Free',
                'interval'               => 'lifetime',
                'price'                  => '0.00',
                'currency'               => 'INR',
                'razorpay_plan_id'       => null,
                'undo_limit'             => 5,
                'ad_free'                => false,
                'priority_matchmaking'   => false,
                'can_create_tournaments' => false,
                'advanced_analytics'     => false,
                'synthetic_opponents'    => false,
                'features'               => json_encode([
                    'Play vs computer',
                    '5 games/day online',
                    'Public tournaments',
                    'Basic game stats',
                    '5 undos per game',
                ]),
                'is_active'              => true,
                'created_at'             => $now,
                'updated_at'             => $now,
            ],

            // ── Silver Monthly (₹99) ─────────────────────────────────────
            [
                'tier'                   => 'silver',
                'name'                   => 'Silver Monthly',
                'interval'               => 'monthly',
                'price'                  => '99.00',
                'currency'               => 'INR',
                'razorpay_plan_id'       => env('RAZORPAY_PLAN_SILVER_MONTHLY'),
                'undo_limit'             => null,
                'ad_free'                => true,
                'priority_matchmaking'   => true,
                'can_create_tournaments' => false,
                'advanced_analytics'     => true,
                'synthetic_opponents'    => false,
                'features'               => json_encode([
                    'Unlimited online games',
                    'Ad-free experience',
                    'Tournament priority matchmaking',
                    'Advanced stats & ELO tracking',
                    'Full game history',
                    'Unlimited undos',
                    'Custom board themes',
                ]),
                'is_active'              => true,
                'created_at'             => $now,
                'updated_at'             => $now,
            ],

            // ── Silver Yearly (₹999) ─────────────────────────────────────
            [
                'tier'                   => 'silver',
                'name'                   => 'Silver Yearly',
                'interval'               => 'yearly',
                'price'                  => '999.00',
                'currency'               => 'INR',
                'razorpay_plan_id'       => env('RAZORPAY_PLAN_SILVER_YEARLY'),
                'undo_limit'             => null,
                'ad_free'                => true,
                'priority_matchmaking'   => true,
                'can_create_tournaments' => false,
                'advanced_analytics'     => true,
                'synthetic_opponents'    => false,
                'features'               => json_encode([
                    'Unlimited online games',
                    'Ad-free experience',
                    'Tournament priority matchmaking',
                    'Advanced stats & ELO tracking',
                    'Full game history',
                    'Unlimited undos',
                    'Custom board themes',
                    'Save 16% vs monthly',
                ]),
                'is_active'              => true,
                'created_at'             => $now,
                'updated_at'             => $now,
            ],

            // ── Gold Monthly (₹499) ──────────────────────────────────────
            [
                'tier'                   => 'gold',
                'name'                   => 'Gold Monthly',
                'interval'               => 'monthly',
                'price'                  => '499.00',
                'currency'               => 'INR',
                'razorpay_plan_id'       => env('RAZORPAY_PLAN_GOLD_MONTHLY'),
                'undo_limit'             => null,
                'ad_free'                => true,
                'priority_matchmaking'   => true,
                'can_create_tournaments' => true,
                'advanced_analytics'     => true,
                'synthetic_opponents'    => true,
                'features'               => json_encode([
                    'Everything in Silver',
                    'AI analysis (post-game)',
                    'Unlimited tournament entries',
                    'Create & manage tournaments',
                    'AI coaching & hints',
                    'Opening explorer',
                    'Game annotations',
                    'Org/school affiliation badge',
                    'Priority support',
                ]),
                'is_active'              => true,
                'created_at'             => $now,
                'updated_at'             => $now,
            ],

            // ── Gold Yearly (₹4999) ──────────────────────────────────────
            [
                'tier'                   => 'gold',
                'name'                   => 'Gold Yearly',
                'interval'               => 'yearly',
                'price'                  => '4999.00',
                'currency'               => 'INR',
                'razorpay_plan_id'       => env('RAZORPAY_PLAN_GOLD_YEARLY'),
                'undo_limit'             => null,
                'ad_free'                => true,
                'priority_matchmaking'   => true,
                'can_create_tournaments' => true,
                'advanced_analytics'     => true,
                'synthetic_opponents'    => true,
                'features'               => json_encode([
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
                ]),
                'is_active'              => true,
                'created_at'             => $now,
                'updated_at'             => $now,
            ],
        ]);
    }

    public function down(): void
    {
        // Remove only the seeded plans on rollback (leaves manually-created rows intact)
        DB::table('subscription_plans')
            ->whereIn('tier', ['free', 'silver', 'gold'])
            ->whereIn('interval', ['lifetime', 'monthly', 'yearly'])
            ->delete();
    }
};
