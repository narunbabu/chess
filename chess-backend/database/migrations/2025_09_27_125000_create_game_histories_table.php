<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        Schema::create('game_histories', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable(); // allow null for guest play
            $table->unsignedBigInteger('game_id')->nullable(); // link to multiplayer games
            $table->dateTime('played_at');
            $table->string('player_color', 1);
            $table->integer('computer_level');
            $table->string('opponent_name')->nullable(); // for multiplayer games
            $table->enum('game_mode', ['computer', 'multiplayer'])->default('computer');
            $table->text('moves');
            $table->float('final_score');
            $table->string('result');
            $table->integer('white_time_remaining_ms')->nullable();
            $table->integer('black_time_remaining_ms')->nullable();
            $table->bigInteger('last_move_time')->nullable();
            $table->timestamps();

            // Foreign keys
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('game_id')->references('id')->on('games')->onDelete('set null');
        });
    }

    public function down()
    {
        Schema::dropIfExists('game_histories');
    }
};
