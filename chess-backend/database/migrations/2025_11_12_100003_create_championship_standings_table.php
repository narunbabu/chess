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
        if (Schema::hasTable('championship_standings')) {
            return;
        }

        // Create championship_standings table
        Schema::create('championship_standings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('championship_id')->constrained('championships')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');

            // Match statistics
            $table->unsignedInteger('matches_played')->default(0);
            $table->unsignedInteger('wins')->default(0);
            $table->unsignedInteger('draws')->default(0);
            $table->unsignedInteger('losses')->default(0);

            // Points (W=1, D=0.5, L=0)
            $table->decimal('points', 4, 1)->default(0);

            // Tiebreakers
            $table->decimal('buchholz_score', 6, 1)->default(0)->comment('Sum of opponents\' scores');
            $table->decimal('sonneborn_berger', 6, 1)->default(0)->comment('Quality of wins tiebreaker');

            // Ranking
            $table->unsignedInteger('rank')->nullable();
            $table->unsignedInteger('final_position')->nullable()->comment('Final position (1st, 2nd, 3rd, etc.)');

            // Prizes
            $table->decimal('prize_amount', 10, 2)->default(0);
            $table->unsignedInteger('credits_earned')->default(0);

            $table->timestamps();

            // Unique constraint - one standing per user per championship
            $table->unique(['championship_id', 'user_id']);

            // Indexes
            $table->index('championship_id');
            $table->index('user_id');
            $table->index(['championship_id', 'points', 'buchholz_score']);
            $table->index(['championship_id', 'rank']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('championship_standings');
    }
};
