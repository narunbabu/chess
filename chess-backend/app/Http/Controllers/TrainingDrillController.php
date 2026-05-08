<?php

namespace App\Http\Controllers;

use App\Enums\SubscriptionTier;
use App\Models\TrainingDrill;
use App\Models\UserTrainingDrillAttempt;
use App\Models\UserTrainingDrillProgress;
use App\Services\EntitlementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class TrainingDrillController extends Controller
{
    private const FREE_DAILY_ATTEMPT_LIMIT = 10;

    public function __construct(
        protected EntitlementService $entitlements
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = TrainingDrill::query()
            ->where('is_active', true)
            ->with(['drillSet'])
            ->orderBy('sort_order')
            ->orderBy('id');

        if ($request->filled('skill_band')) {
            $query->where('skill_band', $request->string('skill_band')->toString());
        }

        if ($request->filled('type')) {
            $query->where('drill_type', $request->string('type')->toString());
        }

        if ($request->filled('theme')) {
            $query->where('theme', $request->string('theme')->toString());
        }

        $drills = $query->get();
        $progress = UserTrainingDrillProgress::where('user_id', $user->id)
            ->whereIn('training_drill_id', $drills->pluck('id'))
            ->get()
            ->keyBy('training_drill_id');

        return response()->json([
            'success' => true,
            'data' => [
                'drills' => $drills->map(fn (TrainingDrill $drill) => $this->serializeDrill(
                    $drill,
                    $user,
                    $progress->get($drill->id)
                ))->values(),
                'access' => [
                    'current_tier' => $user->subscription_tier ?? SubscriptionTier::FREE->value,
                    'free_daily_attempt_cap' => $this->dailyAttemptCap($user),
                ],
            ],
        ]);
    }

    public function recommended(Request $request): JsonResponse
    {
        $user = $request->user();

        $progressByDrill = UserTrainingDrillProgress::where('user_id', $user->id)
            ->get()
            ->keyBy('training_drill_id');

        $drills = TrainingDrill::query()
            ->where('is_active', true)
            ->orderByRaw("CASE required_tier WHEN 'free' THEN 0 WHEN 'silver' THEN 1 WHEN 'gold' THEN 2 ELSE 3 END")
            ->orderBy('skill_band')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->filter(fn (TrainingDrill $drill) => $drill->isAccessibleForUser($user))
            ->sortBy(function (TrainingDrill $drill) use ($progressByDrill) {
                $progress = $progressByDrill->get($drill->id);

                if (!$progress) {
                    return 0;
                }

                if ($progress->review_due_at && $progress->review_due_at->isPast()) {
                    return 1;
                }

                return $progress->is_mastered ? 3 : 2;
            })
            ->take(6)
            ->values();

        return response()->json([
            'success' => true,
            'data' => $drills->map(fn (TrainingDrill $drill) => $this->serializeDrill(
                $drill,
                $user,
                $progressByDrill->get($drill->id)
            )),
        ]);
    }

    public function show(Request $request, string $slug): JsonResponse
    {
        $user = $request->user();
        $drill = TrainingDrill::where('slug', $slug)
            ->where('is_active', true)
            ->with('drillSet')
            ->firstOrFail();

        if (!$drill->isAccessibleForUser($user)) {
            return response()->json([
                'success' => false,
                'message' => "Upgrade to {$drill->required_tier} to access this drill.",
                'required_tier' => $drill->required_tier,
                'upgrade_url' => '/pricing',
            ], 403);
        }

        $progress = UserTrainingDrillProgress::where('user_id', $user->id)
            ->where('training_drill_id', $drill->id)
            ->first();

        return response()->json([
            'success' => true,
            'data' => $this->serializeDrill($drill, $user, $progress, includeSolution: true),
        ]);
    }

    public function attempt(Request $request, string $slug): JsonResponse
    {
        $data = $request->validate([
            'solution' => ['required', 'array', 'min:1'],
            'solution.*' => ['required', 'string', 'max:32'],
            'time_spent_seconds' => ['nullable', 'integer', 'min:0', 'max:86400'],
            'hints_used' => ['nullable', 'integer', 'min:0', 'max:10'],
        ]);

        $user = $request->user();
        $drill = TrainingDrill::where('slug', $slug)
            ->where('is_active', true)
            ->firstOrFail();

        if (!$drill->isAccessibleForUser($user)) {
            return response()->json([
                'success' => false,
                'message' => "Upgrade to {$drill->required_tier} to submit this drill.",
                'required_tier' => $drill->required_tier,
                'upgrade_url' => '/pricing',
            ], 403);
        }

        $cap = $this->dailyAttemptCap($user);
        if ($cap && $cap['remaining'] <= 0) {
            return response()->json([
                'success' => false,
                'message' => 'Free users can submit up to 10 training drill attempts per day. Upgrade to Silver for unlimited drill practice.',
                'daily_attempt_cap' => $cap,
                'upgrade_url' => '/pricing',
            ], 429);
        }

        $submittedSolution = $data['solution'];
        $isCorrect = $this->solutionMatches($submittedSolution, $drill->acceptedSolutions());
        $hintsUsed = (int) ($data['hints_used'] ?? 0);
        $timeSpent = isset($data['time_spent_seconds']) ? (int) $data['time_spent_seconds'] : null;

        $progress = DB::transaction(function () use ($user, $drill, $submittedSolution, $isCorrect, $hintsUsed, $timeSpent) {
            $progress = UserTrainingDrillProgress::firstOrNew([
                'user_id' => $user->id,
                'training_drill_id' => $drill->id,
            ]);

            $wasFirstAttempt = !$progress->exists || (int) $progress->attempts === 0;
            $progress->attempts = (int) $progress->attempts + 1;
            $progress->hints_used = (int) $progress->hints_used + $hintsUsed;
            $progress->last_attempted_at = Carbon::now();

            if ($timeSpent !== null) {
                $progress->total_time_seconds = (int) $progress->total_time_seconds + $timeSpent;
                if ($isCorrect && ($progress->best_time_seconds === null || $timeSpent < $progress->best_time_seconds)) {
                    $progress->best_time_seconds = $timeSpent;
                }
            }

            if ($isCorrect) {
                $progress->solved_count = (int) $progress->solved_count + 1;
                $progress->current_streak = (int) $progress->current_streak + 1;
                $progress->last_failure_reason = null;

                if ($wasFirstAttempt) {
                    $progress->first_try_solves = (int) $progress->first_try_solves + 1;
                }

                $progress->mastery_score = min(
                    (int) $drill->mastery_threshold,
                    (int) $progress->mastery_score + 1
                );

                if (!$progress->is_mastered && $progress->mastery_score >= $drill->mastery_threshold) {
                    $progress->is_mastered = true;
                    $progress->mastered_at = Carbon::now();
                }

                $progress->review_due_at = Carbon::now()->addDays($progress->is_mastered ? 7 : 2)->toDateString();
            } else {
                $progress->current_streak = 0;
                $progress->mastery_score = max(0, (int) $progress->mastery_score - 1);
                $progress->last_failure_reason = 'wrong_solution';
                $progress->review_due_at = Carbon::now()->addDay()->toDateString();
            }

            $progress->save();

            UserTrainingDrillAttempt::create([
                'user_id' => $user->id,
                'training_drill_id' => $drill->id,
                'solved' => $isCorrect,
                'submitted_solution' => $submittedSolution,
                'time_spent_seconds' => $timeSpent,
                'hints_used' => $hintsUsed,
                'failure_reason' => $isCorrect ? null : 'wrong_solution',
                'created_at' => Carbon::now(),
            ]);

            return $progress->fresh();
        });

        return response()->json([
            'success' => true,
            'data' => [
                'correct' => $isCorrect,
                'progress' => $this->serializeProgress($progress),
                'correct_solution' => $drill->solution,
                'explanation' => $isCorrect ? $drill->explanation : null,
                'daily_attempt_cap' => $this->dailyAttemptCap($user),
            ],
        ]);
    }

    private function serializeDrill(
        TrainingDrill $drill,
        $user,
        ?UserTrainingDrillProgress $progress = null,
        bool $includeSolution = false
    ): array {
        $isLocked = !$drill->isAccessibleForUser($user);

        $payload = [
            'id' => $drill->id,
            'slug' => $drill->slug,
            'title' => $drill->title,
            'description' => $drill->description,
            'skill_band' => $drill->skill_band,
            'required_tier' => $drill->required_tier,
            'drill_type' => $drill->drill_type,
            'theme' => $drill->theme,
            'subtheme' => $drill->subtheme,
            'position_fen' => $isLocked ? null : $drill->position_fen,
            'hints' => $isLocked ? [] : ($drill->hints ?? []),
            'thinking_steps' => $drill->thinking_steps ?? [],
            'time_target_seconds' => $drill->time_target_seconds,
            'mastery_threshold' => $drill->mastery_threshold,
            'sort_order' => $drill->sort_order,
            'is_locked' => $isLocked,
            'upgrade_url' => $isLocked ? '/pricing' : null,
            'progress' => $this->serializeProgress($progress),
        ];

        if ($drill->drillSet) {
            $payload['set'] = [
                'slug' => $drill->drillSet->slug,
                'title' => $drill->drillSet->title,
            ];
        }

        if ($includeSolution && !$isLocked) {
            $payload['solution'] = $drill->solution;
            $payload['accepted_alternatives'] = $drill->accepted_alternatives ?? [];
            $payload['explanation'] = $drill->explanation;
        }

        return $payload;
    }

    private function serializeProgress(?UserTrainingDrillProgress $progress): ?array
    {
        if (!$progress) {
            return null;
        }

        $avgTime = $progress->solved_count > 0
            ? round($progress->total_time_seconds / max(1, $progress->solved_count), 1)
            : null;

        return [
            'attempts' => $progress->attempts,
            'solved_count' => $progress->solved_count,
            'first_try_solves' => $progress->first_try_solves,
            'hints_used' => $progress->hints_used,
            'average_time_seconds' => $avgTime,
            'best_time_seconds' => $progress->best_time_seconds,
            'current_streak' => $progress->current_streak,
            'mastery_score' => $progress->mastery_score,
            'is_mastered' => $progress->is_mastered,
            'last_failure_reason' => $progress->last_failure_reason,
            'last_attempted_at' => optional($progress->last_attempted_at)->toISOString(),
            'mastered_at' => optional($progress->mastered_at)->toISOString(),
            'review_due_at' => optional($progress->review_due_at)->toDateString(),
        ];
    }

    private function solutionMatches(array $submitted, array $acceptedSolutions): bool
    {
        $normalizedSubmitted = $this->normalizeSolution($submitted);

        foreach ($acceptedSolutions as $accepted) {
            if ($normalizedSubmitted === $this->normalizeSolution($accepted)) {
                return true;
            }
        }

        return false;
    }

    private function normalizeSolution(array $moves): array
    {
        return array_map(function ($move) {
            return strtolower(trim(str_replace(['+', '#', ' ', "\t", "\n", "\r"], '', (string) $move)));
        }, $moves);
    }

    private function dailyAttemptCap($user): ?array
    {
        if ($this->entitlements->can($user, EntitlementService::CAP_TRAINING_DRILLS_SILVER)) {
            return null;
        }

        $used = UserTrainingDrillAttempt::where('user_id', $user->id)
            ->whereDate('created_at', Carbon::today())
            ->count();

        return [
            'limit' => self::FREE_DAILY_ATTEMPT_LIMIT,
            'used' => $used,
            'remaining' => max(0, self::FREE_DAILY_ATTEMPT_LIMIT - $used),
        ];
    }
}
