<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'learner_rating')) {
                $table->integer('learner_rating')->default(800)->after('rating');
            }
            if (!Schema::hasColumn('users', 'learner_games_played')) {
                $table->integer('learner_games_played')->default(0)->after('games_played');
            }
            if (!Schema::hasColumn('users', 'learner_peak_rating')) {
                $table->integer('learner_peak_rating')->default(800)->after('peak_rating');
            }
            if (!Schema::hasColumn('users', 'learner_rating_last_updated')) {
                $table->timestamp('learner_rating_last_updated')->nullable()->after('rating_last_updated');
            }
        });

        Schema::table('games', function (Blueprint $table) {
            if (!Schema::hasColumn('games', 'learning_mode')) {
                $table->boolean('learning_mode')->default(false)->after('game_mode');
            }
            if (!Schema::hasColumn('games', 'learning_help_limit')) {
                $table->unsignedTinyInteger('learning_help_limit')->nullable()->after('learning_mode');
            }
            if (!Schema::hasColumn('games', 'learning_help_used')) {
                $table->unsignedTinyInteger('learning_help_used')->default(0)->after('learning_help_limit');
            }
            if (!Schema::hasColumn('games', 'learner_rating_change')) {
                $table->integer('learner_rating_change')->nullable()->after('learning_help_used');
            }
            if (!Schema::hasColumn('games', 'learner_rating_data')) {
                $table->json('learner_rating_data')->nullable()->after('learner_rating_change');
            }
        });

        if (!Schema::hasTable('learner_rating_history')) {
            Schema::create('learner_rating_history', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->foreignId('game_id')->nullable()->constrained('games')->nullOnDelete();
                $table->foreignId('synthetic_player_id')->nullable()->constrained('synthetic_players')->nullOnDelete();
                $table->integer('old_rating');
                $table->integer('new_rating');
                $table->integer('rating_change');
                $table->integer('opponent_rating');
                $table->integer('computer_level')->nullable();
                $table->enum('result', ['win', 'loss', 'draw']);
                $table->integer('k_factor');
                $table->decimal('expected_score', 5, 4);
                $table->decimal('actual_score', 3, 2);
                $table->unsignedTinyInteger('help_limit');
                $table->unsignedTinyInteger('help_used');
                $table->decimal('help_ratio', 5, 4);
                $table->decimal('help_multiplier', 5, 3);
                $table->decimal('base_rating_change', 8, 2);
                $table->timestamps();

                $table->unique(['user_id', 'game_id']);
                $table->index(['user_id', 'created_at']);
                $table->index('rating_change');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('learner_rating_history');

        Schema::table('games', function (Blueprint $table) {
            $columns = [
                'learner_rating_data',
                'learner_rating_change',
                'learning_help_used',
                'learning_help_limit',
                'learning_mode',
            ];
            $existing = array_filter($columns, fn ($column) => Schema::hasColumn('games', $column));
            if (!empty($existing)) {
                $table->dropColumn($existing);
            }
        });

        Schema::table('users', function (Blueprint $table) {
            $columns = [
                'learner_rating_last_updated',
                'learner_peak_rating',
                'learner_games_played',
                'learner_rating',
            ];
            $existing = array_filter($columns, fn ($column) => Schema::hasColumn('users', $column));
            if (!empty($existing)) {
                $table->dropColumn($existing);
            }
        });
    }
};
