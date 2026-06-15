<?php

namespace App\Services;

use App\Models\RatingHistory;
use App\Models\User;

/**
 * Single source of truth for Elo rating math and persistence.
 *
 * Consolidates logic that previously lived (and drifted) in three places:
 *   - RatingController::updateRating / calculateKFactor
 *   - GameRoomService::applyEloForPlayer / calculateEloKFactor
 *   - GameController::applyRatedSyntheticElo / syntheticEloKFactor
 *
 * Keeping it in one class prevents the K-factor / formula divergence that
 * existed before and gives every game-end path identical, server-authoritative
 * rating behaviour.
 */
class RatingService
{
    /**
     * K-factor based on experience and rating. This is the canonical table
     * already used by both authoritative game-end paths (multiplayer and
     * synthetic). The old RatingController fallback used a different table
     * (>=2400 => 16, else 24); it is now reconciled to this one.
     */
    public function kFactor(int $gamesPlayed, int $rating): int
    {
        if ($gamesPlayed < 10) return 40;  // Provisional — fast adjustment
        if ($gamesPlayed < 30) return 32;  // Developing
        if ($rating < 1400)    return 32;
        if ($rating < 2000)    return 24;
        return 20;                          // Experienced / stable
    }

    /**
     * Pure Elo computation. Returns the change and resulting values without
     * persisting anything.
     *
     * @param string $result one of 'win' | 'draw' | 'loss'
     * @return array{rating_change:int,new_rating:int,k_factor:int,expected_score:float,actual_score:float}
     */
    public function computeChange(int $oldRating, int $opponentRating, string $result, int $gamesPlayed): array
    {
        $actualScore = match ($result) {
            'win'  => 1.0,
            'draw' => 0.5,
            default => 0.0,
        };

        // E = 1 / (1 + 10^((R_opponent - R_player) / 400))
        $expectedScore = 1 / (1 + pow(10, ($opponentRating - $oldRating) / 400));
        $kFactor       = $this->kFactor($gamesPlayed, $oldRating);
        $ratingChange  = (int) round($kFactor * ($actualScore - $expectedScore));

        // Enforce minimum ±1 for decisive results so wins always gain and losses
        // always lose — pure Elo can round to 0 on large rating mismatches.
        if ($result === 'win')  $ratingChange = max(1,  $ratingChange);
        if ($result === 'loss') $ratingChange = min(-1, $ratingChange);

        $newRating = max(User::MIN_RATING, min(User::MAX_RATING, $oldRating + $ratingChange));

        return [
            'rating_change'  => $ratingChange,
            'new_rating'     => $newRating,
            'k_factor'       => $kFactor,
            'expected_score' => round($expectedScore, 4),
            'actual_score'   => $actualScore,
        ];
    }

    /**
     * Apply an Elo change for one player and record history. Idempotent:
     * if a ratings_history row already exists for (user, game) it is returned
     * unchanged, so server-side and client-fallback calls never double-apply.
     *
     * @param string $result   'win' | 'draw' | 'loss' (from $player's perspective)
     * @param string $gameType 'multiplayer' | 'computer'
     */
    public function applyForPlayer(
        User $player,
        int $opponentRating,
        string $result,
        int $gameId,
        ?int $opponentId,
        string $gameType,
        ?int $computerLevel = null
    ): RatingHistory {
        $existing = RatingHistory::where('user_id', $player->id)
            ->where('game_id', $gameId)
            ->first();
        if ($existing) {
            return $existing;
        }

        $oldRating   = (int) $player->rating;
        $gamesPlayed = (int) ($player->games_played ?? 0);
        $calc        = $this->computeChange($oldRating, $opponentRating, $result, $gamesPlayed);

        $player->rating              = $calc['new_rating'];
        $player->games_played        = $gamesPlayed + 1;
        $player->rating_last_updated = now();
        if ($calc['new_rating'] > ($player->peak_rating ?? 0)) {
            $player->peak_rating = $calc['new_rating'];
        }
        if ($player->games_played >= 10) {
            $player->is_provisional = false;
        }
        $player->save();

        return RatingHistory::create([
            'user_id'         => $player->id,
            'old_rating'      => $oldRating,
            'new_rating'      => $calc['new_rating'],
            'rating_change'   => $calc['rating_change'],
            'opponent_id'     => $opponentId,
            'opponent_rating' => $opponentRating,
            'computer_level'  => $computerLevel,
            'result'          => $result,
            'game_type'       => $gameType,
            'k_factor'        => $calc['k_factor'],
            'expected_score'  => $calc['expected_score'],
            'actual_score'    => $calc['actual_score'],
            'game_id'         => $gameId,
        ]);
    }
}
