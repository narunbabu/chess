<?php

namespace App\Http\Controllers;

use App\Models\UserPresence;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Redis;
use App\Events\UserPresenceUpdated;

class UserPresenceController extends Controller
{
    /**
     * Update user presence status
     */
    public function updatePresence(Request $request): JsonResponse
    {
        $request->validate([
            'socket_id' => 'sometimes|string',
            'device_info' => 'sometimes|array',
            'status' => 'sometimes|in:online,away,offline'
        ]);

        $user = auth()->user();
        if (!$user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $presence = UserPresence::updateOrCreate(
            ['user_id' => $user->id],
            [
                'status' => $request->input('status', 'online'),
                'socket_id' => $request->input('socket_id'),
                'device_info' => $request->input('device_info'),
                'last_activity' => now()
            ]
        );

        // Update Redis for real-time tracking
        Redis::hset("user_presence:{$user->id}", [
            'status' => $presence->status,
            'socket_id' => $presence->socket_id,
            'last_activity' => $presence->last_activity->timestamp,
            'user_name' => $user->name
        ]);

        // Broadcast presence update
        broadcast(new UserPresenceUpdated($user->id, $presence->status, $user->name));

        return response()->json([
            'status' => 'success',
            'presence' => $presence
        ]);
    }

    /**
     * Get user's current presence
     */
    public function getPresence(User $user): JsonResponse
    {
        $presence = UserPresence::where('user_id', $user->id)->first();

        if (!$presence) {
            $presence = UserPresence::create([
                'user_id' => $user->id,
                'status' => 'offline'
            ]);
        }

        return response()->json(['presence' => $presence]);
    }

    /**
     * Get all online users
     */
    public function getOnlineUsers(): JsonResponse
    {
        $onlineUsers = UserPresence::getOnlineUsers();

        return response()->json(['online_users' => $onlineUsers]);
    }

    /**
     * Handle user disconnection
     */
    public function handleDisconnection(Request $request): JsonResponse
    {
        $request->validate([
            'socket_id' => 'required|string',
            'user_id' => 'required|integer'
        ]);

        $userId = $request->input('user_id');
        $socketId = $request->input('socket_id');

        // Check if user has other active connections
        $otherConnections = UserPresence::where('user_id', $userId)
            ->where('socket_id', '!=', $socketId)
            ->where('last_activity', '>', now()->subMinutes(2))
            ->exists();

        if (!$otherConnections) {
            $this->setUserOffline($userId);
        }

        return response()->json(['status' => 'success']);
    }

    /**
     * Send heartbeat to maintain connection
     */
    public function heartbeat(Request $request): JsonResponse
    {
        $user = auth()->user();
        if (!$user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $presence = UserPresence::where('user_id', $user->id)->first();
        if ($presence) {
            $presence->updateActivity();

            // Update Redis
            Redis::hset("user_presence:{$user->id}", 'last_activity', now()->timestamp);
        }

        return response()->json(['status' => 'heartbeat_received']);
    }

    /**
     * Set user as offline
     */
    private function setUserOffline(int $userId): void
    {
        $user = User::find($userId);
        if (!$user) return;

        $presence = UserPresence::where('user_id', $userId)->first();
        if ($presence) {
            $presence->setOffline();
        }

        // Update Redis
        Redis::hset("user_presence:$userId", 'status', 'offline');

        // Handle any active games
        $this->handlePlayerDisconnection($userId);

        // Broadcast presence update
        broadcast(new UserPresenceUpdated($userId, 'offline', $user->name));
    }

    /**
     * Handle player disconnection in active games
     */
    private function handlePlayerDisconnection(int $userId): void
    {
        $user = User::find($userId);
        if (!$user) return;

        // Find active games where this user is playing
        $activeGames = $user->games()
            ->whereIn('status', ['waiting', 'active'])
            ->get();

        foreach ($activeGames as $game) {
            // Update connection status
            if ($game->white_player_id === $userId) {
                $game->update(['white_connected' => false, 'white_last_seen' => now()]);
            } elseif ($game->black_player_id === $userId) {
                $game->update(['black_connected' => false, 'black_last_seen' => now()]);
            }

            // TODO: Implement game-specific disconnection handling
            // This will be expanded in Phase 3 with timeout logic
        }
    }

    /**
     * Get presence statistics
     */
    public function getPresenceStats(): JsonResponse
    {
        $stats = [
            'total_online' => UserPresence::where('status', 'online')
                ->where('last_activity', '>', now()->subMinutes(5))
                ->count(),
            'total_away' => UserPresence::where('status', 'away')
                ->where('last_activity', '>', now()->subMinutes(15))
                ->count(),
            'in_game' => UserPresence::whereNotNull('current_game_id')
                ->where('status', 'online')
                ->count()
        ];

        return response()->json(['stats' => $stats]);
    }
}
