<?php

namespace Tests\Unit;

use Tests\TestCase;
use App\Services\ChampionshipRoundProgressionService;
use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipStanding;
use App\Models\ChampionshipParticipant;
use App\Models\User;
use App\Enums\ChampionshipStatus as ChampionshipStatusEnum;
use App\Enums\ChampionshipMatchStatus as MatchStatusEnum;
use App\Enums\ChampionshipResultType as ResultTypeEnum;
use App\Enums\ChampionshipFormat as FormatEnum;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

class ChampionshipRoundProgressionServiceTest extends TestCase
{
    use RefreshDatabase;

    private ChampionshipRoundProgressionService $service;
    private Championship $championship;
    private User $player1;
    private User $player2;
    private User $player3;
    private User $player4;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new ChampionshipRoundProgressionService();

        // Create test users
        $this->player1 = User::factory()->create(['name' => 'Player 1', 'rating' => 1800]);
        $this->player2 = User::factory()->create(['name' => 'Player 2', 'rating' => 1700]);
        $this->player3 = User::factory()->create(['name' => 'Player 3', 'rating' => 1600]);
        $this->player4 = User::factory()->create(['name' => 'Player 4', 'rating' => 1500]);

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
                'time_control' => '10+5'
            ],
        ]);

        // Add participants
        foreach ([$this->player1, $this->player2, $this->player3, $this->player4] as $player) {
            ChampionshipParticipant::create([
                'championship_id' => $this->championship->id,
                'user_id' => $player->id,
                'registration_date' => now(),
                'is_paid' => true,
            ]);
        }
    }

    /** @test */
    public function it_can_get_current_round_number()
    {
        // Create matches for round 1
        ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'status_id' => MatchStatusEnum::PENDING->getId(),
        ]);

        $currentRound = $this->service->getCurrentRound($this->championship);

        $this->assertEquals(1, $currentRound);
    }

    /** @test */
    public function it_can_detect_completed_round()
    {
        // Create completed matches for round 1
        ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'status_id' => MatchStatusEnum::COMPLETED->getId(),
            'result_id' => ResultTypeEnum::WHITE_WINS->getId(),
        ]);

        ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player3->id,
            'player2_id' => $this->player4->id,
            'round_number' => 1,
            'status_id' => MatchStatusEnum::COMPLETED->getId(),
            'result_id' => ResultTypeEnum::BLACK_WINS->getId(),
        ]);

        $isComplete = $this->service->isRoundComplete($this->championship, 1);

        $this->assertTrue($isComplete);
    }

    /** @test */
    public function it_can_detect_incomplete_round()
    {
        // Create one completed and one pending match
        ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'status_id' => MatchStatusEnum::COMPLETED->getId(),
            'result_id' => ResultTypeEnum::WHITE_WINS->getId(),
        ]);

        ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player3->id,
            'player2_id' => $this->player4->id,
            'round_number' => 1,
            'status_id' => MatchStatusEnum::PENDING->getId(),
        ]);

        $isComplete = $this->service->isRoundComplete($this->championship, 1);

        $this->assertFalse($isComplete);
    }

    /** @test */
    public function it_updates_standings_when_round_completes()
    {
        // Create completed matches with results
        $match1 = ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'status_id' => MatchStatusEnum::COMPLETED->getId(),
            'result_id' => ResultTypeEnum::WHITE_WINS->getId(),
        ]);

        $match2 = ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player3->id,
            'player2_id' => $this->player4->id,
            'round_number' => 1,
            'status_id' => MatchStatusEnum::COMPLETED->getId(),
            'result_id' => ResultTypeEnum::DRAW->getId(),
        ]);

        $result = $this->service->progressToNextRound($this->championship, 1);

        $this->assertNotNull($result);
        $this->assertEquals(1, $result['completed_round']);

        // Verify standings exist
        $standings = ChampionshipStanding::where('championship_id', $this->championship->id)->get();
        $this->assertGreaterThan(0, $standings->count());

        // Verify player 1 has 1 point (win)
        $player1Standing = $standings->where('user_id', $this->player1->id)->first();
        $this->assertEquals(1.0, $player1Standing->score);

        // Verify players 3 and 4 have 0.5 points (draw)
        $player3Standing = $standings->where('user_id', $this->player3->id)->first();
        $player4Standing = $standings->where('user_id', $this->player4->id)->first();
        $this->assertEquals(0.5, $player3Standing->score);
        $this->assertEquals(0.5, $player4Standing->score);
    }

    /** @test */
    public function it_progresses_to_next_round_automatically()
    {
        // Complete round 1
        ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'status_id' => MatchStatusEnum::COMPLETED->getId(),
            'result_id' => ResultTypeEnum::WHITE_WINS->getId(),
        ]);

        ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player3->id,
            'player2_id' => $this->player4->id,
            'round_number' => 1,
            'status_id' => MatchStatusEnum::COMPLETED->getId(),
            'result_id' => ResultTypeEnum::BLACK_WINS->getId(),
        ]);

        $result = $this->service->checkChampionshipRoundProgression($this->championship);

        $this->assertNotNull($result);
        $this->assertEquals(1, $result['completed_round']);

        // Verify round 2 matches were created
        $round2Matches = ChampionshipMatch::where('championship_id', $this->championship->id)
            ->where('round_number', 2)
            ->get();

        $this->assertGreaterThan(0, $round2Matches->count());
    }

    /** @test */
    public function it_detects_championship_completion()
    {
        // Set championship to final round
        $this->championship->update([
            'tournament_configuration' => [
                'rounds' => 1,
                'pairing_system' => 'swiss',
                'time_control' => '10+5'
            ],
        ]);

        // Complete all matches in final round
        ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'status_id' => MatchStatusEnum::COMPLETED->getId(),
            'result_id' => ResultTypeEnum::WHITE_WINS->getId(),
        ]);

        ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player3->id,
            'player2_id' => $this->player4->id,
            'round_number' => 1,
            'status_id' => MatchStatusEnum::COMPLETED->getId(),
            'result_id' => ResultTypeEnum::BLACK_WINS->getId(),
        ]);

        $result = $this->service->checkChampionshipRoundProgression($this->championship);

        $this->assertNotNull($result);
        $this->assertTrue($result['championship_completed'] ?? false);
    }

    /** @test */
    public function it_checks_all_active_championships()
    {
        // Create another championship
        $championship2 = Championship::factory()->create([
            'name' => 'Test Championship 2',
            'format' => FormatEnum::SWISS->value,
            'status' => ChampionshipStatusEnum::IN_PROGRESS->value,
            'start_date' => now()->subDay(),
            'end_date' => now()->addWeek(),
        ]);

        // Add participants to championship 2
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

        // Complete round for both championships
        foreach ([$this->championship, $championship2] as $champ) {
            ChampionshipMatch::factory()->create([
                'championship_id' => $champ->id,
                'player1_id' => $this->player1->id,
                'player2_id' => $this->player2->id,
                'round_number' => 1,
                'status_id' => MatchStatusEnum::COMPLETED->getId(),
                'result_id' => ResultTypeEnum::WHITE_WINS->getId(),
            ]);
        }

        $results = $this->service->checkAllChampionships();

        $this->assertIsArray($results);
        $this->assertGreaterThanOrEqual(1, count($results));
    }

    /** @test */
    public function it_calculates_tiebreak_points_correctly()
    {
        // Create matches where players have same score
        ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'status_id' => MatchStatusEnum::COMPLETED->getId(),
            'result_id' => ResultTypeEnum::WHITE_WINS->getId(),
        ]);

        ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player3->id,
            'player2_id' => $this->player4->id,
            'round_number' => 1,
            'status_id' => MatchStatusEnum::COMPLETED->getId(),
            'result_id' => ResultTypeEnum::BLACK_WINS->getId(),
        ]);

        $this->service->progressToNextRound($this->championship, 1);

        $standings = ChampionshipStanding::where('championship_id', $this->championship->id)
            ->orderBy('rank')
            ->get();

        // Check that tiebreak points exist
        foreach ($standings as $standing) {
            $this->assertNotNull($standing->tiebreak_points);
        }
    }

    /** @test */
    public function it_handles_force_round_progression()
    {
        // Create incomplete round
        ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'status_id' => MatchStatusEnum::PENDING->getId(),
        ]);

        // Force progression should work
        $result = $this->service->forceRoundProgression($this->championship, 1);

        $this->assertNotNull($result);
    }

    /** @test */
    public function it_returns_current_standings()
    {
        // Create and complete some matches
        ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'status_id' => MatchStatusEnum::COMPLETED->getId(),
            'result_id' => ResultTypeEnum::WHITE_WINS->getId(),
        ]);

        $this->service->progressToNextRound($this->championship, 1);

        $standings = $this->service->getCurrentStandings($this->championship);

        $this->assertIsArray($standings);
        $this->assertGreaterThan(0, count($standings));

        // Verify standings structure
        foreach ($standings as $standing) {
            $this->assertArrayHasKey('user_id', $standing);
            $this->assertArrayHasKey('score', $standing);
            $this->assertArrayHasKey('rank', $standing);
        }
    }

    /** @test */
    public function it_handles_bye_in_standings_calculation()
    {
        // Add 5th player for odd number
        $player5 = User::factory()->create(['name' => 'Player 5', 'rating' => 1400]);

        ChampionshipParticipant::create([
            'championship_id' => $this->championship->id,
            'user_id' => $player5->id,
            'registration_date' => now(),
            'is_paid' => true,
        ]);

        // Create matches with one bye
        ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player1->id,
            'player2_id' => $this->player2->id,
            'round_number' => 1,
            'status_id' => MatchStatusEnum::COMPLETED->getId(),
            'result_id' => ResultTypeEnum::WHITE_WINS->getId(),
        ]);

        ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $this->player3->id,
            'player2_id' => $this->player4->id,
            'round_number' => 1,
            'status_id' => MatchStatusEnum::COMPLETED->getId(),
            'result_id' => ResultTypeEnum::DRAW->getId(),
        ]);

        // Player 5 gets bye
        ChampionshipMatch::factory()->create([
            'championship_id' => $this->championship->id,
            'player1_id' => $player5->id,
            'player2_id' => null,
            'round_number' => 1,
            'status_id' => MatchStatusEnum::COMPLETED->getId(),
            'result_id' => ResultTypeEnum::WHITE_WINS->getId(), // Bye = win
        ]);

        $this->service->progressToNextRound($this->championship, 1);

        $standings = ChampionshipStanding::where('championship_id', $this->championship->id)
            ->where('user_id', $player5->id)
            ->first();

        $this->assertNotNull($standings);
        $this->assertEquals(1.0, $standings->score); // Bye should count as 1 point
    }
}
