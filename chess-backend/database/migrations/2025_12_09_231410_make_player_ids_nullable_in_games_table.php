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
            // Make player IDs nullable to support computer games
            $table->unsignedBigInteger('white_player_id')->nullable()->change();
            $table->unsignedBigInteger('black_player_id')->nullable()->change();

            // Add computer player tracking fields
            $table->unsignedBigInteger('computer_player_id')->nullable()->after('black_player_id');
            $table->integer('computer_level')->nullable()->after('computer_player_id');
            $table->string('player_color')->nullable()->after('computer_level'); // 'white' or 'black'

            // Add foreign key for computer player
            $table->foreign('computer_player_id')->references('id')->on('computer_players')->onDelete('set null');

            // Add indexes for performance
            $table->index(['computer_player_id', 'computer_level']);
            $table->index('player_color');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('games', function (Blueprint $table) {
            // Drop foreign key first
            $table->dropForeign(['computer_player_id']);

            // Drop indexes
            $table->dropIndex(['computer_player_id', 'computer_level']);
            $table->dropIndex('player_color');

            // Drop the new columns
            $table->dropColumn(['computer_player_id', 'computer_level', 'player_color']);

            // Make player IDs not nullable again
            $table->unsignedBigInteger('white_player_id')->nullable(false)->change();
            $table->unsignedBigInteger('black_player_id')->nullable(false)->change();
        });
    }
};
