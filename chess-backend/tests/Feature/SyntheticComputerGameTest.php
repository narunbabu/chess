<?php

namespace Tests\Feature;

use App\Models\SyntheticPlayer;
use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SyntheticComputerGameTest extends TestCase
{
    public function test_synthetic_computer_game_uses_the_synthetic_players_configured_level(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $syntheticPlayer = SyntheticPlayer::create([
            'name' => 'Aarav Beginner',
            'avatar_seed' => 'aarav-beginner',
            'rating' => 800,
            'computer_level' => 1,
            'personality' => 'Balanced',
            'bio' => 'Learning the basics',
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/v1/games/computer', [
            'player_color' => 'white',
            'computer_level' => 12,
            'time_control' => 10,
            'increment' => 0,
            'game_mode' => 'casual',
            'synthetic_player_id' => $syntheticPlayer->id,
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('game.computer_level', 1)
            ->assertJsonPath('game.synthetic_player_id', $syntheticPlayer->id)
            ->assertJsonPath('game.computer_player.level', 1)
            ->assertJsonPath('computer_opponent.level', 1);

        $this->assertDatabaseHas('games', [
            'synthetic_player_id' => $syntheticPlayer->id,
            'computer_level' => 1,
        ]);
    }
}
