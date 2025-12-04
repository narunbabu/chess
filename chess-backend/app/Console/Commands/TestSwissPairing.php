<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Championship;
use App\Models\User;
use App\Models\ChampionshipMatch;
use App\Services\SwissPairingService;
use Illuminate\Support\Facades\Log;

class TestSwissPairing extends Command
{
    protected $signature = 'test:swiss-pairing {--players=10}';
    protected $description = 'Test Swiss pairing with fixed BYE logic';

    public function handle()
    {
        $playerCount = $this->option('players');

        $this->info("Creating test Swiss tournament with {$playerCount} players...");

        try {
            // Create test championship
            $championship = Championship::create([
                'title' => "[TEST] Swiss Tournament - {$playerCount} Players",
                'format' => 'swiss_only',
                'swiss_rounds' => 3,
                'status_id' => 1, // Active
                'match_time_window_hours' => 24,
                'bye_points' => 1.0,
                'registration_deadline' => now()->addDays(7),
            ]);

            $this->info("✅ Championship created: {$championship->id}");

            // Create test users
            $users = [];
            for ($i = 1; $i <= $playerCount; $i++) {
                $user = User::firstOrCreate([
                    'username' => "TestPlayer{$i}",
                    'email' => "testplayer{$i}@test.com",
                ], [
                    'name' => "Test Player {$i}",
                    'rating' => 1500 - ($i * 50), // Different ratings
                    'password' => bcrypt('password'),
                ]);

                $championship->participants()->create([
                    'user_id' => $user->id,
                    'seeded' => false,
                ]);

                $users[] = $user;
            }

            $this->info("✅ Created {$playerCount} test users");

            // Test Round 1 pairing
            $this->info("\n🎯 Testing Round 1 pairing...");
            $swissService = new SwissPairingService();
            $round1Pairings = $swissService->generatePairings($championship, 1);

            $this->info("Round 1 pairings generated: " . count($round1Pairings));
            foreach ($round1Pairings as $pairing) {
                if (isset($pairing['is_bye']) && $pairing['is_bye']) {
                    $this->line("  BYE: Player {$pairing['player1_id']}");
                } else {
                    $this->line("  Match: Player {$pairing['player1_id']} vs Player {$pairing['player2_id']}");
                }
            }

            // Simulate Round 1 results (alternating wins/losses)
            $this->info("\n🎯 Simulating Round 1 results...");
            foreach ($round1Pairings as $i => $pairing) {
                if (!isset($pairing['is_bye'])) {
                    $winnerId = ($i % 2 === 0) ? $pairing['player1_id'] : $pairing['player2_id'];

                    $match = ChampionshipMatch::create([
                        'championship_id' => $championship->id,
                        'round_number' => 1,
                        'player1_id' => $pairing['player1_id'],
                        'player2_id' => $pairing['player2_id'],
                        'white_player_id' => $pairing['player1_id'],
                        'black_player_id' => $pairing['player2_id'],
                        'winner_id' => $winnerId,
                        'result_type_id' => 1, // WIN
                        'status_id' => 3, // COMPLETED
                    ]);

                    $this->line("  Match: Player {$pairing['player1_id']} vs Player {$pairing['player2_id']} -> Winner: {$winnerId}");
                }
            }

            // Update standings
            $championship->updateStandings();

            // Show current standings
            $this->info("\n📊 Current Standings:");
            $standings = $championship->standings()->orderBy('points', 'desc')->get();
            foreach ($standings as $standing) {
                $user = $users[array_search($standing->user_id, array_column($users, 'id'))];
                $this->line("  {$standing->points} pts: {$user->name} ({$user->rating})");
            }

            // Test Round 2 pairing
            $this->info("\n🎯 Testing Round 2 pairing...");
            $round2Pairings = $swissService->generatePairings($championship, 2);

            $this->info("Round 2 pairings generated: " . count($round2Pairings));
            foreach ($round2Pairings as $pairing) {
                if (isset($pairing['is_bye']) && $pairing['is_bye']) {
                    $this->line("  BYE: Player {$pairing['player1_id']}");
                } else {
                    $this->line("  Match: Player {$pairing['player1_id']} vs Player {$pairing['player2_id']}");
                }
            }

            // Verification
            $pairedPlayers = [];
            foreach ($round2Pairings as $pairing) {
                if (isset($pairing['is_bye']) && $pairing['is_bye']) {
                    $pairedPlayers[] = $pairing['player1_id'];
                } else {
                    $pairedPlayers[] = $pairing['player1_id'];
                    $pairedPlayers[] = $pairing['player2_id'];
                }
            }

            $missingPlayers = array_diff(
                array_column($users, 'id'),
                $pairedPlayers
            );

            if (empty($missingPlayers)) {
                $this->info("✅ SUCCESS: All players are paired in Round 2");
            } else {
                $this->error("❌ FAILURE: Missing players in Round 2: " . implode(', ', $missingPlayers));
            }

            // BYE verification
            $byeCount = count(array_filter($round2Pairings, fn($p) => isset($p['is_bye']) && $p['is_bye']));
            if ($playerCount % 2 === 0) {
                if ($byeCount === 0) {
                    $this->info("✅ SUCCESS: No BYE for even number of players");
                } else {
                    $this->error("❌ FAILURE: {$byeCount} BYE(s) for even number of players");
                }
            } else {
                if ($byeCount === 1) {
                    $this->info("✅ SUCCESS: 1 BYE for odd number of players");
                } else {
                    $this->error("❌ FAILURE: {$byeCount} BYE(s) for odd number of players (should be 1)");
                }
            }

            $this->info("\n📝 Test tournament ID: {$championship->id}");
            $this->info("You can check it in the visualizer.");

            return 0;

        } catch (\Exception $e) {
            $this->error("Test failed: " . $e->getMessage());
            $this->error("Stack trace: " . $e->getTraceAsString());
            return 1;
        }
    }
}