<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tactical_puzzle_attempts', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('stage_id');
            $table->string('puzzle_id', 32);
            $table->unsignedInteger('puzzle_rating')->nullable();

            $table->boolean('success');
            $table->unsignedSmallInteger('wrong_count')->default(0);
            $table->boolean('solution_shown')->default(false);

            $table->unsignedTinyInteger('cct_my_found')->default(0);
            $table->unsignedTinyInteger('cct_my_total')->default(0);
            $table->unsignedTinyInteger('cct_opp_found')->default(0);
            $table->unsignedTinyInteger('cct_opp_total')->default(0);
            $table->boolean('cct_attempted')->default(false);
            $table->unsignedTinyInteger('cct_quality')->nullable();

            $table->unsignedSmallInteger('puzzle_score')->nullable();
            $table->json('score_breakdown')->nullable();

            $table->smallInteger('rating_delta')->default(0);
            $table->unsignedInteger('rating_before')->nullable();
            $table->unsignedInteger('rating_after')->nullable();

            $table->unsignedInteger('time_spent_ms')->nullable();

            $table->timestamp('created_at')->useCurrent();

            $table->index(['user_id', 'created_at']);
            $table->index(['user_id', 'stage_id', 'created_at']);
            $table->index(['user_id', 'puzzle_id']);
            $table->index('puzzle_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tactical_puzzle_attempts');
    }
};
