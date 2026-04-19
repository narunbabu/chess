<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_tactical_badges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('badge_id')->constrained('tactical_badges')->cascadeOnDelete();
            $table->timestamp('awarded_at')->useCurrent();
            $table->json('progress_snapshot')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'badge_id']);
            $table->index(['user_id', 'awarded_at']);
            $table->index('badge_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_tactical_badges');
    }
};
