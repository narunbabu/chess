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
        Schema::create('invitations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inviter_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('invited_id')->constrained('users')->onDelete('cascade');
            $table->enum('status', ['pending', 'accepted', 'declined', 'notified'])->default('pending');
            $table->enum('inviter_preferred_color', ['white', 'black'])->default('white');
            $table->unsignedBigInteger('responded_by')->nullable();
            $table->timestamp('responded_at')->nullable();
            $table->foreignId('game_id')->nullable()->constrained('games')->onDelete('set null');
            $table->timestamps();

            // Foreign keys
            $table->foreign('responded_by')->references('id')->on('users')->onDelete('set null');

            // Indexes
            $table->index(['invited_id', 'status']);
            $table->index(['inviter_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('invitations');
    }
};