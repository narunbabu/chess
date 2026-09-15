<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\SyntheticPlayer;
use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ActiveGamesListTest extends TestCase
{
    public function test_a_new_bot_game_without_moves_is_listed_before_an_older_game_with_moves(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $bot = SyntheticPlayer::create([
            'name' => 'Riya First Moves',
            'avatar_seed' => 'riya-first-moves',
            'rating' => 800,
            'computer_level' => 2,
            'personality' => 'Balanced',
            'bio' => 'Learning the basics',
            'is_active' => true,
        ]);

        $olderId = $this->startBotGame($bot)->json('game.id');
        Game::whereKey($olderId)->update([
            'created_at' => now()->subDays(2),
            'last_move_at' => now()->subDays(2)->addMinute(),
        ]);

        // No move yet, so last_move_at stays NULL. Ordered by last_move_at alone
        // it sorted after every game with moves and dropped off Home's cards.
        $newerId = $this->startBotGame($bot)->json('game.id');
        $this->assertNull(Game::find($newerId)->last_move_at);

        $this->getJson('/api/v1/games/active')
            ->assertOk()
            ->assertJsonPath('data.0.id', $newerId)
            ->assertJsonPath('data.1.id', $olderId)
            ->assertJsonPath('data.0.black_player', null)
            ->assertJsonPath('data.0.synthetic_player.name', 'Riya First Moves');
    }

    private function startBotGame(SyntheticPlayer $bot)
    {
        return $this->postJson('/api/v1/games/computer', [
            'player_color' => 'white',
            'computer_level' => 2,
            'time_control' => 10,
            'increment' => 0,
            'game_mode' => 'casual',
            'synthetic_player_id' => $bot->id,
        ])->assertOk();
    }
}
