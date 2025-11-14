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
        Schema::create('shared_results', function (Blueprint $table) {
            $table->id();
            $table->uuid('unique_id')->unique();
            $table->unsignedBigInteger('game_id')->nullable(); // No foreign key - supports both multiplayer and computer games
            $table->foreignId('user_id')->nullable()->constrained('users')->onDelete('set null');
            $table->string('image_path');
            $table->json('result_data')->nullable();
            $table->integer('view_count')->default(0);
            $table->timestamps();

            $table->index('unique_id');
            $table->index('game_id');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('shared_results');
    }
};
