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
        Schema::create('daily_challenges', function (Blueprint $table) {
            $table->id();
            $table->date('date')->unique();
            $table->enum('challenge_type', ['puzzle', 'endgame', 'opening', 'tactic']);
            $table->enum('skill_tier', ['beginner', 'intermediate', 'advanced']);
            $table->json('challenge_data'); // position, solution, hints
            $table->integer('xp_reward')->default(25);
            $table->timestamps();

            $table->index(['date', 'skill_tier']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('daily_challenges');
    }
};