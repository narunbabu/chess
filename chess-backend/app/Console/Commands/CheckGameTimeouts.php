<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\ChampionshipGameTimeoutService;
use Illuminate\Support\Facades\Log;

class CheckGameTimeouts extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'championship:check-timeouts
                            {--championship= : Specific championship ID to check}
                            {--match= : Specific match ID to check}
                            {--warnings-only : Only check for timeout warnings}
                            {--force : Force timeout processing for specific match}
                            {--dry-run : Show what would happen without executing}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Check championship game timeouts and send warnings/process forfeits';

    /**
     * @var ChampionshipGameTimeoutService
     */
    protected $timeoutService;

    /**
     * Create a new command instance.
     *
     * @param ChampionshipGameTimeoutService $timeoutService
     */
    public function __construct(ChampionshipGameTimeoutService $timeoutService)
    {
        parent::__construct();
        $this->timeoutService = $timeoutService;
    }

    /**
     * Execute the console command.
     *
     * @return int
     */
    public function handle()
    {
        $this->info('Starting championship timeout check...');

        $championshipId = $this->option('championship');
        $matchId = $this->option('match');
        $warningsOnly = $this->option('warnings-only');
        $force = $this->option('force');
        $dryRun = $this->option('dry-run');

        try {
            if ($dryRun) {
                $this->warn('DRY RUN MODE - No changes will be made');
            }

            if ($matchId) {
                $results = $this->checkSpecificMatch($matchId, $force, $dryRun);
            } elseif ($championshipId) {
                $results = $this->checkSpecificChampionship($championshipId, $warningsOnly, $dryRun);
            } else {
                $results = $this->checkAllTimeOuts($warningsOnly, $dryRun);
            }

            $this->displayResults($results);

            $this->info('Championship timeout check completed successfully.');
            return 0;

        } catch (\Exception $e) {
            $this->error('Error during timeout check: ' . $e->getMessage());
            Log::error('Championship timeout check command failed', [
                'error' => $e->getMessage(),
                'championship_id' => $championshipId,
                'match_id' => $matchId,
                'warnings_only' => $warningsOnly,
                'force' => $force,
                'dry_run' => $dryRun
            ]);
            return 1;
        }
    }

    /**
     * Check all timeouts
     */
    protected function checkAllTimeOuts(bool $warningsOnly, bool $dryRun): array
    {
        $this->info('Checking all championships for timeouts...');

        if ($dryRun) {
            $this->warn('Dry run mode: Showing what timeouts would be checked');
            return [
                'warnings_sent' => 0,
                'timeouts_processed' => 0,
                'actions' => []
            ];
        }

        if ($warningsOnly) {
            $this->info('Checking for timeout warnings only...');
            $warnings = $this->timeoutService->checkTimeoutWarnings();
            return [
                'warnings_sent' => count($warnings),
                'timeouts_processed' => 0,
                'actions' => $warnings
            ];
        }

        return $this->timeoutService->checkAllTimeouts();
    }

    /**
     * Check a specific championship
     */
    protected function checkSpecificChampionship(int $championshipId, bool $warningsOnly, bool $dryRun): array
    {
        $this->info("Checking championship ID: {$championshipId}");

        $championship = \App\Models\Championship::find($championshipId);
        if (!$championship) {
            throw new \Exception("Championship with ID {$championshipId} not found");
        }

        if ($dryRun) {
            $status = $this->timeoutService->getChampionshipTimeoutStatus($championship);
            $this->displayChampionshipTimeoutStatus($status);
            return ['timeout_status' => $status];
        }

        if ($warningsOnly) {
            $this->info('Checking for timeout warnings only...');
            // We'd need to implement a championship-specific warning check
            $this->warn('Championship-specific warning check not implemented yet');
            return ['warnings_sent' => 0];
        }

        $this->warn('Processing timeouts for specific championship not fully implemented');
        return ['timeouts_processed' => 0];
    }

    /**
     * Check a specific match
     */
    protected function checkSpecificMatch(int $matchId, bool $force, bool $dryRun): array
    {
        $this->info("Checking match ID: {$matchId}");

        $match = \App\Models\ChampionshipMatch::find($matchId);
        if (!$match) {
            throw new \Exception("Match with ID {$matchId} not found");
        }

        if ($dryRun) {
            $isTimedOut = $this->timeoutService->isMatchTimedOut($match);
            $timeRemaining = $this->timeoutService->getTimeRemaining($match);

            $this->line("Match status: {$match->status}");
            $this->line("Scheduling status: {$match->scheduling_status}");
            $this->line("Scheduled time: {$match->scheduled_time}");
            $this->line("Game timeout: {$match->game_timeout}");
            $this->line("Is timed out: " . ($isTimedOut ? 'Yes' : 'No'));
            $this->line("Time remaining: " . ($timeRemaining !== null ? "{$timeRemaining} seconds" : 'N/A'));

            return [
                'match_id' => $matchId,
                'is_timed_out' => $isTimedOut,
                'time_remaining' => $timeRemaining,
                'status' => $match->status
            ];
        }

        if ($force) {
            $this->warn('Force processing timeout for match...');
            $result = $this->timeoutService->forceTimeout($match);
            return ['forced_timeout' => $result];
        }

        // Check if match needs processing
        if ($this->timeoutService->isMatchTimedOut($match)) {
            $result = $this->timeoutService->processMatchTimeout($match);
            return ['timeout_processed' => $result];
        }

        $this->info('Match does not need timeout processing');
        return ['status' => 'no_action_needed'];
    }

    /**
     * Display championship timeout status
     */
    protected function displayChampionshipTimeoutStatus(array $status): void
    {
        if (empty($status)) {
            $this->info('No matches with timeouts found.');
            return;
        }

        $this->info('Championship timeout status:');
        foreach ($status as $matchStatus) {
            $this->line("Match {$matchStatus['match_id']}:");
            $this->line("  Scheduled: {$matchStatus['scheduled_time']}");
            $this->line("  Timeout: {$matchStatus['game_timeout']}");
            $this->line("  Time remaining: {$matchStatus['time_remaining_seconds']}s");
            $this->line("  Timed out: " . ($matchStatus['is_timed_out'] ? 'Yes' : 'No'));
            $this->line("  Needs warning: " . ($matchStatus['needs_warning'] ? 'Yes' : 'No'));

            if ($matchStatus['players']['player1']) {
                $player1 = $matchStatus['players']['player1'];
                $this->line("  Player 1: {$player1['username']} (last active: {$player1['last_activity']})");
            }
            if ($matchStatus['players']['player2']) {
                $player2 = $matchStatus['players']['player2'];
                $this->line("  Player 2: {$player2['username']} (last active: {$player2['last_activity']})");
            }
            $this->newLine();
        }
    }

    /**
     * Display the results
     */
    protected function displayResults(array $results): void
    {
        if (isset($results['warnings_sent'])) {
            $this->info("Warnings sent: {$results['warnings_sent']}");
        }

        if (isset($results['timeouts_processed'])) {
            $this->info("Timeouts processed: {$results['timeouts_processed']}");
        }

        if (!empty($results['warnings'])) {
            $this->newLine();
            $this->info('Warnings sent:');
            foreach ($results['warnings'] as $warning) {
                $this->line("- Match {$warning['match_id']}: {$warning['action']}");
                $this->line("  Scheduled for: {$warning['scheduled_time']}");
                $this->line("  Players notified: " . implode(', ', $warning['players_notified']));
            }
        }

        if (!empty($results['timeouts'])) {
            $this->newLine();
            $this->info('Timeouts processed:');
            foreach ($results['timeouts'] as $timeout) {
                $this->line("- Match {$timeout['match_id']}: {$timeout['action']}");
                if (isset($timeout['winner_id'])) {
                    $this->line("  Winner: User {$timeout['winner_id']}");
                }
                if (isset($timeout['loser_id'])) {
                    $this->line("  Loser: User {$timeout['loser_id']}");
                }
                $this->line("  Result: {$timeout['result_type']}");
            }
        }

        if (isset($results['forced_timeout'])) {
            $this->info('Forced timeout processed:');
            $timeout = $results['forced_timeout'];
            $this->line("- Match {$timeout['match_id']}: {$timeout['action']}");
            if (isset($timeout['winner_id'])) {
                $this->line("  Winner: User {$timeout['winner_id']}");
            }
        }

        if (isset($results['timeout_processed'])) {
            if ($results['timeout_processed']) {
                $this->info('Timeout processed:');
                $timeout = $results['timeout_processed'];
                $this->line("- Match {$timeout['match_id']}: {$timeout['action']}");
            } else {
                $this->info('No timeout processing needed for this match.');
            }
        }
    }
}