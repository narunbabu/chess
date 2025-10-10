<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Adds server-authoritative clock fields for multiplayer timer synchronization.
     * This implements the "single source of truth" pattern where the server
     * manages all clock state and clients only render from server snapshots.
     */
    public function up(): void
    {
        Schema::table('games', function (Blueprint $table) {
            // Clock state in milliseconds (server authority)
            $table->bigInteger('white_ms')->default(600000)->after('increment_seconds'); // 10 minutes default
            $table->bigInteger('black_ms')->default(600000)->after('white_ms');

            // Active timer: 'white', 'black', or NULL when paused/ended
            $table->enum('running', ['white', 'black'])->nullable()->after('black_ms');

            // Server timestamp (milliseconds since epoch) for elapsed time calculation
            $table->bigInteger('last_server_ms')->default(0)->after('running');

            // Time increment per move in milliseconds (Fischer increment)
            $table->integer('increment_ms')->default(0)->after('last_server_ms');

            // Monotonic version counter to prevent out-of-order WebSocket frames
            $table->unsignedBigInteger('revision')->default(0)->after('increment_ms');

            // Index for active games heartbeat query
            $table->index(['status_id', 'running']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('games', function (Blueprint $table) {
            $table->dropIndex(['status_id', 'running']);
            $table->dropColumn([
                'white_ms',
                'black_ms',
                'running',
                'last_server_ms',
                'increment_ms',
                'revision'
            ]);
        });
    }
};
