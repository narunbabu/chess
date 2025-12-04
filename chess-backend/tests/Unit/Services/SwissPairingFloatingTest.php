<?php

namespace Tests\Unit\Services;

use Tests\TestCase;
use App\Services\SwissPairingService;
use App\Models\Championship;
use App\Models\User;
use App\Models\ChampionshipParticipant;
use App\Models\ChampionshipStanding;
use App\Models\ChampionshipStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;

class SwissPairingFloatingTest extends TestCase
{
    use RefreshDatabase;

    /** @test */
    public function it_pairs_all_players_in_round_3_with_floating()
    {
        // Create championship
        $championship = Championship::create([
            'title' => 'Test Swiss Championship',
            'format_id' => 1, // Swiss format
            'status_id' => ChampionshipStatus::where('code', 'in_progress')->first()->id,
            'match_time_window_hours' => 24,
            'registration_deadline' => now()->addDays(7),
        ]);

        // Create 10 test users
        $users = User::factory()->count(10)->create();

        // Add users as participants
        foreach ($users as $user) {
            ChampionshipParticipant::create([
                'championship_id' => $championship->id,
                'user_id' => $user->id,
            ]);
        }

        // Create standings that will create odd-sized groups
        // Score distribution:
        // - 3 players with 2 points (won both rounds)
        // - 4 players with 1 point (1 win, 1 loss)
        // - 3 players with 0 points (lost both rounds)
        $scores = [2, 2, 2, 1, 1, 1, 1, 0, 0, 0];

        foreach ($users as $index => $user) {
            ChampionshipStanding::create([
                'championship_id' => $championship->id,
                'user_id' => $user->id,
                'points' => $scores[$index],
                'matches_played' => 2,
                'wins' => $scores[$index],
                'losses' => 2 - $scores[$index],
                'draws' => 0,
                'buchholz_score' => 0,
                'sonneborn_berger' => 0,
            ]);
        }

        // Generate Round 3 pairings
        $service = new SwissPairingService();
        $pairings = $service->generatePairings($championship, 3);

        // Verify all 10 players are paired
        $pairedIds = [];
        $byeCount = 0;

        foreach ($pairings as $pairing) {
            if (isset($pairing['is_bye']) && $pairing['is_bye']) {
                $pairedIds[] = $pairing['player1_id'];
                $byeCount++;
            } else {
                $pairedIds[] = $pairing['player1_id'];
                $pairedIds[] = $pairing['player2_id'];
            }
        }

        $this->assertCount(10, array_unique($pairedIds), "All 10 players must be paired");
        $this->assertGreaterThanOrEqual(4, count($pairings), "Should create at least 4 pairings for 10 players");
        $this->assertLessThanOrEqual(5, count($pairings), "Should create at most 5 pairings for 10 players");

        // Log the pairing results for debugging
        \Log::info("Swiss floating test results", [
            'pairings_count' => count($pairings),
            'bye_count' => $byeCount,
            'players_paired' => count(array_unique($pairedIds)),
            'expected_players' => 10,
        ]);
    }

    /** @test */
    public function it_handles_even_number_of_participants_without_bye()
    {
        // Create championship
        $championship = Championship::create([
            'title' => 'Test Even Championship',
            'format_id' => 1, // Swiss format
            'status_id' => ChampionshipStatus::where('code', 'in_progress')->first()->id,
            'match_time_window_hours' => 24,
            'registration_deadline' => now()->addDays(7),
        ]);

        // Create 8 test users (even number)
        $users = User::factory()->count(8)->create();

        // Add users as participants
        foreach ($users as $user) {
            ChampionshipParticipant::create([
                'championship_id' => $championship->id,
                'user_id' => $user->id,
            ]);
        }

        // Create even-sized score groups
        $scores = [2, 2, 1, 1, 1, 1, 0, 0];

        foreach ($users as $index => $user) {
            ChampionshipStanding::create([
                'championship_id' => $championship->id,
                'user_id' => $user->id,
                'points' => $scores[$index],
                'matches_played' => 2,
                'wins' => $scores[$index],
                'losses' => 2 - $scores[$index],
                'draws' => 0,
                'buchholz_score' => 0,
                'sonneborn_berger' => 0,
            ]);
        }

        // Generate pairings
        $service = new SwissPairingService();
        $pairings = $service->generatePairings($championship, 3);

        // Verify all 8 players are paired in 4 matches, no BYEs
        $pairedIds = [];
        $byeCount = 0;

        foreach ($pairings as $pairing) {
            if (isset($pairing['is_bye']) && $pairing['is_bye']) {
                $pairedIds[] = $pairing['player1_id'];
                $byeCount++;
            } else {
                $pairedIds[] = $pairing['player1_id'];
                $pairedIds[] = $pairing['player2_id'];
            }
        }

        $this->assertCount(8, array_unique($pairedIds), "All 8 players must be paired");
        $this->assertCount(4, $pairings, "Should create exactly 4 matches for 8 players");
        $this->assertEquals(0, $byeCount, "No BYEs should be assigned with even number of players");
    }

    /** @test */
    public function it_throws_exception_when_not_all_players_are_paired()
    {
        // This test verifies our validation safety net works
        $this->expectException(\Exception::class);
        $this->expectExceptionMessageMatches('/Swiss Pairing Validation Failed/');

        // Create a mock scenario where validation would fail
        // We'll use reflection to call the validation method directly with invalid data
        $service = new SwissPairingService();
        $reflection = new \ReflectionClass($service);
        $method = $reflection->getMethod('validatePairingCompleteness');
        $method->setAccessible(true);

        $championship = Championship::create([
            'title' => 'Test Validation',
            'format_id' => 1,
            'status_id' => ChampionshipStatus::where('code', 'in_progress')->first()->id,
            'registration_deadline' => now()->addDays(7),
        ]);

        // Create users and participants
        $users = User::factory()->count(10)->create();
        $participants = collect();

        foreach ($users as $user) {
            $participant = new \stdClass();
            $participant->user_id = $user->id;
            $participants->push($participant);
        }

        // Create invalid pairings (only pair 8 out of 10 players)
        $invalidPairings = [
            ['player1_id' => 1, 'player2_id' => 2],
            ['player1_id' => 3, 'player2_id' => 4],
            ['player1_id' => 5, 'player2_id' => 6],
            ['player1_id' => 7, 'player2_id' => 8],
            // Players 9 and 10 are missing
        ];

        // This should throw an exception
        $method->invoke($service, $participants, $invalidPairings, $championship, 1);
    }
}