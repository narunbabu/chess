<?php

namespace Database\Factories;

use App\Models\Game;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Game>
 */
class GameFactory extends Factory
{
    protected $model = Game::class;

    public function definition(): array
    {
        return [
            'white_player_id' => User::factory(),
            'black_player_id' => User::factory(),
            'status' => 'waiting',
            'game_mode' => 'multiplayer',
            'time_control_minutes' => 10,
            'increment_seconds' => 0,
            'fen' => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            'turn' => 'white',
        ];
    }
}
