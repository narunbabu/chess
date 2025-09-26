<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\GameHistory;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class GameHistoryController extends Controller
{
    // Save a new game history record (authenticated users)
    public function store(Request $request)
    {
        Log::info("Game history request received");
        $user = $request->user();
        Log::info("User:");
        Log::info($user);
        Log::info($request);

        $validated = $request->validate([
            'played_at'      => 'required|date_format:Y-m-d H:i:s',
            'player_color'   => 'required|in:w,b',
            'computer_level' => 'required|integer',
            'moves'          => 'required|string',
            'final_score'    => 'required|numeric',
            'result'         => 'required|string',
        ]);

        Log::info('Validated game data for user:', $validated);

        $userId = Auth::check() ? Auth::id() : null;

        try {
            $game = new GameHistory();
            $game->user_id = $userId;
            $game->played_at = $validated['played_at'];
            $game->player_color = $validated['player_color'];
            $game->computer_level = $validated['computer_level'];
            $game->moves = $validated['moves'];
            $game->final_score = $validated['final_score'];
            $game->result = $validated['result'];
            $game->save();

            return response()->json(['success' => true, 'data' => $game], 201);
        } catch (\Exception $e) {
            Log::error("Failed to save game history: " . $e->getMessage());
            return response()->json(['error' => 'Failed to save game', 'message' => $e->getMessage()], 500);
        }
    }

    // Public endpoint to save game history (no authentication required)
    public function storePublic(Request $request)
    {
        Log::info("=== PUBLIC GAME HISTORY REQUEST ===");
        Log::info("Request Method: " . $request->method());
        Log::info("Request URL: " . $request->fullUrl());
        Log::info("Request Headers: ", $request->headers->all());
        Log::info("Request Body (raw): " . $request->getContent());
        Log::info("Request data (parsed): ", $request->all());
        Log::info("Content-Type: " . $request->header('Content-Type'));

        try {
            $validated = $request->validate([
                'played_at'      => 'nullable|date_format:Y-m-d H:i:s',
                'player_color'   => 'required|in:w,b',
                'computer_level' => 'required|integer',
                'moves'          => 'required|string',
                'final_score'    => 'required|numeric',
                'result'         => 'required|string',
            ]);

            Log::info('Validated public game data:', $validated);

            $game = new GameHistory();
            $game->user_id = null; // Guest game
            $game->played_at = $validated['played_at'] ?? now();
            $game->player_color = $validated['player_color'];
            $game->computer_level = $validated['computer_level'];
            $game->moves = $validated['moves'];
            $game->final_score = $validated['final_score'];
            $game->result = $validated['result'];
            $game->save();

            Log::info("Game saved successfully: ", $game->toArray());
            return response()->json(['success' => true, 'data' => $game], 201);

        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::error("Validation failed: ", $e->errors());
            return response()->json([
                'error' => 'Validation failed',
                'details' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            Log::error("Failed to save public game history: " . $e->getMessage());
            return response()->json([
                'error' => 'Failed to save game',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    // Return a summary list of game histories (without moves)
    public function index(Request $request)
    {
        $user = $request->user();
        Log::info("User:");
        Log::info($user);
        if (!$user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        // Select summary fields (excluding moves)
        $games = GameHistory::where('user_id', $user->id)
            ->orderBy('played_at', 'desc')
            ->get(['id', 'played_at', 'player_color', 'computer_level', 'final_score', 'result']);

        Log::info("Games summary:", $games->toArray());
        return response()->json(['success' => true, 'data' => $games], 200);
    }

    // Return full game details (including moves) for a given id
    public function show(Request $request, $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        // Ensure the game belongs to the user
        $game = GameHistory::where('user_id', $user->id)->findOrFail($id);

        return response()->json(['success' => true, 'data' => $game], 200);
    }

    // (Optional) Global ranking endpoint
    public function rankings()
    {
        $rankings = GameHistory::selectRaw('user_id, COUNT(*) as games_played, SUM(final_score) as total_score')
            ->whereNotNull('user_id')
            ->groupBy('user_id')
            ->orderByDesc('total_score')
            ->get();

        return response()->json(['success' => true, 'data' => $rankings], 200);
    }
}
