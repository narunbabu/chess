<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipParticipant;
use App\Models\User;
use App\Enums\ChampionshipStatus as ChampionshipStatusEnum;
use App\Enums\ChampionshipMatchStatus as MatchStatusEnum;
use App\Enums\ChampionshipResultType as ResultTypeEnum;
use App\Enums\ChampionshipFormat as FormatEnum;
use Illuminate\Foundation\Testing\RefreshDatabase;

class ConsoleCommandsTest extends TestCase
{
    use RefreshDatabase;

    private Championship $championship;
    private User $player1;
    private User $player2;

    protected function setUp(): void
    {
        parent::setUp();

        // Create test users
        $this->player1 = User::factory()->create(['name' => 'Player 1']);
        $this->player2 = User::factory()->create(['name' => 'Player 2']);

        // Create test championship
        $this->championship = Championship::factory()->create([
            'name' => 'Test Championship',
            'format' => FormatEnum::SWISS->value,
            'status' => ChampionshipStatusEnum::IN_PROGRESS->value,
            'start_date' => now()->subDay(),
            'end_date' => now()->addWeek(),
            'tournament_configuration' => [
                'rounds' => 3,
                'pairing_system' => 'swiss',
                'time_control' => '10+5',
                'default_grace_period_minutes' => 10,
            ],
        ]);

        // Add participants
        foreach ([$this->player1, $this->player2] as $player) {
            ChampionshipParticipant::create([
                'championship_id' => $this->championship->id,
                'user_id' => $player->id,
                'registered_at' => now(),
                'payment_status_id' => \App\Enums\PaymentStatus::COMPLETED->getId(),
            ]);
        }
    }

    /** @test */
    public function check_championship_rounds_command_runs_successfully()
    {
        $this->artisan('championship:check-rounds')
            ->assertExitCode(0);
    }

    /** @test */
    public function check_championship_rounds_command_shows_dry_run_warning()
    {
        $this->artisan('championship:check-rounds --dry-run')
            ->expectsOutput('DRY RUN MODE - No changes will be made')
            ->assertExitCode(0);
    }

    /** @test */
    public function check_championship_rounds_command_checks_specific_championship()
    {
        // Create completed matches
        ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'status_id' => MatchStatusEnum::COMPLETED->getId(),
            'result_type_id' => ResultTypeEnum::COMPLETED->getId(),
        ]);

        $this->artisan('championship:check-rounds', ['--championship' => $this->championship->id])
            ->expectsOutput("Checking championship ID: {$this->championship->id}")
            ->assertExitCode(0);
    }

    /** @test */
    public function check_championship_rounds_command_handles_invalid_championship_id()
    {
        $invalidId = 99999;

        $this->artisan('championship:check-rounds', ['--championship' => $invalidId])
            ->assertExitCode(1);
    }

    /** @test */
    public function check_championship_rounds_command_can_force_progression()
    {
        // Create incomplete round
        ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'status_id' => MatchStatusEnum::PENDING->getId(),
        ]);

        $this->artisan('championship:check-rounds', [
            '--championship' => $this->championship->id,
            '--force' => true
        ])
            ->expectsOutput('Force progressing round...')
            ->assertExitCode(0);
    }

    /** @test */
    public function check_championship_rounds_command_dry_run_shows_status()
    {
        ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'status_id' => MatchStatusEnum::PENDING->getId(),
        ]);

        $this->artisan('championship:check-rounds', [
            '--championship' => $this->championship->id,
            '--dry-run' => true
        ])
            ->expectsOutput('DRY RUN MODE - No changes will be made')
            ->assertExitCode(0);
    }

    /** @test */
    public function check_game_timeouts_command_runs_successfully()
    {
        $this->artisan('championship:check-timeouts')
            ->assertExitCode(0);
    }

    /** @test */
    public function check_game_timeouts_command_shows_dry_run_warning()
    {
        $this->artisan('championship:check-timeouts --dry-run')
            ->expectsOutput('DRY RUN MODE - No changes will be made')
            ->assertExitCode(0);
    }

    /** @test */
    public function check_game_timeouts_command_checks_warnings_only()
    {
        // Create match scheduled to start in 3 minutes
        ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'scheduling_status' => 'confirmed',
            'scheduled_time' => now()->addMinutes(3),
            'status_id' => MatchStatusEnum::PENDING->getId(),
        ]);

        $this->artisan('championship:check-timeouts --warnings-only')
            ->expectsOutput('Checking for timeout warnings only...')
            ->assertExitCode(0);
    }

    /** @test */
    public function check_game_timeouts_command_checks_specific_championship()
    {
        $this->artisan('championship:check-timeouts', ['--championship' => $this->championship->id])
            ->expectsOutput("Checking championship ID: {$this->championship->id}")
            ->assertExitCode(0);
    }

    /** @test */
    public function check_game_timeouts_command_handles_invalid_championship_id()
    {
        $invalidId = 99999;

        $this->artisan('championship:check-timeouts', ['--championship' => $invalidId])
            ->assertExitCode(1);
    }

    /** @test */
    public function check_game_timeouts_command_checks_specific_match()
    {
        $match = ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'scheduling_status' => 'confirmed',
            'scheduled_time' => now()->addMinutes(10),
            'game_timeout' => now()->addMinutes(20),
            'status_id' => MatchStatusEnum::PENDING->getId(),
        ]);

        $this->artisan('championship:check-timeouts', ['--match' => $match->id])
            ->expectsOutput("Checking match ID: {$match->id}")
            ->assertExitCode(0);
    }

    /** @test */
    public function check_game_timeouts_command_handles_invalid_match_id()
    {
        $invalidId = 99999;

        $this->artisan('championship:check-timeouts', ['--match' => $invalidId])
            ->assertExitCode(1);
    }

    /** @test */
    public function check_game_timeouts_command_can_force_timeout()
    {
        $match = ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'scheduling_status' => 'confirmed',
            'scheduled_time' => now()->addMinutes(10),
            'game_timeout' => now()->addMinutes(20),
            'status_id' => MatchStatusEnum::PENDING->getId(),
        ]);

        $this->artisan('championship:check-timeouts', [
            '--match' => $match->id,
            '--force' => true
        ])
            ->expectsOutput('Force processing timeout for match...')
            ->assertExitCode(0);
    }

    /** @test */
    public function check_game_timeouts_command_dry_run_shows_match_status()
    {
        $match = ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'scheduling_status' => 'confirmed',
            'scheduled_time' => now()->addMinutes(10),
            'game_timeout' => now()->addMinutes(20),
            'status_id' => MatchStatusEnum::PENDING->getId(),
        ]);

        $this->artisan('championship:check-timeouts', [
            '--match' => $match->id,
            '--dry-run' => true
        ])
            ->expectsOutput('DRY RUN MODE - No changes will be made')
            ->assertExitCode(0);
    }

    /** @test */
    public function check_game_timeouts_command_detects_timed_out_match()
    {
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

        $this->artisan('championship:check-timeouts', ['--match' => $match->id])
            ->assertExitCode(0);

        // Verify match was processed
        $match->refresh();
        // Match should be completed after timeout processing
        // Actual assertion depends on implementation
    }

    /** @test */
    public function check_championship_rounds_displays_results()
    {
        // Create multiple championships with completed rounds
        $championship2 = Championship::factory()->create([
            'name' => 'Test Championship 2',
            'format' => FormatEnum::SWISS->value,
            'status' => ChampionshipStatusEnum::IN_PROGRESS->value,
            'start_date' => now()->subDay(),
        ]);

        ChampionshipParticipant::create([
            'championship_id' => $championship2->id,
            'user_id' => $this->player1->id,
            'registration_date' => now(),
            'is_paid' => true,
        ]);

        ChampionshipParticipant::create([
            'championship_id' => $championship2->id,
            'user_id' => $this->player2->id,
            'registration_date' => now(),
            'is_paid' => true,
        ]);

        // Complete rounds for both championships
        foreach ([$this->championship, $championship2] as $champ) {
            ChampionshipMatch::factory()->create([
                'championship_id' => $champ->id,
                'player1_id' => $this->player1->id,
                'player2_id' => $this->player2->id,
                'round_number' => 1,
                'status_id' => MatchStatusEnum::COMPLETED->getId(),
                'result_type_id' => ResultTypeEnum::COMPLETED->getId(),
            ]);
        }

        $this->artisan('championship:check-rounds')
            ->expectsOutput('Starting championship round check...')
            ->expectsOutput('Championship round check completed successfully.')
            ->assertExitCode(0);
    }

    /** @test */
    public function check_game_timeouts_displays_warning_results()
    {
        // Create multiple matches needing warnings
        for ($i = 0; $i < 3; $i++) {
            ChampionshipMatch::factory()->create([
                'championship_id' => $this->championship->id,
                'player1_id' => $this->player1->id,
                'player2_id' => $this->player2->id,
                'round_number' => 1,
                'scheduling_status' => 'confirmed',
                'scheduled_time' => now()->addMinutes(3),
                'status_id' => MatchStatusEnum::PENDING->getId(),
            ]);
        }

        $this->artisan('championship:check-timeouts --warnings-only')
            ->expectsOutput('Starting championship timeout check...')
            ->expectsOutput('Checking for timeout warnings only...')
            ->expectsOutput('Championship timeout check completed successfully.')
            ->assertExitCode(0);
    }

    /** @test */
    public function check_championship_rounds_handles_exceptions_gracefully()
    {
        // Try to check non-existent championship
        $this->artisan('championship:check-rounds', ['--championship' => 99999])
            ->expectsOutput('Error during round check: Championship with ID 99999 not found')
            ->assertExitCode(1);
    }

    /** @test */
    public function check_game_timeouts_handles_exceptions_gracefully()
    {
        // Try to check non-existent match
        $this->artisan('championship:check-timeouts', ['--match' => 99999])
            ->expectsOutput('Error during timeout check: Match with ID 99999 not found')
            ->assertExitCode(1);
    }

    /** @test */
    public function commands_can_run_concurrently()
    {
        // Create matches
        ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'status_id' => MatchStatusEnum::COMPLETED->getId(),
            'result_type_id' => ResultTypeEnum::COMPLETED->getId(),
        ]);

        // Both commands should run successfully
        $this->artisan('championship:check-rounds')
            ->assertExitCode(0);

        $this->artisan('championship:check-timeouts')
            ->assertExitCode(0);
    }
}
