<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_tactical_stage_progress', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('stage_id');
            $table->unsignedInteger('attempted')->default(0);
            $table->unsignedInteger('solved')->default(0);
            $table->boolean('unlocked')->default(false);
            $table->unsignedInteger('last_index')->default(0);
            $table->json('completed_puzzle_ids')->nullable();
            $table->json('puzzle_scores')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'stage_id']);
            $table->index('stage_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_tactical_stage_progress');
    }
};
