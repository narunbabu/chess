<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private array $starterPlayers = [
        ['name' => 'Riya First Moves', 'avatar_seed' => 'riya-first-moves', 'computer_level' => 1, 'rating' => 200, 'personality' => 'Balanced', 'bio' => 'Practices piece moves and simple captures', 'games_played_count' => 8, 'wins_count' => 1],
        ['name' => 'Om Piece Finder', 'avatar_seed' => 'om-piece-finder', 'computer_level' => 1, 'rating' => 250, 'personality' => 'Defensive', 'bio' => 'Keeps games slow and forgiving for new players', 'games_played_count' => 10, 'wins_count' => 2],
        ['name' => 'Isha Safe King', 'avatar_seed' => 'isha-safe-king', 'computer_level' => 1, 'rating' => 300, 'personality' => 'Defensive', 'bio' => 'Focuses on king safety and legal moves', 'games_played_count' => 12, 'wins_count' => 3],
        ['name' => 'Vivaan Board Basics', 'avatar_seed' => 'vivaan-board-basics', 'computer_level' => 1, 'rating' => 350, 'personality' => 'Balanced', 'bio' => 'A gentle opponent for learning the board', 'games_played_count' => 14, 'wins_count' => 4],
        ['name' => 'Nisha Center Pawns', 'avatar_seed' => 'nisha-center-pawns', 'computer_level' => 1, 'rating' => 400, 'personality' => 'Positional', 'bio' => 'Plays simple center moves and develops slowly', 'games_played_count' => 16, 'wins_count' => 5],
        ['name' => 'Arjun One-Step', 'avatar_seed' => 'arjun-one-step', 'computer_level' => 1, 'rating' => 450, 'personality' => 'Balanced', 'bio' => 'Looks one move ahead and avoids complex tactics', 'games_played_count' => 18, 'wins_count' => 6],
        ['name' => 'Tara Simple Tactics', 'avatar_seed' => 'tara-simple-tactics', 'computer_level' => 2, 'rating' => 500, 'personality' => 'Tactical', 'bio' => 'Tries basic checks, captures, and threats', 'games_played_count' => 20, 'wins_count' => 7],
        ['name' => 'Kabir Calm Player', 'avatar_seed' => 'kabir-calm-player', 'computer_level' => 2, 'rating' => 550, 'personality' => 'Defensive', 'bio' => 'A calm starter bot for longer practice games', 'games_played_count' => 22, 'wins_count' => 8],
        ['name' => 'Maya Open Files', 'avatar_seed' => 'maya-open-files', 'computer_level' => 2, 'rating' => 600, 'personality' => 'Positional', 'bio' => 'Starts using files and simple development plans', 'games_played_count' => 24, 'wins_count' => 9],
        ['name' => 'Dev Slow Planner', 'avatar_seed' => 'dev-slow-planner', 'computer_level' => 2, 'rating' => 650, 'personality' => 'Balanced', 'bio' => 'Makes beginner plans without sharp complications', 'games_played_count' => 26, 'wins_count' => 10],
        ['name' => 'Anika Pin Spotter', 'avatar_seed' => 'anika-pin-spotter', 'computer_level' => 3, 'rating' => 700, 'personality' => 'Tactical', 'bio' => 'Spots simple pins and one-move tactics', 'games_played_count' => 28, 'wins_count' => 11],
        ['name' => 'Rohan Rising', 'avatar_seed' => 'rohan-rising', 'computer_level' => 3, 'rating' => 750, 'personality' => 'Aggressive', 'bio' => 'The strongest starter bot before beginner tier', 'games_played_count' => 30, 'wins_count' => 12],
    ];

    public function up(): void
    {
        if (Schema::hasTable('users')) {
            $this->setUserRatingDefaults(400);
            $this->moveUnplayedUsersToDefault(400);
        }

        if (!Schema::hasTable('synthetic_players')) {
            return;
        }

        foreach ($this->starterPlayers as $player) {
            DB::table('synthetic_players')->updateOrInsert(
                ['name' => $player['name']],
                array_merge($player, [
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ])
            );
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('synthetic_players')) {
            DB::table('synthetic_players')
                ->whereIn('name', array_column($this->starterPlayers, 'name'))
                ->delete();
        }

        if (Schema::hasTable('users')) {
            $this->setUserRatingDefaults(800);

            if (Schema::hasColumn('users', 'rating')) {
                $updates = [
                    'rating' => 800,
                    'updated_at' => now(),
                ];

                if (Schema::hasColumn('users', 'peak_rating')) {
                    $updates['peak_rating'] = DB::raw('CASE WHEN peak_rating = 400 THEN 800 ELSE peak_rating END');
                }

                DB::table('users')
                    ->where(function ($query) {
                        $query->where('games_played', 0)->orWhereNull('games_played');
                    })
                    ->where('is_provisional', true)
                    ->where('rating', 400)
                    ->update($updates);
            }
        }
    }

    private function setUserRatingDefaults(int $rating): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        foreach (['rating', 'peak_rating', 'learner_rating', 'learner_peak_rating'] as $column) {
            if (Schema::hasColumn('users', $column)) {
                DB::statement("ALTER TABLE users MODIFY {$column} INT NOT NULL DEFAULT {$rating}");
            }
        }
    }

    private function moveUnplayedUsersToDefault(int $rating): void
    {
        if (!Schema::hasColumn('users', 'rating')) {
            return;
        }

        $updates = [
            'rating' => $rating,
            'updated_at' => now(),
        ];

        if (Schema::hasColumn('users', 'peak_rating')) {
            $updates['peak_rating'] = DB::raw("CASE WHEN peak_rating IN (800, 1200) THEN {$rating} ELSE peak_rating END");
        }

        DB::table('users')
            ->where(function ($query) {
                $query->where('games_played', 0)->orWhereNull('games_played');
            })
            ->where('is_provisional', true)
            ->whereIn('rating', [800, 1200])
            ->update($updates);

        if (!Schema::hasColumn('users', 'learner_rating')) {
            return;
        }

        $learnerQuery = DB::table('users');

        if (Schema::hasColumn('users', 'learner_games_played')) {
            $learnerQuery->where(function ($query) {
                $query->where('learner_games_played', 0)->orWhereNull('learner_games_played');
            });
        }

        $learnerUpdates = [
            'learner_rating' => $rating,
            'updated_at' => now(),
        ];

        if (Schema::hasColumn('users', 'learner_peak_rating')) {
            $learnerUpdates['learner_peak_rating'] = DB::raw("CASE WHEN learner_peak_rating IN (800, 1200) THEN {$rating} ELSE learner_peak_rating END");
        }

        $learnerQuery
            ->whereIn('learner_rating', [800, 1200])
            ->update($learnerUpdates);
    }
};
