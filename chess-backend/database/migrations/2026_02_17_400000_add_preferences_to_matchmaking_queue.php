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
        Schema::table('matchmaking_queue', function (Blueprint $table) {
            $table->string('preferred_color', 10)->default('random')->after('expires_at');
            $table->unsignedInteger('time_control_minutes')->default(10)->after('preferred_color');
            $table->unsignedInteger('increment_seconds')->default(0)->after('time_control_minutes');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('matchmaking_queue', function (Blueprint $table) {
            $table->dropColumn(['preferred_color', 'time_control_minutes', 'increment_seconds']);
        });
    }
};
