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
            $table->timestamp('ended_at')->nullable()->after('last_move_at');
            $table->string('end_reason')->nullable()->after('ended_at');
            $table->unsignedBigInteger('parent_game_id')->nullable()->after('end_reason');

            // Add index for parent game relationship
            $table->index('parent_game_id');

            // Add foreign key constraint if needed (optional)
            // $table->foreign('parent_game_id')->references('id')->on('games')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('games', function (Blueprint $table) {
            $table->dropIndex(['parent_game_id']);
            $table->dropColumn(['ended_at', 'end_reason', 'parent_game_id']);
        });
    }
};