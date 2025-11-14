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
            // Add time control fields
            $table->unsignedInteger('time_control_minutes')->default(10)->after('match_time_window_hours')->comment('Minutes for each game');
            $table->unsignedInteger('time_control_increment')->default(0)->after('time_control_minutes')->comment('Increment in seconds per move');

            // Add total rounds field (virtual field based on format)
            $table->unsignedInteger('total_rounds')->nullable()->after('top_qualifiers')->comment('Total number of rounds (calculated based on format)');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('championships', function (Blueprint $table) {
            $table->dropColumn(['time_control_minutes', 'time_control_increment', 'total_rounds']);
        });
    }
};