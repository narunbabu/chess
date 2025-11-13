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
        if (Schema::hasTable('championship_matches')) {
            return;
        }

        // Create championship_round_types lookup table
        Schema::create('championship_round_types', function (Blueprint $table) {
            $table->tinyIncrements('id');
            $table->string('code', 32)->unique()->comment('Machine-readable round type code');
            $table->string('label', 50)->comment('Human-readable label');
            $table->timestamps();
        });

        // Seed round type values
        DB::table('championship_round_types')->insert([
            ['code' => 'swiss', 'label' => 'Swiss Round', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'round_of_16', 'label' => 'Round of 16', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'quarter_final', 'label' => 'Quarter Final', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'semi_final', 'label' => 'Semi Final', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'final', 'label' => 'Final', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'third_place', 'label' => 'Third Place', 'created_at' => now(), 'updated_at' => now()],
        ]);

        // Create championship_match_statuses lookup table
        Schema::create('championship_match_statuses', function (Blueprint $table) {
            $table->tinyIncrements('id');
            $table->string('code', 32)->unique()->comment('Machine-readable status code');
            $table->string('label', 50)->comment('Human-readable label');
            $table->timestamps();
        });

        // Seed match status values
        DB::table('championship_match_statuses')->insert([
            ['code' => 'pending', 'label' => 'Pending', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'in_progress', 'label' => 'In Progress', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'completed', 'label' => 'Completed', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'cancelled', 'label' => 'Cancelled', 'created_at' => now(), 'updated_at' => now()],
        ]);

        // Create championship_result_types lookup table
        Schema::create('championship_result_types', function (Blueprint $table) {
            $table->tinyIncrements('id');
            $table->string('code', 32)->unique()->comment('Machine-readable result type code');
            $table->string('label', 50)->comment('Human-readable label');
            $table->timestamps();
        });

        // Seed result type values
        DB::table('championship_result_types')->insert([
            ['code' => 'completed', 'label' => 'Completed Normally', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'forfeit_player1', 'label' => 'Player 1 Forfeit', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'forfeit_player2', 'label' => 'Player 2 Forfeit', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'double_forfeit', 'label' => 'Double Forfeit', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'draw', 'label' => 'Draw', 'created_at' => now(), 'updated_at' => now()],
        ]);

        // Create championship_matches table
        Schema::create('championship_matches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('championship_id')->constrained('championships')->onDelete('cascade');
            $table->unsignedInteger('round_number')->comment('Round number (1, 2, 3...)');

            // Round type using lookup table
            $table->unsignedTinyInteger('round_type_id');
            $table->foreign('round_type_id')->references('id')->on('championship_round_types')->onDelete('restrict');

            $table->foreignId('player1_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('player2_id')->nullable()->constrained('users')->onDelete('cascade');
            $table->foreignId('game_id')->nullable()->constrained('games')->onDelete('set null');

            $table->dateTime('scheduled_at')->useCurrent();
            $table->dateTime('deadline');
            $table->foreignId('winner_id')->nullable()->constrained('users')->onDelete('set null');

            // Result type using lookup table
            $table->unsignedTinyInteger('result_type_id')->nullable();
            $table->foreign('result_type_id')->references('id')->on('championship_result_types')->onDelete('restrict');

            // Status using lookup table
            $table->unsignedTinyInteger('status_id')->default(1);
            $table->foreign('status_id')->references('id')->on('championship_match_statuses')->onDelete('restrict');

            $table->timestamps();

            // Indexes
            $table->index('championship_id');
            $table->index(['championship_id', 'round_number']);
            $table->index('player1_id');
            $table->index('player2_id');
            $table->index('game_id');
            $table->index('status_id');
            $table->index('deadline');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('championship_matches');
        Schema::dropIfExists('championship_result_types');
        Schema::dropIfExists('championship_match_statuses');
        Schema::dropIfExists('championship_round_types');
    }
};
