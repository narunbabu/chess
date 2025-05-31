
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('provider')->nullable();
            $table->string('provider_id')->nullable();
            $table->integer('credits')->default(0);
            $table->string('ref_code', 8)->unique()->nullable();
            $table->string('referred_by', 8)->nullable();
            $table->integer('total_games')->default(0);
            $table->integer('wins')->default(0);
            $table->integer('losses')->default(0);
            $table->integer('draws')->default(0);
            $table->integer('current_streak')->default(0);
            $table->integer('best_streak')->default(0);
            $table->timestamp('last_game_at')->nullable();
            $table->json('achievements')->nullable();
        });
    }

    public function down()
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'provider', 'provider_id', 'credits', 'ref_code', 'referred_by',
                'total_games', 'wins', 'losses', 'draws', 'current_streak', 
                'best_streak', 'last_game_at', 'achievements'
            ]);
        });
    }
};
