<?php

namespace App\Console\Commands;

use App\Models\Championship;
use App\Jobs\GenerateNextRoundJob;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class AutoGenerateRoundsCommand extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'tournaments:auto-generate-rounds';

    /**
     * The console command description.
     */
    protected $description = 'Automatically generate next rounds for tournaments where current round is complete';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting automatic round generation check...');

        $generatedCount = 0;
        $skippedCount = 0;

        try {
            // Find championships that need next round generated
            $readyChampionships = Championship::where('status', 'in_progress')
                ->whereHas('matches', function ($query) {
                    // Must have at least one round completed
                    $query->completed(); // Use model scope instead of direct status query
                })
                ->where(function ($query) {
                    $query->where(function ($subQuery) {
                        // Swiss format with remaining rounds
                        $subQuery->where('format', 'swiss_only')
                                ->whereRaw('(SELECT COALESCE(MAX(round_number), 0) FROM championship_matches WHERE championship_id = championships.id) < swiss_rounds');
                    })
                    ->orWhere(function ($subQuery) {
                        // Hybrid format in Swiss phase
                        $subQuery->where('format', 'hybrid')
                                ->whereRaw('(SELECT COALESCE(MAX(round_number), 0) FROM championship_matches WHERE championship_id = championships.id) < swiss_rounds');
                    })
                    ->orWhere(function ($subQuery) {
                        // Elimination format without winner
                        $subQuery->whereIn('format', ['elimination_only', 'hybrid'])
                                ->whereRaw('(SELECT COUNT(*) FROM championship_participants WHERE championship_id = championships.id AND payment_status_id = ?) > 1',
                                        [\App\Enums\PaymentStatus::COMPLETED->getId()]);
                    });
                })
                ->get();

            foreach ($readyChampionships as $championship) {
                try {
                    // Check if current round is complete before proceeding
                    if (!$this->isCurrentRoundComplete($championship)) {
                        $this->line("Skipping championship {$championship->id} - current round not complete");
                        $skippedCount++;
                        continue;
                    }

                    // Check if championship should continue
                    if (!$this->shouldContinueChampionship($championship)) {
                        $this->line("Skipping championship {$championship->id} - tournament should be complete");
                        $skippedCount++;
                        continue;
                    }

                    // Dispatch the job to generate next round
                    GenerateNextRoundJob::dispatch($championship);

                    Log::info('🎯 Auto-generated next round', [
                        'championship_id' => $championship->id,
                        'title' => $championship->title,
                        'current_round' => $this->getCurrentRoundNumber($championship),
                        'format' => $championship->format,
                        'generated_at' => now()
                    ]);

                    $this->line("✅ Auto-generated next round for '{$championship->title}' (ID: {$championship->id})");
                    $generatedCount++;

                } catch (\Exception $e) {
                    Log::error('Failed to auto-generate next round for championship', [
                        'championship_id' => $championship->id,
                        'error' => $e->getMessage(),
                        'trace' => $e->getTraceAsString()
                    ]);

                    $this->error("❌ Failed to auto-generate next round for championship {$championship->id}: {$e->getMessage()}");
                    $skippedCount++;
                }
            }

            $this->info("Auto-generation check completed. {$generatedCount} rounds generated, {$skippedCount} skipped.");

        } catch (\Exception $e) {
            $this->error("Critical error during automatic round generation: {$e->getMessage()}");
            Log::error('Auto round generation command failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return 1;
        }

        return 0;
    }

    /**
     * Check if current round is complete
     */
    private function isCurrentRoundComplete(Championship $championship): bool
    {
        $currentRound = $this->getCurrentRoundNumber($championship);

        if ($currentRound === 0) {
            return true; // No rounds yet - this should be handled by auto-start
        }

        $totalMatches = $championship->matches()
            ->where('round_number', $currentRound)
            ->count();

        if ($totalMatches === 0) {
            return false; // No matches in current round
        }

        $completedMatches = $championship->matches()
            ->where('round_number', $currentRound)
            ->completed() // Use model scope instead of direct status query
            ->count();

        return $completedMatches === $totalMatches;
    }

    /**
     * Get current round number
     */
    private function getCurrentRoundNumber(Championship $championship): int
    {
        return $championship->matches()->max('round_number') ?: 0;
    }

    /**
     * Check if championship should continue
     */
    private function shouldContinueChampionship(Championship $championship): bool
    {
        $format = $championship->getFormatEnum();
        $currentRound = $this->getCurrentRoundNumber($championship);

        switch ($format->value) {
            case 'swiss_only':
                return $currentRound < $championship->swiss_rounds;

            case 'elimination_only':
                // Continue until we have a winner
                return !$this->hasEliminationWinner($championship);

            case 'hybrid':
                $totalSwissRounds = $championship->swiss_rounds;

                if ($currentRound < $totalSwissRounds) {
                    return true; // Still in Swiss phase
                } else {
                    return !$this->hasEliminationWinner($championship); // In elimination phase
                }

            default:
                return false;
        }
    }

    /**
     * Check if elimination has a winner
     */
    private function hasEliminationWinner(Championship $championship): bool
    {
        $activeParticipants = $championship->participants()
            ->where('payment_status_id', \App\Enums\PaymentStatus::COMPLETED->getId())
            ->count();

        return $activeParticipants <= 1;
    }
}