<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('championship_match_invitations')) {
            return;
        }

        Schema::create('championship_match_invitations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('match_id')->constrained('championship_matches')->onDelete('cascade');
            $table->foreignId('invited_player_id')->constrained('users')->onDelete('cascade');
            $table->string('status')->default('pending');
            $table->dateTime('expires_at')->nullable();
            $table->dateTime('responded_at')->nullable();
            $table->timestamps();

            $table->index(['match_id', 'status']);
            $table->index(['invited_player_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('championship_match_invitations');
    }
};
