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
        if (Schema::hasTable('championship_match_schedules')) {
            return;
        }

        Schema::create('championship_match_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('championship_match_id')->constrained('championship_matches')->onDelete('cascade');
            $table->foreignId('proposer_id')->constrained('users')->onDelete('cascade');
            $table->dateTime('proposed_time')->comment('Proposed match time');
            $table->enum('status', ['proposed', 'accepted', 'rejected', 'alternative_proposed'])->default('proposed');
            $table->foreignId('responder_id')->nullable()->constrained('users')->onDelete('cascade');
            $table->dateTime('response_time')->nullable()->comment('When proposal was responded to');
            $table->text('proposer_message')->nullable()->comment('Message from proposer');
            $table->text('responder_message')->nullable()->comment('Message from responder');
            $table->dateTime('alternative_time')->nullable()->comment('Alternative proposed time');
            $table->text('alternative_message')->nullable()->comment('Reason for alternative proposal');
            $table->timestamps();

            // Indexes
            $table->index('championship_match_id');
            $table->index('proposer_id');
            $table->index('responder_id');
            $table->index('status');
            $table->index('proposed_time');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('championship_match_schedules');
    }
};