<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Add the PAUSED status to the championship_statuses table
        DB::table('championship_statuses')->insert([
            'id' => 6,
            'code' => 'paused',
            'label' => 'Paused',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // First, update any championships using 'paused' status to a safe default
        DB::table('championships')
            ->where('status_id', function($query) {
                $query->select('id')->from('championship_statuses')->where('code', 'paused');
            })
            ->update(['status_id' => 1]); // Move to 'upcoming' status

        // Now safely remove the PAUSED status from championship_statuses table
        DB::table('championship_statuses')->where('code', 'paused')->delete();
    }
};
