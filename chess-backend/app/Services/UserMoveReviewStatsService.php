<?php

namespace App\Services;

use App\Models\GameHistory;
use App\Models\UserMoveReviewStats;

class UserMoveReviewStatsService
{
    public function recalculateForUser(int $userId): UserMoveReviewStats
    {
        $totals = $this->emptyTotals($userId);

        GameHistory::query()
            ->where('user_id', $userId)
            ->select([
                'id',
                'review_report',
                'review_summary',
                'best_button_uses',
                'review_enabled_used',
            ])
            ->orderBy('id')
            ->get()
            ->each(function (GameHistory $history) use (&$totals) {
                $summary = is_array($history->review_summary) ? $history->review_summary : [];
                $report = is_array($history->review_report) ? $history->review_report : [];
                $moves = is_array($report['moves'] ?? null) ? $report['moves'] : [];
                $bestUses = max(0, (int) ($history->best_button_uses ?? $report['bestButtonUses'] ?? $summary['best_button_uses'] ?? 0));
                $reviewUsed = (bool) ($history->review_enabled_used ?? $report['reviewEnabledUsed'] ?? $summary['review_enabled_used'] ?? false);

                $analyzedMoves = $this->summaryInt($summary, 'analyzed_moves', $this->countAnalyzedMoves($moves));
                $rankedMovesCount = $this->summaryInt($summary, 'ranked_moves_count', $this->countRankedMoves($moves));
                $rankSum = $this->summaryInt($summary, 'rank_sum', $this->sumRanks($moves));
                $top1Count = $this->summaryInt($summary, 'top_1_count', $this->countExactRank($moves, 1));
                $top2Count = $this->summaryInt($summary, 'top_2_count', $this->countExactRank($moves, 2));
                $top3Count = $this->summaryInt($summary, 'top_3_count', $this->countExactRank($moves, 3));
                $outsideTop5Count = $this->summaryInt(
                    $summary,
                    'outside_top_5_count',
                    $this->summaryInt($summary, 'outside_top_moves_count', $this->countOutsideTopMoves($moves))
                );
                $coinsEarned = $this->summaryInt($summary, 'coins_earned', $this->sumCoins($moves));
                $hasReviewData = $analyzedMoves > 0 || $bestUses > 0 || $reviewUsed || !empty($moves);

                if ($hasReviewData) {
                    $totals['games_analyzed']++;
                }
                $totals['analyzed_moves'] += $analyzedMoves;
                $totals['ranked_moves_count'] += $rankedMovesCount;
                $totals['rank_sum'] += $rankSum;
                $totals['top_1_count'] += $top1Count;
                $totals['top_2_count'] += $top2Count;
                $totals['top_3_count'] += $top3Count;
                $totals['outside_top_5_count'] += $outsideTop5Count;
                $totals['best_button_uses'] += $bestUses;
                $totals['coins_earned'] += $coinsEarned;
                if ($reviewUsed) {
                    $totals['review_enabled_games']++;
                }
            });

        return UserMoveReviewStats::updateOrCreate(
            ['user_id' => $userId],
            $totals
        );
    }

    public function payloadForUser(int $userId): array
    {
        $stats = UserMoveReviewStats::firstOrCreate(
            ['user_id' => $userId],
            $this->emptyTotals($userId)
        );

        return $this->toPayload($stats);
    }

    public function toPayload(UserMoveReviewStats $stats): array
    {
        $averageRank = $stats->ranked_moves_count > 0
            ? round($stats->rank_sum / $stats->ranked_moves_count, 2)
            : null;

        return [
            'user_id' => $stats->user_id,
            'games_analyzed' => $stats->games_analyzed,
            'analyzed_moves' => $stats->analyzed_moves,
            'ranked_moves_count' => $stats->ranked_moves_count,
            'rank_sum' => $stats->rank_sum,
            'top_1_count' => $stats->top_1_count,
            'top_2_count' => $stats->top_2_count,
            'top_3_count' => $stats->top_3_count,
            'outside_top_5_count' => $stats->outside_top_5_count,
            'best_button_uses' => $stats->best_button_uses,
            'coins_earned' => $stats->coins_earned,
            'review_enabled_games' => $stats->review_enabled_games,
            'average_rank' => $averageRank,
        ];
    }

    private function emptyTotals(int $userId): array
    {
        return [
            'user_id' => $userId,
            'games_analyzed' => 0,
            'analyzed_moves' => 0,
            'ranked_moves_count' => 0,
            'rank_sum' => 0,
            'top_1_count' => 0,
            'top_2_count' => 0,
            'top_3_count' => 0,
            'outside_top_5_count' => 0,
            'best_button_uses' => 0,
            'coins_earned' => 0,
            'review_enabled_games' => 0,
        ];
    }

    private function summaryInt(array $summary, string $key, int $fallback = 0): int
    {
        return max(0, (int) ($summary[$key] ?? $fallback));
    }

    private function countAnalyzedMoves(array $moves): int
    {
        return collect($moves)
            ->filter(fn ($move) => is_array($move['topMoves'] ?? null) && count($move['topMoves']) > 0)
            ->count();
    }

    private function countRankedMoves(array $moves): int
    {
        return collect($moves)
            ->filter(fn ($move) => isset($move['userMoveRank']) && is_numeric($move['userMoveRank']))
            ->count();
    }

    private function sumRanks(array $moves): int
    {
        return collect($moves)
            ->filter(fn ($move) => isset($move['userMoveRank']) && is_numeric($move['userMoveRank']))
            ->sum(fn ($move) => (int) $move['userMoveRank']);
    }

    private function countExactRank(array $moves, int $rank): int
    {
        return collect($moves)
            ->filter(fn ($move) => (int) ($move['userMoveRank'] ?? 0) === $rank)
            ->count();
    }

    private function countOutsideTopMoves(array $moves): int
    {
        return collect($moves)
            ->filter(fn ($move) => (bool) ($move['isOutsideTopMoves'] ?? false))
            ->count();
    }

    private function sumCoins(array $moves): int
    {
        return collect($moves)->sum(fn ($move) => match ((int) ($move['userMoveRank'] ?? 0)) {
            1 => 3,
            2 => 2,
            3 => 1,
            default => 0,
        });
    }
}
