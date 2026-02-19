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
        Schema::create('tutorial_practice_games', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('lesson_id')->nullable();
            $table->enum('ai_difficulty', ['easy', 'medium', 'hard', 'expert']);
            $table->enum('result', ['win', 'loss', 'draw']);
            $table->integer('moves_played')->nullable();
            $table->json('game_data')->nullable(); // PGN, FEN positions, analysis
            $table->integer('duration_seconds')->nullable();
            $table->integer('xp_earned')->default(0);
            $table->timestamp('played_at')->useCurrent();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('lesson_id')->references('id')->on('tutorial_lessons')->onDelete('set null');
            $table->index(['user_id', 'played_at']);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tutorial_practice_games');
    }
};