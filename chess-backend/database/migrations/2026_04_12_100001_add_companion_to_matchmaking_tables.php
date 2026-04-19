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
        if (DB::getDriverName() === 'sqlite') {
            return;
        }
        DB::statement("ALTER TABLE matchmaking_queue MODIFY COLUMN game_mode ENUM('casual', 'rated', 'companion') DEFAULT 'rated'");
        DB::statement("ALTER TABLE match_requests MODIFY COLUMN game_mode ENUM('casual', 'rated', 'companion') DEFAULT 'rated'");
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }
        DB::statement("ALTER TABLE matchmaking_queue MODIFY COLUMN game_mode ENUM('casual', 'rated') DEFAULT 'rated'");
        DB::statement("ALTER TABLE match_requests MODIFY COLUMN game_mode ENUM('casual', 'rated') DEFAULT 'rated'");
    }
};
