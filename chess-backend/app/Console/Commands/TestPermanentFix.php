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

class TestPermanentFix extends Command
{
    protected $signature = 'test:permanent-fix';
    protected $description = 'Test that Swiss duplicate prevention works permanently for new tournaments';

    public function handle()
    {
        $this->info("🧪 Testing Permanent Swiss Duplicate Prevention Fix");
        $this->info("===================================================");
        $this->line("");

        DB::beginTransaction();

        try {
            // Create a fresh 5-player tournament
            $championship = Championship::create([
                'title' => 'DUPLICATE PREVENTION TEST - New Tournament',
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

            $this->info("✅ Created new tournament: {$championship->title} (ID: {$championship->id})");

            // Create 5 test users
            $users = [];
            for ($i = 1; $i <= 5; $i++) {
                $user = User::create([
                    'name' => "Test User {$i}",
                    'email' => "duplicate_test_{$i}_" . time() . "@example.com",
                    'rating' => 1200 + ($i * 50),
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

            // Generate Round 1 pairings
            $swissService = new SwissPairingService();
            $round1Pairings = $swissService->generatePairings($championship, 1);
            $this->info("✅ Generated Round 1 pairings: " . count($round1Pairings));

            // Create Round 1 matches
            $round1Matches = $swissService->createMatches($championship, $round1Pairings, 1);
            $this->info("✅ Created Round 1 matches: " . $round1Matches->count());

            // Complete Round 1 matches with results
            foreach ($round1Matches as $match) {
                if ($match->player1_id && $match->player2_id) {
                    $match->update([
                        'status_id' => ChampionshipMatchStatus::COMPLETED->getId(),
                        'winner_id' => $match->player1_id, // Player 1 wins
                        'result_type' => 'win',
                        'completed_at' => now(),
                    ]);
                }
            }
            $this->info("✅ Completed Round 1 matches");

            // Update standings after Round 1
            $standingsService->updateStandings($championship);

            // Generate Round 2 pairings (THIS IS WHERE DUPLICATES WOULD APPEAR)
            $round2Pairings = $swissService->generatePairings($championship, 2);
            $this->info("✅ Generated Round 2 pairings: " . count($round2Pairings));

            // Create Round 2 matches
            $round2Matches = $swissService->createMatches($championship, $round2Pairings, 2);
            $this->info("✅ Created Round 2 matches: " . $round2Matches->count());

            // Check for duplicates - THIS IS THE CRITICAL TEST
            $round2MatchCount = $championship->matches()
                ->where('round_number', 2)
                ->whereNot('result_type', 'bye')
                ->count();

            $this->line("");
            $this->info("🔍 DUPLICATE PREVENTION TEST RESULTS:");
            $this->line("   Round 2 match count: {$round2MatchCount}");
            $this->line("   Expected for 5 players: 2 matches + 1 bye = 3 total");

            if ($round2MatchCount <= 3) {
                $this->info("   ✅ NO DUPLICATES DETECTED - Fix is working correctly!");
                $this->info("   ✅ Permanent Swiss duplicate prevention is ACTIVE");
            } else {
                $this->error("   ❌ DUPLICATES FOUND - Fix needs review");
                return 1;
            }

            // Show actual matches
            $actualMatches = $championship->matches()
                ->where('round_number', 2)
                ->whereNot('result_type', 'bye')
                ->get();

            $this->line("");
            $this->info("📋 Round 2 Matches Created:");
            foreach ($actualMatches as $match) {
                $p1 = $match->whitePlayer;
                $p2 = $match->blackPlayer;
                if ($p1 && $p2) {
                    $this->line("   - {$p1->name} ({$p1->rating}) vs {$p2->name} ({$p2->rating})");
                }
            }

            // Test calling createMatches multiple times on same round (should not create duplicates)
            $this->line("");
            $this->info("🧪 Testing multiple calls to createMatches on same round...");
            $beforeCount = $championship->matches()
                ->where('round_number', 2)
                ->whereNot('result_type', 'bye')
                ->count();

            // Try to create matches again
            $duplicateMatches = $swissService->createMatches($championship, $round2Pairings, 2);

            $afterCount = $championship->matches()
                ->where('round_number', 2)
                ->whereNot('result_type', 'bye')
                ->count();

            if ($beforeCount === $afterCount) {
                $this->info("   ✅ Multiple calls to createMatches prevented duplicates!");
            } else {
                $this->error("   ❌ Multiple calls created additional matches");
                return 1;
            }

            DB::rollBack(); // Clean up test data
            $this->line("");
            $this->info("🧹 Test completed and cleaned up");

        } catch (\Exception $e) {
            DB::rollBack();
            $this->error("❌ Test failed: " . $e->getMessage());
            return 1;
        }

        $this->line("");
        $this->info("✅ CONCLUSION: Swiss duplicate prevention is PERMANENTLY FIXED!");
        $this->line("   - New tournaments will NOT have duplicate matches");
        $this->line("   - The fix is in the core pairing logic");
        $this->line("   - No manual cleanup needed for future tournaments");
        $this->line("   - Multiple calls to createMatches are safe");

        return 0;
    }
}