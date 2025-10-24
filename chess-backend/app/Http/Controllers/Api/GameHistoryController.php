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
            'computer_level' => 'nullable|integer',
            'moves'          => 'required|string',
            'final_score'    => 'required|numeric',
            'opponent_score' => 'nullable|numeric',
            'result'         => 'required', // Accept both string and array/object
            'game_id'        => 'nullable|integer|exists:games,id',
            'opponent_name'  => 'nullable|string|max:255',
            'game_mode'      => 'nullable|in:computer,multiplayer',
        ]);

        Log::info('Validated game data for user:', $validated);

        $userId = Auth::check() ? Auth::id() : null;

        try {
            // Handle result field - accept both string and object formats
            $resultValue = $validated['result'];
            if (is_array($resultValue) || is_object($resultValue)) {
                // New standardized format (object) - store as JSON
                $resultValue = json_encode($resultValue);
                Log::info('Converted result object to JSON for storage:', ['result' => $resultValue]);
            } else {
                // Legacy format (string) - store as-is
                Log::info('Storing legacy string result format:', ['result' => $resultValue]);
            }

            $game = new GameHistory();
            $game->user_id = $userId;
            $game->played_at = $validated['played_at'];
            $game->player_color = $validated['player_color'];
            $game->computer_level = $validated['computer_level'] ?? 0;
            $game->moves = $validated['moves'];
            $game->final_score = $validated['final_score'];
            $game->opponent_score = $validated['opponent_score'] ?? 0;
            $game->result = $resultValue;
            $game->game_id = $validated['game_id'] ?? null;
            $game->opponent_name = $validated['opponent_name'] ?? null;
            $game->game_mode = $validated['game_mode'] ?? 'computer';
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
                'computer_level' => 'nullable|integer',
                'moves'          => 'required|string',
                'final_score'    => 'required|numeric',
                'opponent_score' => 'nullable|numeric',
                'result'         => 'required', // Accept both string and array/object
                'game_id'        => 'nullable|integer|exists:games,id',
                'opponent_name'  => 'nullable|string|max:255',
                'game_mode'      => 'nullable|in:computer,multiplayer',
            ]);

            Log::info('Validated public game data:', $validated);

            // Handle result field - accept both string and object formats
            $resultValue = $validated['result'];
            if (is_array($resultValue) || is_object($resultValue)) {
                // New standardized format (object) - store as JSON
                $resultValue = json_encode($resultValue);
                Log::info('Converted public result object to JSON for storage:', ['result' => $resultValue]);
            } else {
                // Legacy format (string) - store as-is
                Log::info('Storing public legacy string result format:', ['result' => $resultValue]);
            }

            $game = new GameHistory();
            $game->user_id = null; // Guest game
            $game->played_at = $validated['played_at'] ?? now();
            $game->player_color = $validated['player_color'];
            $game->computer_level = $validated['computer_level'] ?? 0;
            $game->moves = $validated['moves'];
            $game->final_score = $validated['final_score'];
            $game->opponent_score = $validated['opponent_score'] ?? 0;
            $game->result = $resultValue;
            $game->game_id = $validated['game_id'] ?? null;
            $game->opponent_name = $validated['opponent_name'] ?? null;
            $game->game_mode = $validated['game_mode'] ?? 'computer';
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

        // Select summary fields and join with games table to get player scores and opponent info for multiplayer games
        $games = GameHistory::where('game_histories.user_id', $user->id)
            ->leftJoin('games', 'game_histories.game_id', '=', 'games.id')
            ->leftJoin('users as white_player', 'games.white_player_id', '=', 'white_player.id')
            ->leftJoin('users as black_player', 'games.black_player_id', '=', 'black_player.id')
            ->orderBy('game_histories.played_at', 'desc')
            ->get([
                'game_histories.id',
                'game_histories.played_at',
                'game_histories.player_color',
                'game_histories.computer_level',
                'game_histories.final_score',
                'game_histories.opponent_score',
                'game_histories.result',
                'game_histories.game_id',
                'game_histories.game_mode',
                'game_histories.moves',
                'games.white_player_id',
                'games.black_player_id',
                'games.white_player_score',
                'games.black_player_score',
                'white_player.name as white_player_name',
                'white_player.avatar_url as white_player_avatar',
                'white_player.rating as white_player_rating',
                'black_player.name as black_player_name',
                'black_player.avatar_url as black_player_avatar',
                'black_player.rating as black_player_rating',
            ])
            ->map(function ($game) use ($user) {
                // Calculate the correct final_score for multiplayer games
                if ($game->game_mode === 'multiplayer' && $game->game_id) {
                    // Determine which score to use based on player color
                    if ($game->white_player_id === $user->id) {
                        $game->final_score = $game->white_player_score ?? $game->final_score;
                    } elseif ($game->black_player_id === $user->id) {
                        $game->final_score = $game->black_player_score ?? $game->final_score;
                    } else {
                        // Fallback: use player_color if player IDs don't match
                        $game->final_score = ($game->player_color === 'w')
                            ? ($game->white_player_score ?? $game->final_score)
                            : ($game->black_player_score ?? $game->final_score);
                    }
                }

                // Parse result field - convert JSON string back to object if needed
                if ($game->result && is_string($game->result)) {
                    $decoded = json_decode($game->result, true);
                    if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                        // Successfully decoded JSON - return as object
                        $game->result = $decoded;
                    }
                    // If not JSON or decode fails, keep as string (legacy format)
                }

                // Add opponent info based on game mode
                if ($game->game_mode === 'multiplayer' && $game->game_id) {
                    // Multiplayer: show actual opponent with rating
                    if ($game->player_color === 'w') {
                        $game->opponent_name = $game->black_player_name;
                        $game->opponent_avatar = $game->black_player_avatar;
                        $game->opponent_score = $game->black_player_score;
                        $game->opponent_rating = $game->black_player_rating ?? 1200;
                    } else {
                        $game->opponent_name = $game->white_player_name;
                        $game->opponent_avatar = $game->white_player_avatar;
                        $game->opponent_score = $game->white_player_score;
                        $game->opponent_rating = $game->white_player_rating ?? 1200;
                    }
                } elseif ($game->game_mode === 'computer') {
                    // Computer: show level and use stored opponent_score
                    $game->opponent_name = 'Computer';
                    $game->opponent_avatar = null;
                    $game->opponent_rating = null;

                    // Use the opponent_score from database (calculated on frontend during game)
                    // Fallback to 0 if not set (for legacy games)
                    if (!isset($game->opponent_score)) {
                        $game->opponent_score = 0.0;
                    }
                }

                // Remove the extra fields we don't want to return
                unset($game->white_player_id);
                unset($game->black_player_id);
                unset($game->white_player_score);
                unset($game->black_player_score);
                unset($game->white_player_name);
                unset($game->black_player_name);
                unset($game->white_player_avatar);
                unset($game->black_player_avatar);
                unset($game->white_player_rating);
                unset($game->black_player_rating);
                unset($game->game_id);
                // Keep game_mode, computer_level, moves, opponent_rating, opponent_score

                return $game;
            });

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

        // Ensure the game belongs to the user and join with games table if it's a multiplayer game
        $game = GameHistory::where('game_histories.user_id', $user->id)
            ->where('game_histories.id', $id)
            ->leftJoin('games', 'game_histories.game_id', '=', 'games.id')
            ->select([
                'game_histories.*',
                'games.white_player_id',
                'games.black_player_id',
                'games.white_player_score',
                'games.black_player_score',
            ])
            ->firstOrFail();

        // Calculate the correct final_score for multiplayer games
        if ($game->game_mode === 'multiplayer' && $game->game_id) {
            if ($game->white_player_id === $user->id) {
                $game->final_score = $game->white_player_score ?? $game->final_score;
            } elseif ($game->black_player_id === $user->id) {
                $game->final_score = $game->black_player_score ?? $game->final_score;
            } else {
                // Fallback: use player_color if player IDs don't match
                $game->final_score = ($game->player_color === 'w')
                    ? ($game->white_player_score ?? $game->final_score)
                    : ($game->black_player_score ?? $game->final_score);
            }
        }

        // Parse result field - convert JSON string back to object if needed
        if ($game->result && is_string($game->result)) {
            $decoded = json_decode($game->result, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                // Successfully decoded JSON - return as object
                $game->result = $decoded;
            }
            // If not JSON or decode fails, keep as string (legacy format)
        }

        // Remove the extra fields we don't want to return
        unset($game->white_player_id);
        unset($game->black_player_id);
        unset($game->white_player_score);
        unset($game->black_player_score);

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
