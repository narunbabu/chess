<?php

use Illuminate\Support\Facades\Broadcast;
use App\Models\Game;

// Private user channel for notifications
Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Game-specific private channels for real-time gameplay
Broadcast::channel('game.{gameId}', function ($user, $gameId) {
    $game = Game::find($gameId);

    if (!$game) {
        return false;
    }

    // Only allow players participating in the game
    return $game->white_player_id === $user->id ||
           $game->black_player_id === $user->id;
});

// Presence channel for online users
Broadcast::channel('presence.online', function ($user) {
    return [
        'id' => $user->id,
        'name' => $user->name,
        'avatar' => $user->avatar ?? null,
        'status' => 'online',
        'joined_at' => now()->toISOString()
    ];
});

// Presence channel for game lobbies
Broadcast::channel('presence.lobby', function ($user) {
    return [
        'id' => $user->id,
        'name' => $user->name,
        'avatar' => $user->avatar ?? null,
        'looking_for_game' => true,
        'rating' => $user->rating ?? 1200,
        'joined_lobby_at' => now()->toISOString()
    ];
});

// Game room presence for spectators
Broadcast::channel('presence.game.{gameId}', function ($user, $gameId) {
    $game = Game::find($gameId);

    if (!$game) {
        return false;
    }

    // Allow players and spectators
    return [
        'id' => $user->id,
        'name' => $user->name,
        'avatar' => $user->avatar ?? null,
        'role' => ($game->white_player_id === $user->id || $game->black_player_id === $user->id)
                  ? 'player' : 'spectator',
        'joined_at' => now()->toISOString()
    ];
});
