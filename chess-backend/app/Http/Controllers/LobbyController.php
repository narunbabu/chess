<?php

namespace App\Http\Controllers;

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
        $realPlayers = User::where('id', '!=', $user->id)
            ->where('last_activity_at', '>=', $onlineThreshold)
            ->orderBy('rating', 'desc')
            ->limit(50)
            ->get(['id', 'name', 'email', 'avatar_url', 'rating'])
            ->map(function ($player) {
                return [
                    'id' => $player->id,
                    'name' => $player->name,
                    'email' => $player->email,
                    'rating' => $player->rating ?? 1200,
                    'avatar_url' => $player->avatar_url,
                    'type' => 'human',
                    'is_online' => true,
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
