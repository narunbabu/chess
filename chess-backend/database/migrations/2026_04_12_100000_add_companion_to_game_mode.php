<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add 'companion' as a valid game_mode option.
     * Companion mode is for learning - user can get help from synthetic AI during games.
     */
    public function up(): void
    {
        // MySQL doesn't support modifying ENUM values directly
        // We need to alter the column to add the new value
        DB::statement("ALTER TABLE games MODIFY COLUMN game_mode ENUM('rated', 'casual', 'companion') DEFAULT 'casual' COMMENT 'Game mode: rated (affects rating), casual (practice), or companion (learning with AI help)'");
    }

    /**
     * Reverse the migration.
     */
    public function down(): void
    {
        // Remove companion option from enum
        DB::statement("ALTER TABLE games MODIFY COLUMN game_mode ENUM('rated', 'casual') DEFAULT 'casual' COMMENT 'Game mode: rated (affects rating) or casual (practice)'");
    }
};
