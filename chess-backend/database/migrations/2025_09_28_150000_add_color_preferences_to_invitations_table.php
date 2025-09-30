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
        Schema::table('invitations', function (Blueprint $table) {
            // Only store inviter's color preference (resolved to white/black, no 'random')
            // Frontend sends 'random' but backend resolves it immediately
            $table->enum('inviter_preferred_color', ['white', 'black'])->default('white')->after('status');
            // Note: We don't need invited_preferred_color - acceptor sends desired_color directly in response
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('invitations', function (Blueprint $table) {
            $table->dropColumn('inviter_preferred_color');
        });
    }
};