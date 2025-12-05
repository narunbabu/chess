<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Championship;
use App\Models\ChampionshipMatch;

class ClearSwissDuplicates extends Command
{
    protected $signature = 'test:clear-duplicates {championship_id} {--force}';
    protected $description = 'Clear duplicate Swiss matches from a round';

    public function handle()
    {
        $championshipId = $this->argument('championship_id');
        $championship = Championship::find($championshipId);

        if (!$championship) {
            $this->error("❌ Championship not found (ID: {$championshipId})");
            return 1;
        }

        $this->info("Clearing duplicates for: {$championship->name}");
        $this->line("");

        // Find rounds with duplicates
        $roundsWithMatches = $championship->matches()
            ->whereNot('result_type', 'bye')
            ->selectRaw('round_number, COUNT(*) as match_count')
            ->groupBy('round_number')
            ->havingRaw('COUNT(*) > 2') // More than 2 matches for 5 players indicates duplicates
            ->get();

        if ($roundsWithMatches->isEmpty()) {
            $this->info("✅ No duplicate rounds found");
            return 0;
        }

        foreach ($roundsWithMatches as $round) {
            $this->warn("⚠️  Round {$round->round_number} has {$round->match_count} matches (should be 2)");

            if (!$this->option('force')) {
                $continue = $this->confirm("Do you want to clear duplicates from Round {$round->round_number}?");
                if (!$continue) {
                    continue;
                }
            }

            // Get all matches in this round
            $matches = $championship->matches()
                ->where('round_number', $round->round_number)
                ->whereNot('result_type', 'bye')
                ->get()
                ->groupBy(function ($match) {
                    // Group by player pair (regardless of color)
                    $players = [$match->player1_id, $match->player2_id];
                    sort($players);
                    return implode('_', $players);
                });

            $deletedCount = 0;
            foreach ($matches as $pairing => $pairMatches) {
                if ($pairMatches->count() > 1) {
                    // Keep the first match, delete the rest
                    $toDelete = $pairMatches->slice(1);
                    foreach ($toDelete as $match) {
                        $this->line("   Deleting duplicate match ID: {$match->id}");
                        $match->delete();
                        $deletedCount++;
                    }
                }
            }

            $this->info("   ✅ Deleted {$deletedCount} duplicate matches from Round {$round->round_number}");
        }

        $this->line("");
        $this->info("🎉 Cleanup completed! You can now regenerate Round 2 pairings.");

        return 0;
    }
}