<?php

namespace App\Console\Commands;

use App\Models\Game;
use App\Services\GameRoomService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class MonitorGameInactivity extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'games:monitor-inactivity';

    /**
     * The console command description.
     */
    protected $description = 'Monitor active and paused games for inactivity and timeout';

    /**
     * Execute the console command.
     */
    public function handle(GameRoomService $gameRoomService): int
    {
        $this->info('Starting game inactivity monitoring...');

        // Get all active or paused games
        $games = Game::whereIn('status', ['active', 'paused'])
            ->get();

        $this->info("Found {$games->count()} games to check");

        $pausedCount = 0;
        $forfeitedCount = 0;
        $resumedCount = 0;

        foreach ($games as $game) {
            try {
                $result = $this->checkGameInactivity($game, $gameRoomService);

                if ($result === 'paused') {
                    $pausedCount++;
                } elseif ($result === 'forfeited') {
                    $forfeitedCount++;
                } elseif ($result === 'resumed') {
                    $resumedCount++;
                }
            } catch (\Exception $e) {
                Log::error('Error checking game inactivity', [
                    'game_id' => $game->id,
                    'error' => $e->getMessage()
                ]);
                $this->error("Error checking game {$game->id}: {$e->getMessage()}");
            }
        }

        $this->info("Monitoring complete:");
        $this->info("  - Paused: {$pausedCount}");
        $this->info("  - Forfeited: {$forfeitedCount}");
        $this->info("  - Resumed: {$resumedCount}");

        return Command::SUCCESS;
    }

    /**
     * Check a single game for inactivity
     */
    private function checkGameInactivity(Game $game, GameRoomService $gameRoomService): ?string
    {
        // Configuration from environment
        $dialogTimeout = config('game.inactivity_dialog_timeout', 60); // 60 seconds
        $pauseTimeout = config('game.inactivity_pause_timeout', 70); // 70 seconds
        $forfeitTimeout = config('game.inactivity_forfeit_timeout', 1800); // 30 minutes

        $inactiveSeconds = $game->getInactiveSeconds();

        if ($game->status === 'active') {
            // Check if game should be paused
            if ($inactiveSeconds >= $pauseTimeout) {
                $this->line("Game {$game->id}: Pausing due to inactivity ({$inactiveSeconds}s)");

                $result = $gameRoomService->pauseGame($game->id, 'inactivity');

                if ($result['success']) {
                    Log::info('Game paused due to inactivity', [
                        'game_id' => $game->id,
                        'inactive_seconds' => $inactiveSeconds
                    ]);
                    return 'paused';
                }
            } elseif ($inactiveSeconds >= $dialogTimeout) {
                // TODO: Trigger "Are You There?" dialog via broadcast
                // This will be handled by frontend when implemented
                $this->line("Game {$game->id}: Should show dialog ({$inactiveSeconds}s)");
            }
        } elseif ($game->status === 'paused') {
            // Check if game should be forfeited by timeout
            $pausedSeconds = $game->getPausedSeconds();

            if ($pausedSeconds >= $forfeitTimeout) {
                $this->line("Game {$game->id}: Forfeiting due to timeout ({$pausedSeconds}s paused)");

                $result = $gameRoomService->forfeitByTimeout($game->id);

                if ($result['success']) {
                    Log::info('Game forfeited by timeout', [
                        'game_id' => $game->id,
                        'paused_seconds' => $pausedSeconds
                    ]);
                    return 'forfeited';
                }
            }
        }

        return null;
    }
}
