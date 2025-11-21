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
        Schema::table('tutorial_lessons', function (Blueprint $table) {
            // Enhanced interactive lesson fields
            $table->json('interactive_config')->nullable()->after('content_data');
            $table->json('stage_progress')->nullable()->after('interactive_config');
            $table->string('interactive_type', 50)->nullable()->after('lesson_type');
            $table->boolean('allow_invalid_fen')->default(false)->after('is_active');
            $table->json('validation_rules')->nullable()->after('allow_invalid_fen');

            // Indexes for performance
            $table->index(['lesson_type', 'interactive_type']);
            $table->index(['is_active', 'interactive_type']);
        });

        Schema::create('interactive_lesson_stages', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('lesson_id');
            $table->integer('stage_order');
            $table->string('title', 200);
            $table->text('instruction_text')->nullable();
            $table->string('initial_fen', 100);
            $table->string('orientation', 10)->default('white');
            $table->json('goals')->nullable(); // Array of goal objects
            $table->json('success_criteria')->nullable();
            $table->json('hints')->nullable(); // Array of hint texts
            $table->json('visual_aids')->nullable(); // arrows, highlights
            $table->json('alternative_solutions')->nullable();
            $table->boolean('auto_reset_on_success')->default(false);
            $table->integer('auto_reset_delay_ms')->default(1500);
            $table->json('feedback_messages')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('lesson_id')->references('id')->on('tutorial_lessons')->onDelete('cascade');
            $table->unique(['lesson_id', 'stage_order']);
            $table->index(['lesson_id', 'is_active', 'stage_order']);
        });

        Schema::create('user_stage_progress', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('lesson_id');
            $table->unsignedBigInteger('stage_id');
            $table->enum('status', ['not_started', 'in_progress', 'completed', 'mastered'])->default('not_started');
            $table->integer('attempts')->default(0);
            $table->integer('best_score')->default(0);
            $table->integer('total_time_seconds')->default(0);
            $table->json('mistake_log')->nullable(); // Array of failed moves
            $table->json('hint_usage')->nullable(); // Track which hints were used
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('last_attempt_at')->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('lesson_id')->references('id')->on('tutorial_lessons')->onDelete('cascade');
            $table->foreign('stage_id')->references('id')->on('interactive_lesson_stages')->onDelete('cascade');
            $table->unique(['user_id', 'stage_id']);
            $table->index(['user_id', 'lesson_id', 'status']);
            $table->index(['stage_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_stage_progress');
        Schema::dropIfExists('interactive_lesson_stages');

        Schema::table('tutorial_lessons', function (Blueprint $table) {
            $table->dropIndex(['lesson_type', 'interactive_type']);
            $table->dropIndex(['is_active', 'interactive_type']);
            $table->dropColumn([
                'interactive_config',
                'stage_progress',
                'interactive_type',
                'allow_invalid_fen',
                'validation_rules'
            ]);
        });
    }
};