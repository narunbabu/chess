<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use App\Models\RatingHistory;
use App\Models\Game;
use App\Models\SyntheticPlayer;
use App\Models\User;
use App\Services\RatingService;

class RatingController extends Controller
{
    public function __construct(private RatingService $ratingService)
    {
    }

    /**
     * Set initial rating for a user (from skill assessment)
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function setInitialRating(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'rating' => 'required|integer|min:' . User::MIN_RATING . '|max:' . User::MAX_RATING,
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
     * Settle the requesting user's Elo for a finished, rated game.
     *
     * SECURITY: this endpoint is a client-driven *fallback* for the
     * authoritative server-side Elo handlers (GameRoomService::applyRatedGameElo
     * for multiplayer, GameController::applyRatedSyntheticElo for computer).
     * It used to trust client-supplied `result` and `opponent_rating`, which
     * let a caller forge arbitrary rating gains (e.g. result=win,
     * opponent_rating=3200, no game_id → no idempotency dedup). It now requires
     * a real game_id and derives EVERYTHING from the persisted game record:
     * the caller must be a participant, the game must be finished and rated,
     * and the result/opponent are read from the game, never the request body.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function updateRating(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'game_id' => 'required|integer|exists:games,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $user = Auth::user();
        $game = Game::find($request->input('game_id'));

        // Authorization: only a participant can settle their own rating.
        if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'You are not a participant in this game.',
            ], 403);
        }

        // Only finished games count. A decisive/draw result is the reliable signal.
        $validResults = ['1-0', '0-1', '1/2-1/2'];
        if (!in_array($game->result, $validResults, true)) {
            return response()->json([
                'success' => false,
                'message' => 'Game is not finished.',
            ], 409);
        }

        // Casual games never affect rating — return the unchanged rating.
        if ($game->game_mode !== 'rated') {
            return response()->json([
                'success' => true,
                'data' => [
                    'old_rating'     => $user->rating,
                    'new_rating'     => $user->rating,
                    'rating_change'  => 0,
                    'games_played'   => $user->games_played,
                    'is_provisional' => (bool) $user->is_provisional,
                    'peak_rating'    => $user->peak_rating,
                ],
            ]);
        }

        // Derive result + opponent from the game record (never from the client).
        $userColor = $game->white_player_id === $user->id ? 'white' : 'black';
        $userResult = match (true) {
            $game->result === '1/2-1/2'                       => 'draw',
            $game->result === '1-0' && $userColor === 'white' => 'win',
            $game->result === '0-1' && $userColor === 'black' => 'win',
            default                                           => 'loss',
        };

        if ($game->synthetic_player_id) {
            $synthetic     = SyntheticPlayer::find($game->synthetic_player_id);
            $opponentRating = (int) ($synthetic->rating ?? $user->rating);
            $opponentId     = null;
            $gameType       = 'computer';
            $computerLevel  = $game->computer_level;
        } else {
            $opponentUserId = $game->white_player_id === $user->id
                ? $game->black_player_id
                : $game->white_player_id;
            $opponent       = $opponentUserId ? User::find($opponentUserId) : null;
            $opponentRating = (int) ($opponent->rating ?? $user->rating);
            $opponentId     = $opponentUserId;
            $gameType       = 'multiplayer';
            $computerLevel  = null;
        }

        // RatingService is idempotent on (user, game), so this safely returns the
        // already-applied record when the authoritative path ran first.
        $record = $this->ratingService->applyForPlayer(
            $user,
            $opponentRating,
            $userResult,
            $game->id,
            $opponentId,
            $gameType,
            $computerLevel
        );

        $user->refresh();

        return response()->json([
            'success' => true,
            'data' => [
                'old_rating'     => $record->old_rating,
                'new_rating'     => $record->new_rating,
                'rating_change'  => $record->rating_change,
                'games_played'   => $user->games_played,
                'is_provisional' => (bool) $user->is_provisional,
                'peak_rating'    => $user->peak_rating,
                'k_factor'       => $record->k_factor,
                'expected_score' => $record->expected_score,
                'actual_score'   => $record->actual_score,
            ]
        ]);
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
