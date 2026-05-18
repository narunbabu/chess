<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('game_histories', function (Blueprint $table) {
            $table->json('review_report')->nullable();
            $table->json('review_summary')->nullable();
            $table->unsignedInteger('best_button_uses')->default(0);
            $table->boolean('review_enabled_used')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('game_histories', function (Blueprint $table) {
            $table->dropColumn([
                'review_report',
                'review_summary',
                'best_button_uses',
                'review_enabled_used',
            ]);
        });
    }
};
