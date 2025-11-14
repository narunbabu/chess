<?php

namespace Tests\Unit;

use Tests\TestCase;
use App\Services\ChampionshipMatchSchedulingService;
use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipMatchSchedule;
use App\Models\ChampionshipParticipant;
use App\Models\User;
use App\Models\Game;
use App\Enums\ChampionshipStatus as ChampionshipStatusEnum;
use App\Enums\ChampionshipMatchStatus as MatchStatusEnum;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Carbon\Carbon;

class ChampionshipMatchSchedulingServiceTest extends TestCase
{
    use RefreshDatabase;

    private ChampionshipMatchSchedulingService $service;
    private Championship $championship;
    private ChampionshipMatch $match;
    private User $player1;
    private User $player2;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new ChampionshipMatchSchedulingService();

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

        // Create test match
        $this->match = ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'status_id' => MatchStatusEnum::PENDING->getId(),
            'deadline' => now()->addDays(3),
        ]);
    }

    /** @test */
    public function it_can_propose_match_schedule()
    {
        $proposedTime = now()->addDays(1);
        $message = 'How about tomorrow at this time?';

        $schedule = $this->service->proposeMatchSchedule(
            $this->match,
            $this->player1,
            $proposedTime,
            $message
        );

        $this->assertInstanceOf(ChampionshipMatchSchedule::class, $schedule);
        $this->assertEquals($this->match->id, $schedule->championship_match_id);
        $this->assertEquals($this->player1->id, $schedule->proposer_id);
        $this->assertEquals($proposedTime->format('Y-m-d H:i:s'), $schedule->proposed_time->format('Y-m-d H:i:s'));
        $this->assertEquals('proposed', $schedule->status);
        $this->assertEquals($message, $schedule->proposer_message);

        // Check match scheduling status updated
        $this->match->refresh();
        $this->assertEquals('proposed', $this->match->scheduling_status);
    }

    /** @test */
    public function it_prevents_non_participants_from_proposing_schedule()
    {
        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Only match participants can propose schedules');

        $nonParticipant = User::factory()->create(['name' => 'Non Participant']);
        $proposedTime = now()->addDays(1);

        $this->service->proposeMatchSchedule(
            $this->match,
            $nonParticipant,
            $proposedTime
        );
    }

    /** @test */
    public function it_prevents_proposing_time_after_deadline()
    {
        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Proposed time must be before match deadline');

        $proposedTime = now()->addDays(5); // After match deadline

        $this->service->proposeMatchSchedule(
            $this->match,
            $this->player1,
            $proposedTime
        );
    }

    /** @test */
    public function it_prevents_multiple_pending_proposals()
    {
        // Create first proposal
        $proposedTime1 = now()->addDays(1);
        $this->service->proposeMatchSchedule(
            $this->match,
            $this->player1,
            $proposedTime1
        );

        // Try to create second proposal
        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('There is already a pending proposal for this match');

        $proposedTime2 = now()->addDays(2);
        $this->service->proposeMatchSchedule(
            $this->match,
            $this->player2,
            $proposedTime2
        );
    }

    /** @test */
    public function it_can_accept_schedule_proposal()
    {
        $proposedTime = now()->addDays(1);

        // Create proposal
        $schedule = $this->service->proposeMatchSchedule(
            $this->match,
            $this->player1,
            $proposedTime
        );

        // Accept proposal
        $responseMessage = 'Sounds good!';
        $acceptedSchedule = $this->service->acceptScheduleProposal(
            $schedule,
            $this->player2,
            $responseMessage
        );

        $this->assertEquals('accepted', $acceptedSchedule->status);
        $this->assertEquals($this->player2->id, $acceptedSchedule->responder_id);
        $this->assertEquals($responseMessage, $acceptedSchedule->responder_message);
        $this->assertNotNull($acceptedSchedule->response_time);

        // Check match status updated
        $this->match->refresh();
        $this->assertEquals('accepted', $this->match->scheduling_status);
        $this->assertEquals($proposedTime->format('Y-m-d H:i:s'), $this->match->scheduled_time->format('Y-m-d H:i:s'));
        $this->assertNotNull($this->match->game_timeout);
    }

    /** @test */
    public function it_prevents_self_acceptance_of_proposal()
    {
        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('You cannot accept your own proposal');

        $proposedTime = now()->addDays(1);

        // Create proposal
        $schedule = $this->service->proposeMatchSchedule(
            $this->match,
            $this->player1,
            $proposedTime
        );

        // Try to accept own proposal
        $this->service->acceptScheduleProposal(
            $schedule,
            $this->player1 // Same as proposer
        );
    }

    /** @test */
    public function it_can_propose_alternative_time()
    {
        $proposedTime = now()->addDays(1);

        // Create initial proposal
        $schedule = $this->service->proposeMatchSchedule(
            $this->match,
            $this->player1,
            $proposedTime
        );

        // Propose alternative time
        $alternativeTime = now()->addDays(2);
        $alternativeMessage = 'How about a day later?';

        $updatedSchedule = $this->service->proposeAlternativeTime(
            $schedule,
            $this->player2,
            $alternativeTime,
            $alternativeMessage
        );

        $this->assertEquals('alternative_proposed', $updatedSchedule->status);
        $this->assertEquals($this->player2->id, $updatedSchedule->responder_id);
        $this->assertEquals($alternativeTime->format('Y-m-d H:i:s'), $updatedSchedule->alternative_time->format('Y-m-d H:i:s'));
        $this->assertEquals($alternativeMessage, $updatedSchedule->alternative_message);
    }

    /** @test */
    public function it_prevents_alternative_time_after_deadline()
    {
        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Alternative time must be before match deadline');

        $proposedTime = now()->addDays(1);

        // Create initial proposal
        $schedule = $this->service->proposeMatchSchedule(
            $this->match,
            $this->player1,
            $proposedTime
        );

        // Try to propose alternative after deadline
        $alternativeTime = now()->addDays(5); // After deadline

        $this->service->proposeAlternativeTime(
            $schedule,
            $this->player2,
            $alternativeTime
        );
    }

    /** @test */
    public function it_can_confirm_match_schedule()
    {
        $scheduledTime = now()->addDays(1);

        $confirmedMatch = $this->service->confirmMatchSchedule(
            $this->match,
            $scheduledTime
        );

        $this->assertEquals('confirmed', $confirmedMatch->scheduling_status);
        $this->assertEquals($scheduledTime->format('Y-m-d H:i:s'), $confirmedMatch->scheduled_time->format('Y-m-d H:i:s'));
        $this->assertNotNull($confirmedMatch->game_timeout);
    }

    /** @test */
    public function it_can_cancel_schedule_proposal()
    {
        $proposedTime = now()->addDays(1);

        // Create proposal
        $schedule = $this->service->proposeMatchSchedule(
            $this->match,
            $this->player1,
            $proposedTime
        );

        // Cancel proposal
        $cancelledSchedule = $this->service->cancelScheduleProposal(
            $schedule,
            $this->player1
        );

        $this->assertEquals('cancelled', $cancelledSchedule->status);

        // Check match status updated
        $this->match->refresh();
        $this->assertNull($this->match->scheduled_time);
    }

    /** @test */
    public function it_can_check_player_availability()
    {
        $checkTime = now()->addDays(1);

        $isAvailable = $this->service->checkPlayerAvailability(
            $this->player1,
            $checkTime,
            $checkTime->copy()->addHours(2)
        );

        $this->assertIsBool($isAvailable);
    }

    /** @test */
    public function it_detects_scheduling_conflicts()
    {
        $proposedTime = now()->addDays(1);

        // Create another match for the same player
        $otherMatch = ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => User::factory()->create()->id,
            'round_number' => 1,
            'status_id' => MatchStatusEnum::PENDING->getId(),
            'scheduled_time' => $proposedTime,
            'deadline' => now()->addDays(3),
        ]);

        $hasConflict = $this->service->hasSchedulingConflict(
            $this->player1,
            $proposedTime
        );

        $this->assertTrue($hasConflict);
    }

    /** @test */
    public function it_can_get_pending_schedule_proposals()
    {
        // Create multiple proposals
        $proposedTime1 = now()->addDays(1);
        $schedule1 = $this->service->proposeMatchSchedule(
            $this->match,
            $this->player1,
            $proposedTime1
        );

        $pendingProposals = $this->service->getPendingProposals($this->player2);

        $this->assertIsArray($pendingProposals);
        $this->assertGreaterThan(0, count($pendingProposals));
    }

    /** @test */
    public function it_can_create_instant_game_from_match()
    {
        $game = $this->service->createInstantGameFromMatch(
            $this->match,
            $this->player1
        );

        $this->assertInstanceOf(Game::class, $game);

        // Check match updated with game
        $this->match->refresh();
        $this->assertEquals($game->id, $this->match->game_id);
    }

    /** @test */
    public function it_validates_both_players_online_for_instant_game()
    {
        // This test would require mocking online status
        // For now, we'll verify the method exists and can be called

        $bothOnline = $this->service->areBothPlayersOnline($this->match);

        $this->assertIsBool($bothOnline);
    }

    /** @test */
    public function it_can_get_match_scheduling_history()
    {
        $proposedTime = now()->addDays(1);

        // Create multiple proposals and responses
        $schedule1 = $this->service->proposeMatchSchedule(
            $this->match,
            $this->player1,
            $proposedTime
        );

        $alternativeTime = now()->addDays(2);
        $schedule2 = $this->service->proposeAlternativeTime(
            $schedule1,
            $this->player2,
            $alternativeTime
        );

        $history = $this->service->getMatchSchedulingHistory($this->match);

        $this->assertIsArray($history);
        $this->assertGreaterThan(0, count($history));
    }

    /** @test */
    public function it_sets_grace_period_correctly()
    {
        $scheduledTime = now()->addDays(1);
        $gracePeriod = 15; // minutes

        $this->championship->update([
            'tournament_configuration' => [
                'default_grace_period_minutes' => $gracePeriod,
            ],
        ]);

        $confirmedMatch = $this->service->confirmMatchSchedule(
            $this->match,
            $scheduledTime
        );

        $expectedTimeout = $scheduledTime->copy()->addMinutes($gracePeriod);

        $this->assertEquals(
            $expectedTimeout->format('Y-m-d H:i:s'),
            $confirmedMatch->game_timeout->format('Y-m-d H:i:s')
        );
    }

    /** @test */
    public function it_can_reschedule_confirmed_match()
    {
        $initialTime = now()->addDays(1);

        // Confirm initial schedule
        $this->service->confirmMatchSchedule($this->match, $initialTime);

        // Reschedule
        $newTime = now()->addDays(2);
        $rescheduledMatch = $this->service->rescheduleMatch(
            $this->match,
            $newTime,
            $this->player1
        );

        $this->assertEquals($newTime->format('Y-m-d H:i:s'), $rescheduledMatch->scheduled_time->format('Y-m-d H:i:s'));
    }

    /** @test */
    public function it_sends_notifications_on_proposal()
    {
        // This would test event dispatching
        // For now, verify the method completes successfully

        $proposedTime = now()->addDays(1);

        $schedule = $this->service->proposeMatchSchedule(
            $this->match,
            $this->player1,
            $proposedTime
        );

        $this->assertNotNull($schedule);
        $this->assertEquals('proposed', $schedule->status);
    }

    /** @test */
    public function it_validates_minimum_advance_notice()
    {
        // Try to schedule too soon (less than 1 hour notice)
        $this->expectException(\Exception::class);

        $tooSoonTime = now()->addMinutes(30);

        $this->service->proposeMatchSchedule(
            $this->match,
            $this->player1,
            $tooSoonTime
        );
    }
}
