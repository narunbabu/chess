<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Update Silver plan pricing: ₹99→₹199 monthly, ₹999→₹1999 yearly.
 * Also updates Razorpay plan IDs to match the new plans created in Razorpay dashboard.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('subscription_plans')
            ->where('tier', 'silver')
            ->where('interval', 'monthly')
            ->update([
                'price'            => '199.00',
                'razorpay_plan_id' => env('RAZORPAY_PLAN_SILVER_MONTHLY', 'plan_SRlxAPlHQecBKX'),
                'updated_at'       => now(),
            ]);

        DB::table('subscription_plans')
            ->where('tier', 'silver')
            ->where('interval', 'yearly')
            ->update([
                'price'            => '1999.00',
                'razorpay_plan_id' => env('RAZORPAY_PLAN_SILVER_YEARLY', 'plan_SRly4c2XgSVW08'),
                'updated_at'       => now(),
            ]);
    }

    public function down(): void
    {
        DB::table('subscription_plans')
            ->where('tier', 'silver')
            ->where('interval', 'monthly')
            ->update([
                'price'            => '99.00',
                'razorpay_plan_id' => 'plan_SHvIP5LGojTzsx',
                'updated_at'       => now(),
            ]);

        DB::table('subscription_plans')
            ->where('tier', 'silver')
            ->where('interval', 'yearly')
            ->update([
                'price'            => '999.00',
                'razorpay_plan_id' => 'plan_SHvJYPNUsEgLve',
                'updated_at'       => now(),
            ]);
    }
};
