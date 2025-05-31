<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        Schema::create('game_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->onDelete('cascade');
            $table->text('pgn');
            $table->string('result'); // 'win', 'loss', 'draw'
            $table->integer('moves');
            $table->integer('duration'); // in seconds
            $table->json('metadata')->nullable(); // opening, difficulty, etc.
            $table->string('share_token', 32)->unique()->nullable();
            $table->string('gif_url')->nullable();
            $table->string('video_url')->nullable();
            $table->integer('credits_wagered')->default(0);
            $table->integer('credits_won')->default(0);
            $table->enum('opponent_type', ['stockfish', 'llm', 'human', 'guest'])->default('stockfish');
            $table->string('opponent_name')->nullable();
            $table->integer('difficulty_level')->default(1);
            $table->boolean('is_guest_game')->default(false);
            $table->timestamps();

            $table->index(['share_token']);
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('game_histories');
    }
};