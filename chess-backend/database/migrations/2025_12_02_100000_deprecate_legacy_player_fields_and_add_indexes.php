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
        if (Schema::hasTable('championship_matches') && Schema::hasColumn('championship_matches', 'player1_id')) {
            // Ensure all legacy player1_id/player2_id are properly migrated to color fields
            DB::statement('
                UPDATE championship_matches
                SET white_player_id = COALESCE(white_player_id, player1_id),
                    black_player_id = COALESCE(black_player_id, player2_id)
                WHERE (white_player_id IS NULL OR black_player_id IS NULL)
                   AND (player1_id IS NOT NULL OR player2_id IS NOT NULL)
            ');

            // SQLite doesn't support column comments with MODIFY COLUMN
            // Columns are deprecated by documentation and will be handled in application logic

            // Add missing performance indexes
            Schema::table('championship_matches', function (Blueprint $table) {
                // Composite index for round progression queries
                $table->index(['championship_id', 'round_number', 'status_id'], 'champ_round_status_idx');

                // Index for player queries in new color-based system
                $table->index(['white_player_id', 'status_id'], 'white_player_status_idx');
                $table->index(['black_player_id', 'status_id'], 'black_player_status_idx');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('championship_matches') && Schema::hasColumn('championship_matches', 'player1_id')) {
            // SQLite doesn't support column comments with MODIFY COLUMN
            // No action needed for comment removal

            // Drop performance indexes
            Schema::table('championship_matches', function (Blueprint $table) {
                $table->dropIndex('champ_round_status_idx');
                $table->dropIndex('white_player_status_idx');
                $table->dropIndex('black_player_status_idx');
            });
        }
    }
};