<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private array $players = [
        ['name' => 'Aarav Beginner', 'avatar_seed' => 'aarav-beginner', 'computer_level' => 1, 'rating' => 800, 'personality' => 'Balanced', 'bio' => 'New to online chess and learning the basics', 'games_played_count' => 18, 'wins_count' => 6],
        ['name' => 'Meera Starter', 'avatar_seed' => 'meera-starter', 'computer_level' => 2, 'rating' => 850, 'personality' => 'Defensive', 'bio' => 'Practices safe moves and simple tactics', 'games_played_count' => 24, 'wins_count' => 9],
        ['name' => 'Kabir Learner', 'avatar_seed' => 'kabir-learner', 'computer_level' => 2, 'rating' => 900, 'personality' => 'Tactical', 'bio' => 'Looks for one-move checks and captures', 'games_played_count' => 31, 'wins_count' => 13],
        ['name' => 'Ananya Practice', 'avatar_seed' => 'ananya-practice', 'computer_level' => 3, 'rating' => 950, 'personality' => 'Aggressive', 'bio' => 'Enjoys open games and quick development', 'games_played_count' => 39, 'wins_count' => 17],
        ['name' => 'Tara Casual', 'avatar_seed' => 'tara-casual', 'computer_level' => 4, 'rating' => 1000, 'personality' => 'Balanced', 'bio' => 'Ready for a relaxed beginner challenge', 'games_played_count' => 45, 'wins_count' => 18],
    ];

    public function up(): void
    {
        if (!Schema::hasTable('synthetic_players')) {
            return;
        }

        foreach ($this->players as $player) {
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
        if (!Schema::hasTable('synthetic_players')) {
            return;
        }

        DB::table('synthetic_players')
            ->whereIn('name', array_column($this->players, 'name'))
            ->delete();
    }
};
