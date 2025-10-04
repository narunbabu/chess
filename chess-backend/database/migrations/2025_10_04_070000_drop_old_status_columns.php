<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Phase 4: Drop old ENUM columns after verifying FK columns work correctly
     *
     * Prerequisites:
     * - Phase 1: Lookup tables created
     * - Phase 2: FK columns added and backfilled
     * - Phase 3: Frontend updated to use canonical values
     *
     * This migration:
     * - Drops the old 'status' ENUM column (replaced by status_id FK)
     * - Drops the old 'end_reason' ENUM column (replaced by end_reason_id FK)
     */
    public function up(): void
    {
        Schema::table('games', function (Blueprint $table) {
            // Drop indexes that reference the status column first (SQLite requirement)
            $table->dropIndex(['white_player_id', 'status']); // games_white_player_id_status_index
            $table->dropIndex(['black_player_id', 'status']); // games_black_player_id_status_index
            $table->dropIndex(['status']); // games_status_index
        });

        Schema::table('games', function (Blueprint $table) {
            // Now we can safely drop the old ENUM columns
            // The FK columns (status_id, end_reason_id) now contain all the data
            $table->dropColumn('status');
            $table->dropColumn('end_reason');
        });

        // Recreate indexes using status_id instead
        Schema::table('games', function (Blueprint $table) {
            $table->index(['white_player_id', 'status_id'], 'games_white_player_id_status_id_index');
            $table->index(['black_player_id', 'status_id'], 'games_black_player_id_status_id_index');
            $table->index(['status_id'], 'games_status_id_index');
        });

        // Log the change
        DB::statement("-- Phase 4 cleanup: Old ENUM columns dropped successfully");
    }

    /**
     * Reverse the migrations.
     *
     * IMPORTANT: This rollback recreates the old columns but they will be EMPTY
     * Only use this if you need to revert before production deployment
     *
     * If you've already deployed to production, you'll need a data migration
     * to copy values from FK columns back to ENUM columns
     */
    public function down(): void
    {
        // Drop the new indexes first
        Schema::table('games', function (Blueprint $table) {
            $table->dropIndex('games_white_player_id_status_id_index');
            $table->dropIndex('games_black_player_id_status_id_index');
            $table->dropIndex('games_status_id_index');
        });

        Schema::table('games', function (Blueprint $table) {
            // Recreate old ENUM columns (empty - for emergency rollback only)
            $table->enum('status', ['waiting', 'active', 'finished', 'aborted', 'paused'])
                ->default('waiting')
                ->after('black_player_id');

            $table->enum('end_reason', [
                'checkmate',
                'resignation',
                'stalemate',
                'timeout',
                'draw_agreed',
                'threefold',
                'fifty_move',
                'insufficient_material',
                'aborted',
                'forfeit',
                'abandoned_mutual',
                'timeout_inactivity'
            ])->nullable()->after('winner_user_id');
        });

        // Backfill data from FK columns to ENUM columns
        DB::statement("
            UPDATE games
            SET status = (
                SELECT code FROM game_statuses WHERE id = games.status_id
            )
        ");

        DB::statement("
            UPDATE games
            SET end_reason = (
                SELECT code FROM game_end_reasons WHERE id = games.end_reason_id
            )
            WHERE end_reason_id IS NOT NULL
        ");

        // Recreate old indexes on status column
        Schema::table('games', function (Blueprint $table) {
            $table->index(['white_player_id', 'status']);
            $table->index(['black_player_id', 'status']);
            $table->index(['status']);
        });

        DB::statement("-- Phase 4 rollback: Old ENUM columns restored and backfilled");
    }
};
