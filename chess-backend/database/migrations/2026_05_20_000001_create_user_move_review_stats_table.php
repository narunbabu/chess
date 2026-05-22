<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('user_move_review_stats', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->unsignedInteger('games_analyzed')->default(0);
            $table->unsignedInteger('analyzed_moves')->default(0);
            $table->unsignedInteger('ranked_moves_count')->default(0);
            $table->unsignedInteger('rank_sum')->default(0);
            $table->unsignedInteger('top_1_count')->default(0);
            $table->unsignedInteger('top_2_count')->default(0);
            $table->unsignedInteger('top_3_count')->default(0);
            $table->unsignedInteger('outside_top_5_count')->default(0);
            $table->unsignedInteger('best_button_uses')->default(0);
            $table->unsignedInteger('coins_earned')->default(0);
            $table->unsignedInteger('review_enabled_games')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_move_review_stats');
    }
};
