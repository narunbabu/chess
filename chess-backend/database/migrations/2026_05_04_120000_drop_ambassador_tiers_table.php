<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

/**
 * The cumulative-tier ambassador commission model has been retired in favor
 * of the time-decaying per-user model (see ReferralService::SUBSCRIPTION_RATE_BY_YEAR).
 * Tiers are no longer consulted at payment time, no admin tier UI is needed,
 * and leaving the table around just confuses future readers.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('ambassador_tiers');
    }

    public function down(): void
    {
        Schema::create('ambassador_tiers', function (\Illuminate\Database\Schema\Blueprint $table) {
            $table->id();
            $table->string('name', 50);
            $table->unsignedInteger('min_paid_referrals');
            $table->decimal('commission_rate', 5, 4);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->unique('min_paid_referrals');
            $table->index('sort_order');
        });
    }
};
