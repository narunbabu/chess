<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('games', function (Blueprint $table) {
            if (!Schema::hasColumn('games', 'halfmove_clock')) {
                $table->integer('halfmove_clock')->default(0)->after('move_count');
            }
            if (!Schema::hasColumn('games', 'queen_only_move_count')) {
                $table->integer('queen_only_move_count')->default(0)->after('halfmove_clock');
            }
            if (!Schema::hasColumn('games', 'position_history')) {
                $table->json('position_history')->nullable()->after('queen_only_move_count');
            }
        });
    }

    public function down(): void
    {
        Schema::table('games', function (Blueprint $table) {
            $columns = ['halfmove_clock', 'queen_only_move_count', 'position_history'];
            foreach ($columns as $col) {
                if (Schema::hasColumn('games', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
