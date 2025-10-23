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
            // Add computer_level field to track which AI difficulty level was played
            $table->integer('computer_level')->nullable()->after('opponent_rating')
                  ->comment('Computer difficulty level (1-16) for computer games');
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
            $table->dropColumn('computer_level');
        });
    }
};
