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
        // For SQLite, we need to recreate the table with the new enum values
        // This is because SQLite doesn't support ALTER COLUMN for enums
        DB::statement("
            CREATE TABLE invitations_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                inviter_id INTEGER NOT NULL,
                invited_id INTEGER NOT NULL,
                status TEXT CHECK(status IN ('pending', 'accepted', 'declined', 'notified')) NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP,
                updated_at TIMESTAMP,
                FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (invited_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ");

        // Copy data from old table
        DB::statement("INSERT INTO invitations_new SELECT * FROM invitations");

        // Drop old table and rename new one
        DB::statement("DROP TABLE invitations");
        DB::statement("ALTER TABLE invitations_new RENAME TO invitations");

        // Recreate indexes
        DB::statement("CREATE INDEX invitations_invited_id_status_index ON invitations(invited_id, status)");
        DB::statement("CREATE INDEX invitations_inviter_id_status_index ON invitations(inviter_id, status)");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Recreate table without 'notified' status
        DB::statement("
            CREATE TABLE invitations_old (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                inviter_id INTEGER NOT NULL,
                invited_id INTEGER NOT NULL,
                status TEXT CHECK(status IN ('pending', 'accepted', 'declined')) NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP,
                updated_at TIMESTAMP,
                FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (invited_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ");

        // Copy data (excluding 'notified' status records)
        DB::statement("INSERT INTO invitations_old SELECT * FROM invitations WHERE status != 'notified'");

        // Drop new table and rename old one
        DB::statement("DROP TABLE invitations");
        DB::statement("ALTER TABLE invitations_old RENAME TO invitations");

        // Recreate indexes
        DB::statement("CREATE INDEX invitations_invited_id_status_index ON invitations(invited_id, status)");
        DB::statement("CREATE INDEX invitations_inviter_id_status_index ON invitations(inviter_id, status)");
    }
};