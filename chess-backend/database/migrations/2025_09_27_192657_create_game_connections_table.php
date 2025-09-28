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
        Schema::create('game_connections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('game_id')->constrained()->onDelete('cascade');
            $table->string('connection_id')->unique();
            $table->string('socket_id')->nullable();
            $table->enum('status', ['connected', 'disconnected', 'stale'])->default('connected');
            $table->timestamp('connected_at');
            $table->timestamp('disconnected_at')->nullable();
            $table->timestamp('last_activity');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['game_id', 'status']);
            $table->index(['user_id', 'game_id']);
            $table->index('last_activity');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('game_connections');
    }
};
