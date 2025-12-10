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
        Schema::create('computer_players', function (Blueprint $table) {
            $table->id();
            $table->string('name')->default('Computer');
            $table->integer('level')->default(1);
            $table->integer('rating')->default(1200);
            $table->string('avatar')->default('🤖');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['level', 'is_active']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('computer_players');
    }
};
