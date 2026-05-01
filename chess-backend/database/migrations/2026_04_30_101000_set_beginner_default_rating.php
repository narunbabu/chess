<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('users') || !Schema::hasColumn('users', 'rating')) {
            return;
        }

        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE users MODIFY rating INT NOT NULL DEFAULT 800');
            DB::statement('ALTER TABLE users MODIFY peak_rating INT NOT NULL DEFAULT 800');
        }

        DB::table('users')
            ->where(function ($query) {
                $query->where('games_played', 0)->orWhereNull('games_played');
            })
            ->where('is_provisional', true)
            ->where('rating', 1200)
            ->update([
                'rating' => 800,
                'peak_rating' => DB::raw('CASE WHEN peak_rating = 1200 THEN 800 ELSE peak_rating END'),
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        if (!Schema::hasTable('users') || !Schema::hasColumn('users', 'rating')) {
            return;
        }

        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE users MODIFY rating INT NOT NULL DEFAULT 1200');
            DB::statement('ALTER TABLE users MODIFY peak_rating INT NOT NULL DEFAULT 1200');
        }

        DB::table('users')
            ->where(function ($query) {
                $query->where('games_played', 0)->orWhereNull('games_played');
            })
            ->where('is_provisional', true)
            ->where('rating', 800)
            ->update([
                'rating' => 1200,
                'peak_rating' => DB::raw('CASE WHEN peak_rating = 800 THEN 1200 ELSE peak_rating END'),
                'updated_at' => now(),
            ]);
    }
};
