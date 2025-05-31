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
            $table->dateTime('played_at');
            $table->string('player_color', 1);
            $table->integer('computer_level');
            $table->text('moves');
            $table->float('final_score');
            $table->string('result');
            $table->timestamps();

            // If the user is registered, set up a foreign key
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
        });
    }

    public function down()
    {
        Schema::dropIfExists('game_histories');
    }
};
