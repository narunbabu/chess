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
        Schema::table('users', function (Blueprint $table) {
            $table->integer('tutorial_xp')->default(0)->after('last_activity_at');
            $table->integer('tutorial_level')->default(1)->after('tutorial_xp');
            $table->enum('current_skill_tier', ['beginner', 'intermediate', 'advanced'])->default('beginner')->after('tutorial_level');
            $table->integer('current_streak_days')->default(0)->after('current_skill_tier');
            $table->integer('longest_streak_days')->default(0)->after('current_streak_days');
            $table->date('last_activity_date')->nullable()->after('longest_streak_days');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'tutorial_xp',
                'tutorial_level',
                'current_skill_tier',
                'current_streak_days',
                'longest_streak_days',
                'last_activity_date'
            ]);
        });
    }
};