<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('game_histories', function (Blueprint $table) {
            // Add game_id to link multiplayer games to the games table
            $table->unsignedBigInteger('game_id')->nullable()->after('user_id');

            // Add opponent name for multiplayer games
            $table->string('opponent_name')->nullable()->after('computer_level');

            // Add game mode to distinguish between computer and multiplayer
            $table->enum('game_mode', ['computer', 'multiplayer'])->default('computer')->after('opponent_name');

            // Add foreign key constraint for game_id
            $table->foreign('game_id')->references('id')->on('games')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('game_histories', function (Blueprint $table) {
            // Drop foreign key first
            $table->dropForeign(['game_id']);

            // Drop columns
            $table->dropColumn(['game_id', 'opponent_name', 'game_mode']);
        });
    }
};