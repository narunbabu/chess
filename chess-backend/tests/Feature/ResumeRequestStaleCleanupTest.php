<?php

namespace Tests\Feature;

use App\Events\ResumeRequestSent;
use App\Models\Game;
use App\Models\User;
use App\Services\GameRoomService;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/**
 * GameRoomService::requestResume stale-request cleanup.
 *
 * The cleanup measured ages as now()->diffIn*($game->resume_requested_at). Carbon 3
 * diffs are signed, so that is negative for any past request: the "older than
 * 1/20 minutes" branches never fired and "newer than 10 seconds" always did,
 * letting the requester wipe their own pending request at any age.
 */
class ResumeRequestStaleCleanupTest extends TestCase
{
    private User $white;
    private User $black;
    private Game $game;

    protected function setUp(): void
    {
        parent::setUp();

        // Fake only the broadcast under test so Eloquent model events still run.
        Event::fake([ResumeRequestSent::class]);

        $this->white = User::factory()->create();
        $this->black = User::factory()->create();

        $this->game = Game::factory()->create([
            'white_player_id' => $this->white->id,
            'black_player_id' => $this->black->id,
            'game_mode' => 'casual',
            'status' => 'paused',
            'turn' => 'white',
        ]);
    }

    public function test_same_user_pending_request_older_than_ten_seconds_is_not_wiped(): void
    {
        $this->pendingRequest($this->white, now()->subSeconds(20), now()->addSeconds(10));

        $result = app(GameRoomService::class)->requestResume($this->game->id, $this->white->id);

        $this->assertFalse($result['success'], 'A 20 s old request is not a rapid pause/resume cycle');
        $this->assertTrue($result['is_same_user']);
        $this->assertIsInt($result['expires_in_seconds']);
        $this->assertGreaterThan(0, $result['expires_in_seconds']);
        $this->assertLessThanOrEqual(10, $result['expires_in_seconds']);
        Event::assertNotDispatched(ResumeRequestSent::class);
    }

    public function test_same_user_rapid_retry_within_ten_seconds_replaces_the_request(): void
    {
        $this->pendingRequest($this->white, now()->subSeconds(3), now()->addSeconds(27));

        $result = app(GameRoomService::class)->requestResume($this->game->id, $this->white->id);

        $this->assertTrue($result['success']);
        $this->assertTrue($this->game->fresh()->resume_requested_at->greaterThan(now()->subSeconds(2)));
        Event::assertDispatched(ResumeRequestSent::class);
    }

    public function test_opponent_fresh_pending_request_blocks_a_second_request(): void
    {
        $this->pendingRequest($this->black, now()->subSeconds(5), now()->addSeconds(25));

        $result = app(GameRoomService::class)->requestResume($this->game->id, $this->white->id);

        $this->assertFalse($result['success']);
        $this->assertFalse($result['is_same_user']);
        Event::assertNotDispatched(ResumeRequestSent::class);
    }

    public function test_opponent_request_older_than_a_minute_without_expiry_is_cleared(): void
    {
        // Legacy row with no expiry: only the age-based branches can clear it.
        $this->pendingRequest($this->black, now()->subMinutes(2), null);

        $result = app(GameRoomService::class)->requestResume($this->game->id, $this->white->id);

        $this->assertTrue($result['success']);
        $game = $this->game->fresh();
        $this->assertSame($this->white->id, $game->resume_requested_by);
        $this->assertSame('pending', $game->resume_status);
    }

    private function pendingRequest(User $by, $requestedAt, $expiresAt): void
    {
        Game::whereKey($this->game->id)->update([
            'resume_status' => 'pending',
            'resume_requested_by' => $by->id,
            'resume_requested_at' => $requestedAt,
            'resume_request_expires_at' => $expiresAt,
        ]);
    }
}
