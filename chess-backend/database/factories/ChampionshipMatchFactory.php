<?php

namespace Database\Factories;

use App\Models\ChampionshipMatch;
use App\Models\Championship;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\ChampionshipMatch>
 */
class ChampionshipMatchFactory extends Factory
{
    protected $model = ChampionshipMatch::class;

    public function definition(): array
    {
        return [
            'championship_id' => Championship::factory(),
            'round_number' => 1,
            'round_type' => 'swiss',
            'player1_id' => User::factory(),
            'player2_id' => User::factory(),
            'status' => 'pending',
            'scheduled_at' => now(),
            'deadline' => now()->addHours(24),
        ];
    }
}
