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
        Schema::table('users', function (Blueprint $table) {
            // Core rating field
            $table->integer('rating')->default(1200)->after('email');

            // Provisional rating system (first 20 games use higher K-factor)
            $table->boolean('is_provisional')->default(true)->after('rating');

            // Games played counter (used to track provisional period)
            $table->integer('games_played')->default(0)->after('is_provisional');

            // Peak rating (highest rating ever achieved)
            $table->integer('peak_rating')->default(1200)->after('games_played');

            // Last rating update timestamp
            $table->timestamp('rating_last_updated')->nullable()->after('peak_rating');

            // Add index for leaderboard queries
            $table->index('rating');
            $table->index('peak_rating');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['rating']);
            $table->dropIndex(['peak_rating']);
            $table->dropColumn([
                'rating',
                'is_provisional',
                'games_played',
                'peak_rating',
                'rating_last_updated'
            ]);
        });
    }
};
