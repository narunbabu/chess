<?php

namespace Tests\Feature;

use App\Events\GamePausedEvent;
use App\Models\Game;
use App\Models\SyntheticPlayer;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * games:monitor-inactivity auto-pause and forfeit behavior.
 *
 * The pause branch used to call pauseGame($id, 'inactivity') against
 * pauseGame(int $gameId, int $pausedByUserId, ...) — a TypeError on PHP 8.2,
 * so the 70 s auto-pause never fired for any game. It now performs a system
 * pause (null user). Bot games (computer/synthetic opponent) are excluded from
 * both branches: no bot answers a resume request, and the forfeit path assumes
 * two real players; games:cleanup-abandoned aborts a paused bot game after 1 h.
 */
class MonitorGameInactivityTest extends TestCase
{
    public function test_inactive_human_casual_game_is_auto_paused_as_a_system_pause(): void
    {
        // Fake only the broadcast event under assertion — a bare Event::fake()
        // would also swallow Eloquent's model events (Game's creating hook
        // seeds the undo budget).
        Event::fake([GamePausedEvent::class]);

        $white = User::factory()->create();
        $black = User::factory()->create();

        $game = Game::factory()->create([
            'white_player_id' => $white->id,
            'black_player_id' => $black->id,
            'game_mode' => 'casual',
            'status' => 'active',
            'turn' => 'white',
        ]);

        // white/black_time_remaining_ms are not mass-assignable on Game, so
        // set them at the query level like the running clock would.
        Game::whereKey($game->id)->update([
            'white_time_remaining_ms' => 300000,
            'black_time_remaining_ms' => 240000,
        ]);

        $this->makeInactive($game, now()->subMinutes(5));

        $this->artisan('games:monitor-inactivity')->assertExitCode(0);

        $game->refresh();
        $this->assertSame('paused', $game->status);
        $this->assertSame('inactivity', $game->paused_reason);
        $this->assertNull($game->paused_by_user_id, 'System pause must not claim a user paused it');
        $this->assertSame(300000, (int) $game->white_time_paused_ms, 'Server-known clocks are frozen');
        $this->assertSame(240000, (int) $game->black_time_paused_ms);
        $this->assertSame(40000, (int) $game->white_grace_time_ms, 'Grace goes to the side to move');
        $this->assertSame(0, (int) $game->black_grace_time_ms);

        Event::assertDispatched(GamePausedEvent::class, function (GamePausedEvent $event) use ($game) {
            $payload = $event->broadcastWith();

            return $event->game->id === $game->id
                && $payload['reason'] === 'inactivity'
                && $payload['paused_by_user_id'] === null;
        });
    }

    public function test_recently_active_human_game_is_not_paused(): void
    {
        $game = $this->activeHumanGame();

        $this->makeInactive($game, now()->subSeconds(10));

        $this->artisan('games:monitor-inactivity')->assertExitCode(0);

        $this->assertSame('active', $game->fresh()->status);
    }

    public function test_rated_game_is_never_auto_paused(): void
    {
        $game = Game::factory()->create([
            'game_mode' => 'rated',
            'status' => 'active',
        ]);

        $this->makeInactive($game, now()->subMinutes(5));

        $this->artisan('games:monitor-inactivity')->assertExitCode(0);

        $fresh = $game->fresh();
        $this->assertSame('active', $fresh->status, 'Rated games cannot be paused');
        $this->assertNull($fresh->paused_at);
    }

    public function test_synthetic_bot_game_is_not_auto_paused(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $gameId = $this->startBotGame(withSynthetic: true);

        $this->makeInactive(Game::find($gameId), now()->subMinutes(5));

        $this->artisan('games:monitor-inactivity')
            ->expectsOutput('Found 0 games to check')
            ->assertExitCode(0);

        $fresh = Game::find($gameId);
        $this->assertSame('active', $fresh->status, 'No one answers a bot\'s resume request, so bot games must not be auto-paused');
        $this->assertNull($fresh->paused_at);
    }

    public function test_plain_computer_game_is_not_auto_paused(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $gameId = $this->startBotGame(withSynthetic: false);

        $this->makeInactive(Game::find($gameId), now()->subMinutes(5));

        $this->artisan('games:monitor-inactivity')
            ->expectsOutput('Found 0 games to check')
            ->assertExitCode(0);

        $this->assertSame('active', Game::find($gameId)->status);
    }

    public function test_long_paused_human_game_is_forfeited_by_timeout(): void
    {
        $white = User::factory()->create();
        $black = User::factory()->create();

        $game = Game::factory()->create([
            'white_player_id' => $white->id,
            'black_player_id' => $black->id,
            'game_mode' => 'casual',
            'status' => 'paused',
            'turn' => 'white',
            'paused_at' => now()->subMinutes(31),
            'paused_reason' => 'inactivity',
        ]);

        $this->artisan('games:monitor-inactivity')->assertExitCode(0);

        $fresh = $game->fresh();
        $this->assertSame('finished', $fresh->status);
        $this->assertSame('timeout_inactivity', $fresh->end_reason);
        $this->assertSame('0-1', $fresh->result, 'With no moves and white to move, white is the inactive player');
    }

    public function test_long_paused_bot_game_is_left_for_the_hourly_cleanup(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $gameId = $this->startBotGame(withSynthetic: true);
        $game = Game::find($gameId);
        $game->update([
            'status' => 'paused',
            'paused_at' => now()->subMinutes(31),
            'paused_reason' => 'navigation',
        ]);

        $this->artisan('games:monitor-inactivity')
            ->expectsOutput('Found 0 games to check')
            ->assertExitCode(0);

        $fresh = Game::find($gameId);
        $this->assertSame('paused', $fresh->status, 'Bot games stay paused until games:cleanup-abandoned aborts them with result *');
        $this->assertSame('navigation', $fresh->paused_reason);
        $this->assertSame('ongoing', $fresh->result, 'No loss is recorded for an abandoned bot game');
    }

    private function activeHumanGame(): Game
    {
        return Game::factory()->create([
            'game_mode' => 'casual',
            'status' => 'active',
        ]);
    }

    /**
     * Age every activity signal the monitor reads (last_move_at,
     * last_heartbeat_at, updated_at). Query-builder update so updated_at
     * keeps the exact value instead of being touched to now().
     */
    private function makeInactive(Game $game, \Carbon\Carbon $since): void
    {
        Game::whereKey($game->id)->update([
            'last_move_at' => $since,
            'last_heartbeat_at' => $since,
            'updated_at' => $since,
        ]);
    }

    private function startBotGame(bool $withSynthetic): int
    {
        $payload = [
            'player_color' => 'white',
            'computer_level' => 2,
            'time_control' => 10,
            'increment' => 0,
            'game_mode' => 'casual',
        ];

        if ($withSynthetic) {
            $bot = SyntheticPlayer::create([
                'name' => 'Riya First Moves',
                'avatar_seed' => 'riya-first-moves',
                'rating' => 800,
                'computer_level' => 2,
                'personality' => 'Balanced',
                'bio' => 'Learning the basics',
                'is_active' => true,
            ]);
            $payload['synthetic_player_id'] = $bot->id;
        }

        return $this->postJson('/api/v1/games/computer', $payload)
            ->assertOk()
            ->json('game.id');
    }
}
