<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Championship;
use App\Services\PlaceholderMatchAssignmentService;
use Illuminate\Support\Facades\Log;

class ActivateSwissRound extends Command
{
    protected $signature = 'championship:activate-swiss-round {championship_id} {round_number}';
    protected $description = 'Manually activate a Swiss round by assigning players to placeholder matches';

    public function handle()
    {
        $championshipId = $this->argument('championship_id');
        $roundNumber = $this->argument('round_number');

        $championship = Championship::find($championshipId);
        if (!$championship) {
            $this->error("Championship {$championshipId} not found");
            return 1;
        }

        if (!$championship->getFormatEnum()->isSwiss()) {
            $this->error("Championship {$championshipId} is not a Swiss tournament");
            return 1;
        }

        try {
            $this->info("Activating Round {$roundNumber} for Championship {$championshipId}");

            $assignmentService = app(PlaceholderMatchAssignmentService::class);
            $assignmentService->assignPlayersToPlaceholderMatches($championship, $roundNumber);

            $this->info("✅ Round {$roundNumber} activated successfully!");

            // Show updated match status
            $matches = $championship->matches()
                ->where('round_number', $roundNumber)
                ->get(['id', 'player1_id', 'player2_id', 'is_placeholder', 'players_assigned_at', 'status_id']);

            $this->table(
                ['ID', 'Player 1', 'Player 2', 'Placeholder', 'Assigned At', 'Status'],
                $matches->map(function ($match) {
                    return [
                        $match->id,
                        $match->player1_id ?? 'TBD',
                        $match->player2_id ?? 'TBD',
                        $match->is_placeholder ? 'Yes' : 'No',
                        $match->players_assigned_at?->format('H:i:s') ?? 'Not assigned',
                        $match->status_id
                    ];
                })
            );

            return 0;

        } catch (\Exception $e) {
            $this->error("Failed to activate Round {$roundNumber}: " . $e->getMessage());
            Log::error("Manual Swiss round activation failed", [
                'championship_id' => $championshipId,
                'round_number' => $roundNumber,
                'error' => $e->getMessage()
            ]);
            return 1;
        }
    }
}