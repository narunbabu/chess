<?php

namespace App\Http\Controllers;

use App\Events\GameEndedEvent;
use App\Models\Game;
use App\Models\User;
use App\Models\ComputerPlayer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class GameController extends Controller
{
    public function create(Request $request)
    {
        $request->validate([
            'opponent_id' => 'required|exists:users,id'
        ]);

        $user = Auth::user();
        $opponent = User::find($request->opponent_id);

        if ($user->id === $opponent->id) {
            return response()->json(['error' => 'Cannot play against yourself'], 400);
        }

        // Randomly assign colors
        $isUserWhite = rand(0, 1) === 1;

        $game = Game::create([
            'white_player_id' => $isUserWhite ? $user->id : $opponent->id,
            'black_player_id' => $isUserWhite ? $opponent->id : $user->id,
            'status' => 'active',
            'result' => 'ongoing',
            'turn' => 'white',
            'fen' => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            'moves' => []
        ]);

        return response()->json([
            'message' => 'Game created successfully',
            'game' => $game->load(['whitePlayer', 'blackPlayer', 'statusRelation', 'endReasonRelation'])
        ]);
    }

    /**
     * Create a new computer game
     */
    public function createComputerGame(Request $request)
    {
        $request->validate([
            'player_color' => 'required|in:white,black',
            'computer_level' => 'required|integer|min:1|max:20',
            'time_control' => 'sometimes|integer|min:1|max:60', // minutes
            'increment' => 'sometimes|integer|min:0|max:60' // seconds per move
        ]);

        $user = Auth::user();
        $playerColor = $request->player_color;
        $computerLevel = $request->computer_level;
        $timeControl = $request->time_control ?? 10; // Default 10 minutes
        $increment = $request->increment ?? 0; // Default no increment

        // Get or create computer player
        $computerPlayer = ComputerPlayer::getByLevel($computerLevel);

        // Set player IDs based on color choice
        if ($playerColor === 'white') {
            $whitePlayerId = $user->id;
            $blackPlayerId = null; // Computer plays black
        } else {
            $whitePlayerId = null; // Computer plays white
            $blackPlayerId = $user->id;
        }

        // Create the game
        $game = Game::create([
            'white_player_id' => $whitePlayerId,
            'black_player_id' => $blackPlayerId,
            'computer_player_id' => $computerPlayer->id,
            'computer_level' => $computerLevel,
            'player_color' => $playerColor,
            'status' => 'active',
            'result' => 'ongoing',
            'turn' => 'white', // White always starts
            'fen' => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            'moves' => [],
            'time_control_minutes' => $timeControl,
            'increment_seconds' => $increment
        ]);

        // Load relationships for the response
        $game->load([
            'whitePlayer',
            'blackPlayer',
            'computerPlayer',
            'statusRelation',
            'endReasonRelation'
        ]);

        return response()->json([
            'message' => 'Computer game created successfully',
            'game' => $game,
            'computer_opponent' => [
                'id' => $computerPlayer->id,
                'level' => $computerPlayer->level,
                'name' => $computerPlayer->name,
                'rating' => $computerPlayer->rating,
                'avatar' => $computerPlayer->avatar
            ]
        ]);
    }

    public function show($id)
    {
        $game = Game::with(['whitePlayer', 'blackPlayer', 'statusRelation', 'endReasonRelation'])->find($id);

        if (!$game) {
            return response()->json(['error' => 'Game not found'], 404);
        }

        $user = Auth::user();

        \Log::info('Game access attempt:', [
            'game_id' => $id,
            'user_id' => $user->id,
            'white_player_id' => $game->white_player_id,
            'black_player_id' => $game->black_player_id,
            'game_status' => $game->status,
            'created_at' => $game->created_at
        ]);

        // Check if user is part of this game
        if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
            \Log::warning('Unauthorized game access attempt:', [
                'game_id' => $id,
                'user_id' => $user->id,
                'white_player_id' => $game->white_player_id,
                'black_player_id' => $game->black_player_id
            ]);
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Determine player color
        $playerColor = (int) $game->white_player_id === (int) $user->id ? 'white' : 'black';

        \Log::info('🎮 Game show response:', [
            'game_id' => $id,
            'user_id' => $user->id,
            'user_id_type' => gettype($user->id),
            'white_player_id' => $game->white_player_id,
            'white_player_id_type' => gettype($game->white_player_id),
            'black_player_id' => $game->black_player_id,
            'black_player_id_type' => gettype($game->black_player_id),
            'comparison_white' => (int) $game->white_player_id === (int) $user->id,
            'comparison_black' => (int) $game->black_player_id === (int) $user->id,
            'calculated_player_color' => $playerColor
        ]);

        $response = [
            ...$game->toArray(),
            'player_color' => $playerColor,
            'white_player' => [
                'id' => $game->whitePlayer->id,
                'name' => $game->whitePlayer->name,
                'email' => $game->whitePlayer->email,
                'avatar' => $game->whitePlayer->avatar_url,
                'rating' => $game->whitePlayer->rating,
                'is_provisional' => $game->whitePlayer->is_provisional
            ],
            'black_player' => [
                'id' => $game->blackPlayer->id,
                'name' => $game->blackPlayer->name,
                'email' => $game->blackPlayer->email,
                'avatar' => $game->blackPlayer->avatar_url,
                'rating' => $game->blackPlayer->rating,
                'is_provisional' => $game->blackPlayer->is_provisional
            ]
        ];

        \Log::info('🎮 Final response player_color:', ['player_color' => $response['player_color']]);
        \Log::info('🎮 Final response white_player:', ['white_player' => $response['white_player']]);
        \Log::info('🎮 Final response black_player:', ['black_player' => $response['black_player']]);

        return response()->json($response);
    }

    public function move(Request $request, $id)
    {
        $request->validate([
            'from' => 'required|string',
            'to' => 'required|string',
            'fen' => 'required|string',
            'move' => 'required|string'
        ]);

        $game = Game::find($id);

        if (!$game) {
            return response()->json(['error' => 'Game not found'], 404);
        }

        $user = Auth::user();
        $userColor = $game->getPlayerColor($user->id);

        // Check if it's the user's turn
        if ($game->turn !== $userColor) {
            return response()->json(['error' => 'Not your turn'], 400);
        }

        // Update game state
        $moves = $game->moves ?? [];
        $moves[] = [
            'from' => $request->from,
            'to' => $request->to,
            'move' => $request->move,
            'player' => $userColor,
            'timestamp' => now()
        ];

        $game->update([
            'fen' => $request->fen,
            'moves' => $moves,
            'turn' => $userColor === 'white' ? 'black' : 'white',
            'last_move_at' => now()
        ]);

        return response()->json([
            'message' => 'Move recorded',
            'game' => $game->load(['whitePlayer', 'blackPlayer'])
        ]);
    }

    /**
     * Get compact move history for a game (efficient format)
     * Returns moves in compact format: "e4,2.50;a6,3.15;Nf3,1.80"
     * instead of full JSON objects with FEN strings
     */
    public function moves($id)
    {
        $game = Game::find($id);

        if (!$game) {
            return response()->json(['error' => 'Game not found'], 404);
        }

        $user = Auth::user();

        // Check if user is part of this game
        if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        \Log::info('🚀 Game moves requested in compact format', [
            'game_id' => $id,
            'user_id' => $user->id,
            'move_count' => count($game->moves ?? [])
        ]);

        // Convert existing move objects to compact format
        $compactMoves = $this->convertMovesToCompactFormat($game->moves ?? []);

        return response()->json([
            'game_id' => $game->id,
            'moves' => $compactMoves,
            'move_count' => count($game->moves ?? []),
            'format' => 'compact',
            'size_compared' => [
                'original_json' => strlen(json_encode($game->moves ?? [])),
                'compact' => strlen($compactMoves),
                'savings_percent' => $game->moves ?
                    round((1 - strlen($compactMoves) / strlen(json_encode($game->moves))) * 100, 1) : 0
            ]
        ]);
    }

    /**
     * Convert existing move objects to compact format
     * Format: "san,time,evaluation;san,time,evaluation;..."
     */
    private function convertMovesToCompactFormat($moves): string
    {
        if (empty($moves)) {
            return '';
        }

        $compactParts = [];

        foreach ($moves as $move) {
            $san = $move['san'] ?? $move['move'] ?? '';
            $timeInSeconds = isset($move['move_time_ms']) ?
                number_format($move['move_time_ms'] / 1000, 2, '.', '') :
                (isset($move['timeSpent']) ? number_format($move['timeSpent'], 2, '.', '') : '0.00');
            $evaluation = $move['evaluation'] ?? '';

            // Build compact part: san,time,evaluation (evaluation optional)
            if (!empty($evaluation) && $evaluation !== '' && $evaluation !== null) {
                // Handle evaluation objects or numbers
                $evalValue = is_object($evaluation) ? ($evaluation->total ?? 0) : $evaluation;
                $compactParts[] = "{$san},{$timeInSeconds}," . number_format($evalValue, 2, '.', '');
            } else {
                $compactParts[] = "{$san},{$timeInSeconds}";
            }
        }

        return implode(';', $compactParts);
    }

    public function resign($id)
    {
        $game = Game::find($id);

        if (!$game) {
            return response()->json(['error' => 'Game not found'], 404);
        }

        $user = Auth::user();
        $userColor = $game->getPlayerColor($user->id);
        $winnerColor = $userColor === 'white' ? 'black' : 'white';
        $winnerId = $winnerColor === 'white' ? $game->white_player_id : $game->black_player_id;
        $isComputerGame = !is_null($game->computer_player_id);

        // Update game with all resignation details
        $game->update([
            'status' => 'finished',
            'result' => $userColor === 'white' ? '0-1' : '1-0',
            'end_reason' => 'resignation',
            'winner_user_id' => $winnerId,
            'winner_player' => $winnerColor,
            'ended_at' => now()
        ]);

        // Reload relationships
        $game->load(['whitePlayer', 'blackPlayer', 'computerPlayer']);

        // Build player data, handling computer games where one side has no User
        $computerData = $isComputerGame && $game->computerPlayer ? [
            'id' => 'computer_' . $game->computerPlayer->id,
            'name' => $game->computerPlayer->name,
            'email' => null,
            'avatar' => null,
            'rating' => $game->computerPlayer->rating
        ] : null;

        $whitePlayerData = $game->whitePlayer ? [
            'id' => $game->whitePlayer->id,
            'name' => $game->whitePlayer->name,
            'email' => $game->whitePlayer->email,
            'avatar' => $game->whitePlayer->avatar_url,
            'rating' => $game->whitePlayer->rating
        ] : $computerData;

        $blackPlayerData = $game->blackPlayer ? [
            'id' => $game->blackPlayer->id,
            'name' => $game->blackPlayer->name,
            'email' => $game->blackPlayer->email,
            'avatar' => $game->blackPlayer->avatar_url,
            'rating' => $game->blackPlayer->rating
        ] : $computerData;

        // Broadcast game ended event (skip for computer games — no remote opponent)
        if (!$isComputerGame) {
            \Log::info('Broadcasting GameEndedEvent for resignation', [
                'game_id' => $game->id,
                'result' => $game->result,
                'winner_user_id' => $game->winner_user_id,
                'end_reason' => 'resignation'
            ]);

            broadcast(new GameEndedEvent($game->id, [
                'game_over' => true,
                'result' => $game->result,
                'end_reason' => 'resignation',
                'winner_user_id' => $winnerId,
                'winner_player' => $winnerColor,
                'fen_final' => $game->fen,
                'move_count' => count($game->moves ?? []),
                'ended_at' => $game->ended_at->toISOString(),
                'white_player' => $whitePlayerData,
                'black_player' => $blackPlayerData
            ]));
        }

        return response()->json([
            'message' => 'Game resigned successfully',
            'game' => $game
        ]);
    }

    public function userGames(Request $request)
    {
        // Allow admin to query any user's games, otherwise use current user
        $userId = $request->get('user_id');
        if ($userId) {
            // Only allow admin to query other users or if it's the same user
            if (!$request->user()->tokenCan('admin') && $userId != $request->user()->id) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }
            $user = User::find($userId);
            if (!$user) {
                return response()->json(['error' => 'User not found'], 404);
            }
        } else {
            $user = Auth::user();
        }

        $query = Game::where(function($query) use ($user) {
            $query->where('white_player_id', $user->id)
                  ->orWhere('black_player_id', $user->id);
        });

        // Filter by status if provided
        if ($request->has('status')) {
            $status = $request->get('status');
            if ($status === 'finished') {
                $query->whereIn('status', ['finished', 'white_wins', 'black_wins', 'draw', 'timeout']);
            } else {
                $query->where('status', $status);
            }
        }

        // Apply limit
        $limit = $request->get('limit', 50);
        $query->limit(min($limit, 100)); // Cap at 100 for performance

        $games = $query->with(['whitePlayer', 'blackPlayer', 'computerPlayer', 'syntheticPlayer', 'statusRelation', 'endReasonRelation'])
        ->orderBy('last_move_at', 'desc')
        ->orderBy('created_at', 'desc')
        ->get()
        ->map(function($game) {
            $gameArray = $game->toArray();
            $isComputerGame = $game->computer_player_id !== null;

            // Prefer synthetic player data over generic computer player
            if ($isComputerGame && $game->syntheticPlayer) {
                $computerData = [
                    'id' => 'synthetic_' . $game->syntheticPlayer->id,
                    'name' => $game->syntheticPlayer->name,
                    'avatar' => $game->syntheticPlayer->avatar_url,
                    'rating' => $game->syntheticPlayer->rating
                ];
            } elseif ($isComputerGame && $game->computerPlayer) {
                $computerData = [
                    'id' => 'computer_' . $game->computerPlayer->id,
                    'name' => $game->computerPlayer->name,
                    'avatar' => null,
                    'rating' => $game->computerPlayer->rating
                ];
            } else {
                $computerData = null;
            }

            $gameArray['white_player'] = $game->whitePlayer ? [
                'id' => $game->whitePlayer->id,
                'name' => $game->whitePlayer->name,
                'avatar' => $game->whitePlayer->avatar_url,
                'rating' => $game->whitePlayer->rating
            ] : ($computerData ?? ['id' => null, 'name' => 'Computer', 'avatar' => null, 'rating' => null]);

            $gameArray['black_player'] = $game->blackPlayer ? [
                'id' => $game->blackPlayer->id,
                'name' => $game->blackPlayer->name,
                'avatar' => $game->blackPlayer->avatar_url,
                'rating' => $game->blackPlayer->rating
            ] : ($computerData ?? ['id' => null, 'name' => 'Computer', 'avatar' => null, 'rating' => null]);

            return $gameArray;
        });

        return response()->json($games);
    }

    /**
     * Get active/paused games for the current user
     * Used by Lobby and Dashboard to show "Resume Game" buttons
     */
    public function activeGames(Request $request)
    {
        $user = Auth::user();
        $limit = $request->get('limit', 10);
        $page = $request->get('page', 1);

        $query = Game::where(function($query) use ($user) {
            $query->where('white_player_id', $user->id)
                  ->orWhere('black_player_id', $user->id);
        })
        ->whereHas('statusRelation', function($query) {
            // Only active, waiting, or paused games
            $query->whereIn('code', ['waiting', 'active', 'paused']);
        })
        ->with(['whitePlayer', 'blackPlayer', 'statusRelation', 'endReasonRelation'])
        ->orderBy('last_move_at', 'desc')
        ->orderBy('created_at', 'desc');

        $total = $query->count();
        $games = $query->paginate($limit, ['*'], 'page', $page);

        return response()->json([
            'data' => $games->items(),
            'pagination' => [
                'current_page' => $games->currentPage(),
                'last_page' => $games->lastPage(),
                'per_page' => $games->perPage(),
                'total' => $total,
                'has_more' => $games->hasMorePages(),
            ]
        ]);
    }

    /**
     * Get unfinished games (paused by navigation or inactivity)
     */
    public function unfinishedGames()
    {
        $user = Auth::user();

        $games = Game::where(function($query) use ($user) {
            $query->where('white_player_id', $user->id)
                  ->orWhere('black_player_id', $user->id);
        })
        ->whereHas('statusRelation', function($query) {
            $query->where('code', 'paused');
        })
        ->where(function($query) {
            // Only games paused due to navigation or inactivity (not manual pause)
            $query->where('paused_reason', 'navigation')
                  ->orWhere('paused_reason', 'inactivity')
                  ->orWhere('paused_reason', 'beforeunload');
        })
        ->with(['whitePlayer', 'blackPlayer', 'statusRelation', 'endReasonRelation'])
        ->orderBy('paused_at', 'desc')
        ->get()
        ->map(function($game) use ($user) {
            // Add convenience fields for frontend
            $isWhite = $game->white_player_id === $user->id;
            $opponent = $isWhite ? $game->blackPlayer : $game->whitePlayer;

            return [
                ...$game->toArray(),
                'current_user_id' => $user->id,
                'opponent_name' => $opponent->name ?? 'Unknown',
                'opponent_id' => $opponent->id ?? null
            ];
        });

        return response()->json($games);
    }

    /**
     * Pause game due to navigation/page close
     */
    public function pauseNavigation(Request $request, $id)
    {
        $request->validate([
            'fen' => 'sometimes|string',
            'pgn' => 'sometimes|string',
            'white_time_remaining_ms' => 'sometimes|integer',
            'black_time_remaining_ms' => 'sometimes|integer',
            'paused_reason' => 'sometimes|string|in:navigation,beforeunload,inactivity'
        ]);

        $game = Game::find($id);

        if (!$game) {
            return response()->json(['error' => 'Game not found'], 404);
        }

        $user = Auth::user();

        // Check if user is part of this game
        if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Don't pause if game is already finished
        $status = $game->statusRelation;
        if ($status && $status->code === 'finished') {
            return response()->json(['message' => 'Game already finished', 'game' => $game], 200);
        }

        // Update game status to paused
        $updateData = [
            'status_id' => \DB::table('game_statuses')->where('code', 'paused')->first()->id,
            'paused_at' => now(),
            'paused_reason' => $request->input('paused_reason', 'navigation'),
            'paused_by_user_id' => $user->id,
            'turn_at_pause' => $game->turn
        ];

        // Update timer state if provided
        if ($request->has('white_time_remaining_ms')) {
            $updateData['white_time_paused_ms'] = $request->input('white_time_remaining_ms');
        }
        if ($request->has('black_time_remaining_ms')) {
            $updateData['black_time_paused_ms'] = $request->input('black_time_remaining_ms');
        }

        // Update position if provided
        if ($request->has('fen')) {
            $updateData['fen'] = $request->input('fen');
        }
        if ($request->has('pgn')) {
            $updateData['pgn'] = $request->input('pgn');
        }

        $game->update($updateData);

        return response()->json([
            'message' => 'Game paused successfully',
            'game' => $game->fresh(['whitePlayer', 'blackPlayer', 'statusRelation', 'endReasonRelation'])
        ]);
    }

    /**
     * Create game from unfinished guest game (computer games only)
     */
    public function createFromUnfinished(Request $request)
    {
        $request->validate([
            'fen' => 'required|string',
            'pgn' => 'sometimes|string',
            'moves' => 'sometimes|array',
            'player_color' => 'required|in:white,black',
            'computer_level' => 'sometimes|integer|min:1|max:20',
            'white_time_remaining_ms' => 'sometimes|integer',
            'black_time_remaining_ms' => 'sometimes|integer',
            'increment_seconds' => 'sometimes|integer',
            'turn' => 'required|in:w,b,white,black'
        ]);

        $user = Auth::user();

        // Normalize turn value
        $turn = $request->input('turn');
        if ($turn === 'w') $turn = 'white';
        if ($turn === 'b') $turn = 'black';

        // Create game
        $game = Game::create([
            'white_player_id' => $request->input('player_color') === 'white' ? $user->id : null,
            'black_player_id' => $request->input('player_color') === 'black' ? $user->id : null,
            'status_id' => \DB::table('game_statuses')->where('code', 'paused')->first()->id,
            'fen' => $request->input('fen'),
            'pgn' => $request->input('pgn'),
            'moves' => $request->has('moves') ? json_encode($request->input('moves')) : json_encode([]),
            'turn' => $turn,
            'paused_at' => now(),
            'paused_reason' => 'migration',
            'paused_by_user_id' => $user->id,
            'white_time_remaining_ms' => $request->input('white_time_remaining_ms', 10 * 60 * 1000),
            'black_time_remaining_ms' => $request->input('black_time_remaining_ms', 10 * 60 * 1000),
            'increment_seconds' => $request->input('increment_seconds', 0),
            'move_count' => count($request->input('moves', []))
        ]);

        return response()->json([
            'message' => 'Game created successfully from unfinished state',
            'game' => $game->fresh(['whitePlayer', 'blackPlayer', 'statusRelation', 'endReasonRelation']),
            'id' => $game->id
        ], 201);
    }

    /**
     * Delete unfinished game
     */
    public function deleteUnfinished($id)
    {
        $game = Game::find($id);

        if (!$game) {
            return response()->json(['error' => 'Game not found'], 404);
        }

        $user = Auth::user();

        // Check if user is part of this game
        if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Only allow deletion of paused games
        // Use the status accessor which properly handles the statusRelation
        if ($game->status !== 'paused') {
            return response()->json([
                'error' => 'Can only delete paused games',
                'debug' => [
                    'game_id' => $game->id,
                    'status' => $game->status,
                    'game_phase' => $game->game_phase
                ]
            ], 400);
        }

        $game->delete();

        return response()->json(['message' => 'Game deleted successfully']);
    }

    /**
     * Set game mode (rated/casual) for a game
     *
     * POST /api/games/{id}/mode
     *
     * @param Request $request
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function setGameMode(Request $request, $id)
    {
        $request->validate([
            'game_mode' => 'required|in:rated,casual'
        ]);

        $game = Game::find($id);

        if (!$game) {
            return response()->json(['error' => 'Game not found'], 404);
        }

        $user = Auth::user();

        // Check if user is part of this game
        if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Can only set mode for games that haven't started or are just starting
        if (count($game->moves ?? []) > 0) {
            return response()->json(['error' => 'Cannot change game mode after moves have been made'], 400);
        }

        $game->update([
            'game_mode' => $request->input('game_mode')
        ]);

        return response()->json([
            'message' => 'Game mode updated successfully',
            'game' => $game->load(['whitePlayer', 'blackPlayer'])
        ]);
    }

    /**
     * Get game mode for a game
     *
     * GET /api/games/{id}/mode
     *
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function getGameMode($id)
    {
        $game = Game::find($id);

        if (!$game) {
            return response()->json(['error' => 'Game not found'], 404);
        }

        $user = Auth::user();

        // Check if user is part of this game
        if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        return response()->json([
            'game_id' => $game->id,
            'game_mode' => $game->game_mode ?? 'casual' // Default to casual if not set
        ]);
    }

    /**
     * Get rating change for a completed game
     *
     * GET /api/games/{id}/rating-change
     *
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function getRatingChange($id)
    {
        $game = Game::find($id);

        if (!$game) {
            return response()->json(['error' => 'Game not found'], 404);
        }

        $user = Auth::user();

        // Check if user is part of this game
        if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Get rating history for this game
        $ratingHistory = \DB::table('ratings_history')
            ->where('game_id', $game->id)
            ->where('user_id', $user->id)
            ->first();

        if (!$ratingHistory) {
            return response()->json([
                'message' => 'Rating change not available',
                'game_id' => $game->id,
                'game_mode' => $game->game_mode
            ], 404);
        }

        return response()->json([
            'game_id' => $game->id,
            'game_mode' => $game->game_mode,
            'rating_change' => [
                'old_rating' => $ratingHistory->old_rating,
                'new_rating' => $ratingHistory->new_rating,
                'rating_change' => $ratingHistory->rating_change,
                'performance_score' => $ratingHistory->performance_score ?? null,
                'performance_modifier' => $ratingHistory->performance_modifier ?? null,
                'base_rating_change' => $ratingHistory->base_rating_change ?? null,
                'result' => $ratingHistory->result,
                'k_factor' => $ratingHistory->k_factor,
                'expected_score' => $ratingHistory->expected_score,
                'actual_score' => $ratingHistory->actual_score
            ]
        ]);
    }
}