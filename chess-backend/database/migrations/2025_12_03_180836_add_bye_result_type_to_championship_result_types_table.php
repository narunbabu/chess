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
        // First, remove references to bye result type from matches
        DB::table('championship_matches')
            ->whereExists(function ($query) {
                $query->select(DB::raw(1))
                    ->from('championship_result_types')
                    ->whereColumn('championship_result_types.id', 'championship_matches.result_type_id')
                    ->where('championship_result_types.code', 'bye');
            })
            ->update(['result_type_id' => null]);

        // Now safely remove bye result type
        DB::table('championship_result_types')
            ->where('code', 'bye')
            ->delete();
    }
};
