<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('games', function (Blueprint $table) {
            $table->foreignId('synthetic_player_id')->nullable()->after('computer_level')
                  ->constrained('synthetic_players')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('games', function (Blueprint $table) {
            $table->dropForeign(['synthetic_player_id']);
            $table->dropColumn('synthetic_player_id');
        });
    }
};
