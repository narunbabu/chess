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
        Schema::table('championship_matches', function (Blueprint $table) {
            // Drop foreign key constraints first
            $table->dropForeign(['player1_id']);
            $table->dropForeign(['player2_id']);

            // Check if white/black player foreign keys exist (they might be from later migrations)
            try {
                $table->dropForeign(['white_player_id']);
            } catch (\Exception $e) {
                // Foreign key doesn't exist, that's okay
            }

            try {
                $table->dropForeign(['black_player_id']);
            } catch (\Exception $e) {
                // Foreign key doesn't exist, that's okay
            }
        });

        Schema::table('championship_matches', function (Blueprint $table) {
            // Allow NULL values for player IDs to support placeholder matches
            // These will be populated later based on tournament standings
            $table->unsignedBigInteger('player1_id')->nullable()->change();
            $table->unsignedBigInteger('player2_id')->nullable()->change();
            $table->unsignedBigInteger('white_player_id')->nullable()->change();
            $table->unsignedBigInteger('black_player_id')->nullable()->change();
        });

        Schema::table('championship_matches', function (Blueprint $table) {
            // Re-add foreign key constraints with onDelete cascade
            $table->foreign('player1_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('player2_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('white_player_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('black_player_id')->references('id')->on('users')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Note: This migration cannot be safely reversed if placeholder matches exist
        // First, delete any placeholder matches to avoid constraint violations
        DB::table('championship_matches')->where('is_placeholder', true)->delete();

        Schema::table('championship_matches', function (Blueprint $table) {
            // Drop foreign key constraints first
            $table->dropForeign(['player1_id']);
            $table->dropForeign(['player2_id']);

            try {
                $table->dropForeign(['white_player_id']);
            } catch (\Exception $e) {
                // Foreign key doesn't exist
            }

            try {
                $table->dropForeign(['black_player_id']);
            } catch (\Exception $e) {
                // Foreign key doesn't exist
            }
        });

        Schema::table('championship_matches', function (Blueprint $table) {
            // Revert to NOT NULL
            $table->unsignedBigInteger('player1_id')->nullable(false)->change();
            // player2_id stays nullable (it was nullable in original migration)
        });

        Schema::table('championship_matches', function (Blueprint $table) {
            // Re-add foreign key constraints
            $table->foreign('player1_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('player2_id')->references('id')->on('users')->onDelete('cascade');

            // Only add white/black player foreign keys if those columns exist
            if (Schema::hasColumn('championship_matches', 'white_player_id')) {
                $table->foreign('white_player_id')->references('id')->on('users')->onDelete('cascade');
            }
            if (Schema::hasColumn('championship_matches', 'black_player_id')) {
                $table->foreign('black_player_id')->references('id')->on('users')->onDelete('cascade');
            }
        });
    }
};
