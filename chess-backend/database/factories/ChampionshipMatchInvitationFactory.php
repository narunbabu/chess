<?php

namespace Database\Factories;

use App\Models\ChampionshipMatchInvitation;
use App\Models\ChampionshipMatch;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\ChampionshipMatchInvitation>
 */
class ChampionshipMatchInvitationFactory extends Factory
{
    protected $model = ChampionshipMatchInvitation::class;

    public function definition(): array
    {
        return [
            'match_id' => ChampionshipMatch::factory(),
            'invited_player_id' => User::factory(),
            'status' => 'pending',
            'expires_at' => now()->addHours(1),
        ];
    }
}
