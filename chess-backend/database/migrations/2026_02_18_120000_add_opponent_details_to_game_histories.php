<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('game_histories', function (Blueprint $table) {
            $table->string('opponent_avatar_url')->nullable()->after('opponent_name');
            $table->integer('opponent_rating')->nullable()->after('opponent_avatar_url');
        });
    }

    public function down(): void
    {
        Schema::table('game_histories', function (Blueprint $table) {
            $table->dropColumn(['opponent_avatar_url', 'opponent_rating']);
        });
    }
};
