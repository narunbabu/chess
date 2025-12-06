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
            $table->boolean('is_test_tournament')->default(false)->after('created_by');
            $table->index('is_test_tournament'); // For efficient querying
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('championships', function (Blueprint $table) {
            // Try to drop index if it exists
            try {
                $table->dropIndex(['is_test_tournament']);
            } catch (Exception $e) {
                // Index might not exist or have different name
                // Try dropping by specific name
                try {
                    $table->dropIndex('championships_is_test_tournament_index');
                } catch (Exception $e2) {
                    // Index doesn't exist, continue
                }
            }

            // Drop column if it exists
            if (Schema::hasColumn('championships', 'is_test_tournament')) {
                $table->dropColumn('is_test_tournament');
            }
        });
    }
};
