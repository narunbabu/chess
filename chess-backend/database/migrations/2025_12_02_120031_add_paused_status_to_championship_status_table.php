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
        // Remove the PAUSED status from championship_statuses table
        DB::table('championship_statuses')->where('code', 'paused')->delete();
    }
};
