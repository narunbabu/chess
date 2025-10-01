<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     *
     * Adds timer-related fields to game_histories table to support
     * Phase 2 of the multiplayer standardization plan.
     */
    public function up(): void
    {
        Schema::table('game_histories', function (Blueprint $table) {
            // Add timer fields for multiplayer games (Phase 2)
            $table->integer('white_time_remaining_ms')->nullable()->after('result');
            $table->integer('black_time_remaining_ms')->nullable()->after('white_time_remaining_ms');
            $table->bigInteger('last_move_time')->nullable()->after('black_time_remaining_ms');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('game_histories', function (Blueprint $table) {
            $table->dropColumn([
                'white_time_remaining_ms',
                'black_time_remaining_ms',
                'last_move_time'
            ]);
        });
    }
};
