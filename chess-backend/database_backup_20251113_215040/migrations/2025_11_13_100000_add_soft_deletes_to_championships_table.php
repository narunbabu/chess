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
            // Add soft delete timestamp
            $table->softDeletes();

            // Track who archived the championship
            $table->foreignId('deleted_by')->nullable()->constrained('users')->onDelete('set null');

            // Add indexes for efficient querying
            $table->index('deleted_at');
            $table->index(['deleted_at', 'status_id']); // Combined index for common queries
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('championships', function (Blueprint $table) {
            // Drop foreign key first
            $table->dropForeign(['deleted_by']);

            // Drop indexes
            $table->dropIndex(['deleted_at']);
            $table->dropIndex(['deleted_at', 'status_id']);

            // Drop columns
            $table->dropColumn(['deleted_at', 'deleted_by']);
        });
    }
};
