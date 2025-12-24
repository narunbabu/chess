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
     * @return void
     */
    public function up()
    {
        Schema::table('games', function (Blueprint $table) {
            // Add game_mode field to distinguish rated vs casual games
            $table->enum('game_mode', ['rated', 'casual'])
                ->default('casual')
                ->after('status_id')
                ->comment('Game mode: rated (affects rating) or casual (practice)');

            // Add index for efficient queries on game mode and status
            $table->index(['game_mode', 'status_id']);
        });

        // Mark all existing games as 'casual' retroactively
        DB::table('games')
            ->whereNull('game_mode')
            ->orWhere('game_mode', '')
            ->update(['game_mode' => 'casual']);
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('games', function (Blueprint $table) {
            $table->dropIndex(['game_mode', 'status_id']);
            $table->dropColumn('game_mode');
        });
    }
};
