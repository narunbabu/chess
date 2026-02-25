<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('matchmaking_queue', function (Blueprint $table) {
            $table->enum('game_mode', ['casual', 'rated'])->default('rated')->after('increment_seconds');
        });

        Schema::table('match_requests', function (Blueprint $table) {
            $table->enum('game_mode', ['casual', 'rated'])->default('rated')->after('increment_seconds');
        });
    }

    public function down(): void
    {
        Schema::table('matchmaking_queue', function (Blueprint $table) {
            $table->dropColumn('game_mode');
        });

        Schema::table('match_requests', function (Blueprint $table) {
            $table->dropColumn('game_mode');
        });
    }
};
