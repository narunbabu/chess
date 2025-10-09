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
        // Add 'paused' status to game_statuses lookup table
        DB::table('game_statuses')->insert([
            'code' => 'paused',
            'label' => 'Paused',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Add new end reasons to game_end_reasons lookup table
        DB::table('game_end_reasons')->insert([
            [
                'code' => 'forfeit',
                'label' => 'Forfeit',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'code' => 'abandoned_mutual',
                'label' => 'Abandoned by agreement',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'code' => 'timeout_inactivity',
                'label' => 'Timeout',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        // Add new columns to games table
        Schema::table('games', function (Blueprint $table) {
            $table->timestamp('paused_at')->nullable()->after('ended_at');
            $table->string('paused_reason', 50)->nullable()->after('paused_at');
            $table->timestamp('last_heartbeat_at')->nullable()->after('updated_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Remove columns from games table
        Schema::table('games', function (Blueprint $table) {
            $table->dropColumn(['paused_at', 'paused_reason', 'last_heartbeat_at']);
        });

        // Remove new end reasons - first nullify FK references to avoid constraint violations
        $endReasonIds = DB::table('game_end_reasons')
            ->whereIn('code', ['forfeit', 'abandoned_mutual', 'timeout_inactivity'])
            ->pluck('id');

        if ($endReasonIds->isNotEmpty()) {
            DB::table('games')
                ->whereIn('end_reason_id', $endReasonIds)
                ->update(['end_reason_id' => null]);
        }

        DB::table('game_end_reasons')->whereIn('code', [
            'forfeit',
            'abandoned_mutual',
            'timeout_inactivity',
        ])->delete();

        // Remove 'paused' status - first nullify FK references to avoid constraint violations
        $pausedStatusId = DB::table('game_statuses')->where('code', 'paused')->value('id');

        if ($pausedStatusId) {
            // Get 'waiting' status as fallback
            $waitingStatusId = DB::table('game_statuses')->where('code', 'waiting')->value('id');

            DB::table('games')
                ->where('status_id', $pausedStatusId)
                ->update(['status_id' => $waitingStatusId]);
        }

        DB::table('game_statuses')->where('code', 'paused')->delete();
    }
};
