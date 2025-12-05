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

class TestFairBye extends Command
{
    protected $signature = 'test:fair-bye';
    protected $description = 'Test fair BYE distribution in Swiss tournaments';

    public function handle()
    {
        $this->info("🧪 Testing Fair BYE Distribution");
        $this->info("==============================");
        $this->line("");

        DB::beginTransaction();

        try {
            // Create a fresh 5-player tournament
            $championship = Championship::create([
                'title' => 'FAIR BYE TEST - 5 Player Tournament',
                'format' => 'swiss_elimination',
                'status' => 'registration_open',
                'swiss_rounds' => 3,
                'time_control_minutes' => 10,
                'time_control_increment' => 0,
                'match_time_window_hours' => 24,
                'color_assignment_method' => 'balanced',
                'bye_points' => 1,
                'is_test_tournament' => true,
                'organization_id' => 2,
                'created_by' => 2,
                'registration_deadline' => now()->addDays(7),
                'starts_at' => now()->addDays(1),
                'total_rounds' => 5,
            ]);

            $this->info("✅ Created test tournament: {$championship->title}");

            // Create 5 test users with different ratings
            $users = [];
            $playerData = [
                ['name' => 'Player Alpha', 'rating' => 1600],
                ['name' => 'Player Beta', 'rating' => 1500],
                ['name' => 'Player Gamma', 'rating' => 1400],
                ['name' => 'Player Delta', 'rating' => 1300],
                ['name' => 'Player Epsilon', 'rating' => 1200],
            ];

            foreach ($playerData as $i => $data) {
                $user = User::create([
                    'name' => $data['name'],
                    'email' => "fair_bye_test_" . ($i + 1) . "_" . time() . "@example.com",
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

            // Generate Swiss rounds and test BYE fairness
            $swissService = new SwissPairingService();

            for ($round = 1; $round <= 3; $round++) {
                $this->line("");
                $this->info("🔄 Generating Round {$round}");

                $pairings = $swissService->generatePairings($championship, $round);
                $this->line("   Generated " . count($pairings) . " pairings");

                $matches = $swissService->createMatches($championship, $pairings, $round);
                $this->line("   Created " . $matches->count() . " matches");

                // Show BYE for this round
                $byeMatch = $championship->matches()
                    ->where('round_number', $round)
                    ->whereNull('player2_id')
                    ->first();

                if ($byeMatch) {
                    $byeUser = User::find($byeMatch->player1_id);
                    $this->info("   BYE: {$byeUser->name} ({$byeUser->rating})");
                }

                // Complete matches with realistic results
                $this->completeMatches($championship, $round);

                // Update standings
                $standingsService->updateStandings($championship);

                // Show current standings
                $this->showStandings($championship, $round);
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
                $this->info("🎉 SUCCESS: BYE distribution is FAIR and follows Swiss rules!");
                $this->info("   Each player got at most 1 BYE across all rounds");
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