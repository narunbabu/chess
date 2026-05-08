<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('training_drill_sets', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('title');
            $table->text('description')->nullable();
            $table->enum('skill_band', [
                'newcomer',
                'beginner',
                'improving-beginner',
                'club-player',
                'advanced',
                'competitive',
            ]);
            $table->enum('required_tier', ['free', 'silver', 'gold'])->default('free');
            $table->string('theme')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['skill_band', 'required_tier', 'is_active']);
            $table->index(['sort_order', 'id']);
        });

        Schema::create('training_drills', function (Blueprint $table) {
            $table->id();
            $table->foreignId('drill_set_id')->nullable()->constrained('training_drill_sets')->nullOnDelete();
            $table->string('slug')->unique();
            $table->string('title');
            $table->text('description')->nullable();
            $table->enum('skill_band', [
                'newcomer',
                'beginner',
                'improving-beginner',
                'club-player',
                'advanced',
                'competitive',
            ]);
            $table->enum('required_tier', ['free', 'silver', 'gold'])->default('free');
            $table->enum('drill_type', ['pattern', 'calculation', 'habit', 'endgame', 'opening', 'review']);
            $table->string('theme');
            $table->string('subtheme')->nullable();
            $table->string('position_fen');
            $table->json('solution');
            $table->json('accepted_alternatives')->nullable();
            $table->text('explanation')->nullable();
            $table->json('hints')->nullable();
            $table->json('thinking_steps')->nullable();
            $table->unsignedSmallInteger('time_target_seconds')->nullable();
            $table->unsignedTinyInteger('mastery_threshold')->default(3);
            $table->string('source')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['skill_band', 'required_tier', 'is_active']);
            $table->index(['drill_type', 'theme']);
            $table->index(['sort_order', 'id']);
        });

        Schema::create('user_training_drill_progress', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('training_drill_id')->constrained('training_drills')->cascadeOnDelete();
            $table->unsignedInteger('attempts')->default(0);
            $table->unsignedInteger('solved_count')->default(0);
            $table->unsignedInteger('first_try_solves')->default(0);
            $table->unsignedInteger('hints_used')->default(0);
            $table->unsignedInteger('total_time_seconds')->default(0);
            $table->unsignedInteger('best_time_seconds')->nullable();
            $table->unsignedTinyInteger('current_streak')->default(0);
            $table->unsignedTinyInteger('mastery_score')->default(0);
            $table->boolean('is_mastered')->default(false);
            $table->string('last_failure_reason')->nullable();
            $table->timestamp('last_attempted_at')->nullable();
            $table->timestamp('mastered_at')->nullable();
            $table->date('review_due_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'training_drill_id']);
            $table->index(['user_id', 'is_mastered', 'review_due_at'], 'utdp_user_mastered_due_idx');
            $table->index(['user_id', 'last_attempted_at'], 'utdp_user_last_attempt_idx');
        });

        Schema::create('user_training_drill_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('training_drill_id')->constrained('training_drills')->cascadeOnDelete();
            $table->boolean('solved');
            $table->json('submitted_solution')->nullable();
            $table->unsignedSmallInteger('time_spent_seconds')->nullable();
            $table->unsignedTinyInteger('hints_used')->default(0);
            $table->string('failure_reason')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['user_id', 'created_at'], 'utda_user_created_idx');
            $table->index(['user_id', 'training_drill_id', 'created_at'], 'utda_user_drill_created_idx');
            $table->index(['training_drill_id', 'solved'], 'utda_drill_solved_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_training_drill_attempts');
        Schema::dropIfExists('user_training_drill_progress');
        Schema::dropIfExists('training_drills');
        Schema::dropIfExists('training_drill_sets');
    }
};
