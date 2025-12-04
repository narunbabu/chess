<?php

namespace App\Console\Commands;

use App\Models\Championship;
use App\Services\StandingsCalculatorService;
use Illuminate\Console\Command;

class RecalculateStandings extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'championship:recalculate-standings {championship_id}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Recalculate standings for a championship from scratch';

    /**
     * Execute the console command.
     */
    public function handle(StandingsCalculatorService $calculator): int
    {
        $championshipId = $this->argument('championship_id');
        $championship = Championship::find($championshipId);

        if (!$championship) {
            $this->error("Championship {$championshipId} not found");
            return 1;
        }

        $this->info("📊 Recalculating standings for Championship #{$championshipId}: {$championship->name}");
        $this->newLine();

        // Show current standings before recalculation
        $this->info("Current Standings (Before Recalculation):");
        $this->displayStandings($championship);
        $this->newLine();

        // Recalculate
        $calculator->recalculateAllStandings($championship);

        $this->info("✅ Standings recalculated successfully!");
        $this->newLine();

        // Show updated standings
        $this->info("Updated Standings (After Recalculation):");
        $this->displayStandings($championship);

        return 0;
    }

    /**
     * Display standings in a table
     */
    private function displayStandings(Championship $championship): void
    {
        $standings = $championship->standings()
            ->with('user')
            ->orderByDesc('points')
            ->orderByDesc('buchholz_score')
            ->orderByDesc('sonneborn_berger')
            ->orderByRaw('(SELECT rating FROM users WHERE users.id = championship_standings.user_id) DESC')
            ->get();

        if ($standings->isEmpty()) {
            $this->warn("No standings found");
            return;
        }

        $this->table(
            ['Rank', 'Player', 'Rating', 'Points', 'W-L-D', 'Matches', 'Buchholz', 'SB'],
            $standings->map(function($standing) {
                return [
                    $standing->rank ?? '-',
                    $standing->user->name,
                    $standing->user->rating ?? 1200,
                    $standing->points,
                    "{$standing->wins}-{$standing->losses}-{$standing->draws}",
                    $standing->matches_played,
                    round($standing->buchholz_score, 2),
                    round($standing->sonneborn_berger, 2),
                ];
            })
        );
    }
}
