<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('ratings_history', function (Blueprint $table) {
            // Performance-based rating enhancement fields
            $table->decimal('performance_score', 5, 2)->nullable()->after('actual_score')
                ->comment('Player performance score (0-100) for this game');

            $table->decimal('performance_modifier', 4, 2)->nullable()->after('performance_score')
                ->comment('Performance modifier applied to rating change (0.5-1.5)');

            $table->decimal('base_rating_change', 8, 2)->nullable()->after('performance_modifier')
                ->comment('Base ELO rating change before performance modifier');

            $table->decimal('final_rating_change', 8, 2)->nullable()->after('base_rating_change')
                ->comment('Final rating change after performance modifier applied');

            // Draw-specific fields
            $table->boolean('is_draw')->default(false)->after('final_rating_change')
                ->comment('Whether this game ended in a draw');

            $table->decimal('draw_penalty', 8, 2)->nullable()->after('is_draw')
                ->comment('Rating penalty/reward for accepting draw from advantageous/disadvantageous position');

            // Add indexes for new fields
            $table->index('performance_score');
            $table->index('is_draw');
            $table->index(['user_id', 'performance_score']);
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('ratings_history', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'performance_score']);
            $table->dropIndex(['is_draw']);
            $table->dropIndex(['performance_score']);

            $table->dropColumn([
                'performance_score',
                'performance_modifier',
                'base_rating_change',
                'final_rating_change',
                'is_draw',
                'draw_penalty'
            ]);
        });
    }
};
