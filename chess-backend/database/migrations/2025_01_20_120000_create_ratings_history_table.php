<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('ratings_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->integer('old_rating');
            $table->integer('new_rating');
            $table->integer('rating_change'); // Calculated: new - old
            $table->foreignId('opponent_id')->nullable()->constrained('users')->onDelete('set null');
            $table->integer('opponent_rating')->nullable();
            $table->enum('result', ['win', 'loss', 'draw']);
            $table->enum('game_type', ['computer', 'multiplayer'])->default('multiplayer');
            $table->integer('k_factor'); // K-factor used in calculation
            $table->decimal('expected_score', 5, 4); // Expected outcome (0-1)
            $table->decimal('actual_score', 3, 2); // Actual outcome (0, 0.5, 1)
            $table->foreignId('game_id')->nullable()->constrained('games')->onDelete('set null');
            $table->timestamps();

            // Indexes for efficient querying
            $table->index('user_id');
            $table->index('created_at');
            $table->index(['user_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('ratings_history');
    }
};
