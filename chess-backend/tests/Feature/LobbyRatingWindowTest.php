<?php

namespace Tests\Feature;

use App\Models\SyntheticPlayer;
use App\Models\User;
use App\Services\MatchmakingService;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LobbyRatingWindowTest extends TestCase
{
    public function test_new_users_default_to_400_rating(): void
    {
        $user = User::factory()->create();

        $this->assertSame(400, (int) $user->rating);
        $this->assertSame(400, (int) $user->peak_rating);
        $this->assertSame(400, (int) $user->learner_rating);
        $this->assertSame(400, (int) $user->learner_peak_rating);
    }

    public function test_lobby_players_are_filtered_by_rating_window(): void
    {
        SyntheticPlayer::query()->delete();

        $viewer = User::factory()->create([
            'rating' => 400,
            'peak_rating' => 400,
            'last_activity_at' => now(),
        ]);

        User::factory()->create([
            'name' => 'Nearby Human',
            'rating' => 450,
            'peak_rating' => 450,
            'last_activity_at' => now(),
        ]);

        User::factory()->create([
            'name' => 'Too High Human',
            'rating' => 900,
            'peak_rating' => 900,
            'last_activity_at' => now(),
        ]);

        SyntheticPlayer::create([
            'name' => 'Starter Bot',
            'avatar_seed' => 'starter-bot',
            'rating' => 250,
            'computer_level' => 1,
            'is_active' => true,
        ]);

        SyntheticPlayer::create([
            'name' => 'Outside Bot',
            'avatar_seed' => 'outside-bot',
            'rating' => 900,
            'computer_level' => 4,
            'is_active' => true,
        ]);

        Sanctum::actingAs($viewer);

        $response = $this->getJson('/api/v1/lobby/players?min_rating=200&max_rating=750');

        $response->assertOk()
            ->assertJsonPath('rating_window.min', 200)
            ->assertJsonPath('rating_window.max', 750);

        $realRatings = collect($response->json('real_players'))->pluck('rating')->all();
        $botRatings = collect($response->json('synthetic_players'))->pluck('rating')->all();

        $this->assertContains(450, $realRatings);
        $this->assertNotContains(900, $realRatings);
        $this->assertContains(250, $botRatings);
        $this->assertNotContains(900, $botRatings);
    }

    public function test_quick_match_uses_explicit_rating_window_for_synthetic_bot(): void
    {
        SyntheticPlayer::query()->delete();

        $viewer = User::factory()->create([
            'rating' => 400,
            'peak_rating' => 400,
        ]);

        SyntheticPlayer::create([
            'name' => 'Low Starter Bot',
            'avatar_seed' => 'low-starter-bot',
            'rating' => 250,
            'computer_level' => 1,
            'is_active' => true,
        ]);

        SyntheticPlayer::create([
            'name' => 'Selected Window Bot',
            'avatar_seed' => 'selected-window-bot',
            'rating' => 900,
            'computer_level' => 4,
            'is_active' => true,
        ]);

        $result = app(MatchmakingService::class)->quickMatch($viewer, [
            'min_rating' => 800,
            'max_rating' => 950,
            'preferred_color' => 'white',
        ]);

        $this->assertSame('synthetic', $result['match_type']);
        $this->assertSame('Selected Window Bot', $result['opponent']['name']);
        $this->assertSame(900, $result['opponent']['rating']);
    }
}
