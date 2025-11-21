<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Table to track requests to start/resume championship games.
     * When a player wants to start a game, they send a request that the opponent must accept.
     */
    public function up(): void
    {
        Schema::create('championship_game_resume_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('championship_match_id')->constrained('championship_matches')->onDelete('cascade');
            $table->foreignId('game_id')->constrained('games')->onDelete('cascade');
            $table->foreignId('requester_id')->constrained('users')->onDelete('cascade'); // Who sent the request
            $table->foreignId('recipient_id')->constrained('users')->onDelete('cascade'); // Who needs to accept
            $table->enum('status', ['pending', 'accepted', 'declined', 'expired'])->default('pending');
            $table->timestamp('expires_at'); // Request expires after X minutes
            $table->timestamp('responded_at')->nullable(); // When opponent responded
            $table->timestamps();

            // Indexes
            $table->index(['championship_match_id', 'status']);
            $table->index(['recipient_id', 'status']);
            $table->index('expires_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('championship_game_resume_requests');
    }
};
