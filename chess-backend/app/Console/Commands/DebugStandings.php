<?php

namespace App\Console\Commands;

use App\Models\Championship;
use App\Services\StandingsCalculatorService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class DebugStandings extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'championship:debug-standings {championship_id}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Debug standings calculation for a championship';

    protected $standingsService;

    public function __construct(StandingsCalculatorService $standingsService)
    {
        parent::__construct();
        $this->standingsService = $standingsService;
    }

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $championshipId = $this->argument('championship_id');
        $championship = Championship::find($championshipId);

        if (!$championship) {
            $this->error("Championship {$championshipId} not found!");
            return 1;
        }

        $this->info("🔍 Debugging Championship #{$championship->id}: {$championship->name}");
        $this->info("Format: {$championship->getFormatEnum()->name}");
        $this->info("Swiss Rounds: {$championship->swiss_rounds}");
        $this->newLine();

        // Get all matches
        $allMatches = $championship->matches()->with(['player1', 'player2'])->get();
        $this->info("📊 All Matches ({$allMatches->count()}):");
        $this->table(
            ['ID', 'Round', 'Status ID', 'Status', 'Result Type ID', 'Result Type', 'P1', 'P2', 'Winner'],
            $allMatches->map(function($m) {
                // Manually resolve status from ID
                $statusName = 'UNKNOWN';
                if ($m->status_id === 1) $statusName = 'PENDING';
                elseif ($m->status_id === 2) $statusName = 'IN_PROGRESS';
                elseif ($m->status_id === 3) $statusName = 'COMPLETED';
                elseif ($m->status_id === 4) $statusName = 'CANCELLED';

                // Manually resolve result type from ID
                $resultTypeName = 'NORMAL';
                if ($m->result_type_id === 1) $resultTypeName = 'COMPLETED';
                elseif ($m->result_type_id === 2) $resultTypeName = 'FORFEIT_P1';
                elseif ($m->result_type_id === 3) $resultTypeName = 'FORFEIT_P2';
                elseif ($m->result_type_id === 4) $resultTypeName = 'DOUBLE_FORFEIT';
                elseif ($m->result_type_id === 5) $resultTypeName = 'DRAW';
                elseif ($m->result_type_id === 6) $resultTypeName = 'BYE';

                return [
                    $m->id,
                    $m->round_number,
                    $m->status_id ?? 'NULL',
                    $statusName,
                    $m->result_type_id ?? 'NULL',
                    $resultTypeName,
                    $m->player1_id ?? 'NULL',
                    $m->player2_id ?? 'NULL',
                    $m->winner_id ?? 'NULL',
                ];
            })
        );
        $this->newLine();

        // Get completed matches only
        $completedMatches = $championship->matches()->completed()->with(['player1', 'player2'])->get();
        $this->info("✅ Completed Matches Only ({$completedMatches->count()}):");
        $this->table(
            ['ID', 'Round', 'Status ID', 'Status', 'Result Type ID', 'Result Type', 'P1', 'P2', 'Winner'],
            $completedMatches->map(function($m) {
                // Manually resolve status from ID
                $statusName = 'UNKNOWN';
                if ($m->status_id === 1) $statusName = 'PENDING';
                elseif ($m->status_id === 2) $statusName = 'IN_PROGRESS';
                elseif ($m->status_id === 3) $statusName = 'COMPLETED';
                elseif ($m->status_id === 4) $statusName = 'CANCELLED';

                // Manually resolve result type from ID
                $resultTypeName = 'NORMAL';
                if ($m->result_type_id === 1) $resultTypeName = 'COMPLETED';
                elseif ($m->result_type_id === 2) $resultTypeName = 'FORFEIT_P1';
                elseif ($m->result_type_id === 3) $resultTypeName = 'FORFEIT_P2';
                elseif ($m->result_type_id === 4) $resultTypeName = 'DOUBLE_FORFEIT';
                elseif ($m->result_type_id === 5) $resultTypeName = 'DRAW';
                elseif ($m->result_type_id === 6) $resultTypeName = 'BYE';

                return [
                    $m->id,
                    $m->round_number,
                    $m->status_id ?? 'NULL',
                    $statusName,
                    $m->result_type_id ?? 'NULL',
                    $resultTypeName,
                    $m->player1_id ?? 'NULL',
                    $m->player2_id ?? 'NULL',
                    $m->winner_id ?? 'NULL',
                ];
            })
        );
        $this->newLine();

        // Get current standings
        $standings = $championship->standings()->with('user')->orderBy('rank')->get();
        $this->info("📈 Current Standings:");
        $this->table(
            ['Rank', 'User ID', 'Name', 'Points', 'W-L-D', 'Matches'],
            $standings->map(fn($s) => [
                $s->rank,
                $s->user_id,
                $s->user->name,
                $s->points,
                "{$s->wins}-{$s->losses}-{$s->draws}",
                $s->matches_played,
            ])
        );
        $this->newLine();

        // Recalculate with debug logging
        $this->info("🔄 Recalculating standings with debug logging...");
        $this->info("Check storage/logs/laravel.log for detailed debug output");
        $this->newLine();

        // Enable detailed logging for this operation
        Log::info("🎯 [DEBUG COMMAND] Starting recalculation for Championship {$championship->id}");

        $this->standingsService->recalculateAllStandings($championship);

        // Get updated standings
        $updatedStandings = $championship->standings()->with('user')->orderBy('rank')->get();
        $this->info("📈 Recalculated Standings:");
        $this->table(
            ['Rank', 'User ID', 'Name', 'Points', 'W-L-D', 'Matches'],
            $updatedStandings->map(fn($s) => [
                $s->rank,
                $s->user_id,
                $s->user->name,
                $s->points,
                "{$s->wins}-{$s->losses}-{$s->draws}",
                $s->matches_played,
            ])
        );

        $this->newLine();
        $this->info("✅ Done! Check storage/logs/laravel.log for detailed debug traces");

        return 0;
    }
}
