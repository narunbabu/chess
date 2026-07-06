<?php

namespace App\Services;

use App\Models\GameHistory;
use App\Models\GuardianChildRelationship;
use App\Models\RatingHistory;
use App\Models\TacticalPuzzleAttempt;
use App\Models\User;
use App\Models\UserTacticalStats;
use App\Models\UserTutorialProgress;
use Carbon\CarbonInterface;

class ParentDashboardService
{
    public function dashboardForGuardian(User $guardian): array
    {
        $relationships = GuardianChildRelationship::with(['child'])
            ->where('guardian_id', $guardian->id)
            ->whereIn('status', [
                GuardianChildRelationship::STATUS_ACTIVE,
                GuardianChildRelationship::STATUS_PENDING,
            ])
            ->latest('updated_at')
            ->get();

        $pendingForChild = GuardianChildRelationship::with(['guardian'])
            ->where('child_id', $guardian->id)
            ->pending()
            ->latest('invited_at')
            ->get();

        return [
            'generated_at' => now()->toIso8601String(),
            'children' => $relationships
                ->where('status', GuardianChildRelationship::STATUS_ACTIVE)
                ->map(fn (GuardianChildRelationship $relationship) => $this->reportForChild(
                    $relationship->child,
                    $relationship
                ))
                ->values(),
            'pending_children' => $relationships
                ->where('status', GuardianChildRelationship::STATUS_PENDING)
                ->map(fn (GuardianChildRelationship $relationship) => $this->relationshipPayload($relationship))
                ->values(),
            'pending_guardian_requests' => $pendingForChild
                ->map(fn (GuardianChildRelationship $relationship) => $this->relationshipPayload($relationship))
                ->values(),
        ];
    }

    public function reportForChild(
        User $child,
        ?GuardianChildRelationship $relationship = null,
        ?CarbonInterface $since = null
    ): array {
        $since ??= now()->subDays(7);
        $weekStart = $since->copy();

        $weeklyGames = GameHistory::query()
            ->where('user_id', $child->id)
            ->where('played_at', '>=', $weekStart)
            ->latest('played_at')
            ->get();

        $gameResults = $weeklyGames->map(fn (GameHistory $history) => $this->resultForHistory($history));

        $weeklyPuzzleAttempts = TacticalPuzzleAttempt::query()
            ->where('user_id', $child->id)
            ->where('created_at', '>=', $weekStart)
            ->get();

        $weeklyLessonProgress = UserTutorialProgress::query()
            ->where('user_id', $child->id)
            ->where(function ($query) use ($weekStart) {
                $query->where('completed_at', '>=', $weekStart)
                    ->orWhere('last_accessed_at', '>=', $weekStart);
            })
            ->get();

        $weeklyPuzzleSeconds = (int) floor($weeklyPuzzleAttempts->sum('time_spent_ms') / 1000);
        $weeklyLessonSeconds = (int) $weeklyLessonProgress->sum('time_spent_seconds');

        $tacticalStats = UserTacticalStats::query()
            ->where('user_id', $child->id)
            ->first();

        $lessonsCompletedTotal = UserTutorialProgress::query()
            ->where('user_id', $child->id)
            ->whereIn('status', ['completed', 'mastered'])
            ->count();

        $lessonsCompletedWeek = UserTutorialProgress::query()
            ->where('user_id', $child->id)
            ->whereIn('status', ['completed', 'mastered'])
            ->where('completed_at', '>=', $weekStart)
            ->count();

        $ratingChange = (int) RatingHistory::query()
            ->where('user_id', $child->id)
            ->where('created_at', '>=', $weekStart)
            ->sum('rating_change');

        $weeklyPuzzleSolved = $weeklyPuzzleAttempts->where('success', true)->count();

        return [
            'relationship' => $relationship ? $this->relationshipPayload($relationship) : null,
            'child' => $this->childPayload($child),
            'week' => [
                'from' => $weekStart->toDateString(),
                'to' => now()->toDateString(),
                'games_played' => $weeklyGames->count(),
                'wins' => $gameResults->filter(fn (string $result) => $result === 'win')->count(),
                'losses' => $gameResults->filter(fn (string $result) => $result === 'loss')->count(),
                'draws' => $gameResults->filter(fn (string $result) => $result === 'draw')->count(),
                'rating_change' => $ratingChange,
                'puzzles_attempted' => $weeklyPuzzleAttempts->count(),
                'puzzles_solved' => $weeklyPuzzleSolved,
                'lessons_completed' => $lessonsCompletedWeek,
                'time_played_seconds' => $weeklyLessonSeconds + $weeklyPuzzleSeconds,
                'time_played_source' => 'lessons_and_tactics',
                'activity_total' => $weeklyGames->count() + $weeklyPuzzleSolved + $lessonsCompletedWeek,
            ],
            'totals' => [
                'lessons_completed' => $lessonsCompletedTotal,
                'puzzles_solved' => (int) ($tacticalStats?->total_solved ?? 0),
                'tactical_rating' => (int) ($tacticalStats?->rating ?? 1000),
                'tactical_best_streak' => (int) ($tacticalStats?->best_streak ?? 0),
            ],
            'rating_trend' => $this->ratingTrend($child),
            'recent_games' => $this->recentGames($child),
        ];
    }

    public function relationshipPayload(GuardianChildRelationship $relationship): array
    {
        $relationship->loadMissing(['guardian', 'child']);

        return [
            'id' => $relationship->id,
            'status' => $relationship->status,
            'relationship_label' => $relationship->relationship_label,
            'invite_email' => $relationship->invite_email,
            'invited_at' => $relationship->invited_at?->toIso8601String(),
            'accepted_at' => $relationship->accepted_at?->toIso8601String(),
            'revoked_at' => $relationship->revoked_at?->toIso8601String(),
            'guardian' => $relationship->guardian ? $this->personPayload($relationship->guardian) : null,
            'child' => $relationship->child ? $this->childPayload($relationship->child) : null,
        ];
    }

    private function childPayload(User $child): array
    {
        return array_merge($this->personPayload($child), [
            'rating' => (int) ($child->rating ?? User::DEFAULT_RATING),
            'learner_rating' => (int) ($child->learner_rating ?? User::DEFAULT_RATING),
            'games_played' => (int) ($child->games_played ?? 0),
            'learner_games_played' => (int) ($child->learner_games_played ?? 0),
            'subscription_tier' => $child->subscription_tier ?? 'free',
            'class_of_study' => $child->class_of_study,
        ]);
    }

    private function personPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'avatar_url' => $user->avatar_url,
        ];
    }

    private function ratingTrend(User $child): array
    {
        $history = RatingHistory::query()
            ->where('user_id', $child->id)
            ->where('created_at', '>=', now()->subDays(30))
            ->orderBy('created_at')
            ->get(['created_at', 'new_rating', 'rating_change']);

        if ($history->isEmpty()) {
            return [[
                'date' => now()->toDateString(),
                'rating' => (int) ($child->rating ?? User::DEFAULT_RATING),
                'rating_change' => 0,
            ]];
        }

        return $history
            ->map(fn (RatingHistory $rating) => [
                'date' => $rating->created_at?->toDateString(),
                'rating' => (int) $rating->new_rating,
                'rating_change' => (int) $rating->rating_change,
            ])
            ->values()
            ->all();
    }

    private function recentGames(User $child): array
    {
        return GameHistory::query()
            ->where('user_id', $child->id)
            ->latest('played_at')
            ->limit(6)
            ->get()
            ->map(fn (GameHistory $history) => [
                'id' => $history->id,
                'game_id' => $history->game_id,
                'played_at' => $history->played_at,
                'opponent_name' => $history->opponent_name ?: ($history->game_mode === 'computer'
                    ? 'Computer Lv.' . ($history->computer_level ?: '?')
                    : 'Opponent'),
                'opponent_rating' => $history->opponent_rating,
                'game_mode' => $history->game_mode,
                'player_color' => $history->player_color,
                'result' => $this->resultForHistory($history),
                'final_score' => $history->final_score,
                'opponent_score' => $history->opponent_score,
                'replay_url' => $history->game_id ? "/games/{$history->game_id}/replay" : null,
                'pgn_url' => $history->game_id ? "/games/{$history->game_id}/pgn" : null,
            ])
            ->values()
            ->all();
    }

    private function resultForHistory(GameHistory $history): string
    {
        $raw = trim((string) $history->result);
        $lower = strtolower($raw);

        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $lower = strtolower((string) ($decoded['result'] ?? $decoded['outcome'] ?? $decoded['status'] ?? $raw));
        }

        if ($lower === '1-0') {
            return $history->player_color === 'w' ? 'win' : 'loss';
        }

        if ($lower === '0-1') {
            return $history->player_color === 'b' ? 'win' : 'loss';
        }

        if ($lower === '1/2-1/2' || str_contains($lower, 'draw')) {
            return 'draw';
        }

        if (str_contains($lower, 'win') || str_contains($lower, 'won')) {
            return 'win';
        }

        if (str_contains($lower, 'loss') || str_contains($lower, 'lost') || str_contains($lower, 'lose')) {
            return 'loss';
        }

        return 'unknown';
    }
}
