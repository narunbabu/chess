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
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('game_end_reasons');
        Schema::dropIfExists('game_statuses');
    }
};
