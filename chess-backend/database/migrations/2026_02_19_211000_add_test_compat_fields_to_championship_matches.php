<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('championship_matches', function (Blueprint $table) {
            if (!Schema::hasColumn('championship_matches', 'result')) {
                $table->string('result')->nullable()->after('winner_id');
            }
            if (!Schema::hasColumn('championship_matches', 'completed_at')) {
                $table->dateTime('completed_at')->nullable()->after('result');
            }
            if (!Schema::hasColumn('championship_matches', 'moves')) {
                $table->text('moves')->nullable()->after('completed_at');
            }
            if (!Schema::hasColumn('championship_matches', 'player1_result_type_id')) {
                $table->unsignedTinyInteger('player1_result_type_id')->nullable()->after('result_type_id');
            }
            if (!Schema::hasColumn('championship_matches', 'player2_result_type_id')) {
                $table->unsignedTinyInteger('player2_result_type_id')->nullable()->after('player1_result_type_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('championship_matches', function (Blueprint $table) {
            $columns = ['result', 'completed_at', 'moves', 'player1_result_type_id', 'player2_result_type_id'];
            foreach ($columns as $col) {
                if (Schema::hasColumn('championship_matches', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
