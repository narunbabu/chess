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
        Schema::create('engine_evaluations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_id')->constrained()->onDelete('cascade');
            $table->integer('move_number')->comment('Move number in the game (1, 2, 3...)');

            // Position information
            $table->text('fen_before')->comment('FEN position before the move');
            $table->text('fen_after')->comment('FEN position after the move');
            $table->string('move_san', 10)->comment('Move in Standard Algebraic Notation (e.g., "Nf3", "e4")');

            // Evaluation scores (in centipawns)
            $table->decimal('eval_before', 8, 2)->nullable()
                ->comment('Position evaluation before move (centipawns, positive = white advantage)');
            $table->decimal('eval_after', 8, 2)->nullable()
                ->comment('Position evaluation after move (centipawns)');
            $table->decimal('eval_change', 8, 2)->nullable()
                ->comment('Change in evaluation (negative = player lost advantage)');

            // Best move information
            $table->string('best_move', 10)->nullable()
                ->comment('Engine recommended best move in UCI format');
            $table->boolean('is_best_move')->default(false)
                ->comment('Whether the played move matches the best move');

            // Move quality classification
            $table->enum('move_quality', ['brilliant', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'])->nullable()
                ->comment('Move quality classification based on eval change');

            // MultiPV results (top 3 moves)
            $table->json('top_moves')->nullable()
                ->comment('Top 3 moves from Stockfish MultiPV analysis');

            // Metadata
            $table->integer('analysis_depth')->default(15)
                ->comment('Stockfish analysis depth used');
            $table->integer('analysis_time_ms')->nullable()
                ->comment('Time taken for analysis in milliseconds');

            $table->timestamps();

            // Unique constraint: one evaluation per move per game
            $table->unique(['game_id', 'move_number']);

            // Indexes for efficient querying
            $table->index('game_id');
            $table->index('move_quality');
            $table->index(['game_id', 'move_number']);
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('engine_evaluations');
    }
};
