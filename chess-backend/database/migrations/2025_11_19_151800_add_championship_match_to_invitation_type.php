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
        $driver = Schema::connection($this->getConnection())->getConnection()->getDriverName();

        if ($driver === 'sqlite') {
            // SQLite doesn't support MODIFY COLUMN or ENUM
            // Since we're using fresh migrations, the column already has the correct definition
            // Nothing to do for SQLite - the enum is just a string constraint
        } else {
            // MySQL/PostgreSQL: Alter the ENUM to include 'championship_match'
            DB::statement("ALTER TABLE invitations MODIFY COLUMN type ENUM('game_invitation', 'resume_request', 'championship_match') NOT NULL DEFAULT 'game_invitation'");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $driver = Schema::connection($this->getConnection())->getConnection()->getDriverName();

        if ($driver === 'sqlite') {
            // SQLite doesn't support MODIFY COLUMN
            // Nothing to do for SQLite rollback
        } else {
            // MySQL/PostgreSQL: Revert to the original ENUM
            DB::statement("ALTER TABLE invitations MODIFY COLUMN type ENUM('game_invitation', 'resume_request') NOT NULL DEFAULT 'game_invitation'");
        }
    }
};
