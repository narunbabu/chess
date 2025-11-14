<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\ChampionshipRoundProgressionService;
use Illuminate\Support\Facades\Log;

class CheckChampionshipRounds extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'championship:check-rounds
                            {--championship= : Specific championship ID to check}
                            {--force : Force round progression even if not complete}
                            {--dry-run : Show what would happen without executing}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Check championship rounds for completion and progress if needed';

    /**
     * @var ChampionshipRoundProgressionService
     */
    protected $roundService;

    /**
     * Create a new command instance.
     *
     * @param ChampionshipRoundProgressionService $roundService
     */
    public function __construct(ChampionshipRoundProgressionService $roundService)
    {
        parent::__construct();
        $this->roundService = $roundService;
    }

    /**
     * Execute the console command.
     *
     * @return int
     */
    public function handle()
    {
        $this->info('Starting championship round check...');

        $championshipId = $this->option('championship');
        $force = $this->option('force');
        $dryRun = $this->option('dry-run');

        try {
            if ($dryRun) {
                $this->warn('DRY RUN MODE - No changes will be made');
            }

            if ($championshipId) {
                $results = $this->checkSpecificChampionship($championshipId, $force, $dryRun);
            } else {
                $results = $this->checkAllChampionships($dryRun);
            }

            $this->displayResults($results);

            $this->info('Championship round check completed successfully.');
            return 0;

        } catch (\Exception $e) {
            $this->error('Error during round check: ' . $e->getMessage());
            Log::error('Championship round check command failed', [
                'error' => $e->getMessage(),
                'championship_id' => $championshipId,
                'force' => $force,
                'dry_run' => $dryRun
            ]);
            return 1;
        }
    }

    /**
     * Check all active championships
     */
    protected function checkAllChampionships(bool $dryRun): array
    {
        $this->info('Checking all active championships...');

        if ($dryRun) {
            // In dry run mode, we'd need to implement a dry run version of the service
            $this->warn('Dry run mode: Showing what rounds would be checked');
            return [
                'championships_checked' => 0,
                'rounds_completed' => 0,
                'championships_completed' => 0,
                'actions' => []
            ];
        }

        return $this->roundService->checkAllChampionships();
    }

    /**
     * Check a specific championship
     */
    protected function checkSpecificChampionship(int $championshipId, bool $force, bool $dryRun): array
    {
        $this->info("Checking championship ID: {$championshipId}");

        $championship = \App\Models\Championship::find($championshipId);
        if (!$championship) {
            throw new \Exception("Championship with ID {$championshipId} not found");
        }

        if ($dryRun) {
            $status = $this->roundService->getRoundStatus($championship);
            $this->line("Current round: {$status['current_round']}");
            $this->line("Total matches: {$status['total_matches']}");
            $this->line("Completed matches: {$status['completed_matches']}");
            $this->line("Is complete: " . ($status['is_complete'] ? 'Yes' : 'No'));

            if ($force && !$status['is_complete']) {
                $this->warn('Force option would attempt to progress this round');
            }

            return ['status' => $status];
        }

        if ($force) {
            $this->warn('Force progressing round...');
            $result = $this->roundService->forceRoundProgression($championship);
            return ['forced_progression' => $result];
        }

        $result = $this->roundService->checkChampionshipRoundProgression($championship);
        return ['progression' => $result];
    }

    /**
     * Display the results
     */
    protected function displayResults(array $results): void
    {
        if (empty($results)) {
            $this->info('No rounds ready for progression.');
            return;
        }

        if (isset($results['championships_checked'])) {
            $this->info("Championships checked: {$results['championships_checked']}");
            $this->info("Rounds completed: {$results['rounds_completed']}");
            $this->info("Championships completed: {$results['championships_completed']}");

            if (!empty($results['actions'])) {
                $this->newLine();
                $this->info('Actions taken:');

                foreach ($results['actions'] as $action) {
                    $this->line("- Championship {$action['championship_id']}: {$action['action']}");
                    if (isset($action['completed_round'])) {
                        $this->line("  Completed round: {$action['completed_round']}");
                    }
                    if (isset($action['next_round'])) {
                        $this->line("  Next round: {$action['next_round']} ({$action['new_matches_count']} matches)");
                    }
                }
            }
        }

        if (isset($results['forced_progression'])) {
            $this->info('Forced progression completed:');
            $action = $results['forced_progression'];
            $this->line("- Championship {$action['championship_id']}: {$action['action']}");
        }

        if (isset($results['progression'])) {
            if ($results['progression']) {
                $this->info('Round progression completed:');
                $action = $results['progression'];
                $this->line("- Championship {$action['championship_id']}: {$action['action']}");
            } else {
                $this->info('No progression needed for this championship.');
            }
        }

        if (isset($results['status'])) {
            $this->info('Round status:');
            $status = $results['status'];
            $this->line("- Current round: {$status['current_round']}");
            $this->line("- Complete: " . ($status['is_complete'] ? 'Yes' : 'No'));
            $this->line("- Progress: {$status['completed_matches']}/{$status['total_matches']} matches");
        }
    }
}