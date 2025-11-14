<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipMatchInvitation;
use App\Events\ChampionshipMatchInvitationSent;
use App\Events\ChampionshipMatchInvitationAccepted;
use App\Events\ChampionshipMatchInvitationDeclined;
use App\Events\ChampionshipMatchInvitationExpired;
use App\Events\ChampionshipMatchStatusChanged;
use App\Events\ChampionshipRoundGenerated;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class WebSocketEventsTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $player1;
    private User $player2;
    private Championship $championship;
    private ChampionshipMatch $match;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create(['role' => 'admin']);
        $this->player1 = User::factory()->create();
        $this->player2 = User::factory()->create();

        $this->championship = Championship::factory()->create([
            'organizer_id' => $this->admin->id
        ]);

        $this->championship->participants()->attach([
            $this->player1->id,
            $this->player2->id
        ]);

        $this->match = ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'white_player_id' => $this->player1->id,
            'black_player_id' => $this->player2->id,
            'status' => 'scheduled'
        ]);
    }

    /** @test */
    public function championship_match_invitation_sent_event_is_fired()
    {
        Event::fake();

        $invitation = ChampionshipMatchInvitation::factory()->create([
            'match_id' => $this->match->id,
            'invited_player_id' => $this->player1->id
        ]);

        Event::assertDispatched(ChampionshipMatchInvitationSent::class, function ($event) use ($invitation) {
            return $event->invitation->id === $invitation->id;
        });
    }

    /** @test */
    public function championship_match_invitation_accepted_event_is_fired()
    {
        Event::fake();

        $invitation = ChampionshipMatchInvitation::factory()->create([
            'match_id' => $this->match->id,
            'invited_player_id' => $this->player1->id,
            'status' => 'pending'
        ]);

        $invitation->update(['status' => 'accepted']);

        Event::assertDispatched(ChampionshipMatchInvitationAccepted::class, function ($event) use ($invitation) {
            return $event->invitation->id === $invitation->id;
        });
    }

    /** @test */
    public function championship_match_invitation_declined_event_is_fired()
    {
        Event::fake();

        $invitation = ChampionshipMatchInvitation::factory()->create([
            'match_id' => $this->match->id,
            'invited_player_id' => $this->player1->id,
            'status' => 'pending'
        ]);

        $invitation->update(['status' => 'declined']);

        Event::assertDispatched(ChampionshipMatchInvitationDeclined::class, function ($event) use ($invitation) {
            return $event->invitation->id === $invitation->id;
        });
    }

    /** @test */
    public function championship_match_invitation_expired_event_is_fired()
    {
        Event::fake();

        $invitation = ChampionshipMatchInvitation::factory()->create([
            'match_id' => $this->match->id,
            'invited_player_id' => $this->player1->id,
            'status' => 'pending',
            'expires_at' => now()->subMinutes(1)
        ]);

        // Trigger expiration through the service
        $service = new \App\Services\ChampionshipMatchInvitationService();
        $service->cleanupExpiredInvitations();

        Event::assertDispatched(ChampionshipMatchInvitationExpired::class, function ($event) use ($invitation) {
            return $event->invitation->id === $invitation->id;
        });
    }

    /** @test */
    public function championship_match_status_changed_event_is_fired()
    {
        Event::fake();

        $this->match->update([
            'status' => 'in_progress',
            'started_at' => now()
        ]);

        Event::assertDispatched(ChampionshipMatchStatusChanged::class, function ($event) {
            return $event->match->id === $this->match->id &&
                   $event->oldStatus === 'scheduled' &&
                   $event->newStatus === 'in_progress';
        });
    }

    /** @test */
    public function championship_round_generated_event_is_fired()
    {
        Event::fake();

        // Simulate round generation through the service
        $service = new \App\Services\MatchSchedulerService($this->championship);

        $pairings = [
            'pairings' => [
                ['white' => $this->player1->id, 'black' => $this->player2->id]
            ],
            'bye_count' => 0,
            'bye' => null
        ];

        $matches = $service->scheduleRound(1, $pairings);

        Event::assertDispatched(ChampionshipRoundGenerated::class, function ($event) {
            return $event->championship->id === $this->championship->id &&
                   $event->roundNumber === 1 &&
                   count($event->matches) === 1;
        });
    }

    /** @test */
    public function events_contain_correct_data_structure()
    {
        Event::fake();

        $invitation = ChampionshipMatchInvitation::factory()->create([
            'match_id' => $this->match->id,
            'invited_player_id' => $this->player1->id
        ]);

        Event::assertDispatched(ChampionshipMatchInvitationSent::class, function ($event) use ($invitation) {
            // Verify event data structure
            return isset($event->invitation) &&
                   $event->invitation instanceof ChampionshipMatchInvitation &&
                   isset($event->match) &&
                   $event->match instanceof ChampionshipMatch &&
                   isset($event->championship) &&
                   $event->championship instanceof Championship;
        });
    }

    /** @test */
    public function match_status_change_tracks_all_transitions()
    {
        Event::fake();

        // Test multiple status transitions
        $transitions = [
            ['from' => 'scheduled', 'to' => 'in_progress'],
            ['from' => 'in_progress', 'to' => 'completed'],
            ['from' => 'scheduled', 'to' => 'cancelled']
        ];

        foreach ($transitions as $transition) {
            $match = ChampionshipMatch::factory()->create([
                'status' => $transition['from']
            ]);

            $match->update(['status' => $transition['to']]);

            Event::assertDispatched(ChampionshipMatchStatusChanged::class, function ($event) use ($transition, $match) {
                return $event->match->id === $match->id &&
                       $event->oldStatus === $transition['from'] &&
                       $event->newStatus === $transition['to'];
            });
        }
    }

    /** @test */
    public function invitation_events_handle_multiple_players_correctly()
    {
        Event::fake();

        $match = ChampionshipMatch::factory()->create([
            'white_player_id' => $this->player1->id,
            'black_player_id' => $this->player2->id
        ]);

        // Create invitations for both players
        $invitation1 = ChampionshipMatchInvitation::factory()->create([
            'match_id' => $match->id,
            'invited_player_id' => $this->player1->id
        ]);

        $invitation2 = ChampionshipMatchInvitation::factory()->create([
            'match_id' => $match->id,
            'invited_player_id' => $this->player2->id
        ]);

        // Both invitations should trigger events
        Event::assertDispatchedTimes(ChampionshipMatchInvitationSent::class, 2);
    }

    /** @test */
    public function round_generation_event_includes_bye_information()
    {
        Event::fake();

        // Create championship with odd number of players
        $oddChampionship = Championship::factory()->create();
        $players = User::factory()->count(5)->create();
        $oddChampionship->participants()->attach($players->pluck('id'));

        $service = new \App\Services\SwissPairingService($oddChampionship);
        $pairings = $service->generatePairings(1);

        $schedulerService = new \App\Services\MatchSchedulerService($oddChampionship);
        $matches = $schedulerService->scheduleRound(1, $pairings);

        Event::assertDispatched(ChampionshipRoundGenerated::class, function ($event) use ($pairings) {
            return isset($event->byePlayers) &&
                   count($event->byePlayers) === $pairings['bye_count'];
        });
    }

    /** @test */
    public function event_broadcasting_channels_are_correctly_configured()
    {
        // Test that events implement ShouldBroadcast
        $this->assertTrue(
            method_exists(ChampionshipMatchInvitationSent::class, 'broadcastOn')
        );

        $this->assertTrue(
            method_exists(ChampionshipMatchInvitationAccepted::class, 'broadcastOn')
        );

        $this->assertTrue(
            method_exists(ChampionshipMatchStatusChanged::class, 'broadcastOn')
        );

        $this->assertTrue(
            method_exists(ChampionshipRoundGenerated::class, 'broadcastOn')
        );
    }

    /** @test */
    public function event_payload_contains_all_necessary_information()
    {
        Event::fake();

        $match = ChampionshipMatch::factory()->create([
            'status' => 'scheduled'
        ]);

        $invitation = ChampionshipMatchInvitation::factory()->create([
            'match_id' => $match->id,
            'invited_player_id' => $this->player1->id
        ]);

        Event::assertDispatched(ChampionshipMatchInvitationSent::class, function ($event) {
            // Verify the event contains all necessary data for frontend processing
            return isset($event->invitation->id) &&
                   isset($event->invitation->expires_at) &&
                   isset($event->invitation->status) &&
                   isset($event->match->white_player_id) &&
                   isset($event->match->black_player_id) &&
                   isset($event->match->round_number) &&
                   isset($event->championship->id) &&
                   isset($event->championship->name);
        });
    }
}