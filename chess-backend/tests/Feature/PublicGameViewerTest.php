<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\User;
use Tests\TestCase;

/**
 * `GET /api/v1/public/games/{id}` is the route a shared game link resolves to.
 * It sits outside `auth:sanctum` (routes/api.php:68) on purpose: the web
 * PublicGameViewer and the Android viewer both open deep links that can arrive
 * while the reader is logged out. The Android client used to load these
 * through the authenticated `games/{id}` instead, which 401s — the P0 "Public
 * game viewer" gap in docs/android-web-parity-gap-analysis.md.
 */
class PublicGameViewerTest extends TestCase
{
    public function test_a_completed_game_is_readable_without_authentication(): void
    {
        $white = User::factory()->create(['name' => 'Arun', 'rating' => 1240]);
        $black = User::factory()->create(['name' => 'Riya', 'rating' => 1180]);

        $game = Game::factory()->create([
            'white_player_id' => $white->id,
            'black_player_id' => $black->id,
            'status' => 'completed',
            'result' => '1-0',
            'moves' => [
                ['san' => 'e4', 'move' => 'e2e4'],
                ['san' => 'e5', 'move' => 'e7e5'],
                ['san' => 'Nf3', 'move' => 'g1f3'],
            ],
        ]);

        $response = $this->getJson("/api/v1/public/games/{$game->id}")
            ->assertOk()
            ->assertJsonPath('white_player.name', 'Arun')
            ->assertJsonPath('black_player.name', 'Riya')
            ->assertJsonPath('result', '1-0')
            ->assertJsonPath('move_count', 3)
            ->assertJsonCount(3, 'moves');

        // The viewers replay from `san`, falling back to `move`.
        $this->assertSame('Nf3', $response->json('moves.2.san'));

        // No PII leaves through the unauthenticated route.
        $this->assertArrayNotHasKey('email', $response->json('white_player'));
        $this->assertArrayNotHasKey('email', $response->json('black_player'));
    }

    public function test_the_authenticated_game_route_rejects_the_same_logged_out_reader(): void
    {
        $game = Game::factory()->create(['status' => 'completed', 'result' => '1-0']);

        // This is precisely why the viewer must not use `games/{id}`.
        $this->getJson("/api/v1/games/{$game->id}")->assertUnauthorized();
    }

    /**
     * The status column is a FK to game_statuses, whose only finished code is
     * `finished`; `completed` is a legacy write-side alias that the mutator
     * maps onto it. The guard used to compare against the alias, so it matched
     * nothing and every public link 404'd.
     */
    public function test_both_the_canonical_and_the_legacy_finished_status_are_public(): void
    {
        $canonical = Game::factory()->create(['status' => 'finished', 'result' => '0-1']);
        $legacy = Game::factory()->create(['status' => 'completed', 'result' => '1-0']);

        $this->assertSame('finished', $canonical->fresh()->status);
        $this->assertSame('finished', $legacy->fresh()->status);

        $this->getJson("/api/v1/public/games/{$canonical->id}")->assertOk();
        $this->getJson("/api/v1/public/games/{$legacy->id}")->assertOk();
    }

    public function test_an_aborted_game_is_not_public(): void
    {
        $game = Game::factory()->create(['status' => 'aborted']);

        $this->getJson("/api/v1/public/games/{$game->id}")->assertNotFound();
    }

    public function test_a_game_still_in_progress_is_not_public(): void
    {
        $game = Game::factory()->create(['status' => 'active']);

        $this->getJson("/api/v1/public/games/{$game->id}")->assertNotFound();
    }

    /**
     * The viewers orient the board from `player_color`; it used to be absent,
     * so every shared replay rendered White at the bottom.
     */
    public function test_player_color_reports_the_stored_perspective(): void
    {
        $asBlack = Game::factory()->create(['status' => 'completed', 'player_color' => 'black']);
        $asWhite = Game::factory()->create(['status' => 'completed', 'player_color' => 'white']);

        $this->getJson("/api/v1/public/games/{$asBlack->id}")->assertOk()->assertJsonPath('player_color', 'black');
        $this->getJson("/api/v1/public/games/{$asWhite->id}")->assertOk()->assertJsonPath('player_color', 'white');
    }

    public function test_player_color_falls_back_to_the_only_human_seat_then_white(): void
    {
        $black = User::factory()->create();
        $onlyBlack = Game::factory()->create([
            'status' => 'completed',
            'player_color' => null,
            'white_player_id' => null,
            'black_player_id' => $black->id,
        ]);
        $unknown = Game::factory()->create(['status' => 'completed', 'player_color' => null]);

        $this->getJson("/api/v1/public/games/{$onlyBlack->id}")->assertJsonPath('player_color', 'black');
        $this->getJson("/api/v1/public/games/{$unknown->id}")->assertJsonPath('player_color', 'white');
    }

    public function test_an_unknown_game_is_not_found(): void
    {
        $this->getJson('/api/v1/public/games/99999999')->assertNotFound();
    }
}
