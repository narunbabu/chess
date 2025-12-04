<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Add missing bye result type
        DB::table('championship_result_types')->insert([
            'code' => 'bye',
            'label' => 'Bye',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Remove bye result type
        DB::table('championship_result_types')
            ->where('code', 'bye')
            ->delete();
    }
};
