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
        Schema::table('championship_matches', function (Blueprint $table) {
            // Scheduling fields
            $table->dateTime('scheduled_time')->nullable()->comment('Scheduled time for match to be played');
            $table->dateTime('game_timeout')->nullable()->comment('Deadline for player availability before automatic forfeit');
            $table->string('scheduling_status')->default('pending')->comment('Current scheduling status');
            $table->boolean('can_schedule_early')->default(true)->comment('Allow playing before scheduled time if both available');
            $table->text('scheduling_notes')->nullable()->comment('Notes about scheduling arrangements');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('championship_matches', function (Blueprint $table) {
            $table->dropColumn([
                'scheduled_time',
                'game_timeout',
                'scheduling_status',
                'can_schedule_early',
                'scheduling_notes'
            ]);
        });
    }
};