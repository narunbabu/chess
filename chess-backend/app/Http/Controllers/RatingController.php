<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use App\Models\RatingHistory;

class RatingController extends Controller
{
    /**
     * Set initial rating for a user (from skill assessment)
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function setInitialRating(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'rating' => 'required|integer|min:600|max:2600',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $user = Auth::user();

        // Only allow setting initial rating if user has never set one before
        if ($user->games_played > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot set initial rating after playing games'
            ], 400);
        }

        $user->update([
            'rating' => $request->rating,
            'peak_rating' => $request->rating,
            'rating_last_updated' => now(),
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'rating' => $user->rating,
                'is_provisional' => $user->is_provisional,
                'games_played' => $user->games_played,
                'peak_rating' => $user->peak_rating,
            ]
        ]);
    }

    /**
     * Update rating after a game using Elo rating system
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function updateRating(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'opponent_rating' => 'required|integer|min:600|max:3000',
            'result' => 'required|in:win,draw,loss',
            'game_type' => 'nullable|in:computer,multiplayer',
            'opponent_id' => 'nullable|integer|exists:users,id',
            'game_id' => 'nullable|integer|exists:games,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $user = Auth::user();
        $oldRating = $user->rating;
        $opponentRating = $request->opponent_rating;
        $result = $request->result;
        $gameType = $request->input('game_type', 'multiplayer');

        // Convert result to actual score
        $actualScore = match($result) {
            'win' => 1.0,
            'draw' => 0.5,
            'loss' => 0.0,
        };

        // Calculate expected score using Elo formula
        // E = 1 / (1 + 10^((R_opponent - R_player) / 400))
        $expectedScore = 1 / (1 + pow(10, ($opponentRating - $oldRating) / 400));

        // Determine K-factor based on games played
        $gamesPlayed = $user->games_played ?? 0;
        $kFactor = $this->calculateKFactor($gamesPlayed, $oldRating);

        // Calculate new rating
        // R_new = R_old + K × (S - E)
        $ratingChange = round($kFactor * ($actualScore - $expectedScore));
        $newRating = $oldRating + $ratingChange;

        // Ensure rating stays within reasonable bounds
        $newRating = max(600, min(3000, $newRating));

        // Update user rating
        $user->rating = $newRating;
        $user->games_played = $gamesPlayed + 1;
        $user->rating_last_updated = now();

        // Update peak rating if applicable
        if ($newRating > $user->peak_rating) {
            $user->peak_rating = $newRating;
        }

        // Remove provisional status after 10 games
        if ($user->games_played >= 10) {
            $user->is_provisional = false;
        }

        $user->save();

        // Create rating history record
        $historyRecord = RatingHistory::create([
            'user_id' => $user->id,
            'old_rating' => $oldRating,
            'new_rating' => $newRating,
            'rating_change' => $ratingChange,
            'opponent_id' => $request->input('opponent_id'),
            'opponent_rating' => $opponentRating,
            'result' => $result,
            'game_type' => $gameType,
            'k_factor' => $kFactor,
            'expected_score' => round($expectedScore, 4),
            'actual_score' => $actualScore,
            'game_id' => $request->input('game_id'),
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'old_rating' => $oldRating,
                'new_rating' => $newRating,
                'rating_change' => $ratingChange,
                'games_played' => $user->games_played,
                'is_provisional' => $user->is_provisional,
                'peak_rating' => $user->peak_rating,
                'k_factor' => $kFactor,
                'expected_score' => round($expectedScore, 4),
                'actual_score' => $actualScore,
            ]
        ]);
    }

    /**
     * Calculate K-factor based on player experience and rating
     *
     * @param int $gamesPlayed
     * @param int $rating
     * @return int
     */
    private function calculateKFactor($gamesPlayed, $rating)
    {
        // High K-factor for new players (fast adjustment)
        if ($gamesPlayed < 10) {
            return 40;
        }

        // Medium K-factor for intermediate players
        if ($gamesPlayed < 30) {
            return 30;
        }

        // Lower K-factor for experienced players (stable rating)
        // But slightly higher for very high rated players to maintain accuracy
        if ($rating >= 2400) {
            return 24;
        }

        return 20;
    }

    /**
     * Get current user's rating information
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function getRating()
    {
        $user = Auth::user();

        return response()->json([
            'success' => true,
            'data' => [
                'rating' => $user->rating,
                'is_provisional' => $user->is_provisional,
                'games_played' => $user->games_played,
                'peak_rating' => $user->peak_rating,
                'k_factor' => $user->k_factor,
                'rating_last_updated' => $user->rating_last_updated,
            ]
        ]);
    }

    /**
     * Get leaderboard (top rated players)
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getLeaderboard(Request $request)
    {
        $limit = $request->input('limit', 100);
        $limit = min($limit, 500); // Cap at 500

        $leaderboard = \App\Models\User::select(['id', 'name', 'rating', 'peak_rating', 'games_played', 'is_provisional', 'avatar_url'])
            ->where('games_played', '>=', 20) // Only non-provisional players
            ->orderBy('rating', 'desc')
            ->limit($limit)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $leaderboard
        ]);
    }

    /**
     * Get user's rating history
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getRatingHistory(Request $request)
    {
        $user = Auth::user();
        $limit = $request->input('limit', 50);
        $limit = min($limit, 200); // Cap at 200 records

        $history = RatingHistory::where('user_id', $user->id)
            ->with(['opponent:id,name,rating', 'game:id,status'])
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get();

        // Calculate statistics
        $stats = [
            'total_games' => $history->count(),
            'wins' => $history->where('result', 'win')->count(),
            'draws' => $history->where('result', 'draw')->count(),
            'losses' => $history->where('result', 'loss')->count(),
            'total_rating_change' => $history->sum('rating_change'),
            'average_rating_change' => $history->count() > 0 ? round($history->avg('rating_change'), 2) : 0,
            'highest_rating' => $user->peak_rating,
            'current_rating' => $user->rating,
            'current_streak' => $this->calculateCurrentStreak($history),
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'history' => $history,
                'stats' => $stats,
            ]
        ]);
    }

    /**
     * Calculate current win/loss streak
     *
     * @param \Illuminate\Database\Eloquent\Collection $history
     * @return array
     */
    private function calculateCurrentStreak($history)
    {
        if ($history->isEmpty()) {
            return ['type' => null, 'count' => 0];
        }

        $firstResult = $history->first()->result;
        $count = 0;

        foreach ($history as $record) {
            if ($record->result === $firstResult && $firstResult !== 'draw') {
                $count++;
            } else {
                break;
            }
        }

        return [
            'type' => $count > 0 ? $firstResult : null,
            'count' => $count,
        ];
    }
}
