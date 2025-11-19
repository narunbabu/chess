<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Alter the ENUM to include 'championship_match'
        DB::statement("ALTER TABLE invitations MODIFY COLUMN type ENUM('game_invitation', 'resume_request', 'championship_match') NOT NULL DEFAULT 'game_invitation'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert to the original ENUM (this will fail if there are records with 'championship_match')
        DB::statement("ALTER TABLE invitations MODIFY COLUMN type ENUM('game_invitation', 'resume_request') NOT NULL DEFAULT 'game_invitation'");
    }
};
