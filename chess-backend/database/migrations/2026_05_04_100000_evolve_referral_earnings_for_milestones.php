<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Ambassador program — evolve referral_earnings to support activity milestones
 * (signup_phone ₹2, first_activity ₹3, activity_100 ₹5) in addition to the
 * existing subscription-based earnings, and record the subscription year so
 * the time-decaying commission (Y1 10% / Y2 5% / Y3-4 2% / Y5+ 0%) can be
 * computed at payment time and audited later.
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1. Make subscription_payment_id nullable (activity earnings have none).
        // SQLite (test env) can't drop FKs cleanly with the schema builder, so
        // branch on the driver.
        $driver = DB::connection()->getDriverName();

        if ($driver === 'sqlite') {
            Schema::table('referral_earnings', function (Blueprint $table) {
                $table->unsignedBigInteger('subscription_payment_id')->nullable()->change();
            });
        } else {
            Schema::table('referral_earnings', function (Blueprint $table) {
                $table->dropForeign(['subscription_payment_id']);
            });
            Schema::table('referral_earnings', function (Blueprint $table) {
                $table->unsignedBigInteger('subscription_payment_id')->nullable()->change();
                $table->foreign('subscription_payment_id')
                    ->references('id')->on('subscription_payments')
                    ->cascadeOnDelete();
            });
        }

        // 2. Add event metadata.
        Schema::table('referral_earnings', function (Blueprint $table) {
            $table->string('event_type', 32)
                ->default('subscription')
                ->after('referred_user_id')
                ->comment('signup_phone | first_activity | activity_100 | subscription');
            $table->unsignedBigInteger('event_ref_id')
                ->nullable()
                ->after('event_type')
                ->comment('Polymorphic reference: game_id / puzzle_attempt_id / null');
            $table->unsignedTinyInteger('subscription_year')
                ->nullable()
                ->after('subscription_payment_id')
                ->comment('1..N years since first subscription payment for this referred user');

            $table->index(['referred_user_id', 'event_type'], 'ref_earnings_user_event_idx');
        });

        // 3. Backfill: any pre-existing rows are subscription earnings.
        DB::table('referral_earnings')
            ->whereNotNull('subscription_payment_id')
            ->update(['event_type' => 'subscription']);
    }

    public function down(): void
    {
        Schema::table('referral_earnings', function (Blueprint $table) {
            $table->dropIndex('ref_earnings_user_event_idx');
            $table->dropColumn(['event_type', 'event_ref_id', 'subscription_year']);
        });

        // Leaving subscription_payment_id nullable on rollback is safe; not
        // worth restoring NOT NULL since the activity rows we created can't
        // satisfy it anyway.
    }
};
