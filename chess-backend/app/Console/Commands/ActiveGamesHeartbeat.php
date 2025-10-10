<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\ClockService;
use App\Services\ClockStore;
use App\Events\GameClockUpdated;
use App\Models\Game;
use Illuminate\Support\Facades\Log;

/**
 * ActiveGamesHeartbeat Command
 *
 * Periodically updates clocks for all active games and broadcasts snapshots.
 * This ensures clients stay synchronized even if they miss individual move events.
 *
 * Scheduled to run every 2 seconds for active games (configurable via scheduler).
 * Low overhead: O(1) per game using lazy elapsed time calculation.
 */
class ActiveGamesHeartbeat extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'games:heartbeat
                          {--dry-run : Run without broadcasting or persisting}
                          {--persist : Force database persistence on this heartbeat}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Update clocks for active games and broadcast snapshots';

    protected ClockService $clockService;
    protected ClockStore $clockStore;

    public function __construct(ClockService $clockService, ClockStore $clockStore)
    {
        parent::__construct();
        $this->clockService = $clockService;
        $this->clockStore = $clockStore;
    }

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $dryRun = $this->option('dry-run');
        $forcePersist = $this->option('persist');

        // Get all active game IDs from Redis
        $gameIds = $this->clockStore->getActiveGameIds();

        if (empty($gameIds)) {
            if ($dryRun) {
                $this->info('No active games found');
            }
            return 0;
        }

        if ($dryRun) {
            $this->info("Processing {count($gameIds)} active games (dry run)");
        }

        $updated = 0;
        $flagged = 0;

        foreach ($gameIds as $gameId) {
            try {
                // Load clock state
                $clock = $this->clockStore->load($gameId);
                if (!$clock) {
                    continue;
                }

                // Apply elapsed time (this is O(1) operation)
                $clockBefore = $clock;
                $clock = $this->clockService->applyElapsed($clock);

                // Check if anything changed
                $timeChanged = $clock['white_ms'] !== $clockBefore['white_ms'] ||
                              $clock['black_ms'] !== $clockBefore['black_ms'];

                if (!$timeChanged && $clock['status'] === $clockBefore['status']) {
                    // No changes, skip this game
                    continue;
                }

                if ($dryRun) {
                    $this->line("Game {$gameId}: {$clock['running']} timer at {$clock['white_ms']}ms / {$clock['black_ms']}ms");
                    if ($clock['status'] === 'over') {
                        $this->warn("  -> Would flag: {$clock['reason']}");
                    }
                } else {
                    // Save updated clock with new revision
                    $clock = $this->clockStore->updateWithRevision(
                        $gameId,
                        $clock,
                        $forcePersist
                    );

                    // Load game for turn information
                    $game = Game::find($gameId);
                    if (!$game) {
                        continue;
                    }

                    // Broadcast update
                    $eventType = $clock['status'] === 'over' ? 'GAME_OVER' : 'TURN_UPDATE';
                    $winner = $clock['winner'] ?? null;

                    broadcast(new GameClockUpdated(
                        $gameId,
                        $clock,
                        $game->turn ?? 'white',
                        $eventType,
                        $winner,
                        ['source' => 'heartbeat']
                    ));

                    $updated++;

                    if ($clock['status'] === 'over') {
                        $flagged++;
                        Log::info("Game {$gameId} flagged: {$clock['reason']}", [
                            'winner' => $winner,
                            'white_ms' => $clock['white_ms'],
                            'black_ms' => $clock['black_ms']
                        ]);
                    }
                }

            } catch (\Exception $e) {
                Log::error("Heartbeat error for game {$gameId}: {$e->getMessage()}");
                if ($dryRun) {
                    $this->error("Game {$gameId} error: {$e->getMessage()}");
                }
            }
        }

        if ($dryRun) {
            $this->info("Would have updated {$updated} games, flagged {$flagged}");
        } else {
            if ($updated > 0) {
                Log::debug("Heartbeat updated {$updated} games, flagged {$flagged}");
            }
        }

        return 0;
    }
}
