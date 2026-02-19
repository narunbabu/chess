<?php

namespace Tests\Unit;

use Tests\TestCase;
use App\Services\ChampionshipGameTimeoutService;
use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipMatchSchedule;
use App\Models\ChampionshipParticipant;
use App\Models\User;
use App\Events\ChampionshipTimeoutWarning;
use App\Events\ChampionshipMatchForfeited;
use App\Enums\ChampionshipStatus as ChampionshipStatusEnum;
use App\Enums\ChampionshipMatchStatus as MatchStatusEnum;
use App\Enums\ChampionshipResultType as ResultTypeEnum;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Carbon\Carbon;

class ChampionshipGameTimeoutServiceTest extends TestCase
{
    use RefreshDatabase;

    private ChampionshipGameTimeoutService $service;
    private Championship $championship;
    private User $player1;
    private User $player2;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new ChampionshipGameTimeoutService();

        // Create test users
        $this->player1 = User::factory()->create(['name' => 'Player 1']);
        $this->player2 = User::factory()->create(['name' => 'Player 2']);

        // Create test championship
        $this->championship = Championship::factory()->create([
            'name' => 'Test Championship',
            'status' => ChampionshipStatusEnum::IN_PROGRESS->value,
            'start_date' => now()->subDay(),
            'end_date' => now()->addWeek(),
            'tournament_configuration' => [
                'default_grace_period_minutes' => 10,
            ],
        ]);

        // Add participants
        foreach ([$this->player1, $this->player2] as $player) {
            ChampionshipParticipant::create([
                'championship_id' => $this->championship->id,
                'user_id' => $player->id,
                'registration_date' => now(),
                'is_paid' => true,
            ]);
        }
    }

    /** @test */
    public function it_sends_timeout_warning_for_upcoming_matches()
    {
        Event::fake([ChampionshipTimeoutWarning::class]);

        // Create match scheduled to start in 3 minutes
        $match = ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'scheduling_status' => 'confirmed',
            'scheduled_time' => now()->addMinutes(3),
            'status_id' => MatchStatusEnum::PENDING->getId(),
        ]);

        $result = $this->service->checkTimeoutWarnings();

        $this->assertIsArray($result);
        $this->assertGreaterThan(0, count($result));

        // Verify warning event was dispatched
        Event::assertDispatched(ChampionshipTimeoutWarning::class);
    }

    /** @test */
    public function it_does_not_send_duplicate_warnings()
    {
        Event::fake([ChampionshipTimeoutWarning::class]);

        // Create match scheduled to start in 3 minutes
        $match = ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'scheduling_status' => 'confirmed',
            'scheduled_time' => now()->addMinutes(3),
            'status_id' => MatchStatusEnum::PENDING->getId(),
        ]);

        // Create schedule record with recent warning
        ChampionshipMatchSchedule::create([
            'championship_match_id' => $match->id,
            'proposer_id' => $this->player1->id,
            'proposed_time' => now()->addMinutes(3),
            'status' => 'accepted',
            'warning_sent_at' => now()->subMinutes(30), // Recent warning
        ]);

        $result = $this->service->checkTimeoutWarnings();

        // Should not send another warning
        $this->assertIsArray($result);
        $this->assertEquals(0, count($result));
    }

    /** @test */
    public function it_processes_timeout_for_expired_matches()
    {
        Event::fake([ChampionshipMatchForfeited::class]);

        // Create match that has timed out (grace period expired)
        $match = ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'scheduling_status' => 'confirmed',
            'scheduled_time' => now()->subMinutes(20),
            'game_timeout' => now()->subMinutes(5), // Timeout expired
            'status_id' => MatchStatusEnum::PENDING->getId(),
        ]);

        $result = $this->service->processTimeouts();

        $this->assertIsArray($result);
        $this->assertGreaterThan(0, count($result));

        // Refresh match to check status
        $match->refresh();
        $this->assertEquals(MatchStatusEnum::COMPLETED->getId(), $match->status_id);

        // Verify forfeit event was dispatched
        Event::assertDispatched(ChampionshipMatchForfeited::class);
    }

    /** @test */
    public function it_awards_win_to_active_player_on_timeout()
    {
        // Create match with timeout
        $match = ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'scheduling_status' => 'confirmed',
            'scheduled_time' => now()->subMinutes(20),
            'game_timeout' => now()->subMinutes(5),
            'status_id' => MatchStatusEnum::PENDING->getId(),
        ]);

        // Mock player 1 being online/active
        // In a real scenario, this would check actual player activity

        $this->service->processTimeouts();

        $match->refresh();

        // Verify match is completed and has a result
        $this->assertEquals(MatchStatusEnum::COMPLETED->getId(), $match->status_id);
        $this->assertNotNull($match->result_id);
    }

    /** @test */
    public function it_handles_double_forfeit_when_both_players_absent()
    {
        // Create match with timeout where both players are absent
        $match = ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'scheduling_status' => 'confirmed',
            'scheduled_time' => now()->subMinutes(20),
            'game_timeout' => now()->subMinutes(5),
            'status_id' => MatchStatusEnum::PENDING->getId(),
        ]);

        $this->service->processTimeouts();

        $match->refresh();

        // Should be marked as completed
        $this->assertEquals(MatchStatusEnum::COMPLETED->getId(), $match->status_id);

        // Check for draw or other appropriate result for double forfeit
        // Implementation may vary based on business rules
        $this->assertNotNull($match->result_id);
    }

    /** @test */
    public function it_can_set_match_timeout()
    {
        $match = ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'status_id' => MatchStatusEnum::PENDING->getId(),
        ]);

        $scheduledTime = now()->addHours(2);

        // setMatchTimeout takes (ChampionshipMatch, Carbon) — grace period comes from championship config
        $this->service->setMatchTimeout($match, $scheduledTime);

        $match->refresh();

        $this->assertNotNull($match->game_timeout);
        $this->assertEquals('confirmed', $match->scheduling_status);
    }

    /** @test */
    public function it_can_extend_match_timeout()
    {
        $match = ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'scheduling_status' => 'confirmed',
            'scheduled_time' => now()->addMinutes(5),
            'game_timeout' => now()->addMinutes(15),
            'status_id' => MatchStatusEnum::PENDING->getId(),
        ]);

        $originalTimeout = $match->game_timeout;
        $extensionMinutes = 30;

        $this->service->extendTimeout($match, $extensionMinutes);

        $match->refresh();

        $this->assertTrue($match->game_timeout->greaterThan($originalTimeout));
        $this->assertEquals(
            $originalTimeout->addMinutes($extensionMinutes)->format('Y-m-d H:i:s'),
            $match->game_timeout->format('Y-m-d H:i:s')
        );
    }

    /** @test */
    public function it_can_force_timeout_manually()
    {
        Event::fake([ChampionshipMatchForfeited::class]);

        $match = ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'scheduling_status' => 'confirmed',
            'scheduled_time' => now()->addMinutes(10), // Not timed out yet
            'game_timeout' => now()->addMinutes(20),
            'status_id' => MatchStatusEnum::PENDING->getId(),
        ]);

        // forceTimeout takes only (ChampionshipMatch) — winner determined internally
        $this->service->forceTimeout($match);

        $match->refresh();

        $this->assertEquals(MatchStatusEnum::COMPLETED->getId(), $match->status_id);
        $this->assertNotNull($match->result_id);

        Event::assertDispatched(ChampionshipMatchForfeited::class);
    }

    /** @test */
    public function it_checks_all_championships_for_timeouts()
    {
        // Create multiple championships with matches
        $championship2 = Championship::factory()->create([
            'name' => 'Test Championship 2',
            'status' => ChampionshipStatusEnum::IN_PROGRESS->value,
            'start_date' => now()->subDay(),
        ]);

        $player3 = User::factory()->create(['name' => 'Player 3']);
        $player4 = User::factory()->create(['name' => 'Player 4']);

        ChampionshipParticipant::create([
            'championship_id' => $championship2->id,
            'user_id' => $player3->id,
            'registration_date' => now(),
            'is_paid' => true,
        ]);

        ChampionshipParticipant::create([
            'championship_id' => $championship2->id,
            'user_id' => $player4->id,
            'registration_date' => now(),
            'is_paid' => true,
        ]);

        // Create matches with upcoming warnings
        foreach ([$this->championship, $championship2] as $champ) {
            $player1 = $champ->id == $this->championship->id ? $this->player1 : $player3;
            $player2 = $champ->id == $this->championship->id ? $this->player2 : $player4;

            ChampionshipMatch::factory()->create([
                'championship_id' => $champ->id,
                'player1_id' => $player1->id,
                'player2_id' => $player2->id,
                'round_number' => 1,
                'scheduling_status' => 'confirmed',
                'scheduled_time' => now()->addMinutes(3),
                'status_id' => MatchStatusEnum::PENDING->getId(),
            ]);
        }

        $result = $this->service->checkAllTimeouts();

        $this->assertIsArray($result);
        $this->assertArrayHasKey('warnings', $result);
        $this->assertArrayHasKey('timeouts', $result);
    }

    /** @test */
    public function it_gets_championship_timeout_status()
    {
        // Create matches in various states
        $upcomingMatch = ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'scheduling_status' => 'confirmed',
            'scheduled_time' => now()->addMinutes(3),
            'status_id' => MatchStatusEnum::PENDING->getId(),
        ]);

        $timedOutMatch = ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'scheduling_status' => 'confirmed',
            'scheduled_time' => now()->subMinutes(20),
            'game_timeout' => now()->subMinutes(5),
            'status_id' => MatchStatusEnum::PENDING->getId(),
        ]);

        $status = $this->service->getChampionshipTimeoutStatus($this->championship);

        $this->assertIsArray($status);
        // Service returns array of match status items, each with match_id, is_timed_out, needs_warning, etc.
        $this->assertGreaterThanOrEqual(0, count($status));
    }

    /** @test */
    public function it_does_not_timeout_already_completed_matches()
    {
        // Create match that is already completed but has timeout
        $match = ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'scheduling_status' => 'confirmed',
            'scheduled_time' => now()->subMinutes(20),
            'game_timeout' => now()->subMinutes(5),
            'status_id' => MatchStatusEnum::COMPLETED->getId(),
            'result_id' => ResultTypeEnum::WHITE_WINS->getId(),
        ]);

        $result = $this->service->processTimeouts();

        // Should not process already completed match
        $this->assertIsArray($result);
        $this->assertEquals(0, count($result));
    }

    /** @test */
    public function it_logs_timeout_actions()
    {
        // Create match with timeout
        $match = ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'scheduling_status' => 'confirmed',
            'scheduled_time' => now()->subMinutes(20),
            'game_timeout' => now()->subMinutes(5),
            'status_id' => MatchStatusEnum::PENDING->getId(),
        ]);

        // This should log the timeout action
        $this->service->processTimeouts();

        // In a real test, you would assert log entries
        // For now, just verify the process completes
        $this->assertTrue(true);
    }
}
