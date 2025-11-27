<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('game_histories', function (Blueprint $table) {
            $table->text('moves')->nullable()->change();
        });
    }

    public function down()
    {
        Schema::table('game_histories', function (Blueprint $table) {
            $table->text('moves')->nullable(false)->change();
        });
    }
};
