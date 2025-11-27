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
        Schema::table('championships', function (Blueprint $table) {
            // Add tournament configuration JSON field
            $table->json('tournament_config')->nullable()->after('tournament_settings');

            // Add flag to track if full tournament has been generated
            $table->boolean('tournament_generated')->default(false)->after('tournament_config');

            // Add timestamp for when tournament was generated
            $table->timestamp('tournament_generated_at')->nullable()->after('tournament_generated');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (!Schema::hasTable('championships')) {
            return;
        }

        // Only drop columns that actually exist
        $columnsToDrop = [];
        $columnsToCheck = ['tournament_config', 'tournament_generated', 'tournament_generated_at'];

        foreach ($columnsToCheck as $column) {
            if (Schema::hasColumn('championships', $column)) {
                $columnsToDrop[] = $column;
            }
        }

        if (!empty($columnsToDrop)) {
            Schema::table('championships', function (Blueprint $table) use ($columnsToDrop) {
                $table->dropColumn($columnsToDrop);
            });
        }
    }
};
