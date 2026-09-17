<?php

namespace Tests\Feature;

use App\Events\GameResumedEvent;
use App\Events\ResumeRequestSent;
use App\Models\ComputerPlayer;
use App\Models\Game;
use App\Models\SyntheticPlayer;
use App\Models\User;
use App\Services\GameRoomService;
use Illuminate\Support\Facades\Event;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SyntheticResumeTest extends TestCase
{
    private const PAUSED_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

    public function test_casual_synthetic_game_auto_accepts_the_human_resume_request(): void
    {
        Event::fake([GameResumedEvent::class, ResumeRequestSent::class]);

        [$game, $human] = $this->pausedSyntheticGame();

        $result = app(GameRoomService::class)->requestResume($game->id, $human->id);

        $fresh = $game->fresh();
        $this->assertTrue($result['success'], $result['message'] ?? '');
        $this->assertTrue($result['auto_accepted']);
        $this->assertSame('accepted', $result['resume_status']);
        $this->assertSame('active', $fresh->status);
        $this->assertSame(300000, (int) $fresh->white_time_remaining_ms);
        $this->assertSame(340000, (int) $fresh->black_time_remaining_ms);
        $this->assertNull($fresh->paused_at);
        $this->assertNull($fresh->resume_requested_by);
        $this->assertSame('accepted', $fresh->resume_status);
        $this->assertDatabaseCount('invitations', 0);

        Event::assertDispatched(GameResumedEvent::class, function (GameResumedEvent $event) use ($game, $human) {
            $this->assertSame($game->id, $event->game->id);
            $this->assertSame($human->id, $event->resumedBy);
            $this->assertSame('game.resumed', $event->broadcastAs());

            return true;
        });
        Event::assertNotDispatched(ResumeRequestSent::class);
    }

    public function test_human_game_still_creates_a_pending_resume_request(): void
    {
        Event::fake([GameResumedEvent::class, ResumeRequestSent::class]);

        $human = User::factory()->create();
        $opponent = User::factory()->create();
        $game = Game::factory()->create([
            'white_player_id' => $human->id,
            'black_player_id' => $opponent->id,
            'game_mode' => 'casual',
            'status' => 'paused',
            'paused_at' => now(),
            'paused_reason' => 'navigation',
            'paused_by_user_id' => $human->id,
            'white_time_paused_ms' => 300000,
            'black_time_paused_ms' => 300000,
            'turn_at_pause' => 'white',
            'white_grace_time_ms' => 40000,
            'black_grace_time_ms' => 0,
        ]);

        $result = app(GameRoomService::class)->requestResume($game->id, $human->id);

        $this->assertTrue($result['success'], $result['message'] ?? '');
        $this->assertSame('paused', $game->fresh()->status);
        $this->assertSame('pending', $game->fresh()->resume_status);
        $this->assertSame($human->id, $game->fresh()->resume_requested_by);
        $this->assertDatabaseHas('invitations', [
            'game_id' => $game->id,
            'inviter_id' => $human->id,
            'invited_id' => $opponent->id,
            'type' => 'resume_request',
            'status' => 'pending',
        ]);
        Event::assertDispatched(ResumeRequestSent::class);
        Event::assertNotDispatched(GameResumedEvent::class);
    }

    public function test_navigation_pause_fills_missing_legacy_client_clocks(): void
    {
        $human = User::factory()->create();
        Sanctum::actingAs($human);
        $computer = ComputerPlayer::getByLevel(1);
        $game = Game::factory()->create([
            'white_player_id' => $human->id,
            'black_player_id' => null,
            'computer_player_id' => $computer->id,
            'game_mode' => 'casual',
            'time_control_minutes' => 5,
            'status' => 'active',
        ]);

        $this->postJson("/api/v1/games/{$game->id}/pause-navigation")
            ->assertOk();

        $fresh = $game->fresh();
        $this->assertSame('paused', $fresh->status);
        $this->assertSame(300000, (int) $fresh->white_time_paused_ms);
        $this->assertSame(300000, (int) $fresh->black_time_paused_ms);
    }

    private function pausedSyntheticGame(): array
    {
        $human = User::factory()->create();
        $bot = SyntheticPlayer::create([
            'name' => 'Aarav Beginner',
            'avatar_seed' => 'aarav-beginner',
            'rating' => 800,
            'computer_level' => 1,
            'personality' => 'Balanced',
            'bio' => 'Learning the basics',
            'is_active' => true,
        ]);

        $game = Game::factory()->create([
            'white_player_id' => $human->id,
            'black_player_id' => null,
            'computer_player_id' => $bot->getComputerPlayer()->id,
            'synthetic_player_id' => $bot->id,
            'game_mode' => 'casual',
            'status' => 'paused',
            'fen' => self::PAUSED_FEN,
            'turn' => 'black',
            'time_control_minutes' => 5,
            'paused_at' => now(),
            'paused_reason' => 'navigation',
            'paused_by_user_id' => $human->id,
            'white_time_paused_ms' => null,
            'black_time_paused_ms' => null,
            'turn_at_pause' => 'black',
            'white_grace_time_ms' => 0,
            'black_grace_time_ms' => 40000,
        ]);

        return [$game, $human];
    }
}
