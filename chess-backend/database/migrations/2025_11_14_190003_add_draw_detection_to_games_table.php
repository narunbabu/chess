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
        Schema::table('games', function (Blueprint $table) {
            // Only add fields that don't already exist
            if (!Schema::hasColumn('games', 'draw_reason')) {
                $table->text('draw_reason')->nullable()->comment('Reason for draw if applicable');
            }
            if (!Schema::hasColumn('games', 'insufficient_material_draw')) {
                $table->boolean('insufficient_material_draw')->default(false)->comment('True if draw due to insufficient material');
            }
            if (!Schema::hasColumn('games', 'timeout_winner_id')) {
                $table->foreignId('timeout_winner_id')->nullable()->constrained('users')->onDelete('set null')->comment('Winner if opponent timed out');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('games', function (Blueprint $table) {
            $table->dropColumn([
                'draw_reason',
                'insufficient_material_draw',
                'timeout_winner_id'
            ]);
        });
    }
};