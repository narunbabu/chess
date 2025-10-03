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
        if (Schema::hasTable('games')) {
            return;
        }

        Schema::create('games', function (Blueprint $table) {
            $table->id();
            $table->foreignId('white_player_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('black_player_id')->constrained('users')->onDelete('cascade');
            $table->enum('status', ['waiting', 'active', 'finished', 'aborted'])->default('waiting');
            $table->string('result', 7)->nullable()->default('*'); // '1-0', '0-1', '1/2-1/2', '*'
            $table->enum('winner_player', ['white', 'black'])->nullable();
            $table->string('fen', 255)->default('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'); // Starting position
            $table->json('moves')->nullable(); // Store game moves as JSON
            $table->enum('turn', ['white', 'black'])->default('white');
            $table->timestamp('last_move_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->enum('end_reason', [
                'checkmate',
                'resignation',
                'stalemate',
                'timeout',
                'draw_agreed',
                'threefold',
                'fifty_move',
                'insufficient_material',
                'aborted'
            ])->nullable();
            $table->unsignedBigInteger('parent_game_id')->nullable();
            $table->unsignedBigInteger('winner_user_id')->nullable();
            $table->integer('move_count')->default(0);
            $table->longText('pgn')->nullable();

            // Time control settings
            $table->integer('time_control_minutes')->default(10);
            $table->integer('increment_seconds')->default(0);
            $table->integer('white_time_remaining_ms')->nullable();
            $table->integer('black_time_remaining_ms')->nullable();
            $table->timestamp('last_move_time')->nullable();

            // Connection tracking
            $table->boolean('white_connected')->default(false);
            $table->boolean('black_connected')->default(false);
            $table->timestamp('white_last_seen')->nullable();
            $table->timestamp('black_last_seen')->nullable();

            // Game state
            $table->enum('game_phase', ['waiting', 'starting', 'active', 'paused', 'ended'])->default('waiting');
            $table->json('game_state')->nullable(); // Current board state, turn info, etc.
            $table->integer('total_moves')->default(0);

            // Abandonment tracking
            $table->integer('disconnection_count_white')->default(0);
            $table->integer('disconnection_count_black')->default(0);
            $table->timestamp('abandonment_warning_sent')->nullable();

            $table->timestamps();

            // Foreign keys
            $table->foreign('winner_user_id')->references('id')->on('users')->onDelete('set null');

            // Indexes for performance
            $table->index(['white_player_id', 'status']);
            $table->index(['black_player_id', 'status']);
            $table->index(['game_phase', 'updated_at']);
            $table->index(['white_connected', 'black_connected']);
            $table->index('parent_game_id');
            $table->index(['status']);
            $table->index(['winner_user_id', 'ended_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('games');
    }
};