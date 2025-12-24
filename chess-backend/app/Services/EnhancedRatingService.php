<?php

namespace App\Services;

use App\Models\Game;
use App\Models\User;
use App\Models\RatingHistory;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

/**
 * Enhanced Rating Service
 *
 * Calculates rating changes with performance-based modifiers:
 * - Base Elo calculation: K × (Result - ExpectedScore)
 * - K-factor based on rating level (<1000: 32, 1000-1600: 24, >1600: 16)
 * - Performance modifier: BaseDelta × (0.5 + PS / 100)
 * - Draw outcome adjustments based on position evaluation
 */
class EnhancedRatingService
{
    /**
     * Calculate and apply rating changes for a completed rated game
     *
     * @param Game $game The completed game
     * @param int $userId User ID
     * @param float $performanceScore Performance Score (0-100)
     * @param string $result Game result ('win', 'loss', 'draw')
     * @param float|null $drawPositionEval Position evaluation if draw (optional)
     * @return array Rating change data
     */
    public function calculateRatingChange(
        Game $game,
        int $userId,
        float $performanceScore,
        string $result,
        ?float $drawPositionEval = null
    ): array {
        Log::info('EnhancedRatingService: Calculating rating change', [
            'game_id' => $game->id,
            'user_id' => $userId,
            'result' => $result,
            'performance_score' => $performanceScore
        ]);

        // Get user and opponent data
        $user = User::find($userId);
        $opponentRating = $this->getOpponentRating($game, $userId);

        // Calculate expected score using Elo formula
        $expectedScore = $this->calculateExpectedScore($user->rating, $opponentRating);

        // Get K-factor based on user rating
        $kFactor = $this->getKFactor($user->rating);

        // Convert result to actual score (1 = win, 0.5 = draw, 0 = loss)
        $actualScore = $this->getActualScore($result);

        // Calculate base rating change (Elo formula)
        $baseRatingChange = $kFactor * ($actualScore - $expectedScore);

        // Apply performance modifier
        $performanceModifier = 0.5 + ($performanceScore / 100);
        $modifiedRatingChange = $baseRatingChange * $performanceModifier;

        // Apply draw adjustment if applicable
        $drawAdjustment = 0;
        if ($result === 'draw' && $drawPositionEval !== null) {
            $drawAdjustment = $this->calculateDrawAdjustment($drawPositionEval, $kFactor);
            $modifiedRatingChange += $drawAdjustment;
        }

        // Calculate final rating
        $oldRating = $user->rating;
        $finalRatingChange = round($modifiedRatingChange);
        $newRating = max(0, $oldRating + $finalRatingChange); // Ensure rating doesn't go below 0

        Log::info('EnhancedRatingService: Rating change calculated', [
            'user_id' => $userId,
            'old_rating' => $oldRating,
            'new_rating' => $newRating,
            'rating_change' => $finalRatingChange,
            'base_change' => round($baseRatingChange),
            'performance_modifier' => $performanceModifier,
            'draw_adjustment' => $drawAdjustment
        ]);

        return [
            'old_rating' => $oldRating,
            'new_rating' => $newRating,
            'rating_change' => $finalRatingChange,
            'base_rating_change' => round($baseRatingChange),
            'performance_score' => $performanceScore,
            'performance_modifier' => $performanceModifier,
            'draw_adjustment' => $drawAdjustment,
            'k_factor' => $kFactor,
            'expected_score' => $expectedScore,
            'actual_score' => $actualScore,
            'opponent_rating' => $opponentRating
        ];
    }

    /**
     * Apply rating change to user and store in history
     *
     * @param Game $game The game
     * @param int $userId User ID
     * @param array $ratingData Rating change data
     * @return void
     */
    public function applyRatingChange(Game $game, int $userId, array $ratingData): void
    {
        Log::info('EnhancedRatingService: Applying rating change', [
            'game_id' => $game->id,
            'user_id' => $userId,
            'rating_change' => $ratingData['rating_change']
        ]);

        $user = User::find($userId);

        // Update user's rating
        $user->rating = $ratingData['new_rating'];
        $user->save();

        // Get opponent ID (null for computer games)
        $opponentId = $this->getOpponentId($game, $userId);

        // Determine game result for history
        $result = $this->determineResult($game, $userId);

        // Store in rating history with enhanced fields
        RatingHistory::create([
            'user_id' => $userId,
            'old_rating' => $ratingData['old_rating'],
            'new_rating' => $ratingData['new_rating'],
            'rating_change' => $ratingData['rating_change'],
            'opponent_id' => $opponentId,
            'opponent_rating' => $ratingData['opponent_rating'],
            'computer_level' => $game->computer_level,
            'result' => $result,
            'game_type' => $game->isComputerGame() ? 'computer' : 'multiplayer',
            'k_factor' => $ratingData['k_factor'],
            'expected_score' => $ratingData['expected_score'],
            'actual_score' => $ratingData['actual_score'],
            'game_id' => $game->id,
            // Enhanced rating history fields
            'performance_score' => $ratingData['performance_score'],
            'performance_modifier' => $ratingData['performance_modifier'],
            'base_rating_change' => $ratingData['base_rating_change'],
            'final_rating_change' => $ratingData['rating_change'],
            'draw_adjustment' => $ratingData['draw_adjustment'] ?? null
        ]);

        Log::info('EnhancedRatingService: Rating change applied and stored');
    }

    /**
     * Calculate expected score using Elo formula
     *
     * @param int $playerRating Player's current rating
     * @param int $opponentRating Opponent's rating
     * @return float Expected score (0-1)
     */
    private function calculateExpectedScore(int $playerRating, int $opponentRating): float
    {
        $ratingDifference = $opponentRating - $playerRating;
        return 1 / (1 + pow(10, $ratingDifference / 400));
    }

    /**
     * Get K-factor based on player rating
     *
     * K-factor table:
     * - <1000: 32 (rapid improvement for beginners)
     * - 1000-1600: 24 (moderate improvement)
     * - >1600: 16 (slower improvement for advanced players)
     *
     * @param int $rating Player's rating
     * @return int K-factor
     */
    private function getKFactor(int $rating): int
    {
        if ($rating < 1000) {
            return 32;
        } elseif ($rating <= 1600) {
            return 24;
        } else {
            return 16;
        }
    }

    /**
     * Convert game result to actual score
     *
     * @param string $result 'win', 'loss', or 'draw'
     * @return float Actual score (1, 0.5, or 0)
     */
    private function getActualScore(string $result): float
    {
        return match ($result) {
            'win' => 1.0,
            'draw' => 0.5,
            'loss' => 0.0,
            default => 0.5
        };
    }

    /**
     * Calculate draw adjustment based on position evaluation
     *
     * Strategic draw logic:
     * - Better position accepts draw: Rating penalty
     * - Worse position accepts draw: Rating gain
     * - Equal position: Minor adjustment
     *
     * @param float $positionEval Position evaluation in pawns (positive = better for player)
     * @param int $kFactor K-factor
     * @return float Draw adjustment
     */
    private function calculateDrawAdjustment(float $positionEval, int $kFactor): float
    {
        // Normalize position evaluation
        if ($positionEval > 1.0) {
            // Player was significantly better - penalty for accepting draw
            return -($kFactor * 0.1);
        } elseif ($positionEval < -1.0) {
            // Player was significantly worse - reward for salvaging draw
            return $kFactor * 0.1;
        } elseif ($positionEval > 0.5) {
            // Player was slightly better - minor penalty
            return -($kFactor * 0.05);
        } elseif ($positionEval < -0.5) {
            // Player was slightly worse - minor reward
            return $kFactor * 0.05;
        } else {
            // Position was roughly equal - no adjustment
            return 0;
        }
    }

    /**
     * Get opponent rating
     *
     * @param Game $game The game
     * @param int $userId User ID
     * @return int Opponent rating
     */
    private function getOpponentRating(Game $game, int $userId): int
    {
        if ($game->isComputerGame()) {
            // Computer rating based on level
            return $game->computerPlayer?->rating ?? (800 + ($game->computer_level * 100));
        } else {
            // Human opponent rating
            $opponent = $game->getOpponent($userId);
            return $opponent?->rating ?? 1200; // Default rating
        }
    }

    /**
     * Get opponent ID (null for computer games)
     *
     * @param Game $game The game
     * @param int $userId User ID
     * @return int|null Opponent ID
     */
    private function getOpponentId(Game $game, int $userId): ?int
    {
        if ($game->isComputerGame()) {
            return null;
        }

        $opponent = $game->getOpponent($userId);
        return $opponent?->id;
    }

    /**
     * Determine game result from user's perspective
     *
     * @param Game $game The game
     * @param int $userId User ID
     * @return string 'win', 'loss', or 'draw'
     */
    private function determineResult(Game $game, int $userId): string
    {
        if ($game->result === '1/2-1/2') {
            return 'draw';
        }

        $playerColor = $game->getPlayerColor($userId);

        if ($game->result === '1-0') {
            return $playerColor === 'white' ? 'win' : 'loss';
        } elseif ($game->result === '0-1') {
            return $playerColor === 'black' ? 'win' : 'loss';
        }

        return 'draw';
    }

    /**
     * Get rating change summary message
     *
     * @param array $ratingData Rating change data
     * @param string $result Game result
     * @return string Summary message
     */
    public function getRatingChangeSummary(array $ratingData, string $result): string
    {
        $change = $ratingData['rating_change'];
        $performanceScore = $ratingData['performance_score'];

        if ($result === 'win') {
            if ($performanceScore >= 85) {
                return "Outstanding victory! Rating +{$change}";
            } elseif ($performanceScore >= 70) {
                return "Strong win! Rating +{$change}";
            } else {
                return "Victory! Rating +{$change}";
            }
        } elseif ($result === 'draw') {
            if ($change > 0) {
                return "Excellent draw from a difficult position! Rating +{$change}";
            } elseif ($change < 0) {
                return "Draw accepted. Rating {$change}";
            } else {
                return "Fair draw. Rating unchanged";
            }
        } else {
            // Loss
            if ($performanceScore >= 70) {
                return "Great effort! Rating {$change} (reduced by strong play)";
            } elseif ($performanceScore >= 50) {
                return "Solid defense. Rating {$change}";
            } else {
                return "Rating {$change}";
            }
        }
    }
}
