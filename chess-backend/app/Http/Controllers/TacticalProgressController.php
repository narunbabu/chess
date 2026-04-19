<?php

namespace App\Http\Controllers;

use App\Models\TacticalBadge;
use App\Models\TacticalPuzzleAttempt;
use App\Models\UserTacticalBadge;
use App\Models\UserTacticalStageProgress;
use App\Models\UserTacticalStats;
use App\Services\TacticalRatingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class TacticalProgressController extends Controller
{
    private const RATING_FLOOR = 800;
    private const RATING_CEIL = 2400;

    /**
     * Solves required in a stage before the next stage unlocks.
     * Mirrors stages[].unlockAfter on the frontend (tacticalStages.js).
     */
    private const STAGE_UNLOCK_AFTER = [
        0 => 15,
        1 => 20,
        2 => 20,
        3 => 20,
        4 => 999,
    ];

    /**
     * Tactical trainer progress for the authenticated user.
     *
     * GET /api/v1/tactical/progress
     */
    public function progress(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $stats = UserTacticalStats::firstOrNew(['user_id' => $userId]);

        return response()->json($this->buildProgressPayload($userId, $stats));
    }

    /**
     * Record a tactical puzzle attempt and update stats / stage progress / badges.
     *
     * POST /api/v1/tactical/attempts
     */
    public function attempt(Request $request, TacticalRatingService $ratingService): JsonResponse
    {
        $data = $request->validate([
            'stage_id' => ['required', 'integer', 'min:0', 'max:255'],
            'puzzle_id' => ['required', 'string', 'max:32'],
            'puzzle_rating' => ['nullable', 'integer', 'min:0'],
            'puzzle_difficulty' => ['nullable', 'string', 'in:easy,medium,hard,very hard'],
            'success' => ['required', 'boolean'],
            'wrong_count' => ['nullable', 'integer', 'min:0', 'max:65535'],
            'solution_shown' => ['nullable', 'boolean'],
            'cct_my_found' => ['nullable', 'integer', 'min:0', 'max:255'],
            'cct_my_total' => ['nullable', 'integer', 'min:0', 'max:255'],
            'cct_opp_found' => ['nullable', 'integer', 'min:0', 'max:255'],
            'cct_opp_total' => ['nullable', 'integer', 'min:0', 'max:255'],
            'time_spent_ms' => ['nullable', 'integer', 'min:0'],
            'stage_total_puzzles' => ['nullable', 'integer', 'min:1'],
        ]);

        $userId = $request->user()->id;
        $stageId = (int) $data['stage_id'];
        $puzzleId = (string) $data['puzzle_id'];
        $success = (bool) $data['success'];
        $wrongCount = (int) ($data['wrong_count'] ?? 0);
        $solutionShown = (bool) ($data['solution_shown'] ?? false);

        $myFound = (int) ($data['cct_my_found'] ?? 0);
        $myTotal = (int) ($data['cct_my_total'] ?? 0);
        $oppFound = min((int) ($data['cct_opp_found'] ?? 0), 255);
        $oppTotal = min((int) ($data['cct_opp_total'] ?? 0), 255);
        $myFound = min($myFound, $myTotal);
        $oppFound = min($oppFound, $oppTotal);

        $cctAttempted = $myTotal > 0 || $oppTotal > 0;
        $puzzleScore = $this->computePuzzleScore(
            $wrongCount,
            $myFound,
            $myTotal,
            $oppFound,
            $oppTotal,
            $solutionShown
        );

        $puzzleForRating = [
            'difficulty' => $data['puzzle_difficulty'] ?? $this->difficultyFromRating($data['puzzle_rating'] ?? null),
        ];

        $deltaInfo = $cctAttempted
            ? $ratingService->computeRatingDelta($puzzleForRating, $success, $wrongCount, $puzzleScore['cctQuality'])
            : ['value' => 0, 'sign' => '+'];

        $signedDelta = $deltaInfo['sign'] === '-' ? -$deltaInfo['value'] : $deltaInfo['value'];

        $result = DB::transaction(function () use (
            $userId,
            $stageId,
            $puzzleId,
            $success,
            $wrongCount,
            $solutionShown,
            $myFound,
            $myTotal,
            $oppFound,
            $oppTotal,
            $cctAttempted,
            $puzzleScore,
            $signedDelta,
            $data
        ) {
            $stats = UserTacticalStats::firstOrNew(['user_id' => $userId]);
            if (!$stats->exists) {
                $stats->rating = 1000;
                $stats->peak_rating = 1000;
            }
            $ratingBefore = (int) ($stats->rating ?? 1000);

            $stage = UserTacticalStageProgress::firstOrNew([
                'user_id' => $userId,
                'stage_id' => $stageId,
            ]);
            if (!$stage->exists) {
                $stage->unlocked = $stageId === 0;
            }

            $ratingAfter = $ratingBefore;

            if ($cctAttempted) {
                $stats->total_attempted = (int) ($stats->total_attempted ?? 0) + 1;

                if ($success) {
                    $newRating = max(self::RATING_FLOOR, min(self::RATING_CEIL, $ratingBefore + $signedDelta));
                    $stats->rating = $newRating;
                    $stats->total_solved = (int) ($stats->total_solved ?? 0) + 1;
                    $stats->streak = (int) ($stats->streak ?? 0) + 1;
                    $stats->best_streak = max((int) ($stats->best_streak ?? 0), $stats->streak);
                    $stats->peak_rating = max((int) ($stats->peak_rating ?? 1000), $newRating);
                    $stats->last_solved_at = Carbon::now();
                    $ratingAfter = $newRating;
                } else {
                    $newRating = max(self::RATING_FLOOR, min(self::RATING_CEIL, $ratingBefore + $signedDelta));
                    $stats->rating = $newRating;
                    $stats->streak = 0;
                    $ratingAfter = $newRating;
                }

                $stage->attempted = (int) ($stage->attempted ?? 0) + 1;
                $completedIds = is_array($stage->completed_puzzle_ids) ? $stage->completed_puzzle_ids : [];
                $puzzleScores = is_array($stage->puzzle_scores) ? $stage->puzzle_scores : [];

                if ($success) {
                    $stage->solved = (int) ($stage->solved ?? 0) + 1;
                    if (!in_array($puzzleId, $completedIds, true)) {
                        $completedIds[] = $puzzleId;
                    }
                }

                $existingScore = $puzzleScores[$puzzleId] ?? null;
                $existingCombined = $existingScore['combined'] ?? null;
                $newCombined = $puzzleScore['combined'];
                if ($existingCombined === null || ($newCombined !== null && $newCombined > $existingCombined)) {
                    $puzzleScores[$puzzleId] = $puzzleScore;
                }

                $stage->completed_puzzle_ids = $completedIds;
                $stage->puzzle_scores = $puzzleScores;

                $stageTotal = isset($data['stage_total_puzzles']) ? (int) $data['stage_total_puzzles'] : null;
                if ($stageTotal !== null && $stage->solved >= $stageTotal && $stage->completed_at === null) {
                    $stage->completed_at = Carbon::now();
                }

                $stage->save();
                $stats->save();

                $unlockAfter = self::STAGE_UNLOCK_AFTER[$stageId] ?? 999;
                if ($success && $stage->solved >= $unlockAfter) {
                    $nextStageId = $stageId + 1;
                    if (array_key_exists($nextStageId, self::STAGE_UNLOCK_AFTER)) {
                        $next = UserTacticalStageProgress::firstOrNew([
                            'user_id' => $userId,
                            'stage_id' => $nextStageId,
                        ]);
                        if (!$next->unlocked) {
                            $next->unlocked = true;
                            $next->save();
                        }
                    }
                }
            } else {
                if (!$stats->exists) {
                    $stats->save();
                }
                if (!$stage->exists) {
                    $stage->save();
                }
            }

            $cctQualityPct = $cctAttempted ? (int) round($puzzleScore['cctQuality'] * 100) : null;
            TacticalPuzzleAttempt::create([
                'user_id' => $userId,
                'stage_id' => $stageId,
                'puzzle_id' => $puzzleId,
                'puzzle_rating' => $data['puzzle_rating'] ?? null,
                'success' => $success,
                'wrong_count' => $wrongCount,
                'solution_shown' => $solutionShown,
                'cct_my_found' => $myFound,
                'cct_my_total' => $myTotal,
                'cct_opp_found' => $oppFound,
                'cct_opp_total' => $oppTotal,
                'cct_attempted' => $cctAttempted,
                'cct_quality' => $cctQualityPct,
                'puzzle_score' => $puzzleScore['combined'],
                'score_breakdown' => $puzzleScore,
                'rating_delta' => $signedDelta,
                'rating_before' => $ratingBefore,
                'rating_after' => $ratingAfter,
                'time_spent_ms' => $data['time_spent_ms'] ?? null,
                'created_at' => Carbon::now(),
            ]);

            $awarded = $this->awardBadges($userId, $stats);

            return [
                'stats' => $stats,
                'rating_before' => $ratingBefore,
                'rating_after' => $ratingAfter,
                'awarded' => $awarded,
            ];
        });

        $payload = $this->buildProgressPayload($userId, $result['stats']);
        $payload['attempt'] = [
            'puzzleId' => $puzzleId,
            'stageId' => $stageId,
            'success' => $success,
            'wrongCount' => $wrongCount,
            'solutionShown' => $solutionShown,
            'cctAttempted' => $cctAttempted,
            'puzzleScore' => $puzzleScore,
            'ratingDelta' => [
                'value' => $deltaInfo['value'],
                'sign' => $deltaInfo['sign'],
                'signed' => $signedDelta,
            ],
            'ratingBefore' => $result['rating_before'],
            'ratingAfter' => $result['rating_after'],
            'awardedBadges' => $result['awarded'],
        ];

        return response()->json($payload);
    }

    /**
     * Bulk-ingest legacy localStorage progress. Idempotent by (user_id, puzzle_id):
     * re-posting the same payload creates no duplicate attempts, and numeric counters
     * are merged with MAX so an older snapshot can never regress server-side state.
     *
     * POST /api/v1/tactical/sync
     */
    public function sync(Request $request): JsonResponse
    {
        $data = $request->validate([
            'rating' => ['nullable', 'integer', 'min:0', 'max:4000'],
            'totalAttempted' => ['nullable', 'integer', 'min:0'],
            'totalSolved' => ['nullable', 'integer', 'min:0'],
            'streak' => ['nullable', 'integer', 'min:0'],
            'stageProgress' => ['nullable', 'array'],
            'stageProgress.*.attempted' => ['nullable', 'integer', 'min:0'],
            'stageProgress.*.solved' => ['nullable', 'integer', 'min:0'],
            'stageProgress.*.unlocked' => ['nullable', 'boolean'],
            'stageProgress.*.lastIndex' => ['nullable', 'integer', 'min:0'],
            'stageProgress.*.completedPuzzleIds' => ['nullable', 'array'],
            'stageProgress.*.completedPuzzleIds.*' => ['string', 'max:32'],
        ]);

        $userId = $request->user()->id;
        $legacyRating = isset($data['rating']) ? (int) $data['rating'] : null;
        $legacyStreak = isset($data['streak']) ? (int) $data['streak'] : null;
        $legacyTotalAttempted = isset($data['totalAttempted']) ? (int) $data['totalAttempted'] : null;
        $legacyTotalSolved = isset($data['totalSolved']) ? (int) $data['totalSolved'] : null;
        $stageProgressPayload = $data['stageProgress'] ?? [];

        $result = DB::transaction(function () use (
            $userId,
            $legacyRating,
            $legacyStreak,
            $legacyTotalAttempted,
            $legacyTotalSolved,
            $stageProgressPayload
        ) {
            $existingPuzzleIds = TacticalPuzzleAttempt::where('user_id', $userId)
                ->where('success', true)
                ->pluck('puzzle_id')
                ->all();
            $existingSet = array_fill_keys($existingPuzzleIds, true);

            $importedByStage = [];
            $skippedByStage = [];
            $newAttemptRows = [];
            $now = Carbon::now();

            foreach ($stageProgressPayload as $rawStageId => $stage) {
                $stageId = (int) $rawStageId;
                if ($stageId < 0 || $stageId > 255) {
                    continue;
                }
                $completed = $stage['completedPuzzleIds'] ?? [];
                if (!is_array($completed)) {
                    continue;
                }
                $imported = 0;
                $skipped = 0;
                foreach ($completed as $rawPuzzleId) {
                    $puzzleId = trim((string) $rawPuzzleId);
                    if ($puzzleId === '' || strlen($puzzleId) > 32) {
                        continue;
                    }
                    if (isset($existingSet[$puzzleId])) {
                        $skipped++;
                        continue;
                    }
                    $existingSet[$puzzleId] = true;
                    $imported++;
                    $newAttemptRows[] = [
                        'user_id' => $userId,
                        'stage_id' => $stageId,
                        'puzzle_id' => $puzzleId,
                        'puzzle_rating' => null,
                        'success' => true,
                        'wrong_count' => 0,
                        'solution_shown' => false,
                        'cct_my_found' => 0,
                        'cct_my_total' => 0,
                        'cct_opp_found' => 0,
                        'cct_opp_total' => 0,
                        'cct_attempted' => false,
                        'cct_quality' => null,
                        'puzzle_score' => null,
                        'score_breakdown' => json_encode(['legacy' => true]),
                        'rating_delta' => 0,
                        'rating_before' => null,
                        'rating_after' => null,
                        'time_spent_ms' => null,
                        'created_at' => $now,
                    ];
                }
                $importedByStage[$stageId] = $imported;
                $skippedByStage[$stageId] = $skipped;
            }

            if (!empty($newAttemptRows)) {
                foreach (array_chunk($newAttemptRows, 500) as $chunk) {
                    TacticalPuzzleAttempt::insert($chunk);
                }
            }

            $stats = UserTacticalStats::firstOrNew(['user_id' => $userId]);
            if (!$stats->exists) {
                $stats->rating = 1000;
                $stats->peak_rating = 1000;
            }

            $stageIds = array_keys($stageProgressPayload);
            $existingStages = UserTacticalStageProgress::where('user_id', $userId)
                ->get()
                ->keyBy(fn ($row) => (int) $row->stage_id);

            $touchedStageIds = array_unique(array_merge(
                array_map('intval', $stageIds),
                $existingStages->keys()->all()
            ));

            $stageSummaries = [];
            foreach ($touchedStageIds as $stageId) {
                $incoming = $stageProgressPayload[$stageId] ?? $stageProgressPayload[(string) $stageId] ?? null;
                $row = $existingStages->get($stageId) ?? UserTacticalStageProgress::firstOrNew([
                    'user_id' => $userId,
                    'stage_id' => $stageId,
                ]);
                if (!$row->exists) {
                    $row->unlocked = $stageId === 0;
                }

                $currentIds = is_array($row->completed_puzzle_ids) ? $row->completed_puzzle_ids : [];
                $mergedIds = $currentIds;

                if (is_array($incoming)) {
                    $incomingIds = $incoming['completedPuzzleIds'] ?? [];
                    if (is_array($incomingIds)) {
                        foreach ($incomingIds as $rawPuzzleId) {
                            $puzzleId = trim((string) $rawPuzzleId);
                            if ($puzzleId !== '' && !in_array($puzzleId, $mergedIds, true)) {
                                $mergedIds[] = $puzzleId;
                            }
                        }
                    }
                    if (isset($incoming['unlocked']) && $incoming['unlocked']) {
                        $row->unlocked = true;
                    }
                    if (isset($incoming['lastIndex'])) {
                        $row->last_index = max((int) $row->last_index, (int) $incoming['lastIndex']);
                    }
                }

                $solvedFromIds = count($mergedIds);
                $incomingSolved = (int) ($incoming['solved'] ?? 0);
                $incomingAttempted = (int) ($incoming['attempted'] ?? 0);

                $row->completed_puzzle_ids = $mergedIds;
                $row->solved = max((int) $row->solved, $incomingSolved, $solvedFromIds);
                $row->attempted = max((int) $row->attempted, $incomingAttempted, $row->solved);
                $row->save();

                $stageSummaries[] = [
                    'stageId' => $stageId,
                    'imported' => $importedByStage[$stageId] ?? 0,
                    'skipped' => $skippedByStage[$stageId] ?? 0,
                    'solved' => (int) $row->solved,
                    'attempted' => (int) $row->attempted,
                ];
            }

            $aggregateSolved = UserTacticalStageProgress::where('user_id', $userId)->sum('solved');
            $aggregateAttempted = UserTacticalStageProgress::where('user_id', $userId)->sum('attempted');

            $stats->total_solved = max((int) ($stats->total_solved ?? 0), (int) $legacyTotalSolved, (int) $aggregateSolved);
            $stats->total_attempted = max((int) ($stats->total_attempted ?? 0), (int) $legacyTotalAttempted, (int) $aggregateAttempted, (int) $stats->total_solved);

            if ($legacyRating !== null) {
                $clampedLegacyRating = max(self::RATING_FLOOR, min(self::RATING_CEIL, $legacyRating));
                $stats->rating = max((int) ($stats->rating ?? 1000), $clampedLegacyRating);
                $stats->peak_rating = max((int) ($stats->peak_rating ?? 1000), $stats->rating);
            }
            if ($legacyStreak !== null) {
                $stats->best_streak = max((int) ($stats->best_streak ?? 0), $legacyStreak);
            }
            $stats->save();

            $awarded = $this->awardBadges($userId, $stats);

            return [
                'stats' => $stats,
                'stageSummaries' => $stageSummaries,
                'importedTotal' => array_sum($importedByStage),
                'skippedTotal' => array_sum($skippedByStage),
                'awarded' => $awarded,
            ];
        });

        $payload = $this->buildProgressPayload($userId, $result['stats']);
        $payload['sync'] = [
            'importedAttempts' => $result['importedTotal'],
            'skippedAttempts' => $result['skippedTotal'],
            'stages' => $result['stageSummaries'],
            'awardedBadges' => $result['awarded'],
        ];

        return response()->json($payload);
    }

    /**
     * Tactical leaderboard ranked by scope with optional weekly period.
     *
     * GET /api/v1/tactical/leaderboard?scope=rating|solved|streak&period=all|weekly&page=1&per_page=25
     */
    public function leaderboard(Request $request): JsonResponse
    {
        $data = $request->validate([
            'scope' => ['nullable', 'string', 'in:rating,solved,streak'],
            'period' => ['nullable', 'string', 'in:all,weekly'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $scope = $data['scope'] ?? 'rating';
        $period = $data['period'] ?? 'all';
        $perPage = (int) ($data['per_page'] ?? 25);
        $userId = $request->user()->id;

        if ($period === 'weekly' && $scope === 'solved') {
            return $this->weeklySolvedLeaderboard($userId, $perPage);
        }

        $query = UserTacticalStats::join('users', 'users.id', '=', 'user_tactical_stats.user_id')
            ->whereNotNull('users.name');

        if ($period === 'weekly') {
            $query->where('user_tactical_stats.last_solved_at', '>=', Carbon::now()->subDays(7));
        }

        $rankColumn = match ($scope) {
            'solved' => 'user_tactical_stats.total_solved',
            'streak' => 'user_tactical_stats.streak',
            default => 'user_tactical_stats.rating',
        };

        $query->orderByDesc($rankColumn)
            ->orderByDesc('user_tactical_stats.user_id');

        $userRank = $this->computeUserRank($scope, $period, $userId);

        $paginator = $query->paginate($perPage, [
            'user_tactical_stats.user_id',
            'users.name',
            'users.avatar_url',
            'user_tactical_stats.rating',
            'user_tactical_stats.total_solved',
            'user_tactical_stats.streak',
            'user_tactical_stats.best_streak',
            'user_tactical_stats.peak_rating',
        ]);

        $rows = $paginator->getCollection()->values()->map(function ($row, $i) use ($paginator) {
            return [
                'rank' => ($paginator->currentPage() - 1) * $paginator->perPage() + $i + 1,
                'userId' => (int) $row->user_id,
                'name' => $row->name,
                'avatarUrl' => $row->avatar_url,
                'rating' => (int) $row->rating,
                'totalSolved' => (int) $row->total_solved,
                'streak' => (int) $row->streak,
                'bestStreak' => (int) $row->best_streak,
                'peakRating' => (int) $row->peak_rating,
            ];
        });

        return response()->json([
            'leaderboard' => $rows,
            'meta' => [
                'scope' => $scope,
                'period' => $period,
                'currentPage' => $paginator->currentPage(),
                'lastPage' => $paginator->lastPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
            'currentUserRank' => $userRank,
        ]);
    }

    /**
     * Weekly solved: rank by count of successful attempts in last 7 days.
     */
    private function weeklySolvedLeaderboard(int $userId, int $perPage): JsonResponse
    {
        $since = Carbon::now()->subDays(7);

        $userRank = DB::selectOne("
            SELECT COUNT(*) + 1 AS rank
            FROM (
                SELECT user_id, COUNT(*) AS cnt
                FROM tactical_puzzle_attempts
                WHERE success = 1 AND created_at >= ?
                GROUP BY user_id
                HAVING cnt > (
                    SELECT COUNT(*) FROM tactical_puzzle_attempts
                    WHERE success = 1 AND user_id = ? AND created_at >= ?
                )
            ) sub
        ", [$since, $userId, $since]);

        $rows = TacticalPuzzleAttempt::select('user_id', DB::raw('COUNT(*) as weekly_solved'))
            ->where('success', true)
            ->where('created_at', '>=', $since)
            ->groupBy('user_id')
            ->orderByDesc('weekly_solved')
            ->orderByDesc('user_id')
            ->paginate($perPage);

        $userIds = $rows->getCollection()->pluck('user_id')->all();
        $users = User::whereIn('id', $userIds)->get()->keyBy('id');

        $statsMap = UserTacticalStats::whereIn('user_id', $userIds)->get()->keyBy('user_id');

        $mapped = $rows->getCollection()->values()->map(function ($row, $i) use ($rows, $users, $statsMap) {
            $user = $users->get($row->user_id);
            $stats = $statsMap->get($row->user_id);
            return [
                'rank' => ($rows->currentPage() - 1) * $rows->perPage() + $i + 1,
                'userId' => (int) $row->user_id,
                'name' => $user?->name,
                'avatarUrl' => $user?->avatar_url,
                'rating' => (int) ($stats?->rating ?? 1000),
                'totalSolved' => (int) ($stats?->total_solved ?? 0),
                'streak' => (int) ($stats?->streak ?? 0),
                'bestStreak' => (int) ($stats?->best_streak ?? 0),
                'peakRating' => (int) ($stats?->peak_rating ?? 1000),
                'weeklySolved' => (int) $row->weekly_solved,
            ];
        });

        return response()->json([
            'leaderboard' => $mapped,
            'meta' => [
                'scope' => 'solved',
                'period' => 'weekly',
                'currentPage' => $rows->currentPage(),
                'lastPage' => $rows->lastPage(),
                'perPage' => $rows->perPage(),
                'total' => $rows->total(),
            ],
            'currentUserRank' => $userRank ? (int) $userRank->rank : null,
        ]);
    }

    /**
     * Compute the current user's absolute rank for the given scope/period.
     */
    private function computeUserRank(string $scope, string $period, int $userId): ?int
    {
        $stats = UserTacticalStats::where('user_id', $userId)->first();
        if (!$stats) {
            return null;
        }

        $query = UserTacticalStats::whereNotNull('user_id');

        if ($period === 'weekly') {
            $query->where('last_solved_at', '>=', Carbon::now()->subDays(7));
        }

        $rankColumn = match ($scope) {
            'solved' => 'total_solved',
            'streak' => 'streak',
            default => 'rating',
        };

        $myValue = (int) ($stats->{$rankColumn} ?? 0);

        $rank = $query->where($rankColumn, '>', $myValue)->count() + 1;

        return $rank;
    }

    /**
     * Mirror of frontend computePuzzleScore (tacticalStages.js).
     * Returns associative array suitable for JSON serialization.
     */
    private function computePuzzleScore(
        int $wrongCount,
        int $myFound,
        int $myTotal,
        int $oppFound,
        int $oppTotal,
        bool $solutionShown
    ): array {
        $cctAttempted = $myTotal > 0 || $oppTotal > 0;

        if (!$cctAttempted) {
            $cctScore = null;
            $cctQuality = 0.0;
        } else {
            $myQuality = $myTotal > 0 ? $myFound / $myTotal : 1.0;
            $oppQuality = $oppTotal > 0 ? $oppFound / $oppTotal : 1.0;
            $cctQuality = ($myQuality + $oppQuality) / 2;
            $cctScore = (int) round($cctQuality * 100);
        }

        $execScore = $solutionShown ? 0
            : ($wrongCount === 0 ? 100
            : ($wrongCount === 1 ? 75
            : ($wrongCount === 2 ? 50
            : ($wrongCount === 3 ? 25
            : 10))));

        $combined = $cctAttempted ? (int) round($cctScore * 0.4 + $execScore * 0.6) : null;

        return [
            'cctScore' => $cctScore,
            'execScore' => $execScore,
            'combined' => $combined,
            'cctQuality' => $cctQuality,
            'cctAttempted' => $cctAttempted,
            'myFound' => $myFound,
            'myTotal' => $myTotal,
            'oppFound' => $oppFound,
            'oppTotal' => $oppTotal,
            'solutionShown' => $solutionShown,
        ];
    }

    /**
     * Map a Lichess puzzle rating to the difficulty bucket used by the rating service.
     */
    private function difficultyFromRating(?int $rating): string
    {
        if ($rating === null) {
            return 'easy';
        }
        if ($rating >= 2000) {
            return 'very hard';
        }
        if ($rating >= 1700) {
            return 'hard';
        }
        if ($rating >= 1400) {
            return 'medium';
        }
        return 'easy';
    }

    /**
     * Award any newly earned badges based on the user's current stats / attempt log.
     * Returns the list of newly-awarded badges (empty when no new badges).
     */
    private function awardBadges(int $userId, UserTacticalStats $stats): array
    {
        $alreadyAwarded = UserTacticalBadge::where('user_id', $userId)->pluck('badge_id')->all();
        $candidates = TacticalBadge::where('is_active', true)
            ->whereNotIn('id', $alreadyAwarded)
            ->get();

        if ($candidates->isEmpty()) {
            return [];
        }

        $perfectSolves = null;
        $perfectCct = null;
        $stageCompletedIds = null;
        $awarded = [];

        foreach ($candidates as $badge) {
            $criteria = $badge->criteria ?? [];
            $type = $criteria['type'] ?? null;
            $value = (int) ($criteria['value'] ?? 0);

            $earned = false;
            switch ($type) {
                case 'solves_total':
                    $earned = (int) ($stats->total_solved ?? 0) >= $value;
                    break;
                case 'streak':
                    $earned = (int) ($stats->best_streak ?? 0) >= $value;
                    break;
                case 'rating':
                    $earned = (int) ($stats->peak_rating ?? 1000) >= $value;
                    break;
                case 'perfect_solves':
                    if ($perfectSolves === null) {
                        $perfectSolves = TacticalPuzzleAttempt::where('user_id', $userId)
                            ->where('success', true)
                            ->where('wrong_count', 0)
                            ->where('solution_shown', false)
                            ->count();
                    }
                    $earned = $perfectSolves >= $value;
                    break;
                case 'perfect_cct':
                    if ($perfectCct === null) {
                        $perfectCct = TacticalPuzzleAttempt::where('user_id', $userId)
                            ->where('cct_attempted', true)
                            ->where('cct_quality', 100)
                            ->count();
                    }
                    $earned = $perfectCct >= $value;
                    break;
                case 'stage_complete':
                    if ($stageCompletedIds === null) {
                        $stageCompletedIds = UserTacticalStageProgress::where('user_id', $userId)
                            ->whereNotNull('completed_at')
                            ->pluck('stage_id')
                            ->map(fn ($id) => (int) $id)
                            ->all();
                    }
                    $earned = in_array($value, $stageCompletedIds, true);
                    break;
            }

            if (!$earned) {
                continue;
            }

            UserTacticalBadge::create([
                'user_id' => $userId,
                'badge_id' => $badge->id,
                'awarded_at' => Carbon::now(),
                'progress_snapshot' => [
                    'rating' => (int) ($stats->rating ?? 1000),
                    'total_solved' => (int) ($stats->total_solved ?? 0),
                    'best_streak' => (int) ($stats->best_streak ?? 0),
                    'peak_rating' => (int) ($stats->peak_rating ?? 1000),
                ],
            ]);

            $awarded[] = [
                'badgeId' => $badge->id,
                'slug' => $badge->slug,
                'name' => $badge->name,
                'tier' => $badge->tier,
                'icon' => $badge->icon,
            ];
        }

        return $awarded;
    }

    /**
     * Build the progress response payload (shared between GET /progress and POST /attempts).
     */
    private function buildProgressPayload(int $userId, UserTacticalStats $stats): array
    {
        $stageProgress = UserTacticalStageProgress::where('user_id', $userId)
            ->orderBy('stage_id')
            ->get()
            ->map(fn ($row) => [
                'stageId' => (int) $row->stage_id,
                'attempted' => (int) $row->attempted,
                'solved' => (int) $row->solved,
                'unlocked' => (bool) $row->unlocked,
                'lastIndex' => (int) $row->last_index,
                'completedPuzzleIds' => $row->completed_puzzle_ids ?? [],
                'puzzleScores' => $row->puzzle_scores ?? [],
                'completedAt' => optional($row->completed_at)->toIso8601String(),
                'updatedAt' => optional($row->updated_at)->toIso8601String(),
            ]);

        $badges = UserTacticalBadge::with('badge')
            ->where('user_id', $userId)
            ->get()
            ->map(fn ($row) => [
                'badgeId' => (int) $row->badge_id,
                'slug' => $row->badge?->slug,
                'name' => $row->badge?->name,
                'description' => $row->badge?->description,
                'category' => $row->badge?->category,
                'tier' => $row->badge?->tier,
                'icon' => $row->badge?->icon,
                'awardedAt' => optional($row->awarded_at)->toIso8601String(),
                'progressSnapshot' => $row->progress_snapshot,
            ]);

        $lastSyncedAt = collect([
            $stats->exists ? $stats->updated_at : null,
            UserTacticalStageProgress::where('user_id', $userId)->max('updated_at'),
            UserTacticalBadge::where('user_id', $userId)->max('updated_at'),
        ])
            ->filter()
            ->map(fn ($t) => $t instanceof Carbon ? $t : Carbon::parse($t))
            ->max();

        return [
            'stats' => [
                'rating' => (int) ($stats->rating ?? 1000),
                'totalAttempted' => (int) ($stats->total_attempted ?? 0),
                'totalSolved' => (int) ($stats->total_solved ?? 0),
                'streak' => (int) ($stats->streak ?? 0),
                'bestStreak' => (int) ($stats->best_streak ?? 0),
                'peakRating' => (int) ($stats->peak_rating ?? 1000),
                'lastSolvedAt' => optional($stats->last_solved_at)->toIso8601String(),
            ],
            'stageProgress' => $stageProgress,
            'badges' => $badges,
            'lastSyncedAt' => optional($lastSyncedAt)->toIso8601String(),
        ];
    }
}
