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
            $table->dropIndex(['is_test_tournament']);
            $table->dropColumn('is_test_tournament');
        });
    }
};
