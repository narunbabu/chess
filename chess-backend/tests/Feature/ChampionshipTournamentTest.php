<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipMatchInvitation;
use App\Services\SwissPairingService;
use App\Services\EliminationBracketService;
use App\Services\MatchSchedulerService;
use App\Services\ChampionshipMatchInvitationService;
use App\Services\StandingsCalculatorService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class ChampionshipTournamentTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $player1;
    private User $player2;
    private User $player3;
    private User $player4;
    private User $player5;
    private Championship $championship;

    protected function setUp(): void
    {
        parent::setUp();

        // Create test users
        $this->admin = User::factory()->create(['role' => 'admin']);
        $this->player1 = User::factory()->create();
        $this->player2 = User::factory()->create();
        $this->player3 = User::factory()->create();
        $this->player4 = User::factory()->create();
        $this->player5 = User::factory()->create();

        // Create test championship
        $this->championship = Championship::factory()->create([
            'organizer_id' => $this->admin->id,
            'type' => 'swiss',
            'max_players' => 5,
            'registration_deadline' => now()->addHours(2),
            'tournament_configuration' => [
                'rounds' => 3,
                'pairing_system' => 'swiss',
                'time_control' => '10+5'
            ]
        ]);

        // Register players
        $this->championship->participantUsers()->attach([
            $this->player1->id,
            $this->player2->id,
            $this->player3->id,
            $this->player4->id,
            $this->player5->id
        ]);
    }

    /** @test */
    public function it_can_create_championship_with_all_configuration_options()
    {
        $config = [
            'rounds' => 5,
            'pairing_system' => 'swiss',
            'time_control' => '15+10',
            'elimination_rounds' => 2
        ];

        $championship = Championship::factory()->create([
            'type' => 'hybrid',
            'tournament_configuration' => $config,
            'auto_start' => true,
            'auto_generate_rounds' => true
        ]);

        $this->assertEquals('hybrid', $championship->type);
        $this->assertEquals($config, $championship->tournament_configuration);
        $this->assertTrue($championship->auto_start);
        $this->assertTrue($championship->auto_generate_rounds);
    }

    /** @test */
    public function it_can_add_color_assignment_to_matches()
    {
        $match = ChampionshipMatch::factory()->create([
            'white_player_id' => $this->player1->id,
            'black_player_id' => $this->player2->id,
            'round_number' => 1
        ]);

        $this->assertEquals($this->player1->id, $match->white_player_id);
        $this->assertEquals($this->player2->id, $match->black_player_id);
        $this->assertEquals('scheduled', $match->status);
        $this->assertEquals(1, $match->round_number);
    }

    /** @test */
    public function swiss_pairing_service_generates_correct_pairings()
    {
        $service = new SwissPairingService($this->championship);
        $pairings = $service->generatePairings(1);

        $this->assertCount(2, $pairings); // 5 players = 2 matches + 1 bye
        $this->assertEquals(1, $pairings['bye_count']);

        // Check that all players are paired
        $pairedPlayers = collect($pairings['pairings'])->flatten();
        $byePlayer = $pairings['bye'];

        $allPlayers = $pairedPlayers->push($byePlayer)->sort()->values();
        $expectedPlayers = $this->championship->participants->pluck('id')->sort()->values();

        $this->assertEquals($expectedPlayers, $allPlayers);
    }

    /** @test */
    public function elimination_bracket_service_creates_correct_bracket()
    {
        // Create championship with 4 players (perfect for elimination)
        $elimChampionship = Championship::factory()->create([
            'type' => 'elimination',
            'max_players' => 4
        ]);

        $elimChampionship->participantUsers()->attach([
            $this->player1->id,
            $this->player2->id,
            $this->player3->id,
            $this->player4->id
        ]);

        $service = new EliminationBracketService($elimChampionship);
        $bracket = $service->generateBracket();

        $this->assertCount(2, $bracket['first_round']); // Semi-finals
        $this->assertEquals('final', $bracket['final']['round_type']);
        $this->assertArrayHasKey('match_count', $bracket);
    }

    /** @test */
    public function match_scheduler_service_creates_matches_correctly()
    {
        $service = new MatchSchedulerService($this->championship);

        $pairings = [
            'pairings' => [
                ['white' => $this->player1->id, 'black' => $this->player2->id],
                ['white' => $this->player3->id, 'black' => $this->player4->id]
            ],
            'bye_count' => 1,
            'bye' => $this->player5->id
        ];

        $matches = $service->scheduleRound(1, $pairings);

        $this->assertCount(2, $matches);
        $this->assertEquals($this->player1->id, $matches[0]->white_player_id);
        $this->assertEquals($this->player2->id, $matches[0]->black_player_id);
        $this->assertEquals($this->player3->id, $matches[1]->white_player_id);
        $this->assertEquals($this->player4->id, $matches[1]->black_player_id);

        foreach ($matches as $match) {
            $this->assertEquals('scheduled', $match->status);
            $this->assertEquals(1, $match->round_number);
        }
    }

    /** @test */
    public function championship_match_invitation_service_works_correctly()
    {
        $match = ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'white_player_id' => $this->player1->id,
            'black_player_id' => $this->player2->id
        ]);

        $service = new ChampionshipMatchInvitationService();

        // Test invitation creation
        $invitation = $service->createInvitation($match);

        $this->assertInstanceOf(ChampionshipMatchInvitation::class, $invitation);
        $this->assertEquals($match->id, $invitation->match_id);
        $this->assertEquals('pending', $invitation->status);
        $this->assertNotNull($invitation->expires_at);

        // Test invitation acceptance
        $result = $service->acceptInvitation($invitation, $this->player1);
        $this->assertTrue($result);
        $this->assertEquals('accepted', $invitation->fresh()->status);

        // Test duplicate rejection
        $this->assertFalse($service->acceptInvitation($invitation, $this->player1));
    }

    /** @test */
    public function standings_calculator_service_ranks_players_correctly()
    {
        // Create some test results
        $match1 = ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'white_player_id' => $this->player1->id,
            'black_player_id' => $this->player2->id,
            'status' => 'completed',
            'result' => '1-0'
        ]);

        $match2 = ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'white_player_id' => $this->player3->id,
            'black_player_id' => $this->player4->id,
            'status' => 'completed',
            'result' => '0-1'
        ]);

        $service = new StandingsCalculatorService($this->championship);
        $standings = $service->calculateStandings();

        $this->assertCount(5, $standings);

        // Player 1 should be first (1-0)
        $this->assertEquals($this->player1->id, $standings[0]['player_id']);
        $this->assertEquals(1.0, $standings[0]['points']);

        // Player 4 should be second (1-0)
        $this->assertEquals($this->player4->id, $standings[1]['player_id']);
        $this->assertEquals(1.0, $standings[1]['points']);
    }

    /** @test */
    public function invitation_model_handles_all_relationships()
    {
        $match = ChampionshipMatch::factory()->create([
            'white_player_id' => $this->player1->id,
            'black_player_id' => $this->player2->id
        ]);

        $invitation = ChampionshipMatchInvitation::factory()->create([
            'match_id' => $match->id,
            'invited_player_id' => $this->player1->id,
            'status' => 'pending'
        ]);

        // Test relationships
        $this->assertEquals($match->id, $invitation->match->id);
        $this->assertEquals($this->player1->id, $invitation->invitedPlayer->id);

        // Test scopes
        $pendingInvitations = ChampionshipMatchInvitation::pending()->get();
        $this->assertTrue($pendingInvitations->contains($invitation));

        $expiredInvitations = ChampionshipMatchInvitation::expired()->get();
        $this->assertFalse($expiredInvitations->contains($invitation)); // Fresh invitation
    }

    /** @test */
    public function auto_start_tournament_command_works()
    {
        // Create championship past deadline
        $pastChampionship = Championship::factory()->create([
            'status' => 'registration',
            'registration_deadline' => now()->subHours(1),
            'auto_start' => true
        ]);

        $pastChampionship->participantUsers()->attach([$this->player1->id, $this->player2->id]);

        $this->artisan('tournaments:auto-start')
            ->expectsOutput('Auto-started 1 tournaments')
            ->assertExitCode(0);

        $pastChampionship->refresh();
        $this->assertEquals('active', $pastChampionship->status);
    }

    /** @test */
    public function auto_generate_rounds_command_works()
    {
        // Set up championship with completed first round
        $this->championship->update(['status' => 'active']);

        ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'round_number' => 1,
            'status' => 'completed'
        ]);

        $this->artisan('tournaments:auto-generate-rounds')
            ->expectsOutput('Generated rounds for 1 tournaments')
            ->assertExitCode(0);

        // Check that round 2 matches were created
        $round2Matches = $this->championship->matches()->where('round_number', 2)->get();
        $this->assertCount(2, $round2Matches);
    }

    /** @test */
    public function clean_expired_invitations_command_works()
    {
        $match = ChampionshipMatch::factory()->create();

        // Create expired invitation
        $expiredInvitation = ChampionshipMatchInvitation::factory()->create([
            'match_id' => $match->id,
            'expires_at' => now()->subHours(1)
        ]);

        $this->artisan('invitations:clean-expired')
            ->expectsOutput('Cleaned up 1 expired invitations')
            ->assertExitCode(0);

        $this->assertDatabaseMissing('championship_match_invitations', [
            'id' => $expiredInvitation->id
        ]);
    }

    /** @test */
    public function championship_model_has_correct_casts_and_relationships()
    {
        $championship = Championship::factory()->create([
            'tournament_configuration' => [
                'rounds' => 5,
                'time_control' => '10+5'
            ],
            'metadata' => [
                'venue' => 'Online',
                'prize_fund' => 1000
            ]
        ]);

        // Test casts
        $this->assertIsArray($championship->tournament_configuration);
        $this->assertIsArray($championship->metadata);

        // Test relationships
        $this->assertInstanceOf(\Illuminate\Database\Eloquent\Collection::class, $championship->participants);
        $this->assertInstanceOf(\Illuminate\Database\Eloquent\Collection::class, $championship->matches);
        $this->assertInstanceOf(User::class, $championship->organizer);
    }

    /** @test */
    public function it_validates_tournament_configuration_schema()
    {
        // Test Swiss configuration
        $swissConfig = [
            'rounds' => 5,
            'pairing_system' => 'swiss',
            'time_control' => '10+5'
        ];

        $championship = Championship::factory()->create([
            'type' => 'swiss',
            'tournament_configuration' => $swissConfig
        ]);

        $this->assertEquals($swissConfig, $championship->tournament_configuration);
        $this->assertEquals('swiss', $championship->type);

        // Test elimination configuration
        $elimConfig = [
            'elimination_rounds' => 3,
            'time_control' => '15+10'
        ];

        $elimChampionship = Championship::factory()->create([
            'type' => 'elimination',
            'tournament_configuration' => $elimConfig
        ]);

        $this->assertEquals($elimConfig, $elimChampionship->tournament_configuration);
        $this->assertEquals('elimination', $elimChampionship->type);
    }
}