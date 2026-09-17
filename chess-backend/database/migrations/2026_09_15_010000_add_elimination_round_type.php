<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Add the generic round type used by pure-elimination brackets.
     */
    public function up(): void
    {
        DB::table('championship_round_types')->insertOrIgnore([
            'code' => 'elimination',
            'label' => 'Elimination Round',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Remove only the row introduced by this migration.
     */
    public function down(): void
    {
        DB::table('championship_round_types')
            ->where('code', 'elimination')
            ->delete();
    }
};
