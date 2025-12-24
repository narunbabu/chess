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
        Schema::create('game_performance', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');

            // Performance Score (0-100) - Primary metric
            $table->decimal('performance_score', 5, 2)->nullable()
                ->comment('Overall performance score (0-100)');

            // Move Accuracy (0-100%)
            $table->decimal('move_accuracy', 5, 2)->nullable()
                ->comment('Percentage of moves matching engine recommendations');

            // Move quality breakdown
            $table->integer('brilliant_moves')->default(0)
                ->comment('Best move with evaluation improvement >100cp or tactical sacrifice');
            $table->integer('excellent_moves')->default(0)
                ->comment('Best move according to engine');
            $table->integer('good_moves')->default(0)
                ->comment('Moves with eval loss <30cp');
            $table->integer('inaccuracies')->default(0)
                ->comment('Moves with eval loss 30-70cp');
            $table->integer('mistakes')->default(0)
                ->comment('Moves with eval loss 70-200cp');
            $table->integer('blunders')->default(0)
                ->comment('Moves with eval loss >200cp');

            // ACPL - Average Centipawn Loss (lower is better)
            $table->decimal('acpl', 8, 2)->nullable()
                ->comment('Average centipawn loss per move');

            // Additional metrics
            $table->integer('total_moves')->default(0)
                ->comment('Total moves made by player');
            $table->decimal('avg_move_time_seconds', 8, 2)->nullable()
                ->comment('Average time per move in seconds');

            $table->timestamps();

            // Unique constraint: one performance record per player per game
            $table->unique(['game_id', 'user_id']);

            // Indexes for efficient querying
            $table->index('game_id');
            $table->index('user_id');
            $table->index('performance_score');
            $table->index(['user_id', 'performance_score']);
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('game_performance');
    }
};
