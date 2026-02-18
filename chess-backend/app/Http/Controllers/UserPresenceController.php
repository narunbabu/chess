<?php

namespace App\Http\Controllers;

use App\Models\UserPresence;
use App\Models\User;
use App\Models\Game;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
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

        try {
            $presence = UserPresence::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'status' => $request->input('status', 'online'),
                    'socket_id' => $request->input('socket_id'),
                    'device_info' => $request->input('device_info'),
                    'last_activity' => now()
                ]
            );

            // Update Redis for real-time tracking (non-critical)
            try {
                $redisData = [
                    'status' => $presence->status,
                    'last_activity' => $presence->last_activity?->timestamp ?? time(),
                    'user_name' => $user->name
                ];

                if ($presence->socket_id) {
                    $redisData['socket_id'] = $presence->socket_id;
                }

                Redis::hmset("user_presence:{$user->id}", $redisData);
            } catch (\Exception $e) {
                Log::warning('Redis presence update failed', [
                    'user_id' => $user->id,
                    'error' => $e->getMessage()
                ]);
            }

            // Broadcast presence update (non-critical)
            try {
                broadcast(new UserPresenceUpdated($user->id, $presence->status, $user->name));
            } catch (\Exception $e) {
                Log::warning('Presence broadcast failed', [
                    'user_id' => $user->id,
                    'error' => $e->getMessage()
                ]);
            }

            return response()->json([
                'status' => 'success',
                'presence' => $presence
            ]);

        } catch (\Exception $e) {
            Log::error('Update presence failed', [
                'user_id' => $user->id,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Server error',
                'message' => 'Failed to update presence'
            ], 500);
        }
    }

    /**
     * Get user's current presence
     */
    public function getPresence(User $user): JsonResponse
    {
        try {
            $presence = UserPresence::where('user_id', $user->id)->first();

            if (!$presence) {
                $presence = UserPresence::create([
                    'user_id' => $user->id,
                    'status' => 'offline'
                ]);
            }

            return response()->json(['presence' => $presence]);

        } catch (\Exception $e) {
            Log::error('Get presence failed', [
                'user_id' => $user->id,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Server error',
                'message' => 'Failed to get presence'
            ], 500);
        }
    }

    /**
     * Get all online users
     */
    public function getOnlineUsers(): JsonResponse
    {
        try {
            $onlineUsers = UserPresence::getOnlineUsers();

            return response()->json(['online_users' => $onlineUsers]);

        } catch (\Exception $e) {
            Log::error('Get online users failed', [
                'error' => $e->getMessage()
            ]);

            return response()->json(['online_users' => []], 200);
        }
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

        try {
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

        } catch (\Exception $e) {
            Log::error('Handle disconnection failed', [
                'error' => $e->getMessage()
            ]);
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

        try {
            $presence = UserPresence::where('user_id', $user->id)->first();
            if ($presence) {
                $presence->updateActivity();

                // Update Redis (non-critical)
                try {
                    Redis::hset("user_presence:{$user->id}", 'last_activity', now()->timestamp);
                } catch (\Exception $e) {
                    // Redis failure is non-critical for heartbeat
                }
            }
        } catch (\Exception $e) {
            Log::error('Heartbeat failed', [
                'user_id' => $user->id,
                'error' => $e->getMessage()
            ]);
        }

        return response()->json(['status' => 'heartbeat_received']);
    }

    /**
     * Set user as offline
     */
    private function setUserOffline(int $userId): void
    {
        try {
            $user = User::find($userId);
            if (!$user) return;

            $presence = UserPresence::where('user_id', $userId)->first();
            if ($presence) {
                $presence->setOffline();
            }

            // Update Redis (non-critical)
            try {
                Redis::hset("user_presence:$userId", 'status', 'offline');
            } catch (\Exception $e) {
                Log::warning('Redis offline update failed', ['user_id' => $userId]);
            }

            // Handle any active games
            $this->handlePlayerDisconnection($userId);

            // Broadcast presence update (non-critical)
            try {
                broadcast(new UserPresenceUpdated($userId, 'offline', $user->name));
            } catch (\Exception $e) {
                Log::warning('Offline broadcast failed', ['user_id' => $userId]);
            }

        } catch (\Exception $e) {
            Log::error('Set user offline failed', [
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Handle player disconnection in active games
     */
    private function handlePlayerDisconnection(int $userId): void
    {
        try {
            // Find active games where this user is playing
            // Status IDs: 1=waiting, 2=active/in_progress
            $activeGames = DB::table('games')
                ->where(function ($query) use ($userId) {
                    $query->where('white_player_id', $userId)
                          ->orWhere('black_player_id', $userId);
                })
                ->whereIn('status_id', [1, 2])
                ->get();

            foreach ($activeGames as $game) {
                if ($game->white_player_id === $userId) {
                    DB::table('games')->where('id', $game->id)
                        ->update(['white_connected' => false, 'white_last_seen' => now()]);
                } elseif ($game->black_player_id === $userId) {
                    DB::table('games')->where('id', $game->id)
                        ->update(['black_connected' => false, 'black_last_seen' => now()]);
                }
            }
        } catch (\Exception $e) {
            Log::error('Handle player disconnection failed', [
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Get presence statistics
     */
    public function getPresenceStats(): JsonResponse
    {
        try {
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

        } catch (\Exception $e) {
            Log::error('Get presence stats failed', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'stats' => ['total_online' => 0, 'total_away' => 0, 'in_game' => 0]
            ]);
        }
    }
}
