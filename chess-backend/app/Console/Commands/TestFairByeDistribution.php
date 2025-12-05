<?php

namespace App\Console\Commands;

use App\Models\Championship;
use App\Models\User;
use App\Services\ChampionshipRoundProgressionService;
use App\Services\SwissPairingService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class TestFairByeDistribution extends Command
{
    protected $signature = 'test:fair-bye-distribution';
    protected $description = 'Test fair BYE distribution in Swiss tournaments';

    public function handle()
    {
        $this->info("🧪 Testing Fair BYE Distribution in Swiss Tournaments");
        $this->info("================================================\n");

        try {
            DB::beginTransaction();

            // Create test championship
            $creator = User::first();
            if (!$creator) {
                $this->error("No users found in database. Please create a user first.");
                return 1;
            }

            $championship = Championship::create([
                'title' => 'BYE Distribution Test Tournament',
                'description' => 'Testing fair BYE distribution',
                'format' => 'swiss',
                'created_by' => $creator->id,
                'start_date' => now()->addDay(),
                'end_date' => now()->addDays(7),
                'max_participants' => 10,
                'registration_start' => now(),
                'registration_end' => now()->addDay(),
                'entry_fee' => 0,
                'max_rounds' => 3,
                'status' => 'active',
                'visibility' => 'public',
                'match_time_window_hours' => 24,
            ]);

            $this->info("✅ Created championship: {$championship->title} (ID: {$championship->id})");

            // Create 5 test players with different ratings
            $players = [
                ['name' => 'High Rated Player', 'rating' => 1500],
                ['name' => 'Medium-High Player', 'rating' => 1450],
                ['name' => 'Medium Player', 'rating' => 1400],
                ['name' => 'Medium-Low Player', 'rating' => 1350],
                ['name' => 'Low Rated Player', 'rating' => 1300], // This player was getting all BYEs before fix
            ];

            foreach ($players as $index => $playerData) {
                $user = User::create([
                    'name' => $playerData['name'],
                    'email' => 'test_bye_' . ($index + 1) . '@example.com',
                    'password' => bcrypt('password'),
                    'rating' => $playerData['rating'],
                ]);

                $championship->participants()->create([
                    'user_id' => $user->id,
                    'status' => 'approved',
                    'payment_status' => 'paid',
                    'joined_at' => now(),
                ]);

                $this->info("✅ Added player: {$playerData['name']} (Rating: {$playerData['rating']})");
            }

            $this->info("\n📊 Simulating 3 rounds of Swiss pairings...\n");

            $swissService = app(SwissPairingService::class);
            $progressionService = app(ChampionshipRoundProgressionService::class);

            // Track BYE recipients
            $byeRecipients = [];

            // Round 1
            $this->info("=== Round 1 ===");
            $pairings = $swissService->generatePairings($championship, 1);
            $swissService->createMatches($championship, $pairings, 1);

            $byeMatch = $championship->matches()->where('round_number', 1)->whereNull('player2_id')->first();
            if ($byeMatch) {
                $byePlayer = User::find($byeMatch->player1_id);
                $byeRecipients[1] = $byePlayer->name . " (Rating: {$byePlayer->rating})";
                $this->info("🎯 BYE: {$byePlayer->name} (Rating: {$byePlayer->rating})");
            }

            // Simulate match completions
            $this->simulateMatchCompletions($championship, 1);
            $progressionService->progressToNextRound($championship);

            // Round 2
            $this->info("\n=== Round 2 ===");
            $pairings = $swissService->generatePairings($championship, 2);
            $swissService->createMatches($championship, $pairings, 2);

            $byeMatch = $championship->matches()->where('round_number', 2)->whereNull('player2_id')->first();
            if ($byeMatch) {
                $byePlayer = User::find($byeMatch->player1_id);
                $byeRecipients[2] = $byePlayer->name . " (Rating: {$byePlayer->rating})";
                $this->info("🎯 BYE: {$byePlayer->name} (Rating: {$byePlayer->rating})");
            }

            // Simulate match completions
            $this->simulateMatchCompletions($championship, 2);
            $progressionService->progressToNextRound($championship);

            // Round 3
            $this->info("\n=== Round 3 ===");
            $pairings = $swissService->generatePairings($championship, 3);
            $swissService->createMatches($championship, $pairings, 3);

            $byeMatch = $championship->matches()->where('round_number', 3)->whereNull('player2_id')->first();
            if ($byeMatch) {
                $byePlayer = User::find($byeMatch->player1_id);
                $byeRecipients[3] = $byePlayer->name . " (Rating: {$byePlayer->rating})";
                $this->info("🎯 BYE: {$byePlayer->name} (Rating: {$byePlayer->rating})");
            }

            // Verify BYE distribution
            $this->info("\n📊 BYE Distribution Summary:");
            $this->info("============================");
            foreach ($byeRecipients as $round => $recipient) {
                $this->info("Round $round: $recipient");
            }

            // Check if all BYE recipients are different
            $uniqueRecipients = array_unique($byeRecipients);
            if (count($uniqueRecipients) === count($byeRecipients)) {
                $this->info("\n✅ SUCCESS: All BYE recipients are different!");
                $this->info("✅ Fair BYE distribution is working correctly!");
            } else {
                $this->error("\n❌ FAIL: Some players received multiple BYEs!");
                $this->error("This indicates the fix is not working properly.");
            }

            DB::rollBack();
            $this->info("\n✅ Test completed (database changes rolled back)");

            return 0;

        } catch (\Exception $e) {
            DB::rollBack();
            $this->error("\n❌ Test failed with error: " . $e->getMessage());
            $this->error("Stack trace:\n" . $e->getTraceAsString());
            return 1;
        }
    }

    private function simulateMatchCompletions(Championship $championship, int $roundNumber)
    {
        $matches = $championship->matches()
            ->where('round_number', $roundNumber)
            ->whereNotNull('player2_id') // Regular matches only
            ->get();

        foreach ($matches as $match) {
            // Randomly assign winner
            $match->update([
                'status' => 'completed',
                'winner_id' => rand(0, 1) ? $match->player1_id : $match->player2_id,
                'completed_at' => now(),
            ]);
        }

        $this->info("✅ Completed " . $matches->count() . " matches in Round $roundNumber");
    }
}
