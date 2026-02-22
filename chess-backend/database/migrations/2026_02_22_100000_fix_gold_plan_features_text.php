<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Fix Gold-tier subscription plans: replace "Everything in Standard"
     * with "Everything in Silver" in the features JSON column.
     *
     * The seed migration (2026_02_21_200000) already has the correct text,
     * but the production DB was seeded before the Standard→Silver rename.
     */
    public function up(): void
    {
        DB::table('subscription_plans')
            ->where('tier', 'gold')
            ->get()
            ->each(function ($plan) {
                $features = json_decode($plan->features, true);

                if (! is_array($features)) {
                    return;
                }

                $updated = array_map(function ($f) {
                    return $f === 'Everything in Standard' ? 'Everything in Silver' : $f;
                }, $features);

                if ($updated !== $features) {
                    DB::table('subscription_plans')
                        ->where('id', $plan->id)
                        ->update([
                            'features'   => json_encode($updated),
                            'updated_at' => now(),
                        ]);
                }
            });
    }

    public function down(): void
    {
        DB::table('subscription_plans')
            ->where('tier', 'gold')
            ->get()
            ->each(function ($plan) {
                $features = json_decode($plan->features, true);

                if (! is_array($features)) {
                    return;
                }

                $updated = array_map(function ($f) {
                    return $f === 'Everything in Silver' ? 'Everything in Standard' : $f;
                }, $features);

                if ($updated !== $features) {
                    DB::table('subscription_plans')
                        ->where('id', $plan->id)
                        ->update([
                            'features'   => json_encode($updated),
                            'updated_at' => now(),
                        ]);
                }
            });
    }
};
