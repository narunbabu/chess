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
        // Drop existing draw_events table if it exists
        Schema::dropIfExists('draw_events');

        // Recreate with correct schema matching DrawHandlerService expectations
        Schema::create('draw_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_id')->constrained()->onDelete('cascade');

            // Draw offer participants (matching DrawHandlerService expectations)
            $table->foreignId('offering_user_id')->constrained('users')->onDelete('cascade')
                ->comment('User who offered the draw');
            $table->foreignId('receiving_user_id')->nullable()->constrained('users')->onDelete('set null')
                ->comment('User who received the offer (NULL for computer opponent)');

            // Position evaluation at time of offer
            $table->text('position_fen')->comment('FEN position when draw was offered');
            $table->decimal('position_eval', 8, 2)->nullable()
                ->comment('Position evaluation from offering player perspective (pawns)');

            // Rating impact (for rated games)
            $table->integer('offering_player_rating_impact')->nullable()
                ->comment('Potential rating change for offering player');
            $table->integer('receiving_player_rating_impact')->nullable()
                ->comment('Potential rating change for receiving player');

            // Status tracking (matching DrawHandlerService expectations)
            $table->enum('status', ['pending', 'accepted', 'declined', 'canceled'])->default('pending')
                ->comment('Current status of the draw offer');
            $table->timestamp('offered_at')->nullable()
                ->comment('When the draw was offered');
            $table->timestamp('responded_at')->nullable()
                ->comment('When the offer was responded to');

            $table->timestamps();

            // Indexes for efficient querying
            $table->index('game_id');
            $table->index('offering_user_id');
            $table->index('status');
            $table->index(['game_id', 'status']);
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('draw_events');
    }
};
