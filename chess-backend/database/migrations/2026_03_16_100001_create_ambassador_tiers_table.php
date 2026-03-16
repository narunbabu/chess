<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ambassador_tiers', function (Blueprint $table) {
            $table->id();
            $table->string('name', 50);                         // Starter, Bronze, Silver, Gold, Platinum
            $table->unsignedInteger('min_paid_referrals');       // Threshold: number of paid subscribers
            $table->decimal('commission_rate', 5, 4);            // e.g. 0.1000 = 10%, 0.1500 = 15%
            $table->unsignedInteger('sort_order')->default(0);   // Display order
            $table->timestamps();

            $table->unique('min_paid_referrals');
            $table->index('sort_order');
        });

        // Seed default tiers
        DB::table('ambassador_tiers')->insert([
            ['name' => 'Starter',  'min_paid_referrals' => 0,    'commission_rate' => 0.1000, 'sort_order' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Bronze',   'min_paid_referrals' => 50,   'commission_rate' => 0.1200, 'sort_order' => 2, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Silver',   'min_paid_referrals' => 200,  'commission_rate' => 0.1500, 'sort_order' => 3, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Gold',     'min_paid_referrals' => 500,  'commission_rate' => 0.1800, 'sort_order' => 4, 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Platinum', 'min_paid_referrals' => 1000, 'commission_rate' => 0.2000, 'sort_order' => 5, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('ambassador_tiers');
    }
};
