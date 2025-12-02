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
        // Only add columns if they don't already exist
        if (!Schema::hasColumn('tutorial_lessons', 'interactive_config')) {
            Schema::table('tutorial_lessons', function (Blueprint $table) {
                $table->json('interactive_config')->nullable()->after('content_data');
                $table->json('stage_progress')->nullable()->after('interactive_config');
                $table->string('interactive_type', 50)->nullable()->after('lesson_type');
                $table->boolean('allow_invalid_fen')->default(false)->after('is_active');
                $table->json('validation_rules')->nullable()->after('allow_invalid_fen');

                // Indexes for performance
                $table->index(['lesson_type', 'interactive_type']);
                $table->index(['is_active', 'interactive_type']);
            });
        }

        // Only create the table if it doesn't exist
        if (!Schema::hasTable('interactive_lesson_stages')) {
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
        }

        // Note: user_stage_progress table already exists in migration 2025_11_19_100003_create_user_stage_progress_table
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('interactive_lesson_stages');

        // Only drop columns if they exist
        if (Schema::hasColumn('tutorial_lessons', 'interactive_config')) {
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
    }
};