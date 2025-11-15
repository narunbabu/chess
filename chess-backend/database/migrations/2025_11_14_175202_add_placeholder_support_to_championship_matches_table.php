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
        Schema::table('championship_matches', function (Blueprint $table) {
            // Flag to indicate if this is a placeholder match (players TBD based on rankings)
            $table->boolean('is_placeholder')->default(false)->after('auto_generated');

            // Store rank-based position references for placeholder matches
            // Example: {"player1": "rank_1", "player2": "rank_2"} or {"player1": "rank_1", "player2": "rank_3"}
            $table->json('placeholder_positions')->nullable()->after('is_placeholder');

            // Track when players were assigned to placeholder matches
            $table->timestamp('players_assigned_at')->nullable()->after('placeholder_positions');

            // Original round that determines the rankings (e.g., round 2 results determine round 3 matchups)
            $table->unsignedInteger('determined_by_round')->nullable()->after('players_assigned_at');

            // Add index for querying placeholder matches
            $table->index(['is_placeholder', 'round_number']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('championship_matches', function (Blueprint $table) {
            $table->dropIndex(['is_placeholder', 'round_number']);
            $table->dropColumn([
                'is_placeholder',
                'placeholder_positions',
                'players_assigned_at',
                'determined_by_round',
            ]);
        });
    }
};
