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
use Illuminate\Support\Facades\Log;

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
     * Create new game challenge with color preference
     */
    public function createNewGame(int $originalGameId, int $userId, string $socketId, string $colorPreference = 'random'): array
    {
        $originalGame = Game::findOrFail($originalGameId);
        $user = User::findOrFail($userId);

        if (!$this->canUserJoinGame($user, $originalGame)) {
            throw new \Exception('User not authorized to create new game from this game');
        }

        // Determine color assignments based on preference
        $whitePlayerId = null;
        $blackPlayerId = null;

        // Get the opponent's user ID
        $opponentId = ($originalGame->white_player_id === $userId)
            ? $originalGame->black_player_id
            : $originalGame->white_player_id;

        if ($colorPreference === 'white') {
            // Requester wants white
            $whitePlayerId = $userId;
            $blackPlayerId = $opponentId;
        } elseif ($colorPreference === 'black') {
            // Requester wants black
            $whitePlayerId = $opponentId;
            $blackPlayerId = $userId;
        } else {
            // Random assignment
            if (rand(0, 1) === 0) {
                $whitePlayerId = $userId;
                $blackPlayerId = $opponentId;
            } else {
                $whitePlayerId = $opponentId;
                $blackPlayerId = $userId;
            }
        }

        // Create new game with specified colors
        $newGame = Game::create([
            'white_player_id' => $whitePlayerId,
            'black_player_id' => $blackPlayerId,
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
                'join_type' => 'new_game_challenge'
            ]
        );

        // Broadcast new game request to opponent
        broadcast(new \App\Events\NewGameRequestEvent(
            $originalGame,
            $newGame,
            $user,
            $colorPreference
        ));

        \Log::info('New game challenge broadcasted', [
            'original_game_id' => $originalGameId,
            'new_game_id' => $newGame->id,
            'requester_id' => $userId,
            'color_preference' => $colorPreference,
            'white_player_id' => $whitePlayerId,
            'black_player_id' => $blackPlayerId
        ]);

        return [
            'success' => true,
            'game_id' => $newGame->id,
            'game' => $this->getGameRoomData($newGame),
            'connection_id' => $connection->connection_id,
            'color_preference' => $colorPreference
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

        // Determine which player made the move and update their score
        $updateData = [
            'fen' => $newFen,
            'turn' => $newTurn,
            'moves' => $moves,
            'move_count' => count($moves),
            'last_move_at' => now()
        ];

        // Update player's cumulative score if provided
        if (isset($move['player_score']) && is_numeric($move['player_score'])) {
            $playerColor = $this->getUserRole($user, $game); // 'white' or 'black'
            $scoreField = $playerColor . '_player_score';
            $updateData[$scoreField] = (float)$move['player_score'];

            \Log::info('Updating player score', [
                'game_id' => $gameId,
                'user_id' => $userId,
                'player_color' => $playerColor,
                'score_field' => $scoreField,
                'new_score' => $move['player_score']
            ]);
        }

        $game->update($updateData);

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
     * Idempotent - safe to call multiple times
     * Uses transaction with row locking to prevent race conditions
     */
    public function updateGameStatus(int $gameId, int $userId, string $status, string $socketId, ?string $result = null, ?string $reason = null): array
    {
        return \DB::transaction(function () use ($gameId, $userId, $status, $result, $reason, $socketId) {
            // Lock row for update and refresh state
            $game = Game::lockForUpdate()->findOrFail($gameId);
            $user = User::findOrFail($userId);

            if (!$this->canUserJoinGame($user, $game)) {
                throw new \Exception('User not authorized to update this game');
            }

            // Idempotent check: if already finished, return current state
            if ($game->isFinished()) {
                Log::info('Game already finished, returning current state', [
                    'game_id' => $gameId,
                    'current_status' => $game->status,
                    'requested_status' => $status
                ]);

                return [
                    'success' => true,
                    'already_finished' => true,
                    'status' => $game->status,
                    'result' => $game->result,
                    'reason' => $game->end_reason,
                    'game' => $this->getGameRoomData($game)
                ];
            }

            // Validate terminal status request
            if (!in_array($status, ['finished', 'aborted', 'active', 'waiting'])) {
                throw new \InvalidArgumentException("Invalid status: {$status}");
            }

            // Build update data (mutators will handle status_id/end_reason_id automatically)
            $updateData = ['status' => $status];

            if ($result) {
                $updateData['result'] = $result;
            }

            if ($reason) {
                $updateData['end_reason'] = $reason;
            }

            // Set ended_at for terminal statuses
            if (in_array($status, ['finished', 'aborted'])) {
                $updateData['ended_at'] = now();
            }

            $game->update($updateData);

            // Refresh to get updated relationships
            $game->refresh();

            // Broadcast status change event (synchronous for now)
            if (in_array($status, ['finished', 'aborted'])) {
                try {
                    $gameData = [
                        'game_over' => true,
                        'result' => $game->result,
                        'end_reason' => $game->end_reason,
                        'winner_user_id' => $game->winner_user_id,
                        'winner_player' => $game->winner_player,
                        'fen_final' => $game->fen,
                        'move_count' => $game->move_count,
                        'ended_at' => $game->ended_at?->toISOString(),
                        'white_player' => $game->whitePlayer,
                        'black_player' => $game->blackPlayer,
                    ];
                    broadcast(new GameEndedEvent($game->id, $gameData))->toOthers();
                } catch (\Exception $e) {
                    Log::error('Failed to broadcast GameEndedEvent', [
                        'game_id' => $gameId,
                        'error' => $e->getMessage()
                    ]);
                }
            }

            return [
                'success' => true,
                'status' => $game->status,
                'result' => $game->result,
                'reason' => $game->end_reason,
                'game' => $this->getGameRoomData($game)
            ];
        });
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

    /**
     * Handle player forfeit (unilateral abort - forfeiter loses)
     */
    public function forfeitGame(int $gameId, int $userId, string $reason = 'forfeit'): array
    {
        return \DB::transaction(function () use ($gameId, $userId, $reason) {
            $game = Game::lockForUpdate()->findOrFail($gameId);
            $user = User::findOrFail($userId);

            if (!$this->canUserJoinGame($user, $game)) {
                throw new \Exception('User not authorized to forfeit this game');
            }

            if ($game->isFinished()) {
                throw new \Exception('Game is already finished');
            }

            // Determine winner (opponent of forfeiter)
            $forfeiterColor = $this->getUserRole($user, $game);
            $result = ($forfeiterColor === 'white') ? '0-1' : '1-0';
            $winnerUserId = ($forfeiterColor === 'white')
                ? $game->black_player_id
                : $game->white_player_id;
            $winnerColor = ($forfeiterColor === 'white') ? 'black' : 'white';

            // Use the provided reason (e.g., 'timeout' or 'forfeit')
            $endReason = in_array($reason, ['timeout', 'forfeit']) ? $reason : 'forfeit';

            $game->update([
                'status' => 'finished',
                'result' => $result,
                'end_reason' => $endReason,
                'winner_user_id' => $winnerUserId,
                'winner_player' => $winnerColor,
                'ended_at' => now()
            ]);

            $this->broadcastGameEnded($game->fresh());

            return [
                'success' => true,
                'message' => $endReason === 'timeout' ? 'Game ended by timeout' : 'Game forfeited',
                'result' => $result,
                'winner' => $winnerColor
            ];
        });
    }

    /**
     * Request mutual abort (both players must agree)
     */
    public function requestAbort(int $gameId, int $userId): array
    {
        $game = Game::findOrFail($gameId);
        $user = User::findOrFail($userId);

        if (!$this->canUserJoinGame($user, $game)) {
            throw new \Exception('User not authorized to request abort for this game');
        }

        if ($game->isFinished()) {
            throw new \Exception('Game is already finished');
        }

        // Store pending abort request in cache (5 min expiry)
        Cache::put("abort_request:{$gameId}:{$userId}", true, 300);

        // Get opponent
        $opponent = $game->getOpponent($userId);

        // TODO: Broadcast abort request to opponent
        // broadcast(new AbortRequestEvent($gameId, [
        //     'requester_id' => $userId,
        //     'requester_name' => $user->name
        // ]))->toOthers();

        Log::info('Abort request sent', [
            'game_id' => $gameId,
            'requester_id' => $userId,
            'opponent_id' => $opponent->id
        ]);

        return [
            'success' => true,
            'status' => 'pending',
            'message' => 'Abort request sent to opponent'
        ];
    }

    /**
     * Respond to abort request (accept or decline)
     */
    public function respondToAbort(int $gameId, int $userId, bool $accept): array
    {
        return \DB::transaction(function () use ($gameId, $userId, $accept) {
            $game = Game::lockForUpdate()->findOrFail($gameId);
            $user = User::findOrFail($userId);

            if (!$this->canUserJoinGame($user, $game)) {
                throw new \Exception('User not authorized to respond to abort for this game');
            }

            $opponent = $game->getOpponent($userId);
            $requestKey = "abort_request:{$gameId}:{$opponent->id}";

            // Check if there's a pending abort request from opponent
            if (!Cache::has($requestKey)) {
                throw new \Exception('No pending abort request found');
            }

            if ($accept) {
                // Both players agreed - mutual abort (No Result)
                $game->update([
                    'status' => 'finished',
                    'result' => '*',  // No result (PGN standard for abandoned/aborted games)
                    'end_reason' => 'abandoned_mutual',
                    'ended_at' => now()
                ]);

                Cache::forget($requestKey);

                // Broadcast game ended with mutual abort
                broadcast(new GameEndedEvent($game->id, [
                    'game_over' => true,
                    'result' => '*',
                    'end_reason' => 'abandoned_mutual',
                    'fen_final' => $game->fen,
                    'move_count' => $game->move_count,
                    'ended_at' => $game->ended_at?->toISOString(),
                    'white_player' => $game->whitePlayer,
                    'black_player' => $game->blackPlayer
                ]));

                return [
                    'success' => true,
                    'result' => 'mutual_abort',
                    'message' => 'Game aborted by mutual agreement'
                ];
            } else {
                // Declined - game continues
                Cache::forget($requestKey);

                // TODO: Broadcast abort declined
                // broadcast(new AbortDeclinedEvent($gameId))->toOthers();

                return [
                    'success' => true,
                    'result' => 'declined',
                    'message' => 'Abort request declined'
                ];
            }
        });
    }

    /**
     * Pause game due to inactivity
     */
    public function pauseGame(int $gameId, int $pausedByUserId, string $reason = 'inactivity'): array
    {
        $game = Game::findOrFail($gameId);
        $pausedByUser = User::findOrFail($pausedByUserId);

        if ($game->status !== 'active') {
            return [
                'success' => false,
                'message' => 'Game is not active'
            ];
        }

        // Store current time remaining for each player before pausing
        $whiteTimeRemaining = $game->white_time_remaining_ms;
        $blackTimeRemaining = $game->black_time_remaining_ms;
        $currentTurn = $game->turn;

        // Give 40 seconds grace time to the player whose turn it was when paused
        $graceTimeMs = 40000; // 40 seconds in milliseconds

        $updateData = [
            'status' => 'paused',
            'paused_at' => now(),
            'paused_reason' => $reason,
            'paused_by_user_id' => $pausedByUserId,
            'white_time_paused_ms' => $whiteTimeRemaining,
            'black_time_paused_ms' => $blackTimeRemaining,
            'turn_at_pause' => $currentTurn,
            'white_grace_time_ms' => ($currentTurn === 'white') ? $graceTimeMs : 0,
            'black_grace_time_ms' => ($currentTurn === 'black') ? $graceTimeMs : 0,
        ];

        $game->update($updateData);

        // Prepare pause data for event
        $pauseData = [
            'white_time_paused_ms' => $whiteTimeRemaining,
            'black_time_paused_ms' => $blackTimeRemaining,
            'turn_at_pause' => $currentTurn,
            'grace_time_player' => $currentTurn,
            'grace_time_ms' => $graceTimeMs
        ];

        // Broadcast game paused event to both players
        broadcast(new \App\Events\GamePausedEvent(
            $game,
            $pausedByUser,
            $reason,
            $pauseData
        ))->toOthers();

        Log::info('Game paused with time tracking', [
            'game_id' => $gameId,
            'paused_by_user_id' => $pausedByUserId,
            'paused_by_user_name' => $pausedByUser->name,
            'reason' => $reason,
            'white_time_paused_ms' => $whiteTimeRemaining,
            'black_time_paused_ms' => $blackTimeRemaining,
            'turn_at_pause' => $currentTurn,
            'grace_time_given_to' => $currentTurn,
            'grace_time_ms' => $graceTimeMs
        ]);

        return [
            'success' => true,
            'status' => 'paused',
            'reason' => $reason,
            'paused_by_user_id' => $pausedByUserId,
            'paused_by_user_name' => $pausedByUser->name,
            'white_time_paused_ms' => $whiteTimeRemaining,
            'black_time_paused_ms' => $blackTimeRemaining,
            'turn_at_pause' => $currentTurn,
            'grace_time_player' => $currentTurn,
            'grace_time_ms' => $graceTimeMs
        ];
    }

    /**
     * Resume game from inactivity pause
     */
    public function resumeGameFromInactivity(int $gameId, int $userId): array
    {
        $game = Game::findOrFail($gameId);
        $user = User::findOrFail($userId);

        if (!$this->canUserJoinGame($user, $game)) {
            throw new \Exception('User not authorized to resume this game');
        }

        if ($game->status !== 'paused') {
            return [
                'success' => false,
                'message' => 'Game is not paused'
            ];
        }

        // Restore time with grace time applied
        $whiteTimeResumed = $game->white_time_paused_ms + $game->white_grace_time_ms;
        $blackTimeResumed = $game->black_time_paused_ms + $game->black_grace_time_ms;

        $updateData = [
            'status' => 'active',
            'paused_at' => null,
            'paused_reason' => null,
            'last_heartbeat_at' => now(),
            'white_time_remaining_ms' => $whiteTimeResumed,
            'black_time_remaining_ms' => $blackTimeResumed,
            'last_move_time' => now(), // Reset the move timer to current time
            'turn' => $game->turn_at_pause, // Restore the turn that was active when paused
        ];

        // Store pause info for response, then clear the pause fields
        $pauseInfo = [
            'white_time_paused_ms' => $game->white_time_paused_ms,
            'black_time_paused_ms' => $game->black_time_paused_ms,
            'white_grace_time_ms' => $game->white_grace_time_ms,
            'black_grace_time_ms' => $game->black_grace_time_ms,
            'turn_at_pause' => $game->turn_at_pause,
        ];

        // Clear pause-specific fields after resuming
        $updateData = array_merge($updateData, [
            'white_time_paused_ms' => null,
            'black_time_paused_ms' => null,
            'turn_at_pause' => null,
            'white_grace_time_ms' => 0,
            'black_grace_time_ms' => 0,
        ]);

        $game->update($updateData);
        $game->refresh(); // Reload to get updated relationships

        // Broadcast game resumed event to all players
        broadcast(new \App\Events\GameResumedEvent($game, $userId, [
            'white_time_remaining_ms' => $whiteTimeResumed,
            'black_time_remaining_ms' => $blackTimeResumed,
            'turn' => $pauseInfo['turn_at_pause'],
            'grace_time_applied' => [
                'white' => $pauseInfo['white_grace_time_ms'],
                'black' => $pauseInfo['black_grace_time_ms']
            ]
        ]));

        Log::info('Game resumed from inactivity with grace time applied', [
            'game_id' => $gameId,
            'user_id' => $userId,
            'white_time_resumed_ms' => $whiteTimeResumed,
            'black_time_resumed_ms' => $blackTimeResumed,
            'white_grace_applied_ms' => $pauseInfo['white_grace_time_ms'],
            'black_grace_applied_ms' => $pauseInfo['black_grace_time_ms'],
            'restored_turn' => $pauseInfo['turn_at_pause']
        ]);

        return [
            'success' => true,
            'status' => 'active',
            'message' => 'Game resumed',
            'white_time_remaining_ms' => $whiteTimeResumed,
            'black_time_remaining_ms' => $blackTimeResumed,
            'grace_time_applied' => [
                'white' => $pauseInfo['white_grace_time_ms'],
                'black' => $pauseInfo['black_grace_time_ms']
            ],
            'turn' => $pauseInfo['turn_at_pause']
        ];
    }

    /**
     * Request to resume a paused game
     */
    public function requestResume(int $gameId, int $userId): array
    {
        $game = Game::findOrFail($gameId);

        if ($game->status !== 'paused') {
            return [
                'success' => false,
                'message' => 'Game is not paused'
            ];
        }

        // Check if there's a pending request
        if ($game->resume_status === 'pending') {
            // Check if the pending request has expired
            if ($game->resume_request_expires_at && now()->isAfter($game->resume_request_expires_at)) {
                // Auto-clear expired request
                Log::info('Auto-clearing expired resume request', [
                    'game_id' => $gameId,
                    'expired_at' => $game->resume_request_expires_at
                ]);

                $game->update([
                    'resume_status' => 'expired',
                    'resume_requested_by' => null,
                    'resume_requested_at' => null,
                    'resume_request_expires_at' => null
                ]);

                // Allow new request to proceed
            } else {
                // Still pending and not expired
                return [
                    'success' => false,
                    'message' => 'Resume request already pending'
                ];
            }
        }

        // Verify user is a player in this game
        if ($game->white_player_id !== $userId && $game->black_player_id !== $userId) {
            return [
                'success' => false,
                'message' => 'User is not a player in this game'
            ];
        }

        // Determine opponent
        $opponentId = ($game->white_player_id === $userId) ? $game->black_player_id : $game->white_player_id;

        // Create resume request invitation record
        $resumeInvitation = \App\Models\Invitation::create([
            'inviter_id' => $userId,
            'invited_id' => $opponentId,
            'status' => 'pending',
            'type' => 'resume_request',
            'game_id' => $gameId,
            'expires_at' => now()->addSeconds(10) // 10 second window
        ]);

        // Set resume request data
        $game->update([
            'resume_requested_by' => $userId,
            'resume_requested_at' => now(),
            'resume_request_expires_at' => $resumeInvitation->expires_at,
            'resume_status' => 'pending'
        ]);

        // Broadcast resume request event to opponent
        Log::info('📨 Broadcasting ResumeRequestSent event', [
            'game_id' => $gameId,
            'requested_by' => $userId,
            'opponent' => $opponentId,
            'channel' => "private-App.Models.User.{$opponentId}",
            'event' => 'resume.request.sent',
            'invitation_id' => $resumeInvitation->id,
            'game_resume_status' => $game->resume_status,
            'expires_at' => $game->resume_request_expires_at
        ]);

        $event = new \App\Events\ResumeRequestSent($game, $userId);
        broadcast($event);

        Log::info('✅ ResumeRequestSent event dispatched', [
            'event_class' => get_class($event),
            'broadcast_channel' => 'App.Models.User.' . $opponentId
        ]);

        Log::info('Resume request created', [
            'game_id' => $gameId,
            'requested_by' => $userId,
            'opponent' => $opponentId,
            'expires_at' => $game->resume_request_expires_at,
            'invitation_id' => $resumeInvitation->id
        ]);

        return [
            'success' => true,
            'resume_requested_by' => $userId,
            'resume_requested_at' => $game->resume_requested_at,
            'resume_request_expires_at' => $game->resume_request_expires_at,
            'opponent_id' => $opponentId,
            'invitation_id' => $resumeInvitation->id
        ];
    }

    /**
     * Respond to a resume request
     */
    public function respondToResumeRequest(int $gameId, int $userId, bool $accepted): array
    {
        $game = Game::findOrFail($gameId);

        if ($game->status !== 'paused') {
            return [
                'success' => false,
                'message' => 'Game is not paused'
            ];
        }

        if ($game->resume_status !== 'pending') {
            return [
                'success' => false,
                'message' => 'No pending resume request'
            ];
        }

        // Verify user is the opponent who received the request
        $opponentId = ($game->white_player_id === $game->resume_requested_by) ? $game->black_player_id : $game->white_player_id;
        if ($userId !== $opponentId) {
            return [
                'success' => false,
                'message' => 'User is not authorized to respond to this request'
            ];
        }

        if ($game->resume_request_expires_at && now()->isAfter($game->resume_request_expires_at)) {
            // Request has expired - broadcast expiration event to both players
            $requesterId = $game->resume_requested_by;
            $responderId = $userId; // The user trying to respond

            // Update the invitation record to expired
            \App\Models\Invitation::where('type', 'resume_request')
                ->where('game_id', $gameId)
                ->where('inviter_id', $requesterId)
                ->where('status', 'pending')
                ->update([
                    'status' => 'expired',
                    'responded_by' => $responderId,
                    'responded_at' => now()
                ]);

            // Clear resume request fields
            $game->update([
                'resume_status' => 'expired',
                'resume_requested_by' => null,
                'resume_requested_at' => null,
                'resume_request_expires_at' => null
            ]);

            // Broadcast expiration event to both players
            Log::info('📨 Broadcasting ResumeRequestExpired event', [
                'game_id' => $gameId,
                'requester_id' => $requesterId,
                'responder_id' => $responderId,
                'channels' => [
                    'App.Models.User.' . $requesterId,
                    'App.Models.User.' . $responderId
                ],
                'event' => 'resume.request.expired'
            ]);
            broadcast(new \App\Events\ResumeRequestExpired($game, $requesterId, $responderId));

            Log::info('Resume request expired and cleaned up', [
                'game_id' => $gameId,
                'requester_id' => $requesterId,
                'responder_id' => $responderId
            ]);

            return [
                'success' => false,
                'message' => 'Resume request has expired'
            ];
        }

        if ($accepted) {
            // Resume the game
            $resumeResult = $this->resumeGameFromInactivity($gameId, $userId);

            if ($resumeResult['success']) {
                // Update the invitation record to accepted
                \App\Models\Invitation::where('type', 'resume_request')
                    ->where('game_id', $gameId)
                    ->where('invited_id', $userId)
                    ->where('status', 'pending')
                    ->update([
                        'status' => 'accepted',
                        'responded_by' => $userId,
                        'responded_at' => now()
                    ]);

                // Clear resume request fields
                $game->update([
                    'resume_status' => 'accepted',
                    'resume_requested_by' => null,
                    'resume_requested_at' => null,
                    'resume_request_expires_at' => null
                ]);

                // Broadcast resume accepted event
                Log::info('📨 Broadcasting ResumeRequestResponse event (accepted)', [
                    'game_id' => $gameId,
                    'accepted_by' => $userId,
                    'requested_by' => $game->resume_requested_by,
                    'channel' => "App.Models.User.{$game->resume_requested_by}",
                    'event' => 'resume.request.response'
                ]);
                broadcast(new \App\Events\ResumeRequestResponse($game, 'accepted', $userId));

                Log::info('Resume request accepted, game resumed', [
                    'game_id' => $gameId,
                    'accepted_by' => $userId,
                    'requested_by' => $game->resume_requested_by
                ]);

                return array_merge($resumeResult, [
                    'resume_status' => 'accepted'
                ]);
            } else {
                return $resumeResult;
            }
        } else {
            // Update the invitation record to declined
            \App\Models\Invitation::where('type', 'resume_request')
                ->where('game_id', $gameId)
                ->where('invited_id', $userId)
                ->where('status', 'pending')
                ->update([
                    'status' => 'declined',
                    'responded_by' => $userId,
                    'responded_at' => now()
                ]);

            // Request declined
            $game->update([
                'resume_status' => 'none',
                'resume_requested_by' => null,
                'resume_requested_at' => null,
                'resume_request_expires_at' => null
            ]);

            // Broadcast resume declined event
            Log::info('📨 Broadcasting ResumeRequestResponse event (declined)', [
                'game_id' => $gameId,
                'declined_by' => $userId,
                'requested_by' => $game->resume_requested_by,
                'channel' => "App.Models.User.{$game->resume_requested_by}",
                'event' => 'resume.request.response'
            ]);
            broadcast(new \App\Events\ResumeRequestResponse($game, 'declined', $userId));

            Log::info('Resume request declined', [
                'game_id' => $gameId,
                'declined_by' => $userId,
                'requested_by' => $game->resume_requested_by
            ]);

            return [
                'success' => true,
                'resume_status' => 'declined',
                'message' => 'Resume request declined'
            ];
        }
    }

    /**
     * Forfeit game by timeout (inactive player loses)
     */
    public function forfeitByTimeout(int $gameId): array
    {
        return \DB::transaction(function () use ($gameId) {
            $game = Game::lockForUpdate()->findOrFail($gameId);

            if ($game->isFinished()) {
                return [
                    'success' => false,
                    'message' => 'Game is already finished'
                ];
            }

            // Determine inactive player based on last activity
            $inactivePlayer = $this->getInactivePlayer($game);

            if (!$inactivePlayer) {
                return [
                    'success' => false,
                    'message' => 'Could not determine inactive player'
                ];
            }

            // Inactive player loses
            $inactiveColor = $this->getUserRole($inactivePlayer, $game);
            $result = ($inactiveColor === 'white') ? '0-1' : '1-0';
            $winnerUserId = ($inactiveColor === 'white')
                ? $game->black_player_id
                : $game->white_player_id;
            $winnerColor = ($inactiveColor === 'white') ? 'black' : 'white';

            $game->update([
                'status' => 'finished',
                'result' => $result,
                'end_reason' => 'timeout_inactivity',
                'winner_user_id' => $winnerUserId,
                'winner_player' => $winnerColor,
                'ended_at' => now()
            ]);

            $this->broadcastGameEnded($game->fresh());

            Log::info('Game forfeited by timeout', [
                'game_id' => $gameId,
                'inactive_player' => $inactiveColor,
                'winner' => $winnerColor
            ]);

            return [
                'success' => true,
                'message' => 'Game forfeited by timeout',
                'result' => $result,
                'winner' => $winnerColor
            ];
        });
    }

    /**
     * Get the inactive player (helper for inactivity detection)
     */
    private function getInactivePlayer(Game $game): ?User
    {
        // Check last heartbeat for each player
        $whiteActive = $this->isUserOnline($game->white_player_id, $game->id);
        $blackActive = $this->isUserOnline($game->black_player_id, $game->id);

        if (!$whiteActive && $blackActive) {
            return $game->whitePlayer;
        } elseif ($whiteActive && !$blackActive) {
            return $game->blackPlayer;
        }

        // If both inactive or both active, check last move
        if ($game->moves && count($game->moves) > 0) {
            $lastMove = end($game->moves);
            $lastMoveUserId = $lastMove['user_id'] ?? null;

            if ($lastMoveUserId === $game->white_player_id) {
                // White made last move, so black is inactive
                return $game->blackPlayer;
            } else {
                // Black made last move, so white is inactive
                return $game->whitePlayer;
            }
        }

        // Default: assume current turn player is inactive
        return $game->turn === 'white' ? $game->whitePlayer : $game->blackPlayer;
    }

    /**
     * Update game heartbeat (called when player is active)
     */
    public function updateGameHeartbeat(int $gameId, int $userId): array
    {
        $game = Game::find($gameId);

        if (!$game) {
            return ['success' => false, 'error' => 'Game not found'];
        }

        $game->update(['last_heartbeat_at' => now()]);

        // If game was paused due to inactivity, resume it
        if ($game->status === 'paused' && $game->paused_reason === 'inactivity') {
            $this->resumeGameFromInactivity($gameId, $userId);
        }

        return [
            'success' => true,
            'timestamp' => now()->toISOString()
        ];
    }
}