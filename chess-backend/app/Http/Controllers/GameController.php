<?php

namespace App\Http\Controllers;

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
            'game' => $game->load(['whitePlayer', 'blackPlayer'])
        ]);
    }

    public function show($id)
    {
        $game = Game::with(['whitePlayer', 'blackPlayer'])->find($id);

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
            'player_color' => $playerColor
        ];

        \Log::info('🎮 Final response player_color:', ['player_color' => $response['player_color']]);

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

    public function resign($id)
    {
        $game = Game::find($id);

        if (!$game) {
            return response()->json(['error' => 'Game not found'], 404);
        }

        $user = Auth::user();
        $userColor = $game->getPlayerColor($user->id);

        $game->update([
            'status' => 'completed',
            'result' => $userColor === 'white' ? 'black_wins' : 'white_wins'
        ]);

        return response()->json([
            'message' => 'Game resigned',
            'game' => $game->load(['whitePlayer', 'blackPlayer'])
        ]);
    }

    public function userGames()
    {
        $user = Auth::user();

        $games = Game::where(function($query) use ($user) {
            $query->where('white_player_id', $user->id)
                  ->orWhere('black_player_id', $user->id);
        })
        ->with(['whitePlayer', 'blackPlayer'])
        ->orderBy('last_move_at', 'desc')
        ->orderBy('created_at', 'desc')
        ->get();

        return response()->json($games);
    }
}