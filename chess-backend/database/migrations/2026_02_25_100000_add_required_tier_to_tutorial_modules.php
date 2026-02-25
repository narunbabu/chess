<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('tutorial_modules', function (Blueprint $table) {
            $table->enum('required_tier', ['free', 'silver', 'gold'])
                  ->default('free')
                  ->after('skill_tier');
        });

        // Backfill: map skill_tier to required_tier
        DB::table('tutorial_modules')
            ->where('skill_tier', 'beginner')
            ->update(['required_tier' => 'free']);

        DB::table('tutorial_modules')
            ->where('skill_tier', 'intermediate')
            ->update(['required_tier' => 'silver']);

        DB::table('tutorial_modules')
            ->where('skill_tier', 'advanced')
            ->update(['required_tier' => 'gold']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tutorial_modules', function (Blueprint $table) {
            $table->dropColumn('required_tier');
        });
    }
};
