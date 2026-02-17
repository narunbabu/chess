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
        Schema::create('synthetic_players', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('avatar_seed')->comment('DiceBear seed for consistent avatar');
            $table->integer('rating')->default(1400);
            $table->integer('computer_level')->default(6)->comment('Stockfish hybrid level 6-16');
            $table->string('personality')->nullable()->comment('Aggressive|Defensive|Balanced|Tactical|Positional');
            $table->string('bio')->nullable()->comment('Short flavor text');
            $table->boolean('is_active')->default(true);
            $table->integer('games_played_count')->default(0)->comment('Cosmetic counter');
            $table->integer('wins_count')->default(0)->comment('Cosmetic counter');
            $table->timestamps();

            $table->index(['is_active', 'rating']);
            $table->index('computer_level');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('synthetic_players');
    }
};
