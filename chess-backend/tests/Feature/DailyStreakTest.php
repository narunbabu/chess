<?php

namespace Tests\Feature;

use App\Models\DailyChallenge;
use App\Models\Game;
use App\Models\TrainingDrill;
use App\Models\User;
use App\Services\GameRoomService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * FEATURE B — the canonical activity streak (users.current_streak_days,
 * advanced by User::updateDailyStreak()) must be credited by every
 * qualifying activity: finished games (any mode, human vs human or bot),
 * correct daily challenges, solved tactical puzzles and drill attempts.
 * Aborted / cancelled / mutually abandoned games never credit.
 */
class DailyStreakTest extends TestCase
{
    use RefreshDatabase;

    // ── updateDailyStreak day arithmetic ───────────────────────────────────

    public function test_first_activity_starts_streak_at_one(): void
    {
        $user = User::factory()->create([
            'current_streak_days' => 0,
            'longest_streak_days' => 0,
            'last_activity_date' => null,
        ]);

        $user->updateDailyStreak();

        $this->assertSame(1, $user->current_streak_days);
        $this->assertSame(1, $user->longest_streak_days);
        $this->assertSame(now()->toDateString(), $user->last_activity_date->toDateString());
    }

    public function test_activity_yesterday_continues_the_streak(): void
    {
        $user = User::factory()->create([
            'current_streak_days' => 5,
            'longest_streak_days' => 5,
            'last_activity_date' => now()->subDay()->toDateString(),
        ]);

        $user->updateDailyStreak();

        $this->assertSame(6, $user->current_streak_days);
        $this->assertSame(6, $user->longest_streak_days);
    }

    public function test_activity_twice_the_same_day_credits_once(): void
    {
        $user = User::factory()->create([
            'current_streak_days' => 3,
            'longest_streak_days' => 4,
            'last_activity_date' => now()->toDateString(),
        ]);

        $user->updateDailyStreak();

        $this->assertSame(3, $user->current_streak_days);
        $this->assertSame(4, $user->longest_streak_days);
        $this->assertSame(now()->toDateString(), $user->last_activity_date->toDateString());
    }

    public function test_missed_day_resets_the_streak_to_one(): void
    {
        $user = User::factory()->create([
            'current_streak_days' => 5,
            'longest_streak_days' => 5,
            'last_activity_date' => now()->subDays(2)->toDateString(),
        ]);

        $user->updateDailyStreak();

        $this->assertSame(1, $user->current_streak_days);
        $this->assertSame(5, $user->longest_streak_days);
    }

    // ── GameObserver credits on finish ─────────────────────────────────────

    public function test_observer_credits_both_players_when_a_game_finishes(): void
    {
        [$white, $black, $game] = $this->activeGame();

        $game->update([
            'status' => 'finished',
            'result' => '1-0',
            'end_reason' => 'checkmate',
            'winner_player' => 'white',
            'winner_user_id' => $white->id,
            'ended_at' => now(),
        ]);

        $this->assertSame(1, $white->fresh()->current_streak_days);
        $this->assertSame(1, $black->fresh()->current_streak_days);
        $this->assertSame(now()->toDateString(), $white->fresh()->last_activity_date->toDateString());
    }

    /**
     * @dataProvider playedEndReasonProvider
     */
    public function test_observer_credits_players_for_resignation_timeout_and_draw(string $endReason): void
    {
        [$white, $black, $game] = $this->activeGame();

        $game->update([
            'status' => 'finished',
            'result' => $endReason === 'draw_agreed' ? '1/2-1/2' : '1-0',
            'end_reason' => $endReason,
            'winner_player' => $endReason === 'draw_agreed' ? null : 'white',
            'winner_user_id' => $endReason === 'draw_agreed' ? null : $white->id,
            'ended_at' => now(),
        ]);

        $this->assertSame(1, $white->fresh()->current_streak_days, "end_reason={$endReason}");
        $this->assertSame(1, $black->fresh()->current_streak_days, "end_reason={$endReason}");
    }

    public static function playedEndReasonProvider(): array
    {
        return [
            ['resignation'],
            ['timeout'],
            ['draw_agreed'],
            ['checkmate'],
        ];
    }

    public function test_observer_does_not_credit_aborted_games(): void
    {
        [$white, $black, $game] = $this->activeGame();

        $game->update([
            'status' => 'aborted',
            'result' => '*',
            'end_reason' => 'aborted',
            'ended_at' => now(),
        ]);

        $this->assertSame(0, $white->fresh()->current_streak_days);
        $this->assertSame(0, $black->fresh()->current_streak_days);
        $this->assertNull($white->fresh()->last_activity_date);
    }

    /**
     * Mutual abandons and inactivity cancels land with status=finished but
     * are not played games — they must not credit.
     *
     * @dataProvider nonPlayEndReasonProvider
     */
    public function test_observer_does_not_credit_mutual_abandons_or_inactivity_cancels(string $endReason): void
    {
        [$white, $black, $game] = $this->activeGame();

        $game->update([
            'status' => 'finished',
            'result' => '*',
            'end_reason' => $endReason,
            'winner_player' => null,
            'winner_user_id' => null,
            'ended_at' => now(),
        ]);

        $this->assertSame(0, $white->fresh()->current_streak_days);
        $this->assertSame(0, $black->fresh()->current_streak_days);
    }

    public static function nonPlayEndReasonProvider(): array
    {
        return [
            ['abandoned_mutual'],
            ['cancelled_inactivity'],
        ];
    }

    public function test_observer_credits_only_the_human_player_of_a_bot_game(): void
    {
        $human = User::factory()->create();
        $opponent = User::factory()->create();

        $game = Game::factory()->create([
            'white_player_id' => $human->id,
            'black_player_id' => null,
            'game_mode' => 'rated',
            'status' => 'active',
            'player_color' => 'white',
            'moves' => [],
        ]);

        $game->update([
            'status' => 'finished',
            'result' => '1-0',
            'end_reason' => 'checkmate',
            'winner_player' => 'white',
            'winner_user_id' => $human->id,
            'ended_at' => now(),
        ]);

        $this->assertSame(1, $human->fresh()->current_streak_days);
        $this->assertSame(0, $opponent->fresh()->current_streak_days);
    }

    public function test_observer_does_not_credit_an_already_terminal_game_updated_again(): void
    {
        [$white, $black, $game] = $this->activeGame();

        $game->update([
            'status' => 'finished',
            'result' => '1-0',
            'end_reason' => 'checkmate',
            'winner_player' => 'white',
            'winner_user_id' => $white->id,
            'ended_at' => now(),
        ]);

        // A later unrelated update must not re-credit the same day twice
        $game->update(['pgn' => '1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0']);

        $this->assertSame(1, $white->fresh()->current_streak_days);
        $this->assertSame(1, $black->fresh()->current_streak_days);
    }

    public function test_resign_through_game_room_service_credits_both_players(): void
    {
        // Fake only the broadcast event — a bare Event::fake() would also
        // swallow Eloquent model events and the observer would never run.
        Event::fake([\App\Events\GameEndedEvent::class]);

        [$white, $black, $game] = $this->activeGame();

        app(GameRoomService::class)->resignGame($game->id, $black->id);

        $this->assertSame('finished', $game->fresh()->status);
        $this->assertSame(1, $white->fresh()->current_streak_days);
        $this->assertSame(1, $black->fresh()->current_streak_days);
    }

    // ── Daily challenge submissions ────────────────────────────────────────

    public function test_correct_daily_challenge_submission_credits_the_streak(): void
    {
        $user = User::factory()->create(['subscription_tier' => 'silver']);
        Sanctum::actingAs($user);

        $challenge = $this->todaysChallenge();

        $response = $this->postJson('/api/tutorial/daily-challenge/submit', [
            'challenge_id' => $challenge->id,
            'solution' => ['Ra8#'],
            'time_spent_seconds' => 30,
        ]);

        $response->assertOk()->assertJsonPath('data.correct', true);

        $this->assertSame(1, $user->fresh()->current_streak_days);
        $this->assertSame(now()->toDateString(), $user->fresh()->last_activity_date->toDateString());
    }

    public function test_wrong_daily_challenge_submission_does_not_credit_the_streak(): void
    {
        $user = User::factory()->create(['subscription_tier' => 'silver']);
        Sanctum::actingAs($user);

        $challenge = $this->todaysChallenge();

        $response = $this->postJson('/api/tutorial/daily-challenge/submit', [
            'challenge_id' => $challenge->id,
            'solution' => ['Kd2'],
            'time_spent_seconds' => 30,
        ]);

        $response->assertOk()->assertJsonPath('data.correct', false);

        $this->assertSame(0, $user->fresh()->current_streak_days);
        $this->assertNull($user->fresh()->last_activity_date);
    }

    // ── Idempotency across different activities the same day ───────────────

    public function test_second_qualifying_activity_the_same_day_credits_the_streak_once(): void
    {
        $white = User::factory()->create();
        $black = User::factory()->create();
        $challenge = $this->todaysChallenge();

        // Activity 1: correct daily challenge
        $this->actingAsSanctumUser($white);
        $this->postJson('/api/tutorial/daily-challenge/submit', [
            'challenge_id' => $challenge->id,
            'solution' => ['Ra8#'],
            'time_spent_seconds' => 30,
        ])->assertOk();

        $this->assertSame(1, $white->fresh()->current_streak_days);

        // Activity 2: finishing a game the same day
        $game = Game::factory()->create([
            'white_player_id' => $white->id,
            'black_player_id' => $black->id,
            'game_mode' => 'casual',
            'status' => 'active',
            'moves' => [],
        ]);
        $game->update([
            'status' => 'finished',
            'result' => '1/2-1/2',
            'end_reason' => 'draw_agreed',
            'ended_at' => now(),
        ]);

        $this->assertSame(1, $white->fresh()->current_streak_days);
        $this->assertSame(1, $black->fresh()->current_streak_days);
        $this->assertSame(now()->toDateString(), $white->fresh()->last_activity_date->toDateString());
    }

    // ── Stats endpoint exposes the canonical streak ────────────────────────

    public function test_stats_endpoint_includes_daily_streak_key(): void
    {
        $user = User::factory()->create([
            'current_streak_days' => 7,
            'longest_streak_days' => 9,
            'last_activity_date' => now()->toDateString(),
        ]);
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/tutorial/progress/stats');

        $response->assertOk()
            ->assertJsonPath('data.daily_streak', 7)
            ->assertJsonPath('data.stats.current_streak', 7);
    }

    // ── Tactical puzzle solve and drill attempt credit the streak ──────────

    public function test_solved_tactical_puzzle_credits_the_streak_but_failure_does_not(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/tactical/attempts', [
            'stage_id' => 0,
            'puzzle_id' => 'test-001',
            'success' => false,
            'cct_my_found' => 0,
            'cct_my_total' => 1,
            'cct_opp_found' => 1,
            'cct_opp_total' => 2,
        ])->assertOk();

        $this->assertSame(0, $user->fresh()->current_streak_days, 'failed attempt must not credit');

        $this->postJson('/api/v1/tactical/attempts', [
            'stage_id' => 0,
            'puzzle_id' => 'test-002',
            'success' => true,
        ])->assertOk();

        $this->assertSame(1, $user->fresh()->current_streak_days, 'solved puzzle must credit');
    }

    public function test_training_drill_attempt_credits_the_streak(): void
    {
        $user = User::factory()->create(['subscription_tier' => 'free']);
        Sanctum::actingAs($user);

        $drill = TrainingDrill::create([
            'slug' => 'streak-test-back-rank',
            'title' => 'Back rank mate',
            'skill_band' => 'beginner',
            'required_tier' => 'free',
            'drill_type' => 'pattern',
            'theme' => 'back_rank_mate',
            'position_fen' => '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1',
            'solution' => ['Ra8#'],
            'mastery_threshold' => 3,
            'is_active' => true,
        ]);

        $this->postJson("/api/v1/training/drills/{$drill->slug}/attempt", [
            'solution' => ['Kd2'], // wrong — drills credit on ANY attempt
            'time_spent_seconds' => 12,
        ])->assertOk()->assertJsonPath('data.correct', false);

        $this->assertSame(1, $user->fresh()->current_streak_days);
        $this->assertSame(now()->toDateString(), $user->fresh()->last_activity_date->toDateString());
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private function activeGame(): array
    {
        $white = User::factory()->create();
        $black = User::factory()->create();

        $game = Game::factory()->create([
            'white_player_id' => $white->id,
            'black_player_id' => $black->id,
            'game_mode' => 'casual',
            'status' => 'active',
            'moves' => [],
        ]);

        return [$white, $black, $game];
    }

    private function todaysChallenge(): DailyChallenge
    {
        return DailyChallenge::create([
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
    }

    private function actingAsSanctumUser(User $user): void
    {
        Sanctum::actingAs($user);
    }
}
