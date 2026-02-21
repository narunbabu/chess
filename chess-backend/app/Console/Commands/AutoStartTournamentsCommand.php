<?php

namespace App\Console\Commands;

use App\Enums\ChampionshipStatus;
use App\Enums\PaymentStatus;
use App\Models\Championship;
use App\Models\ChampionshipParticipant;
use App\Services\MatchSchedulerService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
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
            // Find championships ready to auto-start.
            // IMPORTANT: 'status' and 'payment_status' are virtual accessors —
            // query builder must use the real FK columns (status_id / payment_status_id).
            $readyChampionships = Championship::where('status_id', ChampionshipStatus::REGISTRATION_OPEN->getId())
                ->where('registration_deadline', '<', now())
                ->where('start_date', '<=', now()->addMinutes(5)) // 5-minute grace period
                ->whereHas('participants', function ($query) {
                    $query->where('payment_status_id', PaymentStatus::COMPLETED->getId());
                }, '>=', 2) // At least 2 paid participants
                ->with(['participants' => function ($query) {
                    $query->where('payment_status_id', PaymentStatus::COMPLETED->getId());
                }])
                ->get();

            foreach ($readyChampionships as $championship) {
                // H4 fix: acquire a per-championship cache lock before attempting to
                // start.  If two concurrent command invocations both pick up the same
                // championship (possible when the cron overlaps), only the one that
                // acquires the lock will proceed; the other skips immediately.
                // TTL of 60 seconds is generous: normal start completes in < 5 s.
                $lock = Cache::lock(
                    "tournament.auto-start.{$championship->id}",
                    60
                );

                if (!$lock->get()) {
                    $this->line("Skipping championship {$championship->id} - start already in progress by another process");
                    $skippedCount++;
                    continue;
                }

                DB::beginTransaction();

                try {
                    // H4 fix: use lockForUpdate() to re-read the row exclusively so
                    // that no other transaction can read/update it until we commit.
                    // This closes the window between the cache-lock check and the
                    // actual DB UPDATE.
                    $championship = Championship::where('id', $championship->id)
                        ->lockForUpdate()
                        ->first();

                    if (!$championship || $championship->status_id !== ChampionshipStatus::REGISTRATION_OPEN->getId()) {
                        $this->line("Skipping championship {$championship?->id} - status changed to {$championship?->status}");
                        DB::rollBack();
                        $lock->release();
                        $skippedCount++;
                        continue;
                    }

                    // Update championship status using the real FK column
                    $championship->update([
                        'status_id'  => ChampionshipStatus::IN_PROGRESS->getId(),
                        'started_at' => now(),
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
                } finally {
                    // Always release the cache lock, even on exception.
                    $lock->release();
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