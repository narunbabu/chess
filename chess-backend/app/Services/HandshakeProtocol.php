<?php

namespace App\Services;

use App\Events\GameConnectionEvent;
use App\Models\Game;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class HandshakeProtocol
{
    // Remove dependency injection to avoid circular dependency
    // Will resolve GameRoomService from container when needed

    /**
     * Complete WebSocket handshake for game connection
     */
    public function completeHandshake(array $handshakeData): array
    {
        $user = Auth::user();
        $gameId = $handshakeData['game_id'];
        $socketId = $handshakeData['socket_id'];
        $clientInfo = $handshakeData['client_info'] ?? [];

        Log::info('Starting WebSocket handshake', [
            'user_id' => $user->id,
            'game_id' => $gameId,
            'socket_id' => $socketId
        ]);

        try {
            // Step 1: Validate game exists and user has access
            $game = Game::with(['whitePlayer', 'blackPlayer'])->findOrFail($gameId);
            Log::info('Game loaded for handshake', [
                'game_id' => $game->id,
                'white_player_id' => $game->white_player_id,
                'black_player_id' => $game->black_player_id,
                'status' => $game->status,
                'white_player_loaded' => $game->whitePlayer !== null,
                'black_player_loaded' => $game->blackPlayer !== null
            ]);

            $this->validateGameAccess($user, $game);

            // Step 2: Join the game room
            $gameRoomService = app(GameRoomService::class);
            $joinResult = $gameRoomService->joinGame($gameId, $socketId, $clientInfo);
            Log::info('Game room join result', ['join_result' => $joinResult]);

            // Step 2.5: Check if both players are now connected and activate game
            $this->maybeActivateGame($game);

            // Step 3: Prepare handshake response with game state
            $handshakeResponse = $this->prepareHandshakeResponse($game, $user, $joinResult);

            // Step 4: Cache the handshake for reconnection scenarios
            $this->cacheHandshakeData($user->id, $gameId, $socketId, $handshakeResponse);

            // Step 5: Log successful handshake
            Log::info('WebSocket handshake completed successfully', [
                'user_id' => $user->id,
                'game_id' => $gameId,
                'connection_id' => $joinResult['connection_id'],
                'handshake_id' => $handshakeResponse['handshake_id']
            ]);

            return $handshakeResponse;

        } catch (\Exception $e) {
            Log::error('WebSocket handshake failed', [
                'user_id' => $user->id,
                'game_id' => $gameId,
                'socket_id' => $socketId,
                'error' => $e->getMessage()
            ]);

            throw $e;
        }
    }

    /**
     * Handle handshake acknowledgment from client
     */
    public function acknowledgeHandshake(string $handshakeId, array $clientData = []): array
    {
        $user = Auth::user();

        try {
            // Retrieve cached handshake data
            $cacheKey = "handshake:{$handshakeId}";
            $handshakeData = Cache::get($cacheKey);

            if (!$handshakeData) {
                throw new \Exception('Handshake not found or expired');
            }

            // Validate the handshake belongs to the current user
            if ($handshakeData['user_id'] !== $user->id) {
                throw new \Exception('Handshake user mismatch');
            }

            // Update handshake status to acknowledged
            $handshakeData['status'] = 'acknowledged';
            $handshakeData['acknowledged_at'] = now()->toISOString();
            $handshakeData['client_data'] = $clientData;

            // Extend cache with acknowledged data
            Cache::put($cacheKey, $handshakeData, now()->addHours(1));

            // Update connection activity
            $gameRoomService = app(GameRoomService::class);
            $gameRoomService->heartbeat(
                $handshakeData['game_id'],
                $handshakeData['socket_id']
            );

            Log::info('WebSocket handshake acknowledged', [
                'user_id' => $user->id,
                'handshake_id' => $handshakeId,
                'game_id' => $handshakeData['game_id']
            ]);

            return [
                'success' => true,
                'handshake_id' => $handshakeId,
                'status' => 'acknowledged',
                'acknowledged_at' => $handshakeData['acknowledged_at'],
                'next_heartbeat' => now()->addSeconds(30)->toISOString()
            ];

        } catch (\Exception $e) {
            Log::error('Handshake acknowledgment failed', [
                'user_id' => $user->id,
                'handshake_id' => $handshakeId,
                'error' => $e->getMessage()
            ]);

            throw $e;
        }
    }

    /**
     * Validate user can access the game
     */
    private function validateGameAccess(User $user, Game $game): void
    {
        Log::info('Validating game access', [
            'user_id' => $user->id,
            'game_id' => $game->id,
            'game_status' => $game->status,
            'white_player_id' => $game->white_player_id,
            'black_player_id' => $game->black_player_id,
            'is_white_player' => $game->white_player_id === $user->id,
            'is_black_player' => $game->black_player_id === $user->id
        ]);

        $isPlayer = $game->white_player_id === $user->id || $game->black_player_id === $user->id;

        if (!$isPlayer) {
            throw new \Exception('User not authorized to join this game');
        }

        Log::info('Game status check for handshake', [
            'game_id' => $game->id,
            'current_status' => $game->status,
            'status_type' => gettype($game->status),
            'allowed_statuses' => ['waiting', 'active'],
            'user_id' => $user->id,
            'white_player_id' => $game->white_player_id,
            'black_player_id' => $game->black_player_id
        ]);

        if (!in_array($game->status, ['waiting', 'active'])) {
            Log::error('Game not in joinable state', [
                'game_id' => $game->id,
                'current_status' => $game->status,
                'allowed_statuses' => ['waiting', 'active']
            ]);
            throw new \Exception('Game is not in a joinable state');
        }
    }

    /**
     * Prepare complete handshake response with game state
     */
    private function prepareHandshakeResponse(Game $game, User $user, array $joinResult): array
    {
        $handshakeId = uniqid('hs_', true);
        $userColor = $game->getPlayerColor($user->id);
        $opponent = $game->getOpponent($user->id);

        Log::info('Preparing handshake response', [
            'game_id' => $game->id,
            'user_id' => $user->id,
            'user_color' => $userColor,
            'opponent_exists' => $opponent !== null,
            'opponent_id' => $opponent?->id
        ]);

        // Prepare opponent info - handle case where opponent might not exist yet
        $opponentInfo = null;
        if ($opponent) {
            $opponentInfo = [
                'id' => $opponent->id,
                'name' => $opponent->name,
                'color' => $userColor === 'white' ? 'black' : 'white',
                'avatar' => $opponent->avatar ?? null,
                'online' => $this->isOpponentOnline($opponent->id, $game->id)
            ];
        } else {
            $opponentInfo = [
                'id' => null,
                'name' => 'Waiting for opponent...',
                'color' => $userColor === 'white' ? 'black' : 'white',
                'avatar' => null,
                'online' => false
            ];
        }

        return [
            'success' => true,
            'handshake_id' => $handshakeId,
            'timestamp' => now()->toISOString(),
            'connection' => [
                'connection_id' => $joinResult['connection_id'],
                'user_role' => $joinResult['user_role'],
                'socket_id' => request()->input('socket_id'),
                'established_at' => now()->toISOString()
            ],
            'game_state' => [
                'id' => $game->id,
                'status' => $game->status,
                'fen' => $game->fen ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                'turn' => $game->turn ?? 'white',
                'moves' => $game->moves ?? [],
                'last_move_at' => $game->last_move_at?->toISOString(),
                'move_count' => count($game->moves ?? [])
            ],
            'player_info' => [
                'you' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'color' => $userColor,
                    'avatar' => $user->avatar ?? null
                ],
                'opponent' => $opponentInfo
            ],
            'channels' => [
                'game_channel' => "game.{$game->id}",
                'presence_channel' => "presence.game.{$game->id}",
                'user_channel' => "App.Models.User.{$user->id}"
            ],
            'protocol' => [
                'version' => '2.0',
                'heartbeat_interval' => 30, // seconds
                'reconnect_timeout' => 300, // seconds
                'supported_events' => [
                    'game.move',
                    'game.connection',
                    'game.status',
                    'game.chat',
                    'game.draw_offer',
                    'game.resignation'
                ]
            ],
            'session' => [
                'session_id' => uniqid('sess_', true),
                'expires_at' => now()->addHours(4)->toISOString(),
                'max_idle_time' => 1800 // 30 minutes
            ]
        ];
    }

    /**
     * Cache handshake data for reconnection scenarios
     */
    private function cacheHandshakeData(int $userId, int $gameId, string $socketId, array $handshakeResponse): void
    {
        $cacheKey = "handshake:{$handshakeResponse['handshake_id']}";

        $cacheData = [
            'user_id' => $userId,
            'game_id' => $gameId,
            'socket_id' => $socketId,
            'handshake_response' => $handshakeResponse,
            'status' => 'completed',
            'created_at' => now()->toISOString()
        ];

        // Cache for 1 hour
        Cache::put($cacheKey, $cacheData, now()->addHours(1));

        // Also cache by user+game for quick lookups
        $userGameKey = "user_handshake:{$userId}:game:{$gameId}";
        Cache::put($userGameKey, $handshakeResponse['handshake_id'], now()->addHours(1));
    }

    /**
     * Check if opponent is currently online
     */
    private function isOpponentOnline(int $opponentId, int $gameId): bool
    {
        // Check general user presence first
        $userPresence = Cache::get("user_presence:{$opponentId}", false);

        // If presence data is an array (from Redis), check the status
        if (is_array($userPresence)) {
            $status = $userPresence['status'] ?? 'offline';
            $lastActivity = $userPresence['last_activity'] ?? 0;

            // Consider user online if status is 'online' and last activity within 5 minutes
            return $status === 'online' && (time() - $lastActivity) < 300;
        }

        // Check game-specific presence as fallback
        $gamePresence = Cache::get("user_presence:{$opponentId}:game:{$gameId}", false);

        return (bool)$gamePresence;
    }

    /**
     * Get existing handshake for reconnection
     */
    public function getExistingHandshake(int $gameId): ?array
    {
        $user = Auth::user();
        $userGameKey = "user_handshake:{$user->id}:game:{$gameId}";
        $handshakeId = Cache::get($userGameKey);

        if (!$handshakeId) {
            return null;
        }

        $cacheKey = "handshake:{$handshakeId}";
        $handshakeData = Cache::get($cacheKey);

        return $handshakeData ? $handshakeData['handshake_response'] : null;
    }

    /**
     * Cleanup expired handshakes
     */
    public function cleanupExpiredHandshakes(): int
    {
        // This would be called by a scheduled job
        // For now, rely on cache TTL for cleanup
        return 0;
    }

    /**
     * Activate game if both players are connected
     */
    private function maybeActivateGame(Game $game): void
    {
        // Only activate if game is currently waiting
        if ($game->status !== 'waiting') {
            return;
        }

        // Check if both players are actively connected
        $activeConnections = \App\Models\GameConnection::where('game_id', $game->id)
            ->where('status', 'connected')
            ->where('last_activity', '>', now()->subMinutes(2))
            ->distinct('user_id')
            ->count();

        Log::info('Checking game activation', [
            'game_id' => $game->id,
            'current_status' => $game->status,
            'active_connections' => $activeConnections,
            'required_connections' => 2
        ]);

        // Activate game when both players are connected
        if ($activeConnections >= 2) {
            $game->update(['status' => 'active']);

            Log::info('Game activated - both players connected', [
                'game_id' => $game->id,
                'white_player_id' => $game->white_player_id,
                'black_player_id' => $game->black_player_id
            ]);

            // TODO: Broadcast game activation event to both players
            // broadcast(new GameActivatedEvent($game));
        }
    }
}