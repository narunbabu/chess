<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Championship;
use App\Models\User;
use App\Services\SwissPairingService;
use App\Services\StandingsCalculatorService;
use Illuminate\Support\Facades\DB;
use App\Enums\PaymentStatus;
use App\Enums\ChampionshipMatchStatus;
use App\Enums\ChampionshipResultType;

class TestByeValidationFix extends Command
{
    protected $signature = 'test:validation-fix';
    protected $description = 'Test BYE validation fix for Swiss tournaments';

    public function handle()
    {
        $this->info("🧪 Testing BYE Validation Fix");
        $this->info("==============================");
        $this->line("");

        DB::beginTransaction();

        try {
            // Create a fresh 5-player tournament
            $championship = Championship::create([
                'title' => 'BYE VALIDATION TEST - 5 Player Tournament',
                'format' => 'swiss_elimination',
                'status' => 'registration_open',
                'swiss_rounds' => 3,
                'time_control_minutes' => 10,
                'time_control_increment' => 0,
                'match_time_window_hours' => 24,
                'color_assignment_method' => 'balanced',
                'bye_points' => 1,
                'is_test_tournament' => true,
                'organization_id' => 1,
                'created_by' => 1,
                'registration_deadline' => now()->addDays(7),
                'starts_at' => now()->addDays(1),
                'total_rounds' => 5,
            ]);

            $this->info("✅ Created test tournament: {$championship->title}");

            // Create 5 test users with different ratings
            $users = [];
            $playerData = [
                ['name' => 'Player A', 'rating' => 1600],
                ['name' => 'Player B', 'rating' => 1500],
                ['name' => 'Player C', 'rating' => 1400],
                ['name' => 'Player D', 'rating' => 1300],
                ['name' => 'Player E', 'rating' => 1200],
            ];

            foreach ($playerData as $i => $data) {
                $user = User::create([
                    'name' => $data['name'],
                    'email' => "validation_test_" . ($i + 1) . "_" . time() . "@example.com",
                    'rating' => $data['rating'],
                    'is_active' => true,
                ]);
                $users[] = $user;

                // Register as participant
                $championship->participants()->create([
                    'user_id' => $user->id,
                    'payment_status_id' => PaymentStatus::COMPLETED->getId(),
                    'registration_date' => now(),
                ]);
            }

            $this->info("✅ Created 5 test participants");

            // Initialize standings
            $standingsService = new StandingsCalculatorService();
            $standingsService->initializeStandings($championship);

            // Test Round 1 pairing
            $this->line("");
            $this->info("🔄 Testing Round 1 Pairing");
            $swissService = new SwissPairingService();

            $pairings1 = $swissService->generatePairings($championship, 1);
            $this->line("   Round 1: Generated " . count($pairings1) . " pairings");

            $matches1 = $swissService->createMatches($championship, $pairings1, 1);
            $this->line("   Round 1: Created " . $matches1->count() . " matches");

            // Show BYE for Round 1
            $byeMatch1 = $championship->matches()
                ->where('round_number', 1)
                ->whereNull('player2_id')
                ->first();

            if ($byeMatch1) {
                $byeUser1 = User::find($byeMatch1->player1_id);
                $this->info("   Round 1 BYE: {$byeUser1->name} ({$byeUser1->rating})");
            }

            // Complete Round 1 matches with realistic results
            $this->completeMatches($championship, 1);

            // Update standings
            $standingsService->updateStandings($championship);

            // Show standings after Round 1
            $this->showStandings($championship, 1);

            // Test Round 2 pairing (this was failing before)
            $this->line("");
            $this->info("🔄 Testing Round 2 Pairing (Critical Test)");

            try {
                $pairings2 = $swissService->generatePairings($championship, 2);
                $this->line("   Round 2: Generated " . count($pairings2) . " pairings");

                $matches2 = $swissService->createMatches($championship, $pairings2, 2);
                $this->line("   Round 2: Created " . $matches2->count() . " matches");

                // Show BYE for Round 2
                $byeMatch2 = $championship->matches()
                    ->where('round_number', 2)
                    ->whereNull('player2_id')
                    ->first();

                if ($byeMatch2) {
                    $byeUser2 = User::find($byeMatch2->player1_id);
                    $this->info("   Round 2 BYE: {$byeUser2->name} ({$byeUser2->rating})");
                }

                $this->info("   ✅ Round 2 pairing successful - validation fix working!");

                // Complete Round 2 matches
                $this->completeMatches($championship, 2);
                $standingsService->updateStandings($championship);
                $this->showStandings($championship, 2);

            } catch (\Exception $e) {
                $this->error("   ❌ Round 2 pairing failed: " . $e->getMessage());
                throw $e;
            }

            // Test Round 3 pairing
            $this->line("");
            $this->info("🔄 Testing Round 3 Pairing");

            try {
                $pairings3 = $swissService->generatePairings($championship, 3);
                $this->line("   Round 3: Generated " . count($pairings3) . " pairings");

                $matches3 = $swissService->createMatches($championship, $pairings3, 3);
                $this->line("   Round 3: Created " . $matches3->count() . " matches");

                // Show BYE for Round 3
                $byeMatch3 = $championship->matches()
                    ->where('round_number', 3)
                    ->whereNull('player2_id')
                    ->first();

                if ($byeMatch3) {
                    $byeUser3 = User::find($byeMatch3->player1_id);
                    $this->info("   Round 3 BYE: {$byeUser3->name} ({$byeUser3->rating})");
                }

                $this->info("   ✅ Round 3 pairing successful!");

            } catch (\Exception $e) {
                $this->error("   ❌ Round 3 pairing failed: " . $e->getMessage());
                throw $e;
            }

            // Final BYE analysis
            $this->line("");
            $this->info("📊 Final BYE Distribution Analysis:");
            $this->line("==================================");

            $byeDistribution = [];
            foreach ($users as $user) {
                $byeCount = $championship->matches()
                    ->whereNull('player2_id')
                    ->where('player1_id', $user->id)
                    ->count();

                $byeDistribution[] = [
                    'name' => $user->name,
                    'byes' => $byeCount
                ];
            }

            usort($byeDistribution, fn($a, $b) => $a['byes'] <=> $b['byes']);

            $allFair = true;
            foreach ($byeDistribution as $player) {
                $status = $player['byes'] > 1 ? '❌' : '✅';
                $this->line("   {$status} {$player['name']}: {$player['byes']} BYE(s)");
                if ($player['byes'] > 1) {
                    $allFair = false;
                }
            }

            $this->line("");
            if ($allFair) {
                $this->info("🎉 SUCCESS: BYE distribution is FAIR and validation fix works!");
                $this->info("   Each player got at most 1 BYE across all rounds");
                $this->info("   All rounds paired successfully without validation errors");
            } else {
                $this->error("❌ FAILED: BYE distribution violates Swiss rules");
                $this->error("   Some players received multiple BYEs");
            }

            DB::rollBack(); // Clean up test data
            $this->line("");
            $this->info("🧹 Test completed and cleaned up");

            return $allFair ? 0 : 1;

        } catch (\Exception $e) {
            DB::rollBack();
            $this->error("❌ Test failed: " . $e->getMessage());
            return 1;
        }
    }

    private function completeMatches(Championship $championship, int $roundNumber): void
    {
        $matches = $championship->matches()
            ->where('round_number', $roundNumber)
            ->whereNotNull('player1_id')
            ->whereNotNull('player2_id')
            ->get();

        foreach ($matches as $match) {
            // Simulate realistic results: higher rating usually wins
            $player1 = User::find($match->player1_id);
            $player2 = User::find($match->player2_id);

            $ratingDiff = ($player1->rating ?? 1200) - ($player2->rating ?? 1200);
            $winProbability = 0.5 + ($ratingDiff / 1000); // Rough estimate
            $winProbability = max(0.2, min(0.8, $winProbability)); // Clamp between 20%-80%

            $isDraw = rand(1, 100) <= 20; // 20% draw chance
            $player1Wins = !$isDraw && rand(1, 100) <= ($winProbability * 100);

            if ($isDraw) {
                $winnerId = null;
                $resultType = 'draw';
            } else {
                $winnerId = $player1Wins ? $match->player1_id : $match->player2_id;
                $resultType = 'win';
            }

            $match->update([
                'status_id' => ChampionshipMatchStatus::COMPLETED->getId(),
                'winner_id' => $winnerId,
                'result_type' => $resultType,
                'completed_at' => now(),
            ]);
        }
    }

    private function showStandings(Championship $championship, int $roundNumber): void
    {
        $standings = $championship->standings()
            ->with('user')
            ->orderBy('points', 'desc')
            ->get();

        $this->line("   Standings after Round {$roundNumber}:");
        foreach ($standings as $i => $standing) {
            $rank = $i + 1;
            $this->line("      {$rank}. {$standing->user->name}: {$standing->points} points");
        }
    }
}