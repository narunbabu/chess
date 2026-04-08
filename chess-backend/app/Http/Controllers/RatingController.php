<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use App\Models\RatingHistory;
use App\Models\Game;
use App\Models\SyntheticPlayer;

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
            'rating' => 'required|integer|min:400|max:3200', // Match full rating range
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
            'opponent_rating' => 'required|integer|min:400|max:3200', // Support full range of computer levels (1-16)
            'result' => 'required|in:win,draw,loss',
            'game_type' => 'nullable|in:computer,multiplayer',
            'opponent_id' => 'nullable|integer|exists:users,id',
            'computer_level' => 'nullable|integer|min:1|max:16',
            'game_id' => 'nullable|integer|exists:games,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $user = Auth::user();
        $gameType = $request->input('game_type', 'multiplayer');

        // Idempotency: if this game_id was already processed by the server-side Elo
        // handler (GameRoomService::applyRatedGameElo), return the existing record.
        if ($request->input('game_id') && $gameType === 'multiplayer') {
            $existing = \DB::table('ratings_history')
                ->where('user_id', $user->id)
                ->where('game_id', $request->input('game_id'))
                ->first();
            if ($existing) {
                return response()->json([
                    'success' => true,
                    'data' => [
                        'old_rating'     => $existing->old_rating,
                        'new_rating'     => $existing->new_rating,
                        'rating_change'  => $existing->rating_change,
                        'games_played'   => $user->games_played,
                        'is_provisional' => (bool) $user->is_provisional,
                        'peak_rating'    => $user->peak_rating,
                        'k_factor'       => $existing->k_factor,
                        'expected_score' => $existing->expected_score,
                        'actual_score'   => $existing->actual_score,
                    ],
                ]);
            }
        }

        $oldRating = $user->rating;
        $opponentRating = $request->opponent_rating;
        $result = $request->result;

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
        $rawChange = $kFactor * ($actualScore - $expectedScore);
        $ratingChange = round($rawChange);

        // Enforce minimum ±1 for decisive results so wins always gain and losses always lose.
        // Pure Elo can round to 0 for large rating mismatches (e.g. 1400 player beats 400-rated
        // opponent: K×(1−0.984)=0.26 → rounds to 0). That's confusing and unfair.
        if ($result === 'win')  $ratingChange = max(1,  $ratingChange);
        if ($result === 'loss') $ratingChange = min(-1, $ratingChange);

        $newRating = $oldRating + $ratingChange;

        // Debug logging
        \Log::info('Rating calculation debug', [
            'user_id' => $user->id,
            'old_rating' => $oldRating,
            'opponent_rating' => $opponentRating,
            'result' => $result,
            'actual_score' => $actualScore,
            'expected_score' => round($expectedScore, 4),
            'games_played_before' => $gamesPlayed,
            'k_factor' => $kFactor,
            'raw_change' => round($rawChange, 2),
            'rating_change' => $ratingChange,
            'new_rating' => $newRating
        ]);

        // Ensure rating stays within reasonable bounds (match computer level range)
        $newRating = max(400, min(3200, $newRating));

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

        // Update synthetic player ELO if this game was against one
        if ($request->input('game_id')) {
            $game = Game::find($request->input('game_id'));
            if ($game && $game->synthetic_player_id) {
                $syntheticPlayer = SyntheticPlayer::find($game->synthetic_player_id);
                if ($syntheticPlayer) {
                    $botOldRating = $syntheticPlayer->rating;
                    // Bot result is opposite of player result
                    $botActualScore = match($result) {
                        'win' => 0.0,
                        'draw' => 0.5,
                        'loss' => 1.0,
                    };
                    $botExpected = 1 / (1 + pow(10, ($oldRating - $botOldRating) / 400));
                    $botK = 16; // Conservative K-factor for bots
                    $botRatingChange = round($botK * ($botActualScore - $botExpected));
                    $syntheticPlayer->rating = max(400, min(3200, $botOldRating + $botRatingChange));
                    if ($result === 'loss') {
                        $syntheticPlayer->wins_count = ($syntheticPlayer->wins_count ?? 0) + 1;
                    }
                    $syntheticPlayer->save();
                }
            }
        }

        // Create rating history record
        $historyRecord = RatingHistory::create([
            'user_id' => $user->id,
            'old_rating' => $oldRating,
            'new_rating' => $newRating,
            'rating_change' => $ratingChange,
            'opponent_id' => $request->input('opponent_id'),
            'opponent_rating' => $opponentRating,
            'computer_level' => $request->input('computer_level'), // Store computer difficulty level
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
        // High K-factor for new players (fast rating adjustment, FIDE: 40)
        if ($gamesPlayed < 10) {
            return 40;
        }

        // Developing players: still adjusting (FIDE: 20, we use 32 for more responsiveness)
        if ($gamesPlayed < 30) {
            return 32;
        }

        // Elite players: stable rating (FIDE: 10 for >2400, we use 16)
        if ($rating >= 2400) {
            return 16;
        }

        // Standard experienced players: K=24 gives a fair spread:
        //   Win vs +300-rated: +20 pts | Win vs equal: +12 pts | Win vs -300-rated: +4 pts
        //   Loss vs -300-rated: -20 pts | Loss vs equal: -12 pts | Loss vs +300-rated: -4 pts
        return 24;
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
