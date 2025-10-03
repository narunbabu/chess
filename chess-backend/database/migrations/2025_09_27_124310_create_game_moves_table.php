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
        if (Schema::hasTable('game_moves')) {
            return;
        }

        Schema::create('game_moves', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->integer('move_number');
            $table->string('from_square', 2); // e.g., 'e2'
            $table->string('to_square', 2);   // e.g., 'e4'
            $table->string('piece_moved', 10); // e.g., 'pawn', 'king'
            $table->string('piece_captured')->nullable(); // captured piece
            $table->string('move_notation', 10); // e.g., 'e4', 'Nf3', 'O-O'
            $table->json('board_state'); // FEN string or board representation
            $table->boolean('is_check')->default(false);
            $table->boolean('is_checkmate')->default(false);
            $table->boolean('is_castling')->default(false);
            $table->boolean('is_en_passant')->default(false);
            $table->string('promotion_piece')->nullable(); // for pawn promotion
            $table->integer('time_taken_ms')->nullable(); // time taken for move in milliseconds
            $table->timestamp('move_timestamp');
            $table->timestamps();

            // Indexes for performance
            $table->index(['game_id', 'move_number']);
            $table->index('move_timestamp');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('game_moves');
    }
};
