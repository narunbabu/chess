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
            // Store the time remaining for each player when the game was paused
            $table->integer('white_time_paused_ms')->nullable()->after('black_time_remaining_ms');
            $table->integer('black_time_paused_ms')->nullable()->after('white_time_paused_ms');

            // Track which player's turn it was when paused (for grace time calculation)
            $table->enum('turn_at_pause', ['white', 'black'])->nullable()->after('black_time_paused_ms');

            // Grace time tracking - store the amount of grace time given to each player
            $table->integer('white_grace_time_ms')->default(0)->after('turn_at_pause');
            $table->integer('black_grace_time_ms')->default(0)->after('white_grace_time_ms');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('games', function (Blueprint $table) {
            $table->dropColumn([
                'white_time_paused_ms',
                'black_time_paused_ms',
                'turn_at_pause',
                'white_grace_time_ms',
                'black_grace_time_ms'
            ]);
        });
    }
};