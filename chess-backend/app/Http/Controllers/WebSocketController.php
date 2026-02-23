<?php

namespace App\Http\Controllers;

use App\Http\Middleware\WebSocketAuth;
use App\Models\Game;
use App\Models\GameChatMessage;
use App\Events\GameChatMessageSent;
use App\Services\GameRoomService;
use App\Services\HandshakeProtocol;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Log;

class WebSocketController extends Controller
{
    public function __construct(
        private GameRoomService $gameRoomService,
        private HandshakeProtocol $handshakeProtocol
    ) {
    }

    /**
     * Handle WebSocket authentication request
     */
    public function authenticate(Request $request): JsonResponse
    {
        $request->validate([
            'socket_id' => 'required|string',
            'channel_name' => 'required|string',
        ]);

        $user = Auth::user();
        $socketId = $request->input('socket_id');
        $channelName = $request->input('channel_name');

        try {
            // Use Laravel Broadcast's built-in authentication
            $authData = Broadcast::auth($request);

            // Log successful authentication
            Log::info('WebSocket authentication successful', [
                'user_id' => $user->id,
                'socket_id' => $socketId,
                'channel' => $channelName,
                'auth_data' => $authData,
                'timestamp' => now()->toISOString()
            ]);

            return response()->json($authData);

        } catch (\Exception $e) {
            Log::error('WebSocket authentication failed', [
                'user_id' => $user->id ?? 'unknown',
                'socket_id' => $socketId,
                'channel' => $channelName,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'error' => 'Authentication failed',
                'message' => $e->getMessage()
            ], 403);
        }
    }

    /**
     * Handle game room join request
     */
    public function joinGame(Request $request): JsonResponse
    {
        $request->validate([
            'game_id' => 'required|integer|exists:games,id',
            'socket_id' => 'required|string',
            'client_info' => 'array'
        ]);

        try {
            $result = $this->gameRoomService->joinGame(
                $request->input('game_id'),
                $request->input('socket_id'),
                $request->input('client_info', [])
            );

            Log::info('User joined game room', [
                'user_id' => Auth::id(),
                'game_id' => $request->input('game_id'),
                'connection_id' => $result['connection_id']
            ]);

            return response()->json($result);

        } catch (\Exception $e) {
            Log::error('Failed to join game room', [
                'user_id' => Auth::id(),
                'game_id' => $request->input('game_id'),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to join game',
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Handle game room leave request
     */
    public function leaveGame(Request $request): JsonResponse
    {
        $request->validate([
            'game_id' => 'required|integer|exists:games,id',
            'socket_id' => 'required|string'
        ]);

        try {
            $result = $this->gameRoomService->leaveGame(
                $request->input('game_id'),
                $request->input('socket_id')
            );

            Log::info('User left game room', [
                'user_id' => Auth::id(),
                'game_id' => $request->input('game_id'),
                'socket_id' => $request->input('socket_id')
            ]);

            return response()->json($result);

        } catch (\Exception $e) {
            Log::error('Failed to leave game room', [
                'user_id' => Auth::id(),
                'game_id' => $request->input('game_id'),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to leave game',
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Handle connection heartbeat
     */
    public function heartbeat(Request $request): JsonResponse
    {
        $request->validate([
            'game_id' => 'required|integer|exists:games,id',
            'socket_id' => 'required|string'
        ]);

        try {
            $result = $this->gameRoomService->heartbeat(
                $request->input('game_id'),
                $request->input('socket_id')
            );

            return response()->json($result);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Heartbeat failed',
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Get current room state for reconnection
     */
    public function getRoomState(Request $request): Response
    {
        // Guard: Check if user is authenticated
        $user = Auth::user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        // For GET requests, game_id should come from query parameters
        $gameId = $request->query('game_id') ?? $request->input('game_id');
        $compact = $request->boolean('compact', false);
        $sinceMove = $request->integer('since_move', -1);

        $request->merge(['game_id' => $gameId]);

        // Validate inputs up front
        $request->validate([
            'game_id' => 'required|integer|exists:games,id',
            'compact' => 'nullable|boolean',
            'since_move' => 'nullable|integer|min:0'
        ]);

        try {
            $game = Game::with(['whitePlayer', 'blackPlayer'])->findOrFail($gameId);

            // Check if user is involved in this game
            if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
            $moves = $game->moves ?? [];
            $moveCount = is_array($moves) ? count($moves) : 0;
            $etag = sha1($game->updated_at . '|' . $moveCount . '|' . $game->status);

            // 1) ETag pathway - if client sent If-None-Match and it matches, return 304
            if ($request->header('If-None-Match') === $etag) {
                return response('', 304)->header('ETag', $etag);
            }

            // 2) Check if game is finished - return final state
            if ($game->status === 'finished') {
                return response()->json([
                    'success' => true,
                    'data' => [
                        'game_over' => true,
                        'result' => $game->result,
                        'end_reason' => $game->end_reason,
                        'winner_user_id' => $game->winner_user_id,
                        'winner_player' => $game->winner_player,
                        'fen_final' => $game->fen,
                        'move_count' => $game->move_count,
                        'ended_at' => $game->ended_at?->toISOString(),
                        'white_player' => [
                            'id' => $game->whitePlayer->id,
                            'name' => $game->whitePlayer->name
                        ],
                        'black_player' => [
                            'id' => $game->blackPlayer->id,
                            'name' => $game->blackPlayer->name
                        ]
                    ]
                ])->header('ETag', $etag);
            }

            // 3) Since-move fast path - if no new moves since last check (for active games)
            if ($sinceMove >= 0 && $sinceMove === $moveCount) {
                return response()->json([
                    'success' => true,
                    'no_change' => true
                ])->header('ETag', $etag);
            }

            // 4) Get room state (compact or full) for active games
            $result = $this->gameRoomService->getRoomState(
                $request->input('game_id'),
                $compact,
                $sinceMove
            );

            return response()->json([
                'success' => true,
                'data' => $result
            ])->header('ETag', $etag);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to get room state',
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Validate WebSocket token for external services
     */
    public function validateToken(Request $request): JsonResponse
    {
        $request->validate([
            'token' => 'required|string'
        ]);

        try {
            $token = $request->input('token');
            $personalAccessToken = \Laravel\Sanctum\PersonalAccessToken::findToken($token);

            if (!$personalAccessToken || !$personalAccessToken->tokenable) {
                return response()->json([
                    'valid' => false,
                    'error' => 'Invalid token'
                ], 401);
            }

            $user = $personalAccessToken->tokenable;

            return response()->json([
                'valid' => true,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email
                ],
                'token_id' => $personalAccessToken->id,
                'expires_at' => $personalAccessToken->expires_at?->toISOString()
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'valid' => false,
                'error' => 'Token validation failed'
            ], 500);
        }
    }

    /**
     * Complete WebSocket handshake for game connection
     */
    public function handshake(Request $request): JsonResponse
    {
        Log::info('Handshake request received', [
            'all_data' => $request->all(),
            'game_id' => $request->input('game_id'),
            'socket_id' => $request->input('socket_id'),
            'client_info' => $request->input('client_info'),
            'user_id' => Auth::id()
        ]);

        $request->validate([
            'game_id' => 'nullable|integer|exists:games,id',
            'socket_id' => 'required|string',
            'client_info' => 'array'
        ]);

        try {
            $handshakeData = [
                'game_id' => $request->input('game_id'),
                'socket_id' => $request->input('socket_id'),
                'client_info' => $request->input('client_info', [])
            ];

            $result = $this->handshakeProtocol->completeHandshake($handshakeData);

            Log::info('WebSocket handshake completed', [
                'user_id' => Auth::id(),
                'game_id' => $request->input('game_id'),
                'handshake_id' => $result['handshake_id']
            ]);

            return response()->json($result);

        } catch (\Exception $e) {
            Log::error('WebSocket handshake failed', [
                'user_id' => Auth::id(),
                'game_id' => $request->input('game_id'),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Handshake failed',
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Acknowledge handshake completion from client
     */
    public function acknowledgeHandshake(Request $request): JsonResponse
    {
        $request->validate([
            'handshake_id' => 'required|string',
            'client_data' => 'array'
        ]);

        try {
            $result = $this->handshakeProtocol->acknowledgeHandshake(
                $request->input('handshake_id'),
                $request->input('client_data', [])
            );

            return response()->json($result);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Handshake acknowledgment failed',
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Get existing handshake for reconnection
     */
    public function getHandshake(Request $request): JsonResponse
    {
        $request->validate([
            'game_id' => 'required|integer|exists:games,id'
        ]);

        try {
            $handshake = $this->handshakeProtocol->getExistingHandshake(
                $request->input('game_id')
            );

            if (!$handshake) {
                return response()->json([
                    'exists' => false,
                    'message' => 'No existing handshake found'
                ], 404);
            }

            return response()->json([
                'exists' => true,
                'handshake' => $handshake
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to retrieve handshake',
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Handle game resume request
     */
    public function resumeGame(Request $request, int $gameId): JsonResponse
    {
        $request->validate([
            'socket_id' => 'required|string',
            'accept_resume' => 'boolean'
        ]);

        try {
            $result = $this->gameRoomService->resumeGame(
                $gameId,
                Auth::id(),
                $request->input('socket_id'),
                $request->boolean('accept_resume', true)
            );

            Log::info('Game resume requested', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'accept_resume' => $request->boolean('accept_resume', true)
            ]);

            return response()->json($result);

        } catch (\Exception $e) {
            Log::error('Failed to resume game', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to resume game',
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Handle new game challenge request
     */
    public function newGame(Request $request, int $gameId): JsonResponse
    {
        $request->validate([
            'socket_id' => 'nullable|string',
            'color_preference' => 'nullable|string|in:white,black,random'
        ]);

        try {
            $result = $this->gameRoomService->createNewGame(
                $gameId,
                Auth::id(),
                $request->input('socket_id', ''), // Pass empty string if null
                $request->input('color_preference', 'random')
            );

            Log::info('New game requested', [
                'user_id' => Auth::id(),
                'original_game_id' => $gameId,
                'new_game_id' => $result['game_id'] ?? null,
                'color_preference' => $request->input('color_preference', 'random')
            ]);

            return response()->json($result);

        } catch (\Exception $e) {
            Log::error('Failed to create new game', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to create new game',
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Handle move broadcast
     */
    public function broadcastMove(Request $request, int $gameId): JsonResponse
    {
        // Check if game is finished before allowing moves
        $game = Game::findOrFail($gameId);
        if ($game->status === 'finished') {
            return response()->json([
                'error' => 'Game finished',
                'message' => 'This game has already ended'
            ], 409);
        }

        // Debug: Log the incoming request
        \Log::info('broadcastMove request data:', [
            'gameId' => $gameId,
            'request_data' => $request->all(),
            'user_id' => Auth::id()
        ]);

        $request->validate([
            'move' => 'required|array',
            'move.from' => 'required|string',
            'move.to' => 'required|string',
            'move.promotion' => 'nullable|string',
            'move.san' => 'required|string',
            'move.uci' => 'required|string',
            'move.piece' => 'nullable|string',
            'move.color' => 'nullable|string',
            'move.captured' => 'nullable|string',
            'move.flags' => 'nullable|string',
              'move.is_mate_hint' => 'required|boolean',
            'move.is_check' => 'required|boolean',
            'move.is_stalemate' => 'required|boolean',
            'move.move_time_ms' => 'nullable|numeric',
            'move.player_rating' => 'nullable|integer',
            // Accept both players' scores to preserve scoring across moves
            'move.white_player_score' => 'nullable|numeric',
            'move.black_player_score' => 'nullable|numeric',
            // Accept remaining clock times to persist across moves
            'move.white_time_remaining_ms' => 'nullable|numeric',
            'move.black_time_remaining_ms' => 'nullable|numeric',
            'socket_id' => 'required|string'
        ]);

        try {
            $result = $this->gameRoomService->broadcastMove(
                $gameId,
                Auth::id(),
                $request->input('move'),
                $request->input('socket_id')
            );

            Log::info('Move broadcasted', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'move' => $request->input('move'),
                'game_status' => $result['game_status'] ?? 'unknown'
            ]);

            return response()->json($result);

        } catch (\Exception $e) {
            // Refresh game to get current status for error context
            $game->refresh();

            Log::error('Failed to broadcast move', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'error' => $e->getMessage(),
                'game_status' => $game->status,
                'game_updated_at' => $game->updated_at
            ]);

            return response()->json([
                'error' => 'Failed to broadcast move',
                'message' => $e->getMessage(),
                'game_status' => $game->status,
                'game_id' => $gameId
            ], 400);
        }
    }

    /**
     * Handle player resignation
     */
    public function resignGame(Request $request, int $gameId): JsonResponse
    {
        try {
            $result = $this->gameRoomService->resignGame($gameId, Auth::id());

            Log::info('Player resigned game', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'result' => $result['result'] ?? null,
                'winner' => $result['winner'] ?? null
            ]);

            return response()->json($result);

        } catch (\Exception $e) {
            Log::error('Failed to resign game', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to resign game',
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Handle game state change events
     * Accepts legacy status/reason values and maps to canonical values
     */
    public function updateGameStatus(Request $request, int $gameId): JsonResponse
    {
        $request->validate([
            // Accept both legacy and canonical status values during transition
            'status' => 'required|string|in:waiting,active,finished,aborted,completed,paused,abandoned',
            'result' => 'nullable|string|in:white_wins,black_wins,draw,stalemate,timeout,1-0,0-1,1/2-1/2,*',
            // Accept both legacy and canonical reason values
            'reason' => 'nullable|string|in:checkmate,resignation,stalemate,timeout,draw_agreed,threefold,fifty_move,insufficient_material,aborted,killed',
            'socket_id' => 'required|string'
        ]);

        try {
            // Map legacy values to canonical using enums
            $statusInput = $request->input('status');
            $reasonInput = $request->input('reason');

            // Use enum mapping for backward compatibility
            $canonicalStatus = \App\Enums\GameStatus::fromLegacy($statusInput)->value;
            $canonicalReason = $reasonInput
                ? \App\Enums\EndReason::fromLegacy($reasonInput)->value
                : null;

            $result = $this->gameRoomService->updateGameStatus(
                $gameId,
                Auth::id(),
                $canonicalStatus,  // Canonical status
                $request->input('socket_id'),  // Socket ID (required)
                $request->input('result'),     // Result (optional)
                $canonicalReason               // Canonical reason (optional)
            );

            Log::info('Game status updated', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'status_input' => $statusInput,
                'status_canonical' => $canonicalStatus,
                'reason_input' => $reasonInput,
                'reason_canonical' => $canonicalReason,
                'result' => $request->input('result')
            ]);

            return response()->json($result);

        } catch (\Exception $e) {
            Log::error('Failed to update game status', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'error' => 'Failed to update game status',
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Handle player forfeit
     */
    public function forfeitGame(Request $request, int $gameId): JsonResponse
    {
        try {
            $reason = $request->input('reason', 'forfeit'); // Default to 'forfeit', but accept 'timeout'
            $result = $this->gameRoomService->forfeitGame($gameId, Auth::id(), $reason);

            Log::info('Player forfeited game', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'reason' => $reason,
                'result' => $result['result'] ?? null,
                'winner' => $result['winner'] ?? null
            ]);

            return response()->json($result);

        } catch (\Exception $e) {
            Log::error('Failed to forfeit game', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to forfeit game',
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Handle mutual abort request
     */
    public function requestAbort(Request $request, int $gameId): JsonResponse
    {
        try {
            $result = $this->gameRoomService->requestAbort($gameId, Auth::id());

            Log::info('Abort request sent', [
                'user_id' => Auth::id(),
                'game_id' => $gameId
            ]);

            return response()->json($result);

        } catch (\Exception $e) {
            Log::error('Failed to request abort', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to request abort',
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Handle response to abort request
     */
    public function respondToAbort(Request $request, int $gameId): JsonResponse
    {
        $request->validate([
            'accept' => 'required|boolean'
        ]);

        try {
            $result = $this->gameRoomService->respondToAbort(
                $gameId,
                Auth::id(),
                $request->boolean('accept')
            );

            Log::info('Abort response received', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'accept' => $request->boolean('accept'),
                'result' => $result['result'] ?? null
            ]);

            return response()->json($result);

        } catch (\Exception $e) {
            Log::error('Failed to respond to abort', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to respond to abort request',
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Handle game heartbeat (player activity tracking)
     */
    public function gameHeartbeat(Request $request, int $gameId): JsonResponse
    {
        try {
            $result = $this->gameRoomService->updateGameHeartbeat($gameId, Auth::id());

            return response()->json($result);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Game heartbeat failed',
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Handle game pause request (inactivity detection)
     */
    public function pauseGame(Request $request, int $gameId): JsonResponse
    {
        try {
            // Extract time data if provided
            $whiteTimeMs = $request->input('white_time_remaining_ms');
            $blackTimeMs = $request->input('black_time_remaining_ms');

            $result = $this->gameRoomService->pauseGame(
                $gameId,
                Auth::id(),
                'inactivity',
                $whiteTimeMs,
                $blackTimeMs
            );

            Log::info('Game paused due to inactivity', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'reason' => 'inactivity',
                'white_time_ms' => $whiteTimeMs,
                'black_time_ms' => $blackTimeMs,
                'result' => $result['result'] ?? null
            ]);

            return response()->json($result);

        } catch (\Exception $e) {
            Log::error('Failed to pause game', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to pause game',
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Handle resume request for paused game
     */
    public function requestResume(Request $request, int $gameId): JsonResponse
    {
        Log::info('🚀 DEBUG: Resume request API endpoint hit', [
            'game_id' => $gameId,
            'user_id' => Auth::id(),
            'url' => $request->fullUrl(),
            'method' => $request->method(),
            'ip' => $request->ip()
        ]);

        try {
            Log::info('🎯 ABOUT TO CALL GAMEROOMSERVICE requestResume', [
                'game_id' => $gameId,
                'user_id' => Auth::id()
            ]);

            $result = $this->gameRoomService->requestResume($gameId, Auth::id());

            Log::info('✅ GAMEROOMSERVICE requestResume COMPLETED', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'result' => $result
            ]);

            return response()->json($result);

        } catch (\Exception $e) {
            Log::error('🚨 EXCEPTION IN requestResume', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'error' => 'Failed to request resume',
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * HTTP fallback for resume request when WebSocket fails
     * This endpoint provides an idempotent way to create resume requests
     */
    public function requestResumeFallback(Request $request, int $gameId): JsonResponse
    {
        $user = Auth::user();
        if (!$user) {
            return response()->json([
                'message' => 'Unauthenticated',
            ], 401);
        }

        try {
            // Validate game exists and user is part of it
            $game = Game::findOrFail($gameId);
            if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
                return response()->json([
                    'message' => 'You are not a participant in this game.',
                ], 403);
            }

            // Game must be paused to request resume
            if ($game->status !== 'paused') {
                return response()->json([
                    'message' => 'Game is not paused.',
                ], 422);
            }

            $cooldownSeconds = 60;
            $ttlSeconds = 60;

            // Check if there is already a live pending request (idempotency)
            $existing = null;
            if ($game->resume_status === 'pending' && $game->resume_requested_by && $game->resume_request_expires_at) {
                if (now()->lt($game->resume_request_expires_at)) {
                    $existing = (object)[
                        'id' => $game->id,
                        'requesting_user_id' => $game->resume_requested_by,
                        'expires_at' => $game->resume_request_expires_at
                    ];
                }
            }

            if ($existing) {
                $secondsRemaining = max(0, now()->diffInSeconds($existing->expires_at, false));

                return response()->json([
                    'message' => 'Resume request already pending.',
                    'pending' => true,
                    'request_id' => $existing->id,
                    'requested_by_id' => $existing->requesting_user_id,
                    'requesting_user_name' => $user->name,
                    'expires_at' => $existing->expires_at->toIso8601String(),
                    'can_request_again_in_seconds' => $secondsRemaining,
                    'can_request_again_at' => $existing->expires_at->toIso8601String(),
                ], 409); // Conflict
            }

            // Enforce cooldown per user (optional but recommended)
            $lastFromUser = null;
            // You could implement cooldown tracking here using cache or a separate table
            // For now, we'll skip cooldown to keep it simple

            if ($lastFromUser && $lastFromUser->created_at->gt(now()->subSeconds($cooldownSeconds))) {
                $retryAt = $lastFromUser->created_at->addSeconds($cooldownSeconds);

                return response()->json([
                    'message' => 'Resume request cooldown active.',
                    'cooldown' => true,
                    'can_request_again_at' => $retryAt->toIso8601String(),
                    'can_request_again_in_seconds' => max(0, now()->diffInSeconds($retryAt, false)),
                ], 429); // Too Many Requests
            }

            // Create new resume request using the existing service
            $result = $this->gameRoomService->requestResume($gameId, $user->id);

            Log::info('Resume request created via HTTP fallback', [
                'user_id' => $user->id,
                'game_id' => $gameId,
                'source' => 'http_fallback',
                'result' => $result
            ]);

            // Find opponent for broadcasting
            $opponent = $game->white_player_id === $user->id ?
                ($game->blackPlayer ?? ($game->black_player_id ? \App\Models\User::find($game->black_player_id) : null)) :
                ($game->whitePlayer ?? ($game->white_player_id ? \App\Models\User::find($game->white_player_id) : null));

            // Broadcast event to opponent if possible
            if ($opponent) {
                try {
                    // Create the resume request sent event
                    $event = new \App\Events\ResumeRequestSent($game, $user->id, $opponent->id);
                    broadcast($event)->toOthers();
                } catch (\Exception $broadcastEx) {
                    Log::warning('Failed to broadcast resume request from HTTP fallback', [
                        'game_id' => $gameId,
                        'user_id' => $user->id,
                        'opponent_id' => $opponent->id,
                        'error' => $broadcastEx->getMessage()
                    ]);
                    // Don't fail the request if broadcast fails
                }
            }

            // Success response matching what frontend expects
            return response()->json([
                'message' => 'Resume request created.',
                'pending' => true,
                'request_id' => $gameId,
                'game_id' => $gameId,
                'requesting_user_id' => $user->id,
                'requesting_user_name' => $user->name,
                'expires_in_seconds' => $ttlSeconds,
                'resume_request_expires_at' => now()->addSeconds($ttlSeconds)->toIso8601String(),
                'delivery_uncertainty' => true,
                'fallback_note' => 'If opponent is offline or WebSocket fails, they will see this request in Lobby → Invitations.',
                'source' => 'http_fallback'
            ], 201); // Created

        } catch (\Exception $e) {
            Log::error('HTTP fallback resume request failed', [
                'user_id' => $user->id,
                'game_id' => $gameId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'message' => 'Failed to create resume request',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    
    /**
     * Handle response to resume request
     */
    public function respondToResumeRequest(Request $request, int $gameId): JsonResponse
    {
        $request->validate([
            'response' => 'required|boolean' // true for accept, false for decline
        ]);

        try {
            $result = $this->gameRoomService->respondToResumeRequest(
                $gameId,
                Auth::id(),
                $request->input('response')
            );

            Log::info('Resume request response', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'response' => $request->input('response'),
                'result' => $result
            ]);

            return response()->json($result);

        } catch (\Exception $e) {
            Log::error('Failed to respond to resume request', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'response' => $request->input('response'),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to respond to resume request',
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Get resume status for a game
     */
    public function getResumeStatus(Request $request, int $gameId): JsonResponse
    {
        try {
            $game = Game::with(['whitePlayer', 'blackPlayer'])->findOrFail($gameId);
            $user = Auth::user();

            // Verify user is part of the game
            if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
                return response()->json([
                    'error' => 'Unauthorized',
                    'message' => 'You are not part of this game'
                ], 403);
            }

            // Game must be paused
            if ($game->status !== 'paused') {
                return response()->json([
                    'pending' => false,
                    'type' => null,
                    'message' => 'Game is not paused'
                ]);
            }

            // Check for pending resume requests in cache (similar to draw offers)
            // Assume cache keys: "resume_request:{$gameId}:{$senderId}"
            $userId = $user->id;
            $opponentId = $game->white_player_id === $userId ? $game->black_player_id : $game->white_player_id;

            $myRequestKey = "resume_request:{$gameId}:{$userId}";
            $opponentRequestKey = "resume_request:{$gameId}:{$opponentId}";

            $status = [
                'pending' => false,
                'type' => null,
                'requested_by_id' => null,
                'requesting_user' => null,
                'opponent_name' => null,
                'expires_at' => null
            ];

            // First check database (source of truth) for pending resume requests
            if ($game->resume_status === 'pending' && $game->resume_requested_by && $game->resume_request_expires_at) {
                // Check if the request is still valid (not expired)
                if (now()->lt($game->resume_request_expires_at)) {
                    $opponent = $game->white_player_id === $userId ? $game->blackPlayer : $game->whitePlayer;
                    $requestingUser = $game->resume_requested_by === $userId ? $user :
                        ($game->resume_requested_by === $game->white_player_id ? $game->whitePlayer : $game->blackPlayer);

                    if ($game->resume_requested_by === $userId) {
                        // I sent the request
                        $status = [
                            'pending' => true,
                            'type' => 'sent',
                            'requested_by_id' => $userId,
                            'requesting_user' => [
                                'id' => $user->id,
                                'name' => $user->name
                            ],
                            'opponent_name' => $opponent->name,
                            'expires_at' => $game->resume_request_expires_at->toISOString()
                        ];
                    } else {
                        // Opponent sent the request
                        $status = [
                            'pending' => true,
                            'type' => 'received',
                            'requested_by_id' => $game->resume_requested_by,
                            'requesting_user' => $requestingUser ? [
                                'id' => $requestingUser->id,
                                'name' => $requestingUser->name
                            ] : null,
                            'opponent_name' => $requestingUser ? $requestingUser->name : 'Unknown Player',
                            'expires_at' => $game->resume_request_expires_at->toISOString()
                        ];
                    }

                    Log::info('Resume status found in database', [
                        'user_id' => $user->id,
                        'game_id' => $gameId,
                        'resume_status' => $game->resume_status,
                        'requested_by' => $game->resume_requested_by,
                        'expires_at' => $game->resume_request_expires_at
                    ]);

                    return response()->json($status);
                }
            }

            // Fallback to cache check (for real-time updates that haven't hit the database yet)
            // Check if opponent has a pending request (received)
            if (\Illuminate\Support\Facades\Cache::has($opponentRequestKey)) {
                $opponent = $game->white_player_id === $userId ? $game->blackPlayer : $game->whitePlayer;
                $expiresAt = \Illuminate\Support\Facades\Cache::get($opponentRequestKey . ':expires_at', now()->addMinutes(1));

                $status = [
                    'pending' => true,
                    'type' => 'received',
                    'requested_by_id' => $opponentId,
                    'requesting_user' => [
                        'id' => $opponent->id,
                        'name' => $opponent->name
                    ],
                    'opponent_name' => $opponent->name,
                    'expires_at' => $expiresAt->toISOString()
                ];
            }
            // Check if I have a pending request (sent)
            elseif (\Illuminate\Support\Facades\Cache::has($myRequestKey)) {
                $opponent = $game->white_player_id === $userId ? $game->blackPlayer : $game->whitePlayer;
                $expiresAt = \Illuminate\Support\Facades\Cache::get($myRequestKey . ':expires_at', now()->addMinutes(1));

                $status = [
                    'pending' => true,
                    'type' => 'sent',
                    'requested_by_id' => $userId,
                    'requesting_user' => [
                        'id' => $user->id,
                        'name' => $user->name
                    ],
                    'opponent_name' => $opponent->name,
                    'expires_at' => $expiresAt->toISOString()
                ];
            }

            Log::info('Resume status checked', [
                'user_id' => $user->id,
                'game_id' => $gameId,
                'status' => $status
            ]);

            return response()->json($status);

        } catch (\Exception $e) {
            Log::error('Failed to get resume status', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'pending' => false,
                'type' => null,
                'error' => 'Failed to get resume status',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Ping opponent to remind them it's their turn
     */
    public function pingOpponent(Request $request, int $gameId): JsonResponse
    {
        try {
            $game = Game::findOrFail($gameId);
            $user = Auth::user();

            // Verify user is part of the game
            if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
                return response()->json([
                    'error' => 'Unauthorized',
                    'message' => 'You are not part of this game'
                ], 403);
            }

            // Only allow pinging when it's NOT your turn
            $userColor = $game->white_player_id === $user->id ? 'white' : 'black';
            if ($game->turn === $userColor) {
                return response()->json([
                    'error' => 'Invalid action',
                    'message' => 'Cannot ping opponent when it is your turn'
                ], 400);
            }

            // Game must be active
            if ($game->status !== 'active') {
                return response()->json([
                    'error' => 'Invalid game state',
                    'message' => 'Game is not active'
                ], 400);
            }

            // Broadcast ping event to the opponent
            broadcast(new \App\Events\OpponentPingedEvent($game, $user))->toOthers();

            Log::info('Opponent pinged', [
                'user_id' => $user->id,
                'game_id' => $gameId,
                'opponent_turn' => $game->turn
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Opponent has been notified'
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to ping opponent', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to ping opponent',
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Get move history for a game (for timer calculation)
     */
    public function getMoves(Request $request, int $gameId): JsonResponse
    {
        try {
            $game = Game::findOrFail($gameId);
            $user = Auth::user();

            // Authorization check - only players in the game can access moves
            if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }

            // Get moves from the games.moves JSON column
            $moves = $game->moves ?? [];

            Log::info('Move history fetched for game completion', [
                'user_id' => $user->id,
                'game_id' => $gameId,
                'move_count' => count($moves),
                'db_white_score' => $game->white_player_score,
                'db_black_score' => $game->black_player_score,
                'game_status' => $game->status
            ]);

            return response()->json([
                'moves' => $moves,
                'time_control_minutes' => $game->time_control_minutes,
                'white_player_score' => $game->white_player_score,
                'black_player_score' => $game->black_player_score,
                'white_player_id' => $game->white_player_id,
                'black_player_id' => $game->black_player_id,
                'move_count' => count($moves)
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to fetch move history', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to fetch move history',
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Offer a draw to the opponent
     */
    public function offerDraw(Request $request, int $gameId): JsonResponse
    {
        try {
            $game = Game::with(['whitePlayer', 'blackPlayer'])->findOrFail($gameId);
            $user = Auth::user();

            // Verify user is part of the game
            if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
                return response()->json([
                    'error' => 'Unauthorized',
                    'message' => 'You are not part of this game'
                ], 403);
            }

            // Game must be active
            if ($game->status !== 'active') {
                return response()->json([
                    'error' => 'Invalid game state',
                    'message' => 'Game is not active'
                ], 400);
            }

            // Store pending draw offer in cache (5 min expiry)
            \Illuminate\Support\Facades\Cache::put("draw_offer:{$gameId}:{$user->id}", true, 300);

            // Get opponent
            $opponent = $game->white_player_id === $user->id ? $game->blackPlayer : $game->whitePlayer;

            // Broadcast draw offer to opponent
            broadcast(new \App\Events\DrawOfferSentEvent($game, $user, $opponent))->toOthers();

            Log::info('Draw offer sent', [
                'game_id' => $gameId,
                'offerer_id' => $user->id,
                'opponent_id' => $opponent->id
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Draw offer sent to opponent'
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to offer draw', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to offer draw',
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Accept a draw offer
     */
    public function acceptDraw(Request $request, int $gameId): JsonResponse
    {
        try {
            $game = Game::with(['whitePlayer', 'blackPlayer'])->findOrFail($gameId);
            $user = Auth::user();

            // Verify user is part of the game
            if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
                return response()->json([
                    'error' => 'Unauthorized',
                    'message' => 'You are not part of this game'
                ], 403);
            }

            // Get opponent
            $opponent = $game->white_player_id === $user->id ? $game->blackPlayer : $game->whitePlayer;
            $requestKey = "draw_offer:{$gameId}:{$opponent->id}";

            // Check if there's a pending draw offer from opponent
            if (!\Illuminate\Support\Facades\Cache::has($requestKey)) {
                return response()->json([
                    'error' => 'No pending draw offer',
                    'message' => 'No draw offer found from opponent'
                ], 400);
            }

            // Both players agreed - draw by mutual agreement
            $game->update([
                'status' => 'finished',
                'result' => '1/2-1/2',  // Draw
                'end_reason' => 'draw_agreed',
                'ended_at' => now()
            ]);

            \Illuminate\Support\Facades\Cache::forget($requestKey);

            // Broadcast game ended with draw
            broadcast(new \App\Events\GameEndedEvent($game->id, [
                'game_over' => true,
                'result' => '1/2-1/2',
                'end_reason' => 'draw_agreed',
                'winner_user_id' => null,
                'winner_player' => null,
                'fen_final' => $game->fen,
                'move_count' => $game->move_count,
                'ended_at' => $game->ended_at?->toISOString(),
                'white_player' => [
                    'id' => $game->whitePlayer->id,
                    'name' => $game->whitePlayer->name,
                    'rating' => $game->whitePlayer->rating ?? 1200
                ],
                'black_player' => [
                    'id' => $game->blackPlayer->id,
                    'name' => $game->blackPlayer->name,
                    'rating' => $game->blackPlayer->rating ?? 1200
                ],
                'white_player_score' => $game->white_player_score ?? 0.0,
                'black_player_score' => $game->black_player_score ?? 0.0
            ]));

            Log::info('Draw offer accepted, game ended', [
                'game_id' => $gameId,
                'accepter_id' => $user->id,
                'offerer_id' => $opponent->id
            ]);

            return response()->json([
                'success' => true,
                'result' => 'draw_agreed',
                'message' => 'Draw offer accepted, game ended as draw'
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to accept draw offer', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to accept draw offer',
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Decline a draw offer
     */
    public function declineDraw(Request $request, int $gameId): JsonResponse
    {
        try {
            $game = Game::with(['whitePlayer', 'blackPlayer'])->findOrFail($gameId);
            $user = Auth::user();

            // Verify user is part of the game
            if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
                return response()->json([
                    'error' => 'Unauthorized',
                    'message' => 'You are not part of this game'
                ], 403);
            }

            // Get opponent
            $opponent = $game->white_player_id === $user->id ? $game->blackPlayer : $game->whitePlayer;
            $requestKey = "draw_offer:{$gameId}:{$opponent->id}";

            // Check if there's a pending draw offer from opponent
            if (!\Illuminate\Support\Facades\Cache::has($requestKey)) {
                return response()->json([
                    'error' => 'No pending draw offer',
                    'message' => 'No draw offer found from opponent'
                ], 400);
            }

            // Remove draw offer from cache
            \Illuminate\Support\Facades\Cache::forget($requestKey);

            // Broadcast draw offer declined to opponent
            broadcast(new \App\Events\DrawOfferDeclinedEvent($game, $user, $opponent))->toOthers();

            Log::info('Draw offer declined', [
                'game_id' => $gameId,
                'decliner_id' => $user->id,
                'offerer_id' => $opponent->id
            ]);

            return response()->json([
                'success' => true,
                'result' => 'declined',
                'message' => 'Draw offer declined'
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to decline draw offer', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to decline draw offer',
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Get championship context for a game
     */
    public function getChampionshipContext(Request $request, int $gameId): JsonResponse
    {
        try {
            $game = Game::findOrFail($gameId);
            $user = Auth::user();

            // Verify user is part of the game
            if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
                return response()->json([
                    'error' => 'Unauthorized',
                    'message' => 'You are not part of this game'
                ], 403);
            }

            $championshipContext = $game->getChampionshipContext();

            return response()->json([
                'success' => true,
                'data' => $championshipContext
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to get championship context', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to get championship context',
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Request undo of last move
     */
    public function requestUndo(Request $request, int $gameId): JsonResponse
    {
        try {
            $result = $this->gameRoomService->requestUndo($gameId, Auth::id());

            if (!$result['success']) {
                return response()->json($result, 400);
            }

            return response()->json($result);

        } catch (\Exception $e) {
            Log::error('Failed to request undo', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to request undo',
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Accept undo request
     */
    public function acceptUndo(Request $request, int $gameId): JsonResponse
    {
        try {
            $result = $this->gameRoomService->acceptUndo($gameId, Auth::id());

            if (!$result['success']) {
                return response()->json($result, 400);
            }

            return response()->json($result);

        } catch (\Exception $e) {
            Log::error('Failed to accept undo', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to accept undo',
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Get chat history for a game
     */
    public function getChatHistory(Request $request, int $gameId): JsonResponse
    {
        $user = Auth::user();
        $game = Game::findOrFail($gameId);

        if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $messages = GameChatMessage::where('game_id', $gameId)
            ->with('user:id,name')
            ->orderBy('created_at')
            ->get()
            ->map(fn($m) => [
                'id'          => $m->id,
                'sender_id'   => $m->user_id,
                'sender_name' => $m->user->name,
                'message'     => $m->message,
                'created_at'  => $m->created_at->toISOString(),
            ]);

        return response()->json(['messages' => $messages]);
    }

    /**
     * Send a chat message in a game
     */
    public function sendChatMessage(Request $request, int $gameId): JsonResponse
    {
        $request->validate([
            'message' => 'required|string|max:500',
        ]);

        $user = Auth::user();
        $game = Game::findOrFail($gameId);

        if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $chatMessage = GameChatMessage::create([
            'game_id' => $gameId,
            'user_id' => $user->id,
            'message' => $request->input('message'),
        ]);

        broadcast(new GameChatMessageSent($game, $user, $chatMessage))->toOthers();

        Log::info('Chat message sent', [
            'game_id' => $gameId,
            'user_id' => $user->id,
            'message_id' => $chatMessage->id,
        ]);

        return response()->json([
            'id'          => $chatMessage->id,
            'sender_id'   => $user->id,
            'sender_name' => $user->name,
            'message'     => $chatMessage->message,
            'created_at'  => $chatMessage->created_at->toISOString(),
        ], 201);
    }

    /**
     * Decline undo request
     */
    public function declineUndo(Request $request, int $gameId): JsonResponse
    {
        try {
            $result = $this->gameRoomService->declineUndo($gameId, Auth::id());

            if (!$result['success']) {
                return response()->json($result, 400);
            }

            return response()->json($result);

        } catch (\Exception $e) {
            Log::error('Failed to decline undo', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to decline undo',
                'message' => $e->getMessage()
            ], 400);
        }
    }
}
