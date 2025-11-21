<?php

namespace App\Http\Controllers;

use App\Events\GameEndedEvent;
use App\Models\Game;
use App\Models\User;
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
        $game->load(['whitePlayer', 'blackPlayer']);

        // Broadcast game ended event
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
            'white_player' => [
                'id' => $game->whitePlayer->id,
                'name' => $game->whitePlayer->name,
                'email' => $game->whitePlayer->email,
                'avatar' => $game->whitePlayer->avatar_url,
                'rating' => $game->whitePlayer->rating
            ],
            'black_player' => [
                'id' => $game->blackPlayer->id,
                'name' => $game->blackPlayer->name,
                'email' => $game->blackPlayer->email,
                'avatar' => $game->blackPlayer->avatar_url,
                'rating' => $game->blackPlayer->rating
            ]
        ]));

        return response()->json([
            'message' => 'Game resigned successfully',
            'game' => $game
        ]);
    }

    public function userGames()
    {
        $user = Auth::user();

        $games = Game::where(function($query) use ($user) {
            $query->where('white_player_id', $user->id)
                  ->orWhere('black_player_id', $user->id);
        })
        ->with(['whitePlayer', 'blackPlayer', 'statusRelation', 'endReasonRelation'])
        ->orderBy('last_move_at', 'desc')
        ->orderBy('created_at', 'desc')
        ->get()
        ->map(function($game) {
            $gameArray = $game->toArray();
            $gameArray['white_player'] = [
                'id' => $game->whitePlayer->id,
                'name' => $game->whitePlayer->name,
                'avatar' => $game->whitePlayer->avatar_url,
                'rating' => $game->whitePlayer->rating
            ];
            $gameArray['black_player'] = [
                'id' => $game->blackPlayer->id,
                'name' => $game->blackPlayer->name,
                'avatar' => $game->blackPlayer->avatar_url,
                'rating' => $game->blackPlayer->rating
            ];
            return $gameArray;
        });

        return response()->json($games);
    }

    /**
     * Get active/paused games for the current user
     * Used by Lobby and Dashboard to show "Resume Game" buttons
     */
    public function activeGames()
    {
        $user = Auth::user();

        $games = Game::where(function($query) use ($user) {
            $query->where('white_player_id', $user->id)
                  ->orWhere('black_player_id', $user->id);
        })
        ->whereHas('statusRelation', function($query) {
            // Only active, waiting, or paused games
            $query->whereIn('code', ['waiting', 'active', 'paused']);
        })
        ->with(['whitePlayer', 'blackPlayer', 'statusRelation', 'endReasonRelation'])
        ->orderBy('last_move_at', 'desc')
        ->orderBy('created_at', 'desc')
        ->get();

        return response()->json($games);
    }
}