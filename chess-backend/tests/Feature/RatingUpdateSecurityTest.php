<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\RatingHistory;
use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Security + correctness tests for the hardened rating/move surface (H2):
 *  - the unsafe REST move endpoint is gone
 *  - POST /rating/update is server-authoritative: it requires a real game,
 *    enforces participation, and derives result/opponent from the game record
 *    instead of trusting client-supplied values.
 */
class RatingUpdateSecurityTest extends TestCase
{
    private function ratedUser(int $rating = 800): User
    {
        return User::factory()->create([
            'rating'         => $rating,
            'peak_rating'    => $rating,
            'games_played'   => 0,
            'is_provisional' => true,
        ]);
    }

    private function finishedRatedGame(User $white, User $black, string $result = '1-0'): Game
    {
        return Game::factory()->create([
            'white_player_id' => $white->id,
            'black_player_id' => $black->id,
            'game_mode'       => 'rated',
            'result'          => $result,
        ]);
    }

    public function test_rest_move_endpoint_is_removed(): void
    {
        $user = $this->ratedUser();
        Sanctum::actingAs($user);
        $game = $this->finishedRatedGame($user, $this->ratedUser());

        $this->postJson("/api/games/{$game->id}/move", [
            'from' => 'e2', 'to' => 'e4', 'fen' => '8/8/8/8/8/8/8/8 w - - 0 1', 'move' => 'e4',
        ])->assertNotFound();
    }

    public function test_rating_update_requires_a_game_id(): void
    {
        Sanctum::actingAs($this->ratedUser());

        $this->postJson('/api/rating/update', [
            'result' => 'win',
            'opponent_rating' => 3200,
        ])->assertStatus(422);
    }

    public function test_rating_update_rejects_non_participant(): void
    {
        $white = $this->ratedUser();
        $black = $this->ratedUser();
        $game  = $this->finishedRatedGame($white, $black);

        $outsider = $this->ratedUser();
        Sanctum::actingAs($outsider);

        $this->postJson('/api/rating/update', ['game_id' => $game->id])
            ->assertStatus(403);

        $this->assertDatabaseMissing('ratings_history', [
            'user_id' => $outsider->id,
            'game_id' => $game->id,
        ]);
    }

    public function test_rating_update_rejects_unfinished_game(): void
    {
        $white = $this->ratedUser();
        $black = $this->ratedUser();
        $game  = $this->finishedRatedGame($white, $black, '*'); // not finished
        Sanctum::actingAs($white);

        $this->postJson('/api/rating/update', ['game_id' => $game->id])
            ->assertStatus(409);
    }

    public function test_rating_update_ignores_forged_result_and_opponent_rating(): void
    {
        $white = $this->ratedUser(800); // winner
        $black = $this->ratedUser(800); // loser
        $game  = $this->finishedRatedGame($white, $black, '1-0');

        // The loser tries to forge a win against a 3200-rated opponent.
        Sanctum::actingAs($black);
        $response = $this->postJson('/api/rating/update', [
            'game_id'         => $game->id,
            'result'          => 'win',  // forged — must be ignored
            'opponent_rating' => 3200,   // forged — must be ignored
        ])->assertOk();

        // Server derives a LOSS vs the real 800-rated opponent: K=40, ΔE=−0.5 → −20.
        $response->assertJsonPath('data.rating_change', -20)
                 ->assertJsonPath('data.new_rating', 780)
                 ->assertJsonPath('data.actual_score', 0);

        $this->assertDatabaseHas('users', [
            'id' => $black->id, 'rating' => 780,
        ]);
    }

    public function test_rating_update_applies_then_is_idempotent(): void
    {
        $white = $this->ratedUser(800); // winner
        $black = $this->ratedUser(800);
        $game  = $this->finishedRatedGame($white, $black, '1-0');

        Sanctum::actingAs($white);

        $first = $this->postJson('/api/rating/update', ['game_id' => $game->id])->assertOk();
        $first->assertJsonPath('data.rating_change', 20)
              ->assertJsonPath('data.new_rating', 820)
              ->assertJsonPath('data.games_played', 1);

        // Second call must return the same record without double-applying.
        $second = $this->postJson('/api/rating/update', ['game_id' => $game->id])->assertOk();
        $second->assertJsonPath('data.new_rating', 820)
               ->assertJsonPath('data.games_played', 1);

        $this->assertSame(1, RatingHistory::where('user_id', $white->id)
            ->where('game_id', $game->id)->count());
        $this->assertDatabaseHas('users', ['id' => $white->id, 'rating' => 820, 'games_played' => 1]);
    }

    public function test_casual_game_yields_no_rating_change(): void
    {
        $white = $this->ratedUser(800);
        $black = $this->ratedUser(800);
        $game  = Game::factory()->create([
            'white_player_id' => $white->id,
            'black_player_id' => $black->id,
            'game_mode'       => 'casual',
            'result'          => '1-0',
        ]);

        Sanctum::actingAs($white);
        $this->postJson('/api/rating/update', ['game_id' => $game->id])
            ->assertOk()
            ->assertJsonPath('data.rating_change', 0)
            ->assertJsonPath('data.new_rating', 800);

        $this->assertDatabaseMissing('ratings_history', [
            'user_id' => $white->id, 'game_id' => $game->id,
        ]);
    }
}
