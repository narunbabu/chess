<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('match_requests', function (Blueprint $table) {
            $table->id();
            $table->string('token', 32)->unique();
            $table->foreignId('requester_id')->constrained('users')->cascadeOnDelete();
            $table->enum('status', ['searching', 'accepted', 'expired', 'cancelled'])->default('searching');
            $table->string('preferred_color', 6)->default('random'); // white|black|random
            $table->unsignedSmallInteger('time_control_minutes')->default(10);
            $table->unsignedSmallInteger('increment_seconds')->default(0);
            $table->foreignId('game_id')->nullable()->constrained('games')->nullOnDelete();
            $table->foreignId('accepted_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('expires_at');
            $table->timestamps();

            $table->index(['requester_id', 'status']);
            $table->index(['status', 'expires_at']);
        });

        Schema::create('match_request_targets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('match_request_id')->constrained('match_requests')->cascadeOnDelete();
            $table->foreignId('target_user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('status', ['pending', 'accepted', 'declined', 'expired'])->default('pending');
            $table->timestamp('responded_at')->nullable();
            $table->timestamps();

            $table->unique(['match_request_id', 'target_user_id']);
            $table->index(['target_user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('match_request_targets');
        Schema::dropIfExists('match_requests');
    }
};
