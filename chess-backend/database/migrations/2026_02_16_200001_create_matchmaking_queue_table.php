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
        Schema::create('matchmaking_queue', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->integer('rating')->comment('Snapshot at queue time');
            $table->integer('rating_range')->default(200)->comment('Acceptable rating spread');
            $table->string('status')->default('searching')->comment('searching|matched|expired|cancelled');
            $table->foreignId('matched_with_user_id')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('matched_with_synthetic_id')->nullable()->constrained('synthetic_players')->onDelete('set null');
            $table->foreignId('game_id')->nullable()->constrained('games')->onDelete('set null');
            $table->timestamp('queued_at');
            $table->timestamp('matched_at')->nullable();
            $table->timestamp('expires_at')->comment('queued_at + 20s');
            $table->timestamps();

            $table->index(['status', 'rating', 'queued_at']);
            $table->index(['user_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('matchmaking_queue');
    }
};
