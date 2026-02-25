<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\GameStatus;
use App\Models\SyntheticPlayer;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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

        // Get real online users (users active within last 5 minutes)
        $onlineThreshold = now()->subMinutes(5);

        // Find users currently in active games (busy — should show "Playing" status)
        $activeStatusId = GameStatus::where('code', 'active')->value('id');
        $busyUserIds = [];
        if ($activeStatusId) {
            $thirtyMinAgo = now()->subMinutes(30);
            $whiteIds = Game::where('status_id', $activeStatusId)
                ->where(function ($q) use ($thirtyMinAgo) {
                    $q->where('last_move_at', '>=', $thirtyMinAgo)
                      ->orWhere('created_at', '>=', $thirtyMinAgo);
                })
                ->whereNotNull('white_player_id')
                ->pluck('white_player_id');
            $blackIds = Game::where('status_id', $activeStatusId)
                ->where(function ($q) use ($thirtyMinAgo) {
                    $q->where('last_move_at', '>=', $thirtyMinAgo)
                      ->orWhere('created_at', '>=', $thirtyMinAgo);
                })
                ->whereNotNull('black_player_id')
                ->pluck('black_player_id');
            $busyUserIds = $whiteIds->merge($blackIds)->unique()->toArray();
        }

        $realPlayers = User::where('id', '!=', $user->id)
            ->where('last_activity_at', '>=', $onlineThreshold)
            ->orderBy('rating', 'desc')
            ->limit(50)
            ->get(['id', 'name', 'email', 'avatar_url', 'rating'])
            ->map(function ($player) use ($busyUserIds) {
                $inGame = in_array($player->id, $busyUserIds);
                return [
                    'id' => $player->id,
                    'name' => $player->name,
                    'email' => $player->email,
                    'rating' => $player->rating ?? 1200,
                    'avatar_url' => $player->avatar_url,
                    'type' => 'human',
                    'is_online' => true,
                    'in_game' => $inGame,
                    'status' => $inGame ? 'playing' : 'online',
                ];
            });

        // Get randomized synthetic players (fresh each request — no cache)
        $syntheticPlayers = SyntheticPlayer::getRandomizedForLobby()->map(function ($bot) {
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
        ]);
    }
}
