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
            $table->integer('undo_white_remaining')->default(3)->after('game_mode');
            $table->integer('undo_black_remaining')->default(3)->after('undo_white_remaining');
            $table->index(['game_mode', 'undo_white_remaining', 'undo_black_remaining'], 'idx_games_undo_tracking');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('games', function (Blueprint $table) {
            $table->dropIndex('idx_games_undo_tracking');
            $table->dropColumn(['undo_white_remaining', 'undo_black_remaining']);
        });
    }
};
