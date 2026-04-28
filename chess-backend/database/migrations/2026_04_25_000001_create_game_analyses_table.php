<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('game_analyses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_id')->unique()->constrained()->onDelete('cascade');
            $table->enum('status', ['pending', 'in_progress', 'completed', 'failed'])->default('pending');
            $table->unsignedInteger('depth')->default(18);

            // Per-move analysis stored as JSON array
            $table->json('move_analyses')->nullable();

            // Summary statistics
            $table->decimal('accuracy_white', 5, 2)->nullable();
            $table->decimal('accuracy_black', 5, 2)->nullable();
            $table->decimal('acpl_white', 8, 2)->nullable()->comment('Average centipawn loss for white');
            $table->decimal('acpl_black', 8, 2)->nullable()->comment('Average centipawn loss for black');
            $table->json('quality_counts')->nullable()->comment('Per-color counts: {white: {brilliant: N, ...}, black: {...}}');

            $table->string('error_message', 500)->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index('status');
        });
    }

    public function down()
    {
        Schema::dropIfExists('game_analyses');
    }
};
