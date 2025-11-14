<?php

namespace App\Console\Commands;

use App\Models\Championship;
use App\Models\ChampionshipParticipant;
use App\Services\MatchSchedulerService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class AutoStartTournamentsCommand extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'tournaments:auto-start';

    /**
     * The console command description.
     */
    protected $description = 'Automatically start tournaments whose registration deadline has passed and have enough participants';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting automatic tournament start check...');

        $startedCount = 0;
        $skippedCount = 0;

        try {
            // Find championships ready to auto-start
            $readyChampionships = Championship::where('status', 'registration_open')
                ->where('registration_deadline', '<', now())
                ->where('start_date', '<=', now()->addMinutes(5)) // 5-minute grace period
                ->whereHas('participants', function ($query) {
                    $query->where('payment_status', 'paid');
                }, '>=', 2) // At least 2 paid participants
                ->with(['participants' => function ($query) {
                    $query->where('payment_status', 'paid');
                }])
                ->get();

            foreach ($readyChampionships as $championship) {
                DB::beginTransaction();

                try {
                    // Double-check status hasn't changed
                    if ($championship->status !== 'registration_open') {
                        $this->line("Skipping championship {$championship->id} - status changed to {$championship->status}");
                        $skippedCount++;
                        continue;
                    }

                    // Update championship status
                    $championship->update([
                        'status' => 'in_progress',
                        'started_at' => now()
                    ]);

                    // Create match scheduler service and schedule first round
                    $matchScheduler = app(MatchSchedulerService::class);
                    $matchScheduler->scheduleRound($championship, 1);

                    // Log the auto-start
                    Log::info('🏆 Championship auto-started', [
                        'championship_id' => $championship->id,
                        'title' => $championship->title,
                        'participants_count' => $championship->participants->count(),
                        'total_rounds' => $championship->total_rounds,
                        'registration_deadline' => $championship->registration_deadline,
                        'auto_started_at' => now()
                    ]);

                    $this->line("✅ Auto-started championship '{$championship->title}' (ID: {$championship->id}) with {$championship->participants->count()} participants");
                    $startedCount++;

                    DB::commit();

                } catch (\Exception $e) {
                    DB::rollBack();

                    Log::error('Failed to auto-start championship', [
                        'championship_id' => $championship->id,
                        'error' => $e->getMessage(),
                        'trace' => $e->getTraceAsString()
                    ]);

                    $this->error("❌ Failed to auto-start championship {$championship->id}: {$e->getMessage()}");
                    $skippedCount++;
                }
            }

            $this->info("Auto-start check completed. {$startedCount} tournaments started, {$skippedCount} skipped.");

        } catch (\Exception $e) {
            $this->error("Critical error during tournament auto-start: {$e->getMessage()}");
            Log::error('Tournament auto-start command failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return 1;
        }

        return 0;
    }
}