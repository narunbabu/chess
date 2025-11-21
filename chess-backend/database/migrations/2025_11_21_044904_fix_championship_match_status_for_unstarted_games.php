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
     * Fix championship matches that have 'in_progress' status but where the game hasn't actually started.
     * A match should only be 'in_progress' when both players are actively connected and playing.
     * If a game exists but is not 'active', the match should be 'pending'.
     */
    public function up(): void
    {
        // Get the status IDs from championship_match_statuses table
        $inProgressStatusId = DB::table('championship_match_statuses')
            ->where('code', 'in_progress')
            ->value('id');

        $pendingStatusId = DB::table('championship_match_statuses')
            ->where('code', 'pending')
            ->value('id');

        if (!$inProgressStatusId || !$pendingStatusId) {
            // If status records don't exist, skip this migration
            return;
        }

        // Get the 'active' status ID for games (status_id = 2 means game is active/in-progress)
        $activeGameStatusId = DB::table('game_statuses')
            ->where('code', 'active')
            ->value('id');

        if (!$activeGameStatusId) {
            return;
        }

        // Find all championship matches that are marked as 'in_progress'
        // but their associated game is not 'active' (meaning game hasn't actually started)
        // A game is only 'active' when both players are connected and playing
        $affectedMatches = DB::table('championship_matches')
            ->where('status_id', $inProgressStatusId)
            ->whereNotNull('game_id')
            ->whereExists(function ($query) use ($activeGameStatusId) {
                $query->select(DB::raw(1))
                    ->from('games')
                    ->whereColumn('games.id', 'championship_matches.game_id')
                    ->where('games.status_id', '!=', $activeGameStatusId);
            })
            ->update([
                'status_id' => $pendingStatusId,
                'updated_at' => now(),
            ]);

        // Log the fix
        \Illuminate\Support\Facades\Log::info('Fixed championship match statuses', [
            'fixed_count' => $affectedMatches,
            'reason' => 'Matches had in_progress status but games were not active (both players connected)'
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No need to reverse this data fix migration
        // It's a one-time correction of incorrect data
    }
};
