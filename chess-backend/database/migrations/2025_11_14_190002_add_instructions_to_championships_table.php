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
            $table->text('scheduling_instructions')->nullable()->comment('Instructions for participants about scheduling matches');
            $table->text('play_instructions')->nullable()->comment('Instructions for participants about playing games');
            $table->integer('default_grace_period_minutes')->default(10)->comment('Default grace period before automatic forfeit');
            $table->boolean('allow_early_play')->default(true)->comment('Allow matches to be played before scheduled time');
            $table->boolean('require_confirmation')->default(true)->comment('Require opponent confirmation for schedule proposals');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('championships', function (Blueprint $table) {
            $table->dropColumn([
                'scheduling_instructions',
                'play_instructions',
                'default_grace_period_minutes',
                'allow_early_play',
                'require_confirmation'
            ]);
        });
    }
};