
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('tournament_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tournament_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->integer('final_position')->nullable();
            $table->integer('points')->default(0);
            $table->integer('prize_won')->default(0);
            $table->timestamps();
            
            $table->unique(['tournament_id', 'user_id']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('tournament_entries');
    }
};
