<?php

namespace Tests\Feature;

use App\Models\DailyChallenge;
use App\Models\User;
use App\Models\UserDailyChallengeCompletion;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DailyChallengeTrackApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_free_user_gets_daily_starter_with_track_metadata(): void
    {
        $user = User::factory()->create(['subscription_tier' => 'free']);
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/tutorial/daily-challenge?track=daily-starter');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.track.slug', 'daily-starter')
            ->assertJsonPath('data.track.required_tier', 'free')
            ->assertJsonPath('data.access.is_locked', false)
            ->assertJsonPath('data.daily_puzzle_cap.limit', 1);

        $this->assertDatabaseHas('daily_challenges', [
            'track_slug' => 'daily-starter',
            'required_tier' => 'free',
        ]);
    }

    public function test_free_user_cannot_open_silver_daily_track(): void
    {
        $user = User::factory()->create(['subscription_tier' => 'free']);
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/tutorial/daily-challenge?track=daily-improvement');

        $response->assertForbidden()
            ->assertJsonPath('success', false)
            ->assertJsonPath('required_tier', 'silver');
    }

    public function test_active_silver_user_can_solve_improvement_track(): void
    {
        $user = User::factory()->create([
            'subscription_tier' => 'silver',
            'subscription_expires_at' => now()->addMonth(),
        ]);
        Sanctum::actingAs($user);

        $challengeResponse = $this->getJson('/api/tutorial/daily-challenge?track=daily-improvement');
        $challengeResponse->assertOk()
            ->assertJsonPath('data.track.slug', 'daily-improvement');

        $challenge = $challengeResponse->json('data');

        $response = $this->postJson('/api/tutorial/daily-challenge/submit', [
            'challenge_id' => $challenge['id'],
            'solution' => $challenge['challenge_data']['solution'],
            'time_spent_seconds' => 22,
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.correct', true)
            ->assertJsonPath('data.xp_awarded', 30);

        $this->assertDatabaseHas('user_daily_challenge_completions', [
            'user_id' => $user->id,
            'challenge_id' => $challenge['id'],
            'completed' => true,
            'time_spent_seconds' => 22,
        ]);
    }

    public function test_leaderboard_is_scoped_to_daily_track(): void
    {
        $starter = DailyChallenge::create([
            'date' => now()->toDateString(),
            'track_slug' => 'daily-starter',
            'required_tier' => 'free',
            'challenge_type' => 'puzzle',
            'skill_tier' => 'beginner',
            'skill_band' => 'beginner',
            'track_label' => 'Daily Starter',
            'challenge_data' => [
                'fen' => '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1',
                'solution' => ['Ra8#'],
                'hints' => [],
            ],
            'xp_reward' => 20,
        ]);

        $improvement = DailyChallenge::create([
            'date' => now()->toDateString(),
            'track_slug' => 'daily-improvement',
            'required_tier' => 'silver',
            'challenge_type' => 'puzzle',
            'skill_tier' => 'intermediate',
            'skill_band' => 'club-player',
            'track_label' => 'Daily Improvement',
            'challenge_data' => [
                'fen' => '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1',
                'solution' => ['Ra8#'],
                'hints' => [],
            ],
            'xp_reward' => 30,
        ]);

        $user = User::factory()->create([
            'subscription_tier' => 'silver',
            'subscription_expires_at' => now()->addMonth(),
        ]);
        Sanctum::actingAs($user);

        UserDailyChallengeCompletion::create([
            'user_id' => $user->id,
            'challenge_id' => $improvement->id,
            'completed' => true,
            'attempts' => 1,
            'time_spent_seconds' => 18,
            'completed_at' => now(),
        ]);

        $this->getJson('/api/tutorial/daily-challenge/leaderboard?track=daily-starter')
            ->assertOk()
            ->assertJsonCount(0, 'data')
            ->assertJsonPath('track.slug', $starter->track_slug);

        $this->getJson('/api/tutorial/daily-challenge/leaderboard?track=daily-improvement')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('track.slug', $improvement->track_slug)
            ->assertJsonPath('data.0.user_id', $user->id);
    }
}
