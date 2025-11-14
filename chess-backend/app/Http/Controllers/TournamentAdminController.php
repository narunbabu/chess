<?php

namespace App\Http\Controllers;

use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipStanding;
use App\Services\MatchSchedulerService;
use App\Services\StandingsCalculatorService;
use App\Services\SwissPairingService;
use App\Services\EliminationBracketService;
use App\Jobs\CheckExpiredMatchesJob;
use App\Jobs\SendMatchReminderJob;
use App\Jobs\GenerateNextRoundJob;
use App\Enums\ChampionshipStatus;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class TournamentAdminController extends Controller
{
    public function __construct(
        private MatchSchedulerService $scheduler,
        private StandingsCalculatorService $standingsCalculator,
        private SwissPairingService $swissService,
        private EliminationBracketService $eliminationService
    ) {}

    /**
     * Get tournament overview for admins
     */
    public function overview(): JsonResponse
    {
        $this->authorize('manageTournaments');

        $activeChampionships = Championship::where('status', ChampionshipStatus::IN_PROGRESS->value)
            ->withCount(['matches', 'participants'])
            ->get();

        $upcomingChampionships = Championship::where('status', ChampionshipStatus::REGISTRATION_OPEN->value)
            ->withCount(['matches', 'participants'])
            ->get();

        $completedChampionships = Championship::where('status', ChampionshipStatus::COMPLETED->value)
            ->withCount(['matches', 'participants'])
            ->get();

        // Get recent activity
        $recentMatches = ChampionshipMatch::with(['championship', 'player1', 'player2'])
            ->orderBy('updated_at', 'desc')
            ->limit(10)
            ->get();

        // Get pending matches needing attention
        $urgentMatches = ChampionshipMatch::where('status', 'pending')
            ->where('deadline', '<=', now()->addHours(4))
            ->where('deadline', '>', now())
            ->with(['championship', 'player1', 'player2'])
            ->orderBy('deadline')
            ->limit(20)
            ->get();

        return response()->json([
            'summary' => [
                'active_championships' => $activeChampionships->count(),
                'upcoming_championships' => $upcomingChampionships->count(),
                'completed_championships' => $completedChampionships->count(),
                'urgent_matches' => $urgentMatches->count(),
            ],
            'active_championships' => $activeChampionships,
            'upcoming_championships' => $upcomingChampionships,
            'recent_matches' => $recentMatches,
            'urgent_matches' => $urgentMatches,
        ]);
    }

    /**
     * Start a championship
     */
    public function startChampionship(Request $request, Championship $championship): JsonResponse
    {
        $this->authorize('manage', $championship);

        if (!$championship->getStatusEnum()->canStart()) {
            return response()->json(['error' => 'Championship cannot be started in current status'], 400);
        }

        $request->validate([
            'auto_schedule_first_round' => 'boolean',
            'start_time' => 'nullable|date|after_or_equal:now',
        ]);

        try {
            DB::transaction(function () use ($request, $championship) {
                // Update championship status
                $championship->update([
                    'status' => ChampionshipStatus::IN_PROGRESS->value,
                    'start_date' => $request->start_time ?? now(),
                ]);

                // Optionally schedule first round
                if ($request->auto_schedule_first_round ?? true) {
                    $matchesScheduled = $this->scheduler->scheduleRound($championship, 1);

                    Log::info("Championship started with first round", [
                        'championship_id' => $championship->id,
                        'matches_scheduled' => $matchesScheduled,
                    ]);
                } else {
                    Log::info("Championship started without first round", [
                        'championship_id' => $championship->id,
                    ]);
                }
            });

            $championship->load(['participants.user', 'matches']);

            return response()->json([
                'message' => 'Championship started successfully',
                'championship' => $championship,
                'summary' => $this->scheduler->getSchedulingSummary($championship),
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to start championship", [
                'championship_id' => $championship->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['error' => 'Failed to start championship'], 500);
        }
    }

    /**
     * Pause a championship
     */
    public function pauseChampionship(Championship $championship): JsonResponse
    {
        $this->authorize('manage', $championship);

        if (!$championship->getStatusEnum()->isActive()) {
            return response()->json(['error' => 'Only active championships can be paused'], 400);
        }

        try {
            $championship->update(['status' => ChampionshipStatus::PAUSED->value]);

            Log::info("Championship paused", [
                'championship_id' => $championship->id,
            ]);

            return response()->json([
                'message' => 'Championship paused successfully',
                'championship' => $championship,
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to pause championship", [
                'championship_id' => $championship->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['error' => 'Failed to pause championship'], 500);
        }
    }

    /**
     * Resume a paused championship
     */
    public function resumeChampionship(Championship $championship): JsonResponse
    {
        $this->authorize('manage', $championship);

        if (!$championship->getStatusEnum()->isPaused()) {
            return response()->json(['error' => 'Only paused championships can be resumed'], 400);
        }

        try {
            $championship->update(['status' => ChampionshipStatus::IN_PROGRESS->value]);

            Log::info("Championship resumed", [
                'championship_id' => $championship->id,
            ]);

            return response()->json([
                'message' => 'Championship resumed successfully',
                'championship' => $championship,
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to resume championship", [
                'championship_id' => $championship->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['error' => 'Failed to resume championship'], 500);
        }
    }

    /**
     * Complete a championship manually
     */
    public function completeChampionship(Request $request, Championship $championship): JsonResponse
    {
        $this->authorize('manage', $championship);

        if (!$championship->getStatusEnum()->isActive()) {
            return response()->json(['error' => 'Only active championships can be completed'], 400);
        }

        $request->validate([
            'force' => 'boolean',
            'reason' => 'nullable|string|max:500',
        ]);

        try {
            DB::transaction(function () use ($request, $championship) {
                // Finalize standings
                if ($championship->getFormatEnum()->isSwiss()) {
                    $this->standingsCalculator->recalculateAllStandings($championship);
                }

                // Complete all pending matches as draws if forced
                if ($request->force) {
                    $pendingMatches = $championship->matches()
                        ->pending() // Use model scope instead of direct status query
                        ->get();

                    foreach ($pendingMatches as $match) {
                        $match->update([
                            'status' => 'completed',
                            'result_type' => 'draw',
                            'winner_id' => null,
                            'completed_at' => now(),
                        ]);
                    }
                }

                // Update championship status
                $championship->update([
                    'status' => ChampionshipStatus::COMPLETED->value,
                    'completion_reason' => $request->reason,
                ]);

                Log::info("Championship completed manually", [
                    'championship_id' => $championship->id,
                    'force' => $request->force ?? false,
                    'reason' => $request->reason,
                ]);
            });

            $championship->load(['standings.user', 'matches']);

            return response()->json([
                'message' => 'Championship completed successfully',
                'championship' => $championship,
                'final_standings' => $championship->standings()->orderBy('rank')->get(),
            ]);
        } catch (\Exception $e) {
            Log::error("Failed to complete championship", [
                'championship_id' => $championship->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json(['error' => 'Failed to complete championship'], 500);
        }
    }

    /**
     * Run maintenance tasks
     */
    public function runMaintenance(Request $request): JsonResponse
    {
        $this->authorize('manageTournaments');

        $request->validate([
            'tasks' => 'array',
            'tasks.*' => 'string|in:check_expired,send_reminders,update_standings,clean_orphans',
        ]);

        $tasks = $request->tasks ?? ['check_expired', 'send_reminders', 'update_standings'];
        $results = [];

        foreach ($tasks as $task) {
            try {
                switch ($task) {
                    case 'check_expired':
                        CheckExpiredMatchesJob::dispatchSync();
                        $results[$task] = 'success';
                        break;

                    case 'send_reminders':
                        $reminderJob = new SendMatchReminderJob();
                        $reminderJob->handle();
                        $results[$task] = 'success';
                        break;

                    case 'update_standings':
                        $activeChampionships = Championship::where('status', ChampionshipStatus::IN_PROGRESS->value)
                            ->get();

                        foreach ($activeChampionships as $championship) {
                            if ($championship->getFormatEnum()->isSwiss()) {
                                $this->standingsCalculator->updateStandings($championship);
                            }
                        }
                        $results[$task] = 'success';
                        break;

                    case 'clean_orphans':
                        $this->cleanOrphanedMatches();
                        $results[$task] = 'success';
                        break;
                }
            } catch (\Exception $e) {
                $results[$task] = "error: {$e->getMessage()}";
                Log::error("Maintenance task failed", [
                    'task' => $task,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return response()->json([
            'message' => 'Maintenance tasks completed',
            'results' => $results,
        ]);
    }

    /**
     * Get tournament analytics
     */
    public function getAnalytics(Request $request): JsonResponse
    {
        $this->authorize('manageTournaments');

        $startDate = $request->start_date ?? now()->subDays(30);
        $endDate = $request->end_date ?? now();

        $championships = Championship::whereBetween('created_at', [$startDate, $endDate])
            ->get();

        $totalChampionships = $championships->count();
        $completedChampionships = $championships->where('status', ChampionshipStatus::COMPLETED->value)->count();
        $activeChampionships = $championships->where('status', ChampionshipStatus::IN_PROGRESS->value)->count();

        $totalParticipants = $championships->sum(function ($champ) {
            return $champ->participants()->where('payment_status_id', \App\Enums\PaymentStatus::COMPLETED->getId())->count();
        });

        $totalRevenue = $championships->sum(function ($champ) {
            return $champ->participants()
                ->where('payment_status_id', \App\Enums\PaymentStatus::COMPLETED->getId())
                ->sum('entry_fee');
        });

        $totalMatches = ChampionshipMatch::whereHas('championship', function ($query) use ($startDate, $endDate) {
            $query->whereBetween('created_at', [$startDate, $endDate]);
        })->count();

        $completedMatches = ChampionshipMatch::whereHas('championship', function ($query) use ($startDate, $endDate) {
            $query->whereBetween('created_at', [$startDate, $endDate]);
        })->completed()->count(); // Use model scope instead of direct status query

        // Format distribution
        $formatDistribution = $championships->groupBy('format')->map->count();

        return response()->json([
            'period' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
            ],
            'championships' => [
                'total' => $totalChampionships,
                'completed' => $completedChampionships,
                'active' => $activeChampionships,
                'completion_rate' => $totalChampionships > 0 ? round(($completedChampionships / $totalChampionships) * 100, 1) : 0,
            ],
            'participants' => [
                'total' => $totalParticipants,
                'average_per_championship' => $totalChampionships > 0 ? round($totalParticipants / $totalChampionships, 1) : 0,
            ],
            'revenue' => [
                'total' => $totalRevenue,
                'average_per_championship' => $totalChampionships > 0 ? round($totalRevenue / $totalChampionships, 2) : 0,
                'average_per_participant' => $totalParticipants > 0 ? round($totalRevenue / $totalParticipants, 2) : 0,
            ],
            'matches' => [
                'total' => $totalMatches,
                'completed' => $completedMatches,
                'completion_rate' => $totalMatches > 0 ? round(($completedMatches / $totalMatches) * 100, 1) : 0,
            ],
            'format_distribution' => $formatDistribution,
        ]);
    }

    /**
     * Clean orphaned matches
     */
    private function cleanOrphanedMatches(): void
    {
        // Find matches without valid championships
        $orphanedMatches = ChampionshipMatch::whereDoesntHave('championship')->get();

        foreach ($orphanedMatches as $match) {
            Log::warning("Deleting orphaned match", [
                'match_id' => $match->id,
            ]);
            $match->delete();
        }

        // Find standings without valid championships
        $orphanedStandings = ChampionshipStanding::whereDoesntHave('championship')->get();

        foreach ($orphanedStandings as $standing) {
            Log::warning("Deleting orphaned standing", [
                'standing_id' => $standing->id,
            ]);
            $standing->delete();
        }
    }

    /**
     * Validate tournament integrity
     */
    public function validateTournament(Championship $championship): JsonResponse
    {
        $this->authorize('manage', $championship);

        $errors = [];

        // Validate championship structure
        try {
            if ($championship->getFormatEnum()->isElimination()) {
                $bracketErrors = $this->eliminationService->validateBracket($championship);
                $errors = array_merge($errors, $bracketErrors);
            }

            if ($championship->getFormatEnum()->isSwiss()) {
                $standingsErrors = $this->standingsCalculator->validateStandings($championship);
                $errors = array_merge($errors, $standingsErrors);
            }
        } catch (\Exception $e) {
            $errors[] = "Validation error: {$e->getMessage()}";
        }

        // Check for data inconsistencies
        $participantCount = $championship->participants()
            ->where('payment_status_id', \App\Enums\PaymentStatus::COMPLETED->getId())
            ->count();

        if ($participantCount < 2 && $championship->getStatusEnum()->isActive()) {
            $errors[] = "Active championship has fewer than 2 eligible participants";
        }

        // Check matches for inconsistencies
        $invalidMatches = $championship->matches()
            ->where(function ($query) {
                $query->whereNull('player1_id')
                      ->orWhereNull('player2_id')
                      ->orWhereColumn('player1_id', 'player2_id');
            })
            ->count();

        if ($invalidMatches > 0) {
            $errors[] = "Found {$invalidMatches} matches with invalid participant data";
        }

        return response()->json([
            'valid' => empty($errors),
            'errors' => $errors,
            'championship_summary' => [
                'id' => $championship->id,
                'title' => $championship->title,
                'status' => $championship->status,
                'format' => $championship->format,
                'participants' => $participantCount,
                'matches' => $championship->matches()->count(),
            ],
        ]);
    }

    /**
     * Get system health metrics
     */
    public function getSystemHealth(): JsonResponse
    {
        $this->authorize('manageTournaments');

        // Queue health
        $queueSize = \Illuminate\Support\Facades\Queue::size();
        $failedJobs = \Illuminate\Support\Facades\DB::table('failed_jobs')->count();

        // Database health (SQLite compatible)
        $dbSize = 0;
        try {
            if (config('database.default') === 'sqlite') {
                $dbPath = database_path('database.sqlite');
                $dbSize = file_exists($dbPath) ? filesize($dbPath) : 0;
            } else {
                // MySQL/PostgreSQL
                $dbSize = \Illuminate\Support\Facades\DB::select('SELECT SUM(data_length + index_length) as size FROM information_schema.TABLES WHERE table_schema = DATABASE()')[0]->size ?? 0;
            }
        } catch (\Exception $e) {
            Log::warning('Could not get database size', ['error' => $e->getMessage()]);
        }

        // Recent errors
        $recentErrors = \Illuminate\Support\Facades\Log::getLogger()->getHandlers(); // This would need actual error logging implementation

        return response()->json([
            'queue' => [
                'pending_jobs' => $queueSize,
                'failed_jobs' => $failedJobs,
                'healthy' => $queueSize < 100 && $failedJobs < 10,
            ],
            'database' => [
                'size_mb' => round($dbSize / 1024 / 1024, 2),
                'healthy' => true, // Could add more checks
            ],
            'tournaments' => [
                'active_championships' => Championship::where('status', ChampionshipStatus::IN_PROGRESS->value)->count(),
                'urgent_matches' => ChampionshipMatch::where('status', 'pending')
                    ->where('deadline', '<=', now()->addHours(4))
                    ->count(),
                'healthy' => true, // Could add more checks
            ],
            'overall' => [
                'healthy' => true, // Combine all health checks
                'last_check' => now(),
            ],
        ]);
    }
}