<?php

namespace Tests\Integration;

use App\Models\User;
use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipMatchInvitation;
use App\Services\SwissPairingService;
use App\Services\MatchSchedulerService;
use App\Services\ChampionshipMatchInvitationService;
use App\Services\StandingsCalculatorService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class TournamentWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private User $organizer;
    private array $players;
    private Championship $championship;

    protected function setUp(): void
    {
        parent::setUp();

        $this->organizer = User::factory()->create(['role' => 'admin']);

        // Create 8 players for a complete tournament
        $this->players = User::factory()->count(8)->create();

        $this->championship = Championship::factory()->create([
            'organizer_id' => $this->organizer->id,
            'type' => 'swiss',
            'max_players' => 8,
            'registration_deadline' => now()->addHours(1),
            'tournament_configuration' => [
                'rounds' => 3,
                'pairing_system' => 'swiss',
                'time_control' => '10+5'
            ],
            'auto_start' => true,
            'auto_generate_rounds' => true
        ]);

        $this->championship->participants()->attach(
            $this->players->pluck('id')
        );
    }

    /** @test */
    public function complete_tournament_workflow_from_registration_to_completion()
    {
        // 1. Championship is created and players are registered
        $this->assertEquals('registration', $this->championship->status);
        $this->assertCount(8, $this->championship->participants);

        // 2. Start championship
        $this->championship->update(['status' => 'active']);

        // 3. Generate first round pairings
        $pairingService = new SwissPairingService($this->championship);
        $round1Pairings = $pairingService->generatePairings(1);

        $this->assertCount(4, $round1Pairings['pairings']);
        $this->assertEquals(0, $round1Pairings['bye_count']);

        // 4. Schedule matches for round 1
        $schedulerService = new MatchSchedulerService($this->championship);
        $round1Matches = $schedulerService->scheduleRound(1, $round1Pairings);

        $this->assertCount(4, $round1Matches);
        foreach ($round1Matches as $match) {
            $this->assertEquals('scheduled', $match->status);
            $this->assertEquals(1, $match->round_number);
        }

        // 5. Create invitations for matches
        $invitationService = new ChampionshipMatchInvitationService();
        $invitations = [];

        foreach ($round1Matches as $match) {
            $invitations[] = $invitationService->createInvitation($match);
        }

        $this->assertCount(8, $invitations); // 2 invitations per match

        // 6. Players accept invitations
        foreach ($invitations as $invitation) {
            $result = $invitationService->acceptInvitation($invitation, $invitation->invitedPlayer);
            $this->assertTrue($result);
        }

        // 7. Complete round 1 matches with realistic results
        $round1Matches->each(function ($match, $index) {
            $match->update([
                'status' => 'completed',
                'result' => $index % 2 === 0 ? '1-0' : '0-1', // Alternate results
                'moves' => 'e4 e5 Nf3 Nc6',
                'completed_at' => now()
            ]);
        });

        // 8. Calculate standings after round 1
        $standingsService = new StandingsCalculatorService($this->championship);
        $round1Standings = $standingsService->calculateStandings();

        $this->assertCount(8, $round1Standings);
        // Should have 4 players with 1 point, 4 players with 0 points
        $playersWith1Point = collect($round1Standings)->filter(fn($s) => $s['points'] == 1.0);
        $playersWith0Points = collect($round1Standings)->filter(fn($s) => $s['points'] == 0.0);
        $this->assertCount(4, $playersWith1Point);
        $this->assertCount(4, $playersWith0Points);

        // 9. Generate round 2 pairings (should pair players with same scores)
        $round2Pairings = $pairingService->generatePairings(2);
        $round2Matches = $schedulerService->scheduleRound(2, $round2Pairings);

        $this->assertCount(4, $round2Matches);
        foreach ($round2Matches as $match) {
            $this->assertEquals(2, $match->round_number);
        }

        // 10. Complete round 2 with some draws
        $round2Matches->each(function ($match, $index) {
            $result = match($index) {
                0 => '1-0',
                1 => '0-1',
                2 => '0.5-0.5', // Draw
                default => '1-0'
            };

            $match->update([
                'status' => 'completed',
                'result' => $result,
                'completed_at' => now()
            ]);
        });

        // 11. Calculate standings after round 2
        $round2Standings = $standingsService->calculateStandings();

        // Verify different point totals after 2 rounds
        $pointsDistribution = collect($round2Standings)->pluck('points')->unique()->sortDesc();
        $this->assertContains(2.0, $pointsDistribution);
        $this->assertContains(1.5, $pointsDistribution);
        $this->assertContains(1.0, $pointsDistribution);
        $this->assertContains(0.0, $pointsDistribution);

        // 12. Generate and complete round 3
        $round3Pairings = $pairingService->generatePairings(3);
        $round3Matches = $schedulerService->scheduleRound(3, $round3Pairings);

        $round3Matches->each(function ($match) {
            $match->update([
                'status' => 'completed',
                'result' => '0.5-0.5', // All draws in final round
                'completed_at' => now()
            ]);
        });

        // 13. Final standings
        $finalStandings = $standingsService->calculateStandings();

        $this->assertCount(8, $finalStandings);

        // Check that standings are properly sorted
        for ($i = 0; $i < count($finalStandings) - 1; $i++) {
            $current = $finalStandings[$i];
            $next = $finalStandings[$i + 1];

            $this->assertGreaterThanOrEqual(
                $next['points'],
                $current['points'],
                'Standings should be sorted by points in descending order'
            );
        }

        // 14. Complete championship
        $this->championship->update([
            'status' => 'completed',
            'completed_at' => now()
        ]);

        $this->assertEquals('completed', $this->championship->fresh()->status);
    }

    /** @test */
    public function tournament_with_byes_works_correctly()
    {
        // Create tournament with odd number of players
        $oddChampionship = Championship::factory()->create([
            'type' => 'swiss',
            'max_players' => 5,
            'tournament_configuration' => ['rounds' => 3]
        ]);

        $oddPlayers = User::factory()->count(5)->create();
        $oddChampionship->participants()->attach($oddPlayers->pluck('id'));

        $pairingService = new SwissPairingService($oddChampionship);
        $pairings = $pairingService->generatePairings(1);

        $this->assertEquals(1, $pairings['bye_count']);
        $this->assertNotNull($pairings['bye']);
        $this->assertCount(2, $pairings['pairings']); // 5 players = 2 matches + 1 bye

        // Player with bye should get a point
        $byePlayerId = $pairings['bye'];
        $this->assertTrue($oddPlayers->pluck('id')->contains($byePlayerId));
    }

    /** @test */
    public function tournament_invitations_handle_timeouts_correctly()
    {
        Queue::fake();

        // Start championship and create matches
        $this->championship->update(['status' => 'active']);

        $pairingService = new SwissPairingService($this->championship);
        $pairings = $pairingService->generatePairings(1);

        $schedulerService = new MatchSchedulerService($this->championship);
        $matches = $schedulerService->scheduleRound(1, $pairings);

        $invitationService = new ChampionshipMatchInvitationService();
        $invitation = $invitationService->createInvitation($matches->first());

        // Simulate expired invitation
        $invitation->update([
            'expires_at' => now()->subMinutes(1)
        ]);

        // Check that invitation shows as expired
        $expiredInvitations = ChampionshipMatchInvitation::expired()->get();
        $this->assertTrue($expiredInvitations->contains($invitation));

        // Test cleanup command
        $this->artisan('invitations:clean-expired')
            ->expectsOutput('Cleaned up 1 expired invitations')
            ->assertExitCode(0);

        $this->assertDatabaseMissing('championship_match_invitations', [
            'id' => $invitation->id
        ]);
    }

    /** @test */
    public function auto_start_tournament_with_minimum_players()
    {
        $minimumChampionship = Championship::factory()->create([
            'status' => 'registration',
            'registration_deadline' => now()->subMinutes(1),
            'auto_start' => true,
            'min_players' => 2
        ]);

        $minimumChampionship->participants()->attach([
            $this->players[0]->id,
            $this->players[1]->id
        ]);

        // Run auto-start command
        $this->artisan('tournaments:auto-start')
            ->expectsOutput('Auto-started 1 tournaments')
            ->assertExitCode(0);

        $minimumChampionship->refresh();
        $this->assertEquals('active', $minimumChampionship->status);
    }

    /** @test */
    public void tournament_with_elimination_format()
    {
        $eliminationChampionship = Championship::factory()->create([
            'type' => 'elimination',
            'max_players' => 4,
            'tournament_configuration' => [
                'elimination_rounds' => 2
            ]
        ]);

        $eliminationPlayers = User::factory()->count(4)->create();
        $eliminationChampionship->participants()->attach($eliminationPlayers->pluck('id'));

        $eliminationChampionship->update(['status' => 'active']);

        // Test that elimination bracket is generated
        $service = new \App\Services\EliminationBracketService($eliminationChampionship);
        $bracket = $service->generateBracket();

        $this->assertCount(2, $bracket['first_round']);
        $this->assertEquals('final', $bracket['final']['round_type']);
        $this->assertEquals(3, $bracket['match_count']);
    }

    /** @test */
    public function tournament_command_handles_various_scenarios()
    {
        // Test auto-generate rounds command with no ready tournaments
        $this->artisan('tournaments:auto-generate-rounds')
            ->expectsOutput('Generated rounds for 0 tournaments')
            ->assertExitCode(0);

        // Test with tournament ready for next round
        $this->championship->update(['status' => 'active']);

        // Complete first round
        $pairingService = new SwissPairingService($this->championship);
        $pairings = $pairingService->generatePairings(1);

        $schedulerService = new MatchSchedulerService($this->championship);
        $matches = $schedulerService->scheduleRound(1, $pairings);

        $matches->each(function ($match) {
            $match->update([
                'status' => 'completed',
                'result' => '1-0',
                'completed_at' => now()
            ]);
        });

        // Now auto-generate should find 1 tournament ready
        $this->artisan('tournaments:auto-generate-rounds')
            ->expectsOutput('Generated rounds for 1 tournaments')
            ->assertExitCode(0);

        // Verify round 2 matches were created
        $round2Matches = $this->championship->matches()->where('round_number', 2)->get();
        $this->assertCount(4, $round2Matches);
    }
}