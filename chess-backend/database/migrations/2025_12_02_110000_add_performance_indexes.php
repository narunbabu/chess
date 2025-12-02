<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Only add critical indexes that don't already exist using SQLite-safe approach
        if (Schema::hasTable('championship_standings')) {
            // Only add indexes if they don't exist (SQLite specific)
            try {
                DB::statement('CREATE INDEX IF NOT EXISTS champ_standings_rank_idx ON championship_standings (championship_id, rank)');
                DB::statement('CREATE INDEX IF NOT EXISTS champ_standings_points_idx ON championship_standings (championship_id, points, tiebreak_score)');
                DB::statement('CREATE INDEX IF NOT EXISTS champ_standings_champ_user_idx ON championship_standings (championship_id, user_id)');
            } catch (\Exception $e) {
                \Log::warning('Could not create championship_standings indexes: ' . $e->getMessage());
            }
        }

        if (Schema::hasTable('championship_matches')) {
            try {
                DB::statement('CREATE INDEX IF NOT EXISTS champ_match_round_status_idx ON championship_matches (championship_id, round_number, status_id)');
                DB::statement('CREATE INDEX IF NOT EXISTS champ_match_white_idx ON championship_matches (championship_id, white_player_id)');
                DB::statement('CREATE INDEX IF NOT EXISTS champ_match_black_idx ON championship_matches (championship_id, black_player_id)');
            } catch (\Exception $e) {
                \Log::warning('Could not create championship_matches indexes: ' . $e->getMessage());
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Drop critical indexes using SQLite-safe approach
        if (Schema::hasTable('championship_standings')) {
            try {
                DB::statement('DROP INDEX IF EXISTS champ_standings_rank_idx');
                DB::statement('DROP INDEX IF EXISTS champ_standings_points_idx');
                DB::statement('DROP INDEX IF EXISTS champ_standings_champ_user_idx');
            } catch (\Exception $e) {
                \Log::warning('Could not drop championship_standings indexes: ' . $e->getMessage());
            }
        }

        if (Schema::hasTable('championship_matches')) {
            try {
                DB::statement('DROP INDEX IF EXISTS champ_match_round_status_idx');
                DB::statement('DROP INDEX IF EXISTS champ_match_white_idx');
                DB::statement('DROP INDEX IF EXISTS champ_match_black_idx');
            } catch (\Exception $e) {
                \Log::warning('Could not drop championship_matches indexes: ' . $e->getMessage());
            }
        }
    }
};