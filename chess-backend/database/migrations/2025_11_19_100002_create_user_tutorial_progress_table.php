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
        Schema::create('user_tutorial_progress', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('lesson_id');
            $table->enum('status', ['not_started', 'in_progress', 'completed', 'mastered'])->default('not_started');
            $table->integer('attempts')->default(0);
            $table->decimal('best_score', 5, 2)->default(0.00); // percentage score
            $table->integer('time_spent_seconds')->default(0);
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('mastered_at')->nullable();
            $table->timestamp('last_accessed_at')->useCurrent();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('lesson_id')->references('id')->on('tutorial_lessons')->onDelete('cascade');
            $table->unique(['user_id', 'lesson_id']);
            $table->index(['user_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_tutorial_progress');
    }
};