<?php

namespace App\Services;

use App\Events\GameConnectionEvent;
use App\Events\GameEndedEvent;
use App\Models\Game;
use App\Models\GameConnection;
use App\Models\User;
use App\Services\ChessRulesService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;

class GameRoomService
{
    protected $chessRules;

    public function __construct(ChessRulesService $chessRules)
    {
        $this->chessRules = $chessRules;
    }
    /**
     * Join a game room with WebSocket connection tracking
     */
    public function joinGame(int $gameId, string $socketId, array $metadata = []): array
    {
        $user = Auth::user();
        $game = Game::findOrFail($gameId);

        // Validate user can join this game
        if (!$this->canUserJoinGame($user, $game)) {
            throw new \Exception('User not authorized to join this game');
        }

        // Create connection record
        $connection = GameConnection::createConnection(
            $user->id,
            $gameId,
            $socketId,
            array_merge($metadata, [
                'user_agent' => request()->userAgent(),
                'ip_address' => request()->ip(),
                'join_type' => $this->determineJoinType($user, $game)
            ])
        );

        // Update user presence cache
        $this->updateUserPresence($user->id, $gameId, 'joined');

        // TODO: Re-enable broadcasting once configured
        // broadcast(new GameConnectionEvent($game, $user, 'join', [
        //     'connection_id' => $connection->connection_id,
        //     'socket_id' => $socketId
        // ]));

        return [
            'success' => true,
            'connection_id' => $connection->connection_id,
            'game' => $this->getGameRoomData($game),
            'user_role' => $this->getUserRole($user, $game),
            'active_connections' => $this->getActiveConnections($gameId)
        ];
    }

    /**
     * Leave a game room
     */
    public function leaveGame(int $gameId, string $socketId): array
    {
        $user = Auth::user();
        $game = Game::findOrFail($gameId);

        // Find and disconnect the connection
        $connection = GameConnection::where('game_id', $gameId)
            ->where('user_id', $user->id)
            ->where('socket_id', $socketId)
            ->where('status', 'connected')
            ->first();

        if ($connection) {
            $connection->markDisconnected();

            // Update user presence cache
            $this->updateUserPresence($user->id, $gameId, 'left');

            // Broadcast disconnect event
            // TODO: Re-enable broadcasting once configured
            // broadcast(new GameConnectionEvent($game, $user, 'leave', [
            //     'connection_id' => $connection->connection_id,
            //     'socket_id' => $socketId
            // ]));
        }

        return [
            'success' => true,
            'active_connections' => $this->getActiveConnections($gameId)
        ];
    }

    /**
     * Handle connection heartbeat to maintain presence
     */
    public function heartbeat(int $gameId, string $socketId): array
    {
        $user = Auth::user();

        $connection = GameConnection::where('game_id', $gameId)
            ->where('user_id', $user->id)
            ->where('socket_id', $socketId)
            ->where('status', 'connected')
            ->first();

        if ($connection) {
            $connection->updateActivity();
            $this->updateUserPresence($user->id, $gameId, 'active');

            return [
                'success' => true,
                'timestamp' => now()->toISOString(),
                'connection_id' => $connection->connection_id
            ];
        }

        return ['success' => false, 'error' => 'Connection not found'];
    }

    /**
     * Get current room state for reconnection
     */
    public function getRoomState(int $gameId, bool $compact = false, int $sinceMove = -1): array
    {
        $game = Game::with(['whitePlayer', 'blackPlayer'])->findOrFail($gameId);
        $user = Auth::user();

        if (!$this->canUserJoinGame($user, $game)) {
            throw new \Exception('User not authorized to access this game');
        }

        if ($compact) {
            return $this->getCompactRoomState($game, $user);
        }

        return [
            'game' => $this->getGameRoomData($game),
            'user_role' => $this->getUserRole($user, $game),
            'active_connections' => $this->getActiveConnections($gameId),
            'presence' => $this->getPresenceData($gameId)
        ];
    }

    /**
     * Get compact room state with minimal data
     */
    private function getCompactRoomState(Game $game, User $user): array
    {
        $moves = $game->moves ?? [];
        $moveCount = is_array($moves) ? count($moves) : 0;
        $lastMove = $moveCount > 0 ? $moves[$moveCount - 1] : null;

        // Convert database turn format ('white'/'black') to chess notation ('w'/'b')
        $chessTurn = ($game->turn === 'white') ? 'w' : 'b';

        // Determine player color for board orientation
        $playerColor = $this->getUserRole($user, $game);

        return [
            'fen' => $game->fen,
            'turn' => $chessTurn,
            'move_count' => $moveCount,
            'last_move' => $lastMove,
            'last_move_by' => $lastMove['user_id'] ?? null,
            'user_role' => $playerColor,
            'player_color' => $playerColor, // Add explicit player_color for frontend
        ];
    }

    /**
     * Check if user can join the game
     */
    private function canUserJoinGame(User $user, Game $game): bool
    {
        // Players can always join their own games
        if ($game->white_player_id === $user->id || $game->black_player_id === $user->id) {
            return true;
        }

        // Spectators can join public games (implement spectator logic later)
        return false; // For now, only players
    }

    /**
     * Determine the type of join (player, spectator, reconnect)
     */
    private function determineJoinType(User $user, Game $game): string
    {
        $existingConnection = GameConnection::where('game_id', $game->id)
            ->where('user_id', $user->id)
            ->where('status', 'disconnected')
            ->where('disconnected_at', '>', now()->subHours(1))
            ->exists();

        if ($existingConnection) {
            return 'reconnect';
        }

        if ($game->white_player_id === $user->id || $game->black_player_id === $user->id) {
            return 'player_join';
        }

        return 'spectator_join';
    }

    /**
     * Get user's role in the game
     */
    private function getUserRole(User $user, Game $game): string
    {
        if ($game->white_player_id === $user->id) {
            return 'white';
        }

        if ($game->black_player_id === $user->id) {
            return 'black';
        }

        return 'spectator';
    }

    /**
     * Get formatted game room data
     */
    private function getGameRoomData(Game $game): array
    {
        // Convert database turn format ('white'/'black') to chess notation ('w'/'b')
        $chessTurn = ($game->turn === 'white') ? 'w' : 'b';

        return [
            'id' => $game->id,
            'status' => $game->status,
            'turn' => $chessTurn,
            'fen' => $game->fen,
            'moves' => $game->moves ?? [],
            'white_player' => [
                'id' => $game->whitePlayer->id,
                'name' => $game->whitePlayer->name,
                'avatar' => $game->whitePlayer->avatar,
                'online' => $this->isUserOnline($game->whitePlayer->id, $game->id)
            ],
            'black_player' => [
                'id' => $game->blackPlayer->id,
                'name' => $game->blackPlayer->name,
                'avatar' => $game->blackPlayer->avatar,
                'online' => $this->isUserOnline($game->blackPlayer->id, $game->id)
            ],
            'last_move_at' => $game->last_move_at?->toISOString(),
            'created_at' => $game->created_at->toISOString(),
            'updated_at' => $game->updated_at->toISOString()
        ];
    }

    /**
     * Get active connections for a game
     */
    private function getActiveConnections(int $gameId): array
    {
        $connections = GameConnection::getActiveConnectionsForGame($gameId);

        return $connections->map(function ($connection) {
            return [
                'user_id' => $connection->user_id,
                'user_name' => $connection->user->name,
                'connection_id' => $connection->connection_id,
                'connected_at' => $connection->connected_at->toISOString(),
                'last_activity' => $connection->last_activity->toISOString()
            ];
        })->toArray();
    }

    /**
     * Update user presence in cache
     */
    private function updateUserPresence(int $userId, int $gameId, string $status): void
    {
        $cacheKey = "user_presence:{$userId}:game:{$gameId}";

        Cache::put($cacheKey, [
            'status' => $status,
            'timestamp' => now()->toISOString(),
            'game_id' => $gameId
        ], now()->addMinutes(30));
    }

    /**
     * Check if user is online in a specific game
     */
    private function isUserOnline(int $userId, int $gameId): bool
    {
        return GameConnection::where('game_id', $gameId)
            ->where('user_id', $userId)
            ->where('status', 'connected')
            ->where('last_activity', '>', now()->subMinutes(5))
            ->exists();
    }

    /**
     * Get presence data for the game room
     */
    private function getPresenceData(int $gameId): array
    {
        $activeConnections = GameConnection::getActiveConnectionsForGame($gameId);

        return [
            'total_online' => $activeConnections->count(),
            'players_online' => $activeConnections->whereIn('user_id', function ($query) use ($gameId) {
                $game = Game::find($gameId);
                return [$game->white_player_id, $game->black_player_id];
            })->count(),
            'last_updated' => now()->toISOString()
        ];
    }

    /**
     * Clean up stale connections periodically
     */
    public function cleanupStaleConnections(): int
    {
        return GameConnection::cleanupStaleConnections();
    }

    /**
     * Handle game resume request
     */
    public function resumeGame(int $gameId, int $userId, string $socketId, bool $acceptResume = true): array
    {
        $game = Game::findOrFail($gameId);
        $user = User::findOrFail($userId);

        if (!$this->canUserJoinGame($user, $game)) {
            throw new \Exception('User not authorized to resume this game');
        }

        if ($game->status !== 'paused' && $game->status !== 'waiting') {
            throw new \Exception('Game cannot be resumed in current status: ' . $game->status);
        }

        if ($acceptResume) {
            // Update game status to active
            $game->update(['status' => 'active']);

            // Create new connection for resumed game
            $connection = GameConnection::createConnection(
                $userId,
                $gameId,
                $socketId,
                [
                    'user_agent' => request()->userAgent(),
                    'ip_address' => request()->ip(),
                    'join_type' => 'resume'
                ]
            );

            // Broadcast resume event
            // TODO: Re-enable broadcasting once configured
            // broadcast(new GameConnectionEvent($game, $user, 'resume', [
            //     'connection_id' => $connection->connection_id,
            //     'socket_id' => $socketId
            // ]));

            return [
                'success' => true,
                'action' => 'resumed',
                'game' => $this->getGameRoomData($game),
                'connection_id' => $connection->connection_id
            ];
        }

        return [
            'success' => true,
            'action' => 'pending',
            'message' => 'Waiting for other player to accept resume'
        ];
    }

    /**
     * Create new game/rematch
     */
    public function createNewGame(int $originalGameId, int $userId, string $socketId, bool $isRematch = false): array
    {
        $originalGame = Game::findOrFail($originalGameId);
        $user = User::findOrFail($userId);

        if (!$this->canUserJoinGame($user, $originalGame)) {
            throw new \Exception('User not authorized to create new game from this game');
        }

        // Create new game with swapped colors for rematch
        $newGame = Game::create([
            'white_player_id' => $isRematch ? $originalGame->black_player_id : $originalGame->white_player_id,
            'black_player_id' => $isRematch ? $originalGame->white_player_id : $originalGame->black_player_id,
            'fen' => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', // Starting position
            'status' => 'waiting',
            'turn' => 'white', // Use database format
            'moves' => [],
            'parent_game_id' => $originalGameId
        ]);

        // Create connection for the requesting user
        $connection = GameConnection::createConnection(
            $userId,
            $newGame->id,
            $socketId,
            [
                'user_agent' => request()->userAgent(),
                'ip_address' => request()->ip(),
                'join_type' => $isRematch ? 'rematch' : 'new_game'
            ]
        );

        // Broadcast new game event
        // TODO: Re-enable broadcasting once configured
        // broadcast(new GameConnectionEvent($newGame, $user, 'new_game', [
        //     'connection_id' => $connection->connection_id,
        //     'socket_id' => $socketId,
        //     'is_rematch' => $isRematch,
        //     'original_game_id' => $originalGameId
        // ]));

        return [
            'success' => true,
            'game_id' => $newGame->id,
            'game' => $this->getGameRoomData($newGame),
            'connection_id' => $connection->connection_id,
            'is_rematch' => $isRematch
        ];
    }

    /**
     * Broadcast move to all players
     */
    public function broadcastMove(int $gameId, int $userId, array $move, string $socketId): array
    {
        $game = Game::findOrFail($gameId);
        $user = User::findOrFail($userId);

        if (!$this->canUserJoinGame($user, $game)) {
            throw new \Exception('User not authorized to make moves in this game');
        }

        if ($game->status !== 'active') {
            throw new \Exception('Game is not active, current status: ' . $game->status);
        }

        // Verify it's the user's turn
        $userRole = $this->getUserRole($user, $game);
        $currentTurn = $game->turn; // This is in database format ('white'/'black')

        \Log::info('Turn validation check', [
            'user_id' => $userId,
            'user_role' => $userRole,
            'current_turn_in_db' => $currentTurn,
            'game_id' => $gameId
        ]);

        // Check if it's the user's turn (database uses 'white'/'black', userRole returns 'white'/'black')
        if ($currentTurn !== $userRole) {
            \Log::error('Turn validation failed', [
                'user_id' => $userId,
                'user_role' => $userRole,
                'current_turn_required' => $currentTurn,
                'game_id' => $gameId
            ]);
            throw new \Exception('Not your turn');
        }

        // Verify position synchronization with client
        $currentFen = $game->fen;
        if (($move['prev_fen'] ?? '') !== $currentFen) {
            throw new \Exception('Position desync between client and server. Expected: ' . $currentFen . ', got: ' . ($move['prev_fen'] ?? 'null'));
        }

        // Use client-computed FEN and turn (no server-side chess simulation needed)
        $newFen = (string)$move['next_fen'];
        $newTurn = (explode(' ', $newFen)[1] ?? 'w') === 'w' ? 'white' : 'black'; // Extract turn from FEN

        // Update game state
        $moves = $game->moves ?? [];
        $moveWithUser = array_merge($move, ['user_id' => $userId]);
        $moves[] = $moveWithUser;

        $game->update([
            'fen' => $newFen,
            'turn' => $newTurn,
            'moves' => $moves,
            'move_count' => count($moves),
            'last_move_at' => now()
        ]);

        // Check for game end conditions after move
        $this->maybeFinalizeGame($game, $userId, $move);

        // Refresh game to get any updates from finalization
        $game->refresh();

        // Broadcast move event (only if game is still active)
        if ($game->status === 'active') {
            // Extract turn from FEN for broadcast (chess notation 'w'/'b')
            $chessTurn = explode(' ', $newFen)[1] ?? 'w';
            broadcast(new \App\Events\GameMoveEvent($game, $user, $move, $newFen, $chessTurn, [
                'socket_id' => $socketId,
                'move_number' => count($moves)
            ]))->toOthers();
        }

        return [
            'success' => true,
            'move' => $move,
            'fen' => $newFen,
            'turn' => explode(' ', $newFen)[1] ?? 'w', // Extract turn from FEN (chess notation 'w'/'b')
            'move_number' => count($moves),
            'game_status' => $game->status,
            'game_over' => $game->status === 'finished'
        ];
    }

    /**
     * Update game status and broadcast to players
     */
    public function updateGameStatus(int $gameId, int $userId, string $status, ?string $result = null, ?string $reason = null, string $socketId): array
    {
        $game = Game::findOrFail($gameId);
        $user = User::findOrFail($userId);

        if (!$this->canUserJoinGame($user, $game)) {
            throw new \Exception('User not authorized to update this game');
        }

        $updateData = ['status' => $status];

        if ($result) {
            $updateData['result'] = $result;
        }

        if ($reason) {
            $updateData['end_reason'] = $reason;
        }

        if ($status === 'completed') {
            $updateData['ended_at'] = now();
        }

        $game->update($updateData);

        // Broadcast status change event
        // TODO: Re-enable broadcasting once configured
        // broadcast(new GameConnectionEvent($game, $user, 'status_change', [
        //     'status' => $status,
        //     'result' => $result,
        //     'reason' => $reason,
        //     'socket_id' => $socketId,
        //     'ended_at' => $status === 'completed' ? $game->ended_at?->toISOString() : null
        // ]));

        return [
            'success' => true,
            'status' => $status,
            'result' => $result,
            'reason' => $reason,
            'game' => $this->getGameRoomData($game)
        ];
    }

    /**
     * Check if the game has ended and finalize if necessary
     */
    private function maybeFinalizeGame(Game $game, int $actorUserId, array $move = []): void
    {
        // Skip if game is already finished
        if ($game->status === 'finished') {
            return;
        }

        // Use client-provided mate detection if available, otherwise fallback to analysis
        if (!empty($move['is_mate_hint']) || !empty($move['is_stalemate'])) {
            // Client indicates the game might be over
            $isCheckmate = !empty($move['is_mate_hint']);
            $isStalemate = !empty($move['is_stalemate']);

            Log::info('Using client-provided game end detection', [
                'game_id' => $game->id,
                'is_checkmate' => $isCheckmate,
                'is_stalemate' => $isStalemate,
                'san' => $move['san'] ?? ''
            ]);

            if ($isCheckmate) {
                // Determine winner from the move that delivered checkmate
                $winnerColor = ($game->turn === 'white') ? 'black' : 'white'; // Previous player won
                $result = $winnerColor === 'white' ? '1-0' : '0-1';
                $winnerUserId = $winnerColor === 'white' ? $game->white_player_id : $game->black_player_id;

                $this->finalizeGame($game, [
                    'result' => $result,
                    'winner_player' => $winnerColor,
                    'winner_user_id' => $winnerUserId,
                    'end_reason' => 'checkmate'
                ]);
                return;
            }

            if ($isStalemate) {
                $this->finalizeGame($game, [
                    'result' => '1/2-1/2',
                    'winner_player' => null,
                    'winner_user_id' => null,
                    'end_reason' => 'stalemate'
                ]);
                return;
            }
        }

        // Fallback: Analyze current position for game end conditions (backup system)
        $analysis = $this->chessRules->analyzeGameState($game);
        Log::info('Fallback analysis (no client hint)', ['game_id' => $game->id, 'analysis' => $analysis]);

        if (!empty($analysis['game_over'])) {
            $reason = $analysis['is_checkmate'] ? 'checkmate'
                     : ($analysis['is_stalemate'] ? 'stalemate'
                     : ($analysis['is_insufficient_material'] ? 'insufficient_material'
                     : ($analysis['is_threefold_repetition'] ? 'threefold'
                     : ($analysis['is_fifty_move_rule'] ? 'fifty_move' : 'other'))));
            $winnerColor = $analysis['winner'];  // 'white' | 'black' | null on draw
            $result = $analysis['result'];       // '1-0'|'0-1'|'1/2-1/2'

            // Determine winner_user_id based on winnerColor
            $winnerUserId = null;
            if ($winnerColor === 'white') {
                $winnerUserId = $game->white_player_id;
            } elseif ($winnerColor === 'black') {
                $winnerUserId = $game->black_player_id;
            }

            $this->finalizeGame($game, [
                'result' => $result,
                'winner_player' => $winnerColor,
                'winner_user_id' => $winnerUserId,
                'end_reason' => $reason
            ]);
            return; // stop here; finalized + broadcast happens inside finalizeGame()
        }
    }

    /**
     * Finalize the game (idempotent)
     */
    private function finalizeGame(Game $game, array $attrs): void
    {
        // Idempotent check
        if ($game->status === 'finished') {
            return;
        }

        // Generate PGN
        $pgn = $this->chessRules->generatePGN($game);

        // Update game with final state
        $game->update([
            'status' => 'finished',
            'result' => $attrs['result'],
            'winner_player' => $attrs['winner_player'] ?? null,
            'winner_user_id' => $attrs['winner_user_id'] ?? null,
            'end_reason' => $attrs['end_reason'],
            'ended_at' => now(),
            'pgn' => $pgn,
        ]);

        // Broadcast game ended event
        Log::info('Broadcasting GameEndedEvent', [
            'game_id' => $game->id,
            'result' => $game->result,
            'winner_user_id' => $game->winner_user_id,
            'end_reason' => $game->end_reason
        ]);

        $this->broadcastGameEnded($game);
    }

    /**
     * Broadcast game ended event to all players
     */
    private function broadcastGameEnded(Game $game): void
    {
        // Include player names in the broadcast data
        $whitePlayer = $game->whitePlayer;
        $blackPlayer = $game->blackPlayer;

        broadcast(new GameEndedEvent($game->id, [
            'game_over' => true,
            'result' => $game->result,
            'end_reason' => $game->end_reason,
            'winner_user_id' => $game->winner_user_id,
            'winner_player' => $game->winner_player,
            'fen_final' => $game->fen,
            'move_count' => $game->move_count,
            'ended_at' => $game->ended_at?->toISOString(),
            'white_player' => [
                'id' => $whitePlayer->id,
                'name' => $whitePlayer->name
            ],
            'black_player' => [
                'id' => $blackPlayer->id,
                'name' => $blackPlayer->name
            ]
        ])); // REMOVED ->toOthers() so BOTH players receive the event!

        \Log::info('Game ended', [
            'game_id' => $game->id,
            'result' => $game->result,
            'end_reason' => $game->end_reason,
            'winner_user_id' => $game->winner_user_id,
            'winner_player' => $game->winner_player,
        ]);
    }

    /**
     * Handle player resignation
     */
    public function resignGame(int $gameId, int $userId): array
    {
        $game = Game::with(['whitePlayer', 'blackPlayer'])->findOrFail($gameId);
        $user = User::findOrFail($userId);

        if (!$this->canUserJoinGame($user, $game)) {
            throw new \Exception('User not authorized to resign this game');
        }

        if ($game->status === 'finished') {
            throw new \Exception('Game is already finished');
        }

        if ($game->status !== 'active') {
            throw new \Exception('Game is not active, current status: ' . $game->status);
        }

        // Determine winner (opponent of resigning player)
        $resigningPlayerRole = $this->getUserRole($user, $game);
        $winner = $resigningPlayerRole === 'white' ? 'black' : 'white';
        $winnerUserId = $winner === 'white' ? $game->white_player_id : $game->black_player_id;

        $this->finalizeGame($game, [
            'result' => $winner === 'white' ? '1-0' : '0-1',
            'winner_player' => $winner,
            'winner_user_id' => $winnerUserId,
            'end_reason' => 'resignation'
        ]);

        return [
            'success' => true,
            'message' => 'Game resigned successfully',
            'result' => $game->fresh()->result,
            'winner' => $winner
        ];
    }
}