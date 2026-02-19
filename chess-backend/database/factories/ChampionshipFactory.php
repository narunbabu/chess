<?php

namespace Database\Factories;

use App\Models\Championship;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Championship>
 */
class ChampionshipFactory extends Factory
{
    protected $model = Championship::class;

    public function definition(): array
    {
        return [
            'title' => $this->faker->sentence(3),
            'description' => $this->faker->paragraph(),
            'entry_fee' => 0,
            'max_participants' => $this->faker->randomElement([8, 16, 32]),
            'registration_deadline' => now()->addDays(3),
            'start_date' => now()->addDays(7),
            'match_time_window_hours' => 24,
            'format' => 'swiss_only',
            'status' => 'registration_open',
            'created_by' => User::factory(),
            'time_control_minutes' => 10,
            'time_control_increment' => 5,
            'total_rounds' => 3,
        ];
    }
}
