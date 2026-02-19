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
        Schema::create('user_skill_assessments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->enum('skill_tier', ['beginner', 'intermediate', 'advanced']);
            $table->enum('assessment_type', ['initial', 'module_completion', 'challenge']);
            $table->decimal('score', 5, 2);
            $table->integer('rating_before')->nullable();
            $table->integer('rating_after')->nullable();
            $table->timestamp('completed_at')->useCurrent();
            $table->json('assessment_data')->nullable(); // stores detailed results

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->index(['user_id', 'skill_tier']);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_skill_assessments');
    }
};