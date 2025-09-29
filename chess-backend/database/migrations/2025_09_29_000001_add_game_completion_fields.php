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
            // Modify status to support new states
            $table->enum('status', ['waiting', 'active', 'finished', 'aborted'])->default('waiting')->change();

            // Modify existing result field to use standard notation
            $table->string('result', 7)->nullable()->default('*')->change(); // '1-0', '0-1', '1/2-1/2', '*' for ongoing

            // Modify existing end_reason field to use enum with chess-specific values
            $table->enum('end_reason', [
                'checkmate',
                'resignation',
                'stalemate',
                'timeout',
                'draw_agreed',
                'threefold',
                'fifty_move',
                'insufficient_material',
                'aborted'
            ])->nullable()->change();

            // Add new completion fields
            $table->enum('winner_player', ['white', 'black'])->nullable()->after('result');
            $table->unsignedBigInteger('winner_user_id')->nullable()->after('winner_player');

            // Metadata fields
            $table->integer('move_count')->default(0)->after('end_reason');
            $table->longText('pgn')->nullable()->after('move_count');

            // Foreign key constraint
            $table->foreign('winner_user_id')->references('id')->on('users')->onDelete('set null');

            // Index for performance
            $table->index(['status']);
            $table->index(['winner_user_id', 'ended_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('games', function (Blueprint $table) {
            // Drop foreign key and indexes
            $table->dropForeign(['winner_user_id']);
            $table->dropIndex(['status']);
            $table->dropIndex(['winner_user_id', 'ended_at']);

            // Drop only the newly added columns
            $table->dropColumn([
                'winner_player',
                'winner_user_id',
                'move_count',
                'pgn'
            ]);

            // Restore original result enum
            $table->enum('result', ['white_wins', 'black_wins', 'draw', 'ongoing'])->default('ongoing')->change();

            // Restore original end_reason to string (as it was in the previous migration)
            $table->string('end_reason')->nullable()->change();

            // Restore original status enum
            $table->enum('status', ['waiting', 'active', 'completed', 'abandoned'])->default('waiting')->change();
        });
    }
};