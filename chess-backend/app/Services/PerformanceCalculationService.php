<?php

namespace App\Services;

use App\Models\Game;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

/**
 * Performance Calculation Service
 *
 * Calculates Performance Score (0-100) based on move quality:
 * - Move Accuracy: 55% weight
 * - Blunders: -15 points each
 * - Mistakes: -7 points each
 * - Time Score: 10% weight
 *
 * Formula: PS = (Accuracy × 0.55) + (100 - Blunders × 15) + (100 - Mistakes × 7) + (TimeScore × 0.10)
 */
class PerformanceCalculationService
{
    /**
     * Calculate Performance Score for a completed game
     *
     * @param Game $game The completed game
     * @param int $userId The user to calculate performance for
     * @return array Performance data including score, accuracy, move quality breakdown
     */
    public function calculatePerformance(Game $game, int $userId): array
    {
        Log::info('PerformanceCalculationService: Calculating performance', [
            'game_id' => $game->id,
            'user_id' => $userId
        ]);

        // Get user's color in the game
        $playerColor = $game->getPlayerColor($userId);

        // Get move analysis data from engine_evaluations table
        $moveAnalysis = $this->getMoveAnalysisForPlayer($game->id, $playerColor);

        // Calculate component scores
        $accuracy = $this->calculateAccuracy($moveAnalysis);
        $blunderPenalty = $this->calculateBlunderPenalty($moveAnalysis);
        $mistakePenalty = $this->calculateMistakePenalty($moveAnalysis);
        $timeScore = $this->calculateTimeScore($game, $playerColor);

        // Calculate final Performance Score (0-100)
        $performanceScore = $this->calculateFinalScore(
            $accuracy,
            $blunderPenalty,
            $mistakePenalty,
            $timeScore
        );

        // Get move quality breakdown
        $moveQuality = $this->getMoveQualityBreakdown($moveAnalysis);

        $result = [
            'performance_score' => round($performanceScore, 2),
            'accuracy' => round($accuracy, 2),
            'acpl' => $this->calculateACPL($moveAnalysis),
            'brilliant_moves' => $moveQuality['brilliant'] ?? 0,
            'excellent_moves' => $moveQuality['excellent'] ?? 0,
            'good_moves' => $moveQuality['good'] ?? 0,
            'inaccuracies' => $moveQuality['inaccuracy'] ?? 0,
            'mistakes' => $moveQuality['mistake'] ?? 0,
            'blunders' => $moveQuality['blunder'] ?? 0,
            'time_score' => round($timeScore, 2),
            'performance_grade' => $this->getPerformanceGrade($performanceScore),
            'feedback_message' => $this->getFeedbackMessage($performanceScore, $moveQuality)
        ];

        Log::info('PerformanceCalculationService: Performance calculated', [
            'game_id' => $game->id,
            'user_id' => $userId,
            'performance_score' => $result['performance_score']
        ]);

        return $result;
    }

    /**
     * Get move analysis data for a specific player
     *
     * @param int $gameId Game ID
     * @param string $playerColor 'white' or 'black'
     * @return array Move analysis data
     */
    private function getMoveAnalysisForPlayer(int $gameId, string $playerColor): array
    {
        // Fetch all engine evaluations for this game and player
        $evaluations = DB::table('engine_evaluations')
            ->where('game_id', $gameId)
            ->where('player_color', $playerColor)
            ->orderBy('move_number', 'asc')
            ->get()
            ->toArray();

        return array_map(function ($eval) {
            return (array) $eval;
        }, $evaluations);
    }

    /**
     * Calculate move accuracy percentage
     *
     * @param array $moveAnalysis Move analysis data
     * @return float Accuracy percentage (0-100)
     */
    private function calculateAccuracy(array $moveAnalysis): float
    {
        if (empty($moveAnalysis)) {
            return 0.0;
        }

        $totalMoves = count($moveAnalysis);
        $accurateMovesCount = 0;

        foreach ($moveAnalysis as $move) {
            $quality = $move['move_quality'] ?? 'good';

            // Count brilliant, excellent, and good moves as accurate
            if (in_array($quality, ['brilliant', 'excellent', 'good'])) {
                $accurateMovesCount++;
            }
        }

        return ($accurateMovesCount / $totalMoves) * 100;
    }

    /**
     * Calculate blunder penalty
     *
     * @param array $moveAnalysis Move analysis data
     * @return float Blunder penalty (blunders × 15)
     */
    private function calculateBlunderPenalty(array $moveAnalysis): float
    {
        $blunderCount = 0;

        foreach ($moveAnalysis as $move) {
            if (($move['move_quality'] ?? '') === 'blunder') {
                $blunderCount++;
            }
        }

        return $blunderCount * 15;
    }

    /**
     * Calculate mistake penalty
     *
     * @param array $moveAnalysis Move analysis data
     * @return float Mistake penalty (mistakes × 7)
     */
    private function calculateMistakePenalty(array $moveAnalysis): float
    {
        $mistakeCount = 0;

        foreach ($moveAnalysis as $move) {
            if (($move['move_quality'] ?? '') === 'mistake') {
                $mistakeCount++;
            }
        }

        return $mistakeCount * 7;
    }

    /**
     * Calculate time management score
     *
     * @param Game $game The game
     * @param string $playerColor Player's color
     * @return float Time score (0-100)
     */
    private function calculateTimeScore(Game $game, string $playerColor): float
    {
        // Default to 80 if no time pressure issues
        // This can be enhanced later with actual time tracking

        // For now, return a baseline score
        // TODO: Implement time pressure detection and scoring
        return 80.0;
    }

    /**
     * Calculate final Performance Score
     *
     * Formula: PS = (Accuracy × 0.55) + (100 - Blunders × 15) + (100 - Mistakes × 7) + (TimeScore × 0.10)
     *
     * @param float $accuracy Accuracy percentage
     * @param float $blunderPenalty Blunder penalty
     * @param float $mistakePenalty Mistake penalty
     * @param float $timeScore Time score
     * @return float Performance Score (0-100)
     */
    private function calculateFinalScore(
        float $accuracy,
        float $blunderPenalty,
        float $mistakePenalty,
        float $timeScore
    ): float {
        // Component weights as per PRD
        $accuracyComponent = $accuracy * 0.55;
        $blunderComponent = max(0, 100 - $blunderPenalty);
        $mistakeComponent = max(0, 100 - $mistakePenalty);
        $timeComponent = $timeScore * 0.10;

        // Calculate weighted sum
        $rawScore = ($accuracyComponent + $blunderComponent + $mistakeComponent + $timeComponent) / 3.65;

        // Ensure score is within 0-100 range
        return max(0, min(100, $rawScore));
    }

    /**
     * Calculate Average Centipawn Loss (ACPL)
     *
     * @param array $moveAnalysis Move analysis data
     * @return float ACPL value
     */
    private function calculateACPL(array $moveAnalysis): float
    {
        if (empty($moveAnalysis)) {
            return 0.0;
        }

        $totalCentipawnLoss = 0;
        $moveCount = 0;

        foreach ($moveAnalysis as $move) {
            if (isset($move['eval_before']) && isset($move['eval_after'])) {
                $evalBefore = (float) $move['eval_before'];
                $evalAfter = (float) $move['eval_after'];

                // Calculate centipawn loss for this move
                $loss = abs($evalAfter - $evalBefore);

                // Only count significant losses (> 0.05 pawns)
                if ($loss > 0.05) {
                    $totalCentipawnLoss += $loss * 100; // Convert to centipawns
                    $moveCount++;
                }
            }
        }

        return $moveCount > 0 ? ($totalCentipawnLoss / $moveCount) : 0.0;
    }

    /**
     * Get move quality breakdown
     *
     * @param array $moveAnalysis Move analysis data
     * @return array Quality counts
     */
    private function getMoveQualityBreakdown(array $moveAnalysis): array
    {
        $breakdown = [
            'brilliant' => 0,
            'excellent' => 0,
            'good' => 0,
            'inaccuracy' => 0,
            'mistake' => 0,
            'blunder' => 0
        ];

        foreach ($moveAnalysis as $move) {
            $quality = $move['move_quality'] ?? 'good';
            if (isset($breakdown[$quality])) {
                $breakdown[$quality]++;
            }
        }

        return $breakdown;
    }

    /**
     * Get performance grade based on score
     *
     * @param float $performanceScore Performance Score (0-100)
     * @return string Performance grade
     */
    private function getPerformanceGrade(float $performanceScore): string
    {
        if ($performanceScore >= 85) {
            return 'Excellent';
        } elseif ($performanceScore >= 70) {
            return 'Strong';
        } elseif ($performanceScore >= 50) {
            return 'Average';
        } else {
            return 'Needs Improvement';
        }
    }

    /**
     * Get encouraging feedback message
     *
     * @param float $performanceScore Performance Score
     * @param array $moveQuality Move quality breakdown
     * @return string Feedback message
     */
    private function getFeedbackMessage(float $performanceScore, array $moveQuality): string
    {
        // Positive, encouraging messages as per UX guidelines

        if ($performanceScore >= 85) {
            return "Excellent play! Your move accuracy was outstanding.";
        }

        if ($performanceScore >= 70) {
            if (($moveQuality['brilliant'] ?? 0) > 0) {
                return "Strong performance with some brilliant moves!";
            }
            return "Great defense and solid decision-making throughout.";
        }

        if ($performanceScore >= 50) {
            if (($moveQuality['blunder'] ?? 0) === 0) {
                return "Good effort! No major mistakes - keep building on this.";
            }
            return "Solid foundation. Focus on reducing small inaccuracies.";
        }

        // Even for lower scores, keep it constructive
        if (($moveQuality['good'] ?? 0) > ($moveQuality['mistake'] ?? 0)) {
            return "You played some good moves. Review the key moments to improve.";
        }

        return "Keep practicing! Every game is a learning opportunity.";
    }

    /**
     * Store performance data in database
     *
     * @param Game $game The game
     * @param int $userId User ID
     * @param array $performanceData Performance data
     * @return void
     */
    public function storePerformance(Game $game, int $userId, array $performanceData): void
    {
        Log::info('PerformanceCalculationService: Storing performance', [
            'game_id' => $game->id,
            'user_id' => $userId
        ]);

        DB::table('game_performance')->insert([
            'game_id' => $game->id,
            'user_id' => $userId,
            'performance_score' => $performanceData['performance_score'],
            'accuracy' => $performanceData['accuracy'],
            'acpl' => $performanceData['acpl'],
            'brilliant_moves' => $performanceData['brilliant_moves'],
            'excellent_moves' => $performanceData['excellent_moves'],
            'good_moves' => $performanceData['good_moves'],
            'inaccuracies' => $performanceData['inaccuracies'],
            'mistakes' => $performanceData['mistakes'],
            'blunders' => $performanceData['blunders'],
            'time_score' => $performanceData['time_score'],
            'performance_grade' => $performanceData['performance_grade'],
            'feedback_message' => $performanceData['feedback_message'],
            'created_at' => now(),
            'updated_at' => now()
        ]);

        Log::info('PerformanceCalculationService: Performance stored successfully');
    }
}
