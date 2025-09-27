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
        Schema::create('user_presence', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->enum('status', ['online', 'away', 'offline'])->default('offline');
            $table->string('socket_id')->nullable();
            $table->json('device_info')->nullable();
            $table->timestamp('last_activity')->nullable();
            $table->foreignId('current_game_id')->nullable()->constrained('games')->onDelete('set null');
            $table->enum('game_status', ['waiting', 'playing', 'spectating'])->nullable();
            $table->timestamps();

            // Indexes for performance
            $table->index(['user_id', 'status']);
            $table->index('socket_id');
            $table->index('last_activity');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_presence');
    }
};
