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
        Schema::create('user_stage_progress', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('lesson_id');
            $table->unsignedBigInteger('stage_id');
            $table->enum('status', ['not_started', 'in_progress', 'completed'])->default('not_started');
            $table->integer('attempts')->default(0);
            $table->integer('best_score')->default(0);
            $table->integer('total_time_seconds')->default(0);
            $table->json('mistake_log')->nullable();
            $table->json('hint_usage')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('last_attempt_at')->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('lesson_id')->references('id')->on('tutorial_lessons')->onDelete('cascade');
            $table->foreign('stage_id')->references('id')->on('interactive_lesson_stages')->onDelete('cascade');
            $table->unique(['user_id', 'lesson_id', 'stage_id']);
            $table->index(['user_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_stage_progress');
    }
};
