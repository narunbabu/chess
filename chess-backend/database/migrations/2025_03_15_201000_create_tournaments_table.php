
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('tournaments', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->integer('entry_fee');
            $table->integer('prize_pool')->default(0);
            $table->integer('max_participants')->default(32);
            $table->enum('status', ['upcoming', 'active', 'completed', 'cancelled'])->default('upcoming');
            $table->timestamp('registration_start');
            $table->timestamp('registration_end');
            $table->timestamp('tournament_start');
            $table->timestamp('tournament_end')->nullable();
            $table->json('settings')->nullable(); // time control, format, etc.
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('tournaments');
    }
};
