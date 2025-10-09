<?php

namespace App\Http\Controllers;

use App\Http\Middleware\WebSocketAuth;
use App\Models\Game;
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
     * Handle new game/rematch request
     */
    public function newGame(Request $request, int $gameId): JsonResponse
    {
        $request->validate([
            'socket_id' => 'required|string',
            'is_rematch' => 'boolean'
        ]);

        try {
            $result = $this->gameRoomService->createNewGame(
                $gameId,
                Auth::id(),
                $request->input('socket_id'),
                $request->boolean('is_rematch', false)
            );

            Log::info('New game requested', [
                'user_id' => Auth::id(),
                'original_game_id' => $gameId,
                'new_game_id' => $result['game_id'] ?? null,
                'is_rematch' => $request->boolean('is_rematch', false)
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
            'move.prev_fen' => 'required|string',
            'move.next_fen' => 'required|string',
            'move.is_mate_hint' => 'required|boolean',
            'move.is_check' => 'required|boolean',
            'move.is_stalemate' => 'required|boolean',
            'move.move_time_ms' => 'nullable|numeric',
            'move.player_rating' => 'nullable|integer',
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
            Log::error('Failed to broadcast move', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to broadcast move',
                'message' => $e->getMessage()
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
            $result = $this->gameRoomService->forfeitGame($gameId, Auth::id());

            Log::info('Player forfeited game', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
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
            $result = $this->gameRoomService->pauseGame($gameId, Auth::id());

            Log::info('Game paused due to inactivity', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'reason' => 'inactivity',
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
        try {
            $result = $this->gameRoomService->requestResume($gameId, Auth::id());

            Log::info('Resume request sent', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'result' => $result
            ]);

            return response()->json($result);

        } catch (\Exception $e) {
            Log::error('Failed to request resume', [
                'user_id' => Auth::id(),
                'game_id' => $gameId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to request resume',
                'message' => $e->getMessage()
            ], 400);
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
}
