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
        Schema::create('games', function (Blueprint $table) {
            $table->id();
            $table->foreignId('white_player_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('black_player_id')->constrained('users')->onDelete('cascade');
            $table->enum('status', ['waiting', 'active', 'completed', 'abandoned'])->default('waiting');
            $table->enum('result', ['white_wins', 'black_wins', 'draw', 'ongoing'])->default('ongoing');
            $table->text('fen')->default('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'); // Starting position
            $table->json('moves')->nullable(); // Store game moves as JSON
            $table->enum('turn', ['white', 'black'])->default('white');
            $table->timestamp('last_move_at')->nullable();

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

            // Indexes for performance
            $table->index(['white_player_id', 'status']);
            $table->index(['black_player_id', 'status']);
            $table->index(['game_phase', 'updated_at']);
            $table->index(['white_connected', 'black_connected']);
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