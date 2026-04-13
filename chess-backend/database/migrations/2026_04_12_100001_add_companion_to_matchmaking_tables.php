<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add 'companion' to game_mode enum in matchmaking tables.
     */
    public function up(): void
    {
        // Update matchmaking_queue table
        DB::statement("ALTER TABLE matchmaking_queue MODIFY COLUMN game_mode ENUM('casual', 'rated', 'companion') DEFAULT 'rated'");

        // Update match_requests table
        DB::statement("ALTER TABLE match_requests MODIFY COLUMN game_mode ENUM('casual', 'rated', 'companion') DEFAULT 'rated'");
    }

    /**
     * Reverse the migration.
     */
    public function down(): void
    {
        // Remove companion from matchmaking_queue
        DB::statement("ALTER TABLE matchmaking_queue MODIFY COLUMN game_mode ENUM('casual', 'rated') DEFAULT 'rated'");

        // Remove companion from match_requests
        DB::statement("ALTER TABLE match_requests MODIFY COLUMN game_mode ENUM('casual', 'rated') DEFAULT 'rated'");
    }
};
