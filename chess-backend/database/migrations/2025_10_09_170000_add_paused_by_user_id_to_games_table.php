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
        Schema::table('games', function (Blueprint $table) {
            // Track which user caused the game to be paused (due to inactivity)
            $table->foreignId('paused_by_user_id')
                ->nullable()
                ->after('paused_reason')
                ->constrained('users')
                ->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('games', function (Blueprint $table) {
            $table->dropForeign(['paused_by_user_id']);
            $table->dropColumn('paused_by_user_id');
        });
    }
};
