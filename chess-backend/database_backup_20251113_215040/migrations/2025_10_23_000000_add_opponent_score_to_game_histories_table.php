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
        Schema::table('game_histories', function (Blueprint $table) {
            // Add opponent_score field (for computer or multiplayer opponent)
            $table->float('opponent_score')->default(0)->after('final_score');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('game_histories', function (Blueprint $table) {
            $table->dropColumn('opponent_score');
        });
    }
};
