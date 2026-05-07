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

    public function test_learning_computer_game_applies_help_aware_learner_elo_on_completion(): void
    {
        $user = User::factory()->create([
            'learner_rating' => 800,
            'learner_games_played' => 0,
            'learner_peak_rating' => 800,
        ]);
        Sanctum::actingAs($user);

        $syntheticPlayer = SyntheticPlayer::create([
            'name' => 'Meera Starter',
            'avatar_seed' => 'meera-starter',
            'rating' => 800,
            'computer_level' => 2,
            'personality' => 'Balanced',
            'bio' => 'Learning the basics',
            'is_active' => true,
        ]);

        $createResponse = $this->postJson('/api/v1/games/computer', [
            'player_color' => 'white',
            'computer_level' => 12,
            'time_control' => 10,
            'increment' => 0,
            'game_mode' => 'casual',
            'learning_mode' => true,
            'learning_help_limit' => 7,
            'synthetic_player_id' => $syntheticPlayer->id,
        ]);

        $gameId = $createResponse->json('game.id');

        $completeResponse = $this->postJson("/api/v1/games/{$gameId}/complete", [
            'result' => '1-0',
            'end_reason' => 'checkmate',
            'move_count' => 21,
            'fen' => '8/8/8/8/8/8/8/8 w - - 0 1',
            'moves' => '["e4"]',
            'learning_mode' => true,
            'learning_help_limit' => 7,
            'learning_help_used' => 0,
        ]);

        $completeResponse
            ->assertOk()
            ->assertJsonPath('learner_rating_data.type', 'learner')
            ->assertJsonPath('learner_rating_data.old_rating', 800)
            ->assertJsonPath('learner_rating_data.new_rating', 825)
            ->assertJsonPath('learner_rating_data.rating_change', 25)
            ->assertJsonPath('learner_rating_data.help_limit', 7)
            ->assertJsonPath('learner_rating_data.help_used', 0);

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'learner_rating' => 825,
            'learner_games_played' => 1,
            'learner_peak_rating' => 825,
        ]);

        $this->assertDatabaseHas('learner_rating_history', [
            'user_id' => $user->id,
            'game_id' => $gameId,
            'result' => 'win',
            'rating_change' => 25,
            'help_limit' => 7,
            'help_used' => 0,
        ]);
    }
}
