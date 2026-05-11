<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\GameStatus;
use App\Models\SyntheticPlayer;
use App\Models\User;
use Illuminate\Http\Request;

class LobbyController extends Controller
{
    /**
     * GET /api/v1/lobby/players
     *
     * Returns real online players and synthetic players for lobby display.
     */
    public function players(Request $request)
    {
        $user = $request->user();
        [$minRating, $maxRating, $hasRatingWindow] = $this->ratingWindowFromRequest($request);
        $userRating = (int) ($user->rating ?? User::DEFAULT_RATING);

        // Get real online users (users active within last 5 minutes)
        $onlineThreshold = now()->subMinutes(5);

        // Find users currently in active multiplayer games. Synthetic/computer games
        // are single-player and should not mark a user as busy in the lobby.
        $activeStatusId = GameStatus::where('code', 'active')->value('id');
        $busyUserIds = [];
        if ($activeStatusId) {
            $thirtyMinAgo = now()->subMinutes(30);
            $whiteIds = Game::where('status_id', $activeStatusId)
                ->whereNull('computer_player_id')
                ->whereNull('synthetic_player_id')
                ->where(function ($q) use ($thirtyMinAgo) {
                    $q->where('last_move_at', '>=', $thirtyMinAgo)
                      ->orWhere('created_at', '>=', $thirtyMinAgo);
                })
                ->whereNotNull('white_player_id')
                ->pluck('white_player_id');
            $blackIds = Game::where('status_id', $activeStatusId)
                ->whereNull('computer_player_id')
                ->whereNull('synthetic_player_id')
                ->where(function ($q) use ($thirtyMinAgo) {
                    $q->where('last_move_at', '>=', $thirtyMinAgo)
                      ->orWhere('created_at', '>=', $thirtyMinAgo);
                })
                ->whereNotNull('black_player_id')
                ->pluck('black_player_id');
            $busyUserIds = $whiteIds->merge($blackIds)->unique()->toArray();
        }

        $realPlayersQuery = User::where('id', '!=', $user->id)
            ->where('last_activity_at', '>=', $onlineThreshold)
            ->when($minRating !== null, fn ($query) => $query->where('rating', '>=', $minRating))
            ->when($maxRating !== null, fn ($query) => $query->where('rating', '<=', $maxRating));

        if ($hasRatingWindow) {
            $realPlayersQuery->orderByRaw('ABS(rating - ?) ASC', [$userRating])->orderBy('rating');
        } else {
            $realPlayersQuery->orderBy('rating', 'desc');
        }

        $realPlayers = $realPlayersQuery
            ->limit(50)
            ->get(['id', 'name', 'email', 'avatar_url', 'rating'])
            ->map(function ($player) use ($busyUserIds) {
                $inGame = in_array($player->id, $busyUserIds);

                return [
                    'id' => $player->id,
                    'name' => $player->name,
                    'email' => $player->email,
                    'rating' => $player->rating ?? User::DEFAULT_RATING,
                    'avatar_url' => $player->avatar_url,
                    'type' => 'human',
                    'is_online' => true,
                    'in_game' => $inGame,
                    'status' => $inGame ? 'playing' : 'online',
                ];
            });

        $syntheticQuery = $hasRatingWindow
            ? SyntheticPlayer::getForLobby(40, $minRating, $maxRating)
            : SyntheticPlayer::getRandomizedForLobby();

        $syntheticPlayers = $syntheticQuery->map(function ($bot) {
            return [
                'id' => $bot->id,
                'name' => $bot->name,
                'rating' => $bot->rating,
                'computer_level' => $bot->computer_level,
                'personality' => $bot->personality,
                'bio' => $bot->bio,
                'avatar_url' => $bot->avatar_url,
                'games_played' => $bot->games_played_count,
                'win_rate' => $bot->win_rate,
                'type' => 'synthetic',
            ];
        });

        return response()->json([
            'real_players' => $realPlayers,
            'synthetic_players' => $syntheticPlayers,
            'rating_window' => [
                'min' => $minRating,
                'max' => $maxRating,
            ],
        ]);
    }

    /**
     * GET /api/v1/synthetic-players
     *
     * Returns all active synthetic players for companion mode selection.
     */
    public function syntheticPlayers(Request $request)
    {
        [$minRating, $maxRating] = $this->ratingWindowFromRequest($request);

        $companions = SyntheticPlayer::getForLobby(40, $minRating, $maxRating)->map(function ($bot) {
            return [
                'id' => $bot->id,
                'name' => $bot->name,
                'rating' => $bot->rating,
                'computer_level' => $bot->computer_level,
                'personality' => $bot->personality,
                'bio' => $bot->bio,
                'avatar_url' => $bot->avatar_url,
                'games_played' => $bot->games_played_count,
                'win_rate' => $bot->win_rate,
                'type' => 'synthetic',
            ];
        });

        return response()->json([
            'data' => $companions,
        ]);
    }

    private function ratingWindowFromRequest(Request $request): array
    {
        $validated = $request->validate([
            'min_rating' => 'nullable|integer|min:0|max:' . User::MAX_RATING,
            'max_rating' => 'nullable|integer|min:0|max:' . User::MAX_RATING,
        ]);

        $minRating = array_key_exists('min_rating', $validated) && $validated['min_rating'] !== null
            ? (int) $validated['min_rating']
            : null;
        $maxRating = array_key_exists('max_rating', $validated) && $validated['max_rating'] !== null
            ? (int) $validated['max_rating']
            : null;

        if ($minRating !== null && $maxRating !== null && $minRating > $maxRating) {
            [$minRating, $maxRating] = [$maxRating, $minRating];
        }

        return [$minRating, $maxRating, $minRating !== null || $maxRating !== null];
    }
}
