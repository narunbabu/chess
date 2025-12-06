<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('games')) {
            return;
        }

        // Create game_statuses lookup table
        Schema::create('game_statuses', function (Blueprint $table) {
            $table->tinyIncrements('id');
            $table->string('code', 24)->unique()->comment('Machine-readable status code');
            $table->string('label', 50)->comment('Human-readable label');
            $table->timestamps();
        });

        // Seed canonical status values
        DB::table('game_statuses')->insert([
            ['code' => 'waiting', 'label' => 'Waiting for opponent', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'active', 'label' => 'In progress', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'finished', 'label' => 'Finished', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'aborted', 'label' => 'Aborted', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'paused', 'label' => 'Paused', 'created_at' => now(), 'updated_at' => now()],
        ]);

        // Create game_end_reasons lookup table
        Schema::create('game_end_reasons', function (Blueprint $table) {
            $table->tinyIncrements('id');
            $table->string('code', 32)->unique()->comment('Machine-readable reason code');
            $table->string('label', 50)->comment('Human-readable label');
            $table->timestamps();
        });

        // Seed canonical end reason values
        DB::table('game_end_reasons')->insert([
            ['code' => 'checkmate', 'label' => 'Checkmate', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'resignation', 'label' => 'Resignation', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'stalemate', 'label' => 'Stalemate', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'timeout', 'label' => 'Timeout', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'draw_agreed', 'label' => 'Draw by agreement', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'threefold', 'label' => 'Threefold repetition', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'fifty_move', 'label' => 'Fifty-move rule', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'insufficient_material', 'label' => 'Insufficient material', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'aborted', 'label' => 'Game aborted', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'forfeit', 'label' => 'Forfeit', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'abandoned_mutual', 'label' => 'Abandoned by agreement', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'timeout_inactivity', 'label' => 'Timeout', 'created_at' => now(), 'updated_at' => now()],
        ]);

        Schema::create('games', function (Blueprint $table) {
            $table->id();
            $table->foreignId('white_player_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('black_player_id')->constrained('users')->onDelete('cascade');

            // Status tracking using lookup table
            $table->unsignedTinyInteger('status_id');
            $table->foreign('status_id')->references('id')->on('game_statuses')->onDelete('restrict');

            $table->string('result', 7)->nullable()->default('*'); // '1-0', '0-1', '1/2-1/2', '*'
            $table->enum('winner_player', ['white', 'black'])->nullable();
            $table->string('fen', 255)->default('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'); // Starting position
            $table->json('moves')->nullable(); // Store game moves as JSON
            $table->enum('turn', ['white', 'black'])->default('white');
            $table->timestamp('last_move_at')->nullable();
            $table->timestamp('ended_at')->nullable();

            // End reason tracking using lookup table
            $table->unsignedTinyInteger('end_reason_id')->nullable();
            $table->foreign('end_reason_id')->references('id')->on('game_end_reasons')->onDelete('restrict');

            // Pause tracking
            $table->timestamp('paused_at')->nullable();
            $table->string('paused_reason', 50)->nullable();
            $table->foreignId('paused_by_user_id')->nullable()->constrained('users')->onDelete('set null');

            $table->unsignedBigInteger('parent_game_id')->nullable();
            $table->unsignedBigInteger('winner_user_id')->nullable();
            $table->integer('move_count')->default(0);
            $table->longText('pgn')->nullable();

            // Time control settings
            $table->integer('time_control_minutes')->default(10);
            $table->integer('increment_seconds')->default(0);
            $table->integer('white_time_remaining_ms')->nullable();
            $table->integer('black_time_remaining_ms')->nullable();
            $table->timestamp('last_move_time')->nullable();

            // Pause time tracking
            $table->integer('white_time_paused_ms')->nullable();
            $table->integer('black_time_paused_ms')->nullable();
            $table->enum('turn_at_pause', ['white', 'black'])->nullable();
            $table->integer('white_grace_time_ms')->default(0);
            $table->integer('black_grace_time_ms')->default(0);

            // Resume request tracking
            $table->unsignedBigInteger('resume_requested_by')->nullable();
            $table->timestamp('resume_requested_at')->nullable();
            $table->timestamp('resume_request_expires_at')->nullable();
            $table->enum('resume_status', ['none', 'pending', 'accepted', 'expired'])->default('none');

            // Connection tracking
            $table->boolean('white_connected')->default(false);
            $table->boolean('black_connected')->default(false);
            $table->timestamp('white_last_seen')->nullable();
            $table->timestamp('black_last_seen')->nullable();

            // Game state
            $table->enum('game_phase', ['waiting', 'starting', 'active', 'paused', 'ended'])->default('waiting');
            $table->json('game_state')->nullable(); // Current board state, turn info, etc.
            $table->integer('total_moves')->default(0);

            // Abandonment tracking
            $table->integer('disconnection_count_white')->default(0);
            $table->integer('disconnection_count_black')->default(0);
            $table->timestamp('abandonment_warning_sent')->nullable();

            $table->timestamps();
            $table->timestamp('last_heartbeat_at')->nullable();

            // Foreign keys
            $table->foreign('winner_user_id')->references('id')->on('users')->onDelete('set null');
            $table->foreign('resume_requested_by')->references('id')->on('users')->onDelete('set null');

            // Indexes for performance
            $table->index(['white_player_id', 'status_id']);
            $table->index(['black_player_id', 'status_id']);
            $table->index(['status_id']);
            $table->index(['game_phase', 'updated_at']);
            $table->index(['white_connected', 'black_connected']);
            $table->index('parent_game_id');
            $table->index(['winner_user_id', 'ended_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Disable foreign key constraints to handle dependencies
        DB::statement('PRAGMA foreign_keys = OFF');

        try {
            Schema::dropIfExists('games');
            Schema::dropIfExists('game_end_reasons');
            Schema::dropIfExists('game_statuses');
        } finally {
            // Always re-enable foreign keys
            DB::statement('PRAGMA foreign_keys = ON');
        }
    }
};