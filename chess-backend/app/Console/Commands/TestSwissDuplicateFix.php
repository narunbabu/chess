<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\SwissPairingService;
use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\User;

class TestSwissDuplicateFix extends Command
{
    protected $signature = 'test:swiss-duplicate-fix {championship_id=87}';
    protected $description = 'Test Swiss duplicate prevention fix';

    public function handle()
    {
        $this->info("Testing Swiss Duplicate Prevention Fix");
        $this->info("=====================================");
        $this->line("");

        $championshipId = $this->argument('championship_id');
        $championship = Championship::find($championshipId);

        if (!$championship) {
            $this->error("❌ Test tournament not found (ID: {$championshipId})");
            return 1;
        }

        $this->info("✅ Found tournament: {$championship->name}");
        $this->line("   Format: {$championship->format}");
        $this->line("   Status: {$championship->status}");
        $this->line("");

        // Check existing matches
        $round1Matches = $championship->matches()
            ->where('round_number', 1)
            ->whereNot('result_type', 'bye')
            ->get();

        $round2Matches = $championship->matches()
            ->where('round_number', 2)
            ->whereNot('result_type', 'bye')
            ->get();

        $this->info("📊 Current match counts:");
        $this->line("   Round 1: {$round1Matches->count()} matches");
        $this->line("   Round 2: {$round2Matches->count()} matches");
        $this->line("");

        // Show Round 2 matches to verify duplicates
        if ($round2Matches->count() > 0) {
            $this->info("🔍 Round 2 matches (checking for duplicates):");
            foreach ($round2Matches as $match) {
                $player1 = $match->whitePlayer;
                $player2 = $match->blackPlayer;
                $this->line("   - {$player1->name} ({$player1->rating}) vs {$player2->name} ({$player2->rating}) [Match ID: {$match->id}]");
            }
            $this->line("");
        }

        // Test the haveAlreadyPlayed method
        $swissService = new SwissPairingService();

        // Test players C vs A (from Round 2 duplicates)
        $playerC = User::where('email', 'test_visualizer_87_3@example.com')->first();
        $playerA = User::where('email', 'test_visualizer_87_1@example.com')->first();

        if ($playerC && $playerA) {
            $this->info("🧪 Testing duplicate detection:");
            $this->line("");

            // Use reflection to test private method
            $reflection = new \ReflectionClass($swissService);
            $method = $reflection->getMethod('haveAlreadyPlayed');
            $method->setAccessible(true);

            // Test without round parameter (should check completed matches only)
            $hasPlayedCompleted = $method->invoke($swissService, $championship, $playerC->id, $playerA->id);
            $this->line("   - Have they completed any match? " . ($hasPlayedCompleted ? 'YES' : 'NO'));

            // Test with round 2 parameter (should detect current round duplicates)
            $hasPlayedInRound2 = $method->invoke($swissService, $championship, $playerC->id, $playerA->id, 2);
            $this->line("   - Are they paired in Round 2? " . ($hasPlayedInRound2 ? 'YES' : 'NO'));

            if ($hasPlayedInRound2) {
                $this->info("   ✅ Duplicate detection is WORKING correctly!");
            } else {
                $this->error("   ❌ Duplicate detection is NOT working");
            }
        }

        $this->line("");
        $this->info("📋 Summary:");
        $this->line("   The fix should prevent creating duplicate matches in the same round.");
        $this->line("   If Round 2 shows duplicates above, they were created before the fix.");

        if ($round2Matches->count() > 2) {
            $this->line("");
            $this->warn("⚠️  Round 2 has more than expected matches (duplicates detected)");
            $this->line("   To clear duplicates: php artisan test:clear-duplicates {$championshipId}");
        }

        return 0;
    }
}