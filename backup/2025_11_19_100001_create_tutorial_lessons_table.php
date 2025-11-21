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
        Schema::create('tutorial_lessons', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('module_id');
            $table->string('title', 150);
            $table->string('slug', 150);
            $table->enum('lesson_type', ['theory', 'interactive', 'puzzle', 'practice_game']);
            $table->json('content_data')->nullable(); // stores lesson content, positions, explanations
            $table->integer('difficulty_rating')->default(1); // 1-10 scale
            $table->integer('sort_order')->default(0);
            $table->integer('estimated_duration_minutes')->default(10);
            $table->integer('xp_reward')->default(10);
            $table->unsignedBigInteger('unlock_requirement_lesson_id')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('module_id')->references('id')->on('tutorial_modules')->onDelete('cascade');
            $table->index(['module_id', 'is_active', 'sort_order']);
            $table->foreign('unlock_requirement_lesson_id')->references('id')->on('tutorial_lessons')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tutorial_lessons');
    }
};