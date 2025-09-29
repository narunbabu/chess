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
            $table->enum('inviter_preferred_color', ['white', 'black', 'random'])->default('random')->after('status');
            $table->enum('invited_preferred_color', ['white', 'black', 'accept', 'opposite'])->nullable()->after('inviter_preferred_color');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('invitations', function (Blueprint $table) {
            $table->dropColumn(['inviter_preferred_color', 'invited_preferred_color']);
        });
    }
};