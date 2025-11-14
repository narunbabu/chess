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
        Schema::table('games', function (Blueprint $table) {
            // Add cumulative score fields for both players
            $table->decimal('white_player_score', 8, 2)->default(0)->after('black_player_id');
            $table->decimal('black_player_score', 8, 2)->default(0)->after('white_player_score');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('games', function (Blueprint $table) {
            $table->dropColumn(['white_player_score', 'black_player_score']);
        });
    }
};
