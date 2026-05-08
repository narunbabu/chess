<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('daily_challenges', function (Blueprint $table) {
            $table->string('track_slug')->default('daily-starter')->after('date');
            $table->string('required_tier')->default('free')->after('track_slug');
            $table->string('skill_band')->nullable()->after('skill_tier');
            $table->string('track_label')->nullable()->after('skill_band');
        });

        Schema::table('daily_challenges', function (Blueprint $table) {
            $table->dropUnique('daily_challenges_date_unique');
            $table->unique(['date', 'track_slug'], 'daily_challenges_date_track_slug_unique');
            $table->index(['date', 'track_slug', 'required_tier'], 'daily_challenges_date_track_tier_index');
        });
    }

    public function down(): void
    {
        DB::table('daily_challenges')
            ->where('track_slug', '!=', 'daily-starter')
            ->delete();

        Schema::table('daily_challenges', function (Blueprint $table) {
            $table->dropUnique('daily_challenges_date_track_slug_unique');
            $table->dropIndex('daily_challenges_date_track_tier_index');
            $table->dropColumn(['track_slug', 'required_tier', 'skill_band', 'track_label']);
            $table->unique('date', 'daily_challenges_date_unique');
        });
    }
};
