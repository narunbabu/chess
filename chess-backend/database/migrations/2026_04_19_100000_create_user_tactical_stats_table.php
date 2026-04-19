<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_tactical_stats', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('rating')->default(1000);
            $table->unsignedInteger('total_attempted')->default(0);
            $table->unsignedInteger('total_solved')->default(0);
            $table->unsignedInteger('streak')->default(0);
            $table->unsignedInteger('best_streak')->default(0);
            $table->unsignedInteger('peak_rating')->default(1000);
            $table->timestamp('last_solved_at')->nullable();
            $table->timestamps();

            $table->unique('user_id');
            $table->index('rating');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_tactical_stats');
    }
};
