<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

class WebSocketAuth
{
    /**
     * Handle an incoming request for WebSocket authentication.
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Get token from query parameter or authorization header
        $token = $request->query('token')
            ?? $request->bearerToken()
            ?? $request->header('X-Socket-ID');

        if (!$token) {
            return response()->json([
                'error' => 'Authentication token required for WebSocket connection'
            ], 401);
        }

        // Validate token using Sanctum
        $personalAccessToken = PersonalAccessToken::findToken($token);

        if (!$personalAccessToken || !$personalAccessToken->tokenable) {
            return response()->json([
                'error' => 'Invalid authentication token'
            ], 401);
        }

        // Set authenticated user
        Auth::setUser($personalAccessToken->tokenable);

        // Add user info to request for downstream processing
        $request->merge([
            'authenticated_user' => $personalAccessToken->tokenable,
            'auth_token' => $token
        ]);

        return $next($request);
    }

    /**
     * Validate WebSocket connection for specific channel access
     */
    public function validateChannelAccess(Request $request, string $channelName): bool
    {
        $user = $request->get('authenticated_user');

        if (!$user) {
            return false;
        }

        // Validate access to game channels
        if (str_starts_with($channelName, 'game.')) {
            $gameId = str_replace('game.', '', $channelName);
            return $this->canAccessGame($user, $gameId);
        }

        // Validate access to presence channels
        if (str_starts_with($channelName, 'presence.')) {
            return true; // All authenticated users can join presence
        }

        return false;
    }

    /**
     * Check if user can access specific game channel
     */
    private function canAccessGame($user, string $gameId): bool
    {
        // Load game and check if user is a participant
        $game = \App\Models\Game::find($gameId);

        if (!$game) {
            return false;
        }

        return $game->white_player_id === $user->id ||
               $game->black_player_id === $user->id;
    }
}