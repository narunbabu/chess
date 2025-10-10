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
        // Add FK columns (nullable initially for backfill)
        Schema::table('games', function (Blueprint $table) {
            $table->unsignedTinyInteger('status_id')->nullable()->after('status');
            $table->unsignedTinyInteger('end_reason_id')->nullable()->after('end_reason');

            $table->foreign('status_id')->references('id')->on('game_statuses')->onDelete('restrict');
            $table->foreign('end_reason_id')->references('id')->on('game_end_reasons')->onDelete('restrict');
        });

        // Database-agnostic backfill using Query Builder
        // Backfill status_id from existing status values
        $statuses = DB::table('game_statuses')->get()->keyBy('code');
        
        DB::table('games')->orderBy('id')->chunk(100, function ($games) use ($statuses) {
            foreach ($games as $game) {
                if (isset($statuses[$game->status])) {
                    DB::table('games')
                        ->where('id', $game->id)
                        ->update(['status_id' => $statuses[$game->status]->id]);
                }
            }
        });

        // Backfill end_reason_id from existing end_reason values (only where not null)
        $reasons = DB::table('game_end_reasons')->get()->keyBy('code');
        
        DB::table('games')->whereNotNull('end_reason')->orderBy('id')->chunk(100, function ($games) use ($reasons) {
            foreach ($games as $game) {
                if (isset($reasons[$game->end_reason])) {
                    DB::table('games')
                        ->where('id', $game->id)
                        ->update(['end_reason_id' => $reasons[$game->end_reason]->id]);
                }
            }
        });

        // Verify backfill completeness
        $unmappedStatus = DB::table('games')->whereNull('status_id')->count();
        if ($unmappedStatus > 0) {
            throw new \Exception("Backfill failed: {$unmappedStatus} games have null status_id. Check for unmapped status values.");
        }

        // Make status_id required after successful backfill
        Schema::table('games', function (Blueprint $table) {
            $table->unsignedTinyInteger('status_id')->nullable(false)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // For SQLite: Drop indexes that might reference status_id first
        if (DB::connection()->getDriverName() === 'sqlite') {
            // Query sqlite_master to find all indexes on the games table that include status_id
            $indexes = DB::select("
                SELECT name FROM sqlite_master
                WHERE type = 'index'
                AND tbl_name = 'games'
                AND sql LIKE '%status_id%'
            ");

            Schema::table('games', function (Blueprint $table) use ($indexes) {
                foreach ($indexes as $index) {
                    try {
                        $table->dropIndex($index->name);
                    } catch (\Exception $e) {
                        // Index might not exist or already dropped, continue
                    }
                }
            });
        }

        Schema::table('games', function (Blueprint $table) {
            $table->dropForeign(['status_id']);
            $table->dropForeign(['end_reason_id']);
            $table->dropColumn(['status_id', 'end_reason_id']);
        });
    }
};
