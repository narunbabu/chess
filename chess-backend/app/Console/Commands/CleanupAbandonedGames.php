<?php

namespace App\Console\Commands;

use App\Models\Game;
use App\Enums\GameStatus;
use App\Enums\EndReason;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CleanupAbandonedGames extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'games:cleanup-abandoned
                            {--dry-run : Show what would be cleaned without making changes}
                            {--zero-move-hours=1 : Hours of inactivity before cleaning 0-move games}
                            {--active-days=7 : Days of inactivity before cleaning games with moves}
                            {--skip-championship : Skip games linked to championship matches}';

    /**
     * The console command description.
     */
    protected $description = 'Clean up abandoned games: 0-move games after 1h, 1+ move games after 7d of inactivity';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $dryRun = $this->option('dry-run');
        $zeroMoveHours = (int) $this->option('zero-move-hours');
        $activeDays = (int) $this->option('active-days');
        $skipChampionship = $this->option('skip-championship');

        $this->info('Starting abandoned game cleanup...');

        if ($dryRun) {
            $this->warn('DRY RUN MODE - No changes will be made');
        }

        $this->line("  Thresholds: 0-move games > {$zeroMoveHours}h, 1+ move games > {$activeDays}d");

        $zeroMoveCutoff = Carbon::now()->subHours($zeroMoveHours);
        $activeMoveCutoff = Carbon::now()->subDays($activeDays);

        $waitingStatusId = GameStatus::WAITING->getId();
        $activeStatusId = GameStatus::ACTIVE->getId();
        $abortedStatusId = GameStatus::ABORTED->getId();

        $abortedEndReasonId = EndReason::ABORTED->getId();
        $timeoutInactivityEndReasonId = EndReason::TIMEOUT_INACTIVITY->getId();

        $pausedStatusId = GameStatus::PAUSED->getId();

        $targetStatusIds = [$waitingStatusId, $activeStatusId, $pausedStatusId];

        // --- Phase 1: 0-move games older than threshold ---
        $zeroMoveQuery = Game::whereIn('status_id', $targetStatusIds)
            ->where(function ($q) {
                $q->whereNull('move_count')->orWhere('move_count', 0);
            })
            ->where('updated_at', '<', $zeroMoveCutoff);

        if ($skipChampionship) {
            $zeroMoveQuery->whereDoesntHave('championshipMatch');
        }

        $zeroMoveGames = $zeroMoveQuery->get();

        // --- Phase 2: 1+ move games older than threshold ---
        $activeMoveQuery = Game::whereIn('status_id', $targetStatusIds)
            ->where('move_count', '>=', 1)
            ->where('updated_at', '<', $activeMoveCutoff);

        if ($skipChampionship) {
            $activeMoveQuery->whereDoesntHave('championshipMatch');
        }

        $activeMoveGames = $activeMoveQuery->get();

        $totalCandidates = $zeroMoveGames->count() + $activeMoveGames->count();
        $this->info("Found {$zeroMoveGames->count()} zero-move games and {$activeMoveGames->count()} stale active games ({$totalCandidates} total)");

        if ($totalCandidates === 0) {
            $this->info('No abandoned games to clean up.');
            Log::info('Game cleanup: no abandoned games found.');
            return Command::SUCCESS;
        }

        $cleanedZero = 0;
        $cleanedActive = 0;
        $errors = 0;

        // Process 0-move games (abort them)
        foreach ($zeroMoveGames as $game) {
            try {
                $this->processGame($game, 'zero-move', $abortedStatusId, $abortedEndReasonId, $dryRun);
                $cleanedZero++;
            } catch (\Exception $e) {
                $errors++;
                $this->error("  Failed game #{$game->id}: {$e->getMessage()}");
                Log::error('Game cleanup failed', [
                    'game_id' => $game->id,
                    'category' => 'zero-move',
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Process 1+ move games (timeout inactivity)
        foreach ($activeMoveGames as $game) {
            try {
                $this->processGame($game, 'stale-active', $abortedStatusId, $timeoutInactivityEndReasonId, $dryRun);
                $cleanedActive++;
            } catch (\Exception $e) {
                $errors++;
                $this->error("  Failed game #{$game->id}: {$e->getMessage()}");
                Log::error('Game cleanup failed', [
                    'game_id' => $game->id,
                    'category' => 'stale-active',
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // --- Phase 3: Clean up stale game_connections for cleaned games ---
        $cleanedGameIds = $zeroMoveGames->pluck('id')
            ->merge($activeMoveGames->pluck('id'))
            ->unique()
            ->values();

        $cleanedConnections = 0;
        if ($cleanedGameIds->isNotEmpty() && !$dryRun) {
            $cleanedConnections = DB::table('game_connections')
                ->whereIn('game_id', $cleanedGameIds)
                ->delete();
        } elseif ($cleanedGameIds->isNotEmpty() && $dryRun) {
            $cleanedConnections = DB::table('game_connections')
                ->whereIn('game_id', $cleanedGameIds)
                ->count();
        }

        // Also clean orphaned connections (no matching game or game already finished)
        $finishedStatusId = GameStatus::FINISHED->getId();
        $orphanedConnections = 0;
        if (!$dryRun) {
            $orphanedConnections = DB::table('game_connections')
                ->whereNotExists(function ($query) {
                    $query->select(DB::raw(1))
                        ->from('games')
                        ->whereColumn('games.id', 'game_connections.game_id');
                })
                ->delete();

            $orphanedConnections += DB::table('game_connections')
                ->whereIn('game_id', function ($query) use ($finishedStatusId, $abortedStatusId) {
                    $query->select('id')
                        ->from('games')
                        ->whereIn('status_id', [$finishedStatusId, $abortedStatusId]);
                })
                ->delete();
        } else {
            $orphanedConnections = DB::table('game_connections')
                ->whereNotExists(function ($query) {
                    $query->select(DB::raw(1))
                        ->from('games')
                        ->whereColumn('games.id', 'game_connections.game_id');
                })
                ->count();

            $orphanedConnections += DB::table('game_connections')
                ->whereIn('game_id', function ($query) use ($finishedStatusId, $abortedStatusId) {
                    $query->select('id')
                        ->from('games')
                        ->whereIn('status_id', [$finishedStatusId, $abortedStatusId]);
                })
                ->count();
        }

        // Summary
        $this->newLine();
        $this->info('Cleanup Summary:');

        $headers = ['Category', 'Count'];
        $rows = [
            ['Zero-move games cleaned', $cleanedZero],
            ['Stale active games cleaned', $cleanedActive],
            ['Connections for cleaned games', $cleanedConnections],
            ['Orphaned connections removed', $orphanedConnections],
            ['Errors', $errors],
            ['Total games processed', $cleanedZero + $cleanedActive],
        ];
        $this->table($headers, $rows);

        if ($dryRun) {
            $this->warn('DRY RUN COMPLETE - No actual changes were made');
        }

        Log::info('Game cleanup completed', [
            'dry_run' => $dryRun,
            'zero_move_cleaned' => $cleanedZero,
            'stale_active_cleaned' => $cleanedActive,
            'connections_cleaned' => $cleanedConnections,
            'orphaned_connections' => $orphanedConnections,
            'errors' => $errors,
            'thresholds' => [
                'zero_move_hours' => $zeroMoveHours,
                'active_days' => $activeDays,
            ],
        ]);

        return $errors > 0 ? Command::FAILURE : Command::SUCCESS;
    }

    /**
     * Process a single game for cleanup.
     */
    private function processGame(
        Game $game,
        string $category,
        int $statusId,
        int $endReasonId,
        bool $dryRun
    ): void {
        $inactiveMinutes = (int) abs(Carbon::now()->diffInMinutes($game->updated_at));
        $gameType = $game->isComputerGame() ? 'vs-computer' : 'multiplayer';

        $logLine = sprintf(
            '  Game #%d [%s, %s] — %d moves, inactive %s, last updated %s',
            $game->id,
            $category,
            $gameType,
            $game->move_count ?? 0,
            $this->humanDuration($inactiveMinutes),
            $game->updated_at->toDateTimeString()
        );

        if ($dryRun) {
            $this->line("{$logLine} — WOULD CLEAN");
            return;
        }

        DB::transaction(function () use ($game, $statusId, $endReasonId) {
            $game->update([
                'status_id' => $statusId,
                'end_reason_id' => $endReasonId,
                'ended_at' => now(),
                'game_phase' => 'ended',
                'result' => '*',
            ]);
        });

        $this->line("{$logLine} — CLEANED");

        Log::info('Abandoned game cleaned up', [
            'game_id' => $game->id,
            'category' => $category,
            'game_type' => $gameType,
            'move_count' => $game->move_count ?? 0,
            'inactive_minutes' => $inactiveMinutes,
            'previous_status_id' => $game->getOriginal('status_id'),
            'new_status_id' => $statusId,
            'end_reason_id' => $endReasonId,
            'white_player_id' => $game->white_player_id,
            'black_player_id' => $game->black_player_id,
        ]);
    }

    /**
     * Format minutes into human-readable duration.
     */
    private function humanDuration(int $minutes): string
    {
        if ($minutes < 60) {
            return "{$minutes}m";
        }

        $hours = intdiv($minutes, 60);
        $remainingMinutes = $minutes % 60;

        if ($hours < 24) {
            return $remainingMinutes > 0 ? "{$hours}h {$remainingMinutes}m" : "{$hours}h";
        }

        $days = intdiv($hours, 24);
        $remainingHours = $hours % 24;

        return $remainingHours > 0 ? "{$days}d {$remainingHours}h" : "{$days}d";
    }
}
