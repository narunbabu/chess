<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\User;

class ClearByeDuplicates extends Command
{
    protected $signature = 'test:clear-bye-duplicates {championship_id=87} {--force}';
    protected $description = 'Clear duplicate BYE matches from tournament rounds';

    public function handle()
    {
        $championshipId = $this->argument('championship_id');
        $championship = Championship::find($championshipId);

        if (!$championship) {
            $this->error("❌ Championship not found (ID: {$championshipId})");
            return 1;
        }

        $this->info("🧹 Clearing BYE Duplicates for: {$championship->name}");
        $this->line("");

        // Find all BYE matches
        $byeMatches = $championship->matches()
            ->whereNull('player2_id')
            ->orderBy('round_number')
            ->orderBy('id')
            ->get()
            ->groupBy(function ($match) {
                return $match->round_number . '_' . $match->player1_id;
            });

        $duplicatesFound = false;
        $totalDeleted = 0;

        foreach ($byeMatches as $key => $matches) {
            if ($matches->count() > 1) {
                $duplicatesFound = true;
                $player = User::find($matches->first()->player1_id);
                $roundNumber = $matches->first()->round_number;

                $this->warn("⚠️  Found " . $matches->count() . " BYEs for {$player->name} in Round {$roundNumber}");

                if (!$this->option('force')) {
                    $continue = $this->confirm("Delete " . ($matches->count() - 1) . " duplicate BYEs?");
                    if (!$continue) {
                        continue;
                    }
                }

                // Keep the first BYE, delete the rest
                $toDelete = $matches->slice(1);
                foreach ($toDelete as $match) {
                    $this->line("   Deleting duplicate BYE ID: {$match->id}");
                    $match->delete();
                    $totalDeleted++;
                }
            }
        }

        if (!$duplicatesFound) {
            $this->info("✅ No duplicate BYEs found");
        } else {
            $this->info("✅ Deleted {$totalDeleted} duplicate BYEs");
        }

        // Show BYE summary after cleanup
        $this->line("");
        $this->info("📊 BYE Summary After Cleanup:");

        for ($round = 1; $round <= 3; $round++) {
            $byeCount = $championship->matches()
                ->where('round_number', $round)
                ->whereNull('player2_id')
                ->count();

            $this->line("   Round {$round}: {$byeCount} BYE(s)");
        }

        // Check if players have multiple BYEs (should not happen after cleanup)
        $playerByes = $championship->matches()
            ->whereNull('player2_id')
            ->get()
            ->groupBy('player1_id')
            ->map(fn($matches) => $matches->count());

        $multiByePlayers = $playerByes->filter(fn($count) => $count > 1);

        if ($multiByePlayers->isNotEmpty()) {
            $this->warn("⚠️  Players still with multiple BYEs:");
            foreach ($multiByePlayers as $playerId => $byeCount) {
                $player = $championship->participants()->where('user_id', $playerId)->first()->user;
                $this->line("   - {$player->name}: {$byeCount} BYEs");
            }
        } else {
            $this->info("✅ No players have multiple BYEs");
        }

        return 0;
    }
}