<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\GameHistory;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class GameHistoryController extends Controller
{
    /**
     * Extract final scores from moves string
     * Moves format: "move1,score1;move2,score2;...;moveN,scoreN"
     */
    private function extractScoresFromMoves(?string $moves, string $playerColor): array
    {
        $whiteScore = 0;
        $blackScore = 0;

        if ($moves === null || empty($moves)) {
            return ['white_score' => 0, 'black_score' => 0];
        }

        $movePairs = explode(';', $moves);
        $moveIndex = 0;

        foreach ($movePairs as $pair) {
            if (empty(trim($pair))) continue;

            $parts = explode(',', $pair);
            if (count($parts) < 2) continue;

            $score = (float) end($parts);

            // Alternating moves: white moves first (index 0), then black (index 1), etc.
            if ($moveIndex % 2 === 0) {
                // White's move
                $whiteScore += $score;
            } else {
                // Black's move
                $blackScore += $score;
            }

            $moveIndex++;
        }

        Log::info("Extracted scores from moves", [
            'player_color' => $playerColor,
            'white_score' => $whiteScore,
            'black_score' => $blackScore,
            'total_moves' => $moveIndex,
            'moves_sample' => substr($moves, 0, 100) . '...'
        ]);

        return ['white_score' => $whiteScore, 'black_score' => $blackScore];
    }

    // Save a new game history record (authenticated users)
    public function store(Request $request)
    {
        Log::info("Game history request received");
        $user = $request->user();
        Log::info("User:");
        Log::info($user);
        Log::info($request);

        $validated = $request->validate([
            'played_at'           => 'required|date_format:Y-m-d H:i:s',
            'player_color'        => 'required|in:w,b',
            'computer_level'      => 'nullable|integer',
            'moves'               => 'nullable|string',
            'final_score'         => 'required|numeric',
            'opponent_score'      => 'nullable|numeric',
            'result'              => 'required', // Accept both string and array/object
            'game_id'             => 'nullable|integer|exists:games,id',
            'opponent_name'       => 'nullable|string|max:255',
            'opponent_avatar_url' => 'nullable|string|max:500',
            'opponent_rating'     => 'nullable|integer',
            'game_mode'           => 'nullable|in:computer,multiplayer',
        ]);

        Log::info('Validated game data for user:', $validated);

        $userId = Auth::check() ? Auth::id() : null;

        try {
            // Extract scores from moves string if not provided or if provided scores are 0
            $extractedScores = $this->extractScoresFromMoves($validated['moves'], $validated['player_color']);

            // Use provided scores if they exist and are not both 0, otherwise use extracted scores
            $finalScore = $validated['final_score'];
            $opponentScore = $validated['opponent_score'] ?? 0;

            if ($finalScore == 0 && $opponentScore == 0) {
                Log::info('Both scores are 0, using extracted scores from moves string');
                if ($validated['player_color'] === 'w') {
                    $finalScore = $extractedScores['white_score'];
                    $opponentScore = $extractedScores['black_score'];
                } else {
                    $finalScore = $extractedScores['black_score'];
                    $opponentScore = $extractedScores['white_score'];
                }
                Log::info('Updated scores from moves extraction', [
                    'final_score' => $finalScore,
                    'opponent_score' => $opponentScore
                ]);
            }

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
            $game->final_score = $finalScore;
            $game->opponent_score = $opponentScore;
            $game->result = $resultValue;
            $game->game_id = $validated['game_id'] ?? null;
            $game->opponent_name = $validated['opponent_name'] ?? null;
            $game->opponent_avatar_url = $validated['opponent_avatar_url'] ?? null;
            $game->opponent_rating = $validated['opponent_rating'] ?? null;
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
                'played_at'           => 'nullable|date_format:Y-m-d H:i:s',
                'player_color'        => 'required|in:w,b',
                'computer_level'      => 'nullable|integer',
                'moves'               => 'nullable|string',
                'final_score'         => 'required|numeric',
                'opponent_score'      => 'nullable|numeric',
                'result'              => 'required', // Accept both string and array/object
                'game_id'             => 'nullable|integer|exists:games,id',
                'opponent_name'       => 'nullable|string|max:255',
                'opponent_avatar_url' => 'nullable|string|max:500',
                'opponent_rating'     => 'nullable|integer',
                'game_mode'           => 'nullable|in:computer,multiplayer',
            ]);

            Log::info('Validated public game data:', $validated);

            // Extract scores from moves string if not provided or if provided scores are 0
            $extractedScores = $this->extractScoresFromMoves($validated['moves'], $validated['player_color']);

            // Use provided scores if they exist and are not both 0, otherwise use extracted scores
            $finalScore = $validated['final_score'];
            $opponentScore = $validated['opponent_score'] ?? 0;

            if ($finalScore == 0 && $opponentScore == 0) {
                Log::info('Both scores are 0 in public game, using extracted scores from moves string');
                if ($validated['player_color'] === 'w') {
                    $finalScore = $extractedScores['white_score'];
                    $opponentScore = $extractedScores['black_score'];
                } else {
                    $finalScore = $extractedScores['black_score'];
                    $opponentScore = $extractedScores['white_score'];
                }
                Log::info('Updated public game scores from moves extraction', [
                    'final_score' => $finalScore,
                    'opponent_score' => $opponentScore
                ]);
            }

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
            $game->final_score = $finalScore;
            $game->opponent_score = $opponentScore;
            $game->result = $resultValue;
            $game->game_id = $validated['game_id'] ?? null;
            $game->opponent_name = $validated['opponent_name'] ?? null;
            $game->opponent_avatar_url = $validated['opponent_avatar_url'] ?? null;
            $game->opponent_rating = $validated['opponent_rating'] ?? null;
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
                'game_histories.opponent_name',
                'game_histories.opponent_avatar_url',
                'game_histories.opponent_rating',
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

                // Auto-detect multiplayer: if game_id exists and both players are real users
                $isMultiplayer = ($game->game_mode === 'multiplayer')
                    || ($game->game_id && $game->white_player_name && $game->black_player_name);

                // Add opponent info based on game mode
                if ($isMultiplayer && $game->game_id) {
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
                    // Ensure game_mode is set for frontend detection
                    if (!$game->game_mode || $game->game_mode !== 'multiplayer') {
                        $game->game_mode = 'multiplayer';
                    }
                } elseif (!$game->game_mode || $game->game_mode === 'computer') {
                    // Computer: use stored synthetic opponent name/avatar, fallback to generic 'Computer'
                    $game->opponent_name = $game->opponent_name ?: 'Computer';
                    $game->opponent_avatar = $game->opponent_avatar_url ?: null;
                    // opponent_rating already set from DB column (null for legacy games)

                    // Use the opponent_score from database (calculated on frontend during game)
                    // Fallback to 0 if not set (for legacy games)
                    if (!isset($game->opponent_score)) {
                        $game->opponent_score = 0.0;
                    }
                }

                // Add player objects for GameEndCard compatibility (multiplayer only)
                if ($game->game_mode === 'multiplayer' && $game->game_id) {
                    $game->white_player = [
                        'id' => $game->white_player_id,
                        'name' => $game->white_player_name,
                        'avatar' => $game->white_player_avatar,
                        'rating' => $game->white_player_rating ?? 1200
                    ];
                    $game->black_player = [
                        'id' => $game->black_player_id,
                        'name' => $game->black_player_name,
                        'avatar' => $game->black_player_avatar,
                        'rating' => $game->black_player_rating ?? 1200
                    ];
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
                // Keep game_mode, computer_level, moves, opponent_rating, opponent_score, game_id

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
            ->leftJoin('users as white_player', 'games.white_player_id', '=', 'white_player.id')
            ->leftJoin('users as black_player', 'games.black_player_id', '=', 'black_player.id')
            ->select([
                'game_histories.*',
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
            ->first();

        if (!$game) {
            Log::warning("Game history not found", [
                'user_id' => $user->id,
                'game_history_id' => $id,
                'error' => 'No query results for model [App\\Models\\GameHistory]'
            ]);
            return response()->json([
                'error' => 'Game not found',
                'message' => "Game history with ID {$id} not found for user {$user->id}"
            ], 404);
        }

        // Calculate the correct final_score for multiplayer games
        if ($game->game_mode === 'multiplayer' && $game->game_id) {
            if ($game->white_player_id === $user->id) {
                $game->final_score = $game->white_player_score ?? $game->final_score;
                $game->opponent_score = $game->black_player_score ?? $game->opponent_score;
            } elseif ($game->black_player_id === $user->id) {
                $game->final_score = $game->black_player_score ?? $game->final_score;
                $game->opponent_score = $game->white_player_score ?? $game->opponent_score;
            } else {
                // Fallback: use player_color if player IDs don't match
                if ($game->player_color === 'w') {
                    $game->final_score = $game->white_player_score ?? $game->final_score;
                    $game->opponent_score = $game->black_player_score ?? $game->opponent_score;
                } else {
                    $game->final_score = $game->black_player_score ?? $game->final_score;
                    $game->opponent_score = $game->white_player_score ?? $game->opponent_score;
                }
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

        // Auto-detect multiplayer: if game_id exists and both players are real users
        $isMultiplayer = ($game->game_mode === 'multiplayer')
            || ($game->game_id && $game->white_player_name && $game->black_player_name);

        // Add opponent info based on game mode (same logic as index())
        if ($isMultiplayer && $game->game_id) {
            if ($game->player_color === 'w') {
                $game->opponent_name = $game->black_player_name ?: $game->opponent_name;
                $game->opponent_avatar_url = $game->black_player_avatar ?: $game->opponent_avatar_url;
                $game->opponent_rating = $game->black_player_rating ?? $game->opponent_rating ?? 1200;
                $game->opponent_score = $game->black_player_score ?? $game->opponent_score;
            } else {
                $game->opponent_name = $game->white_player_name ?: $game->opponent_name;
                $game->opponent_avatar_url = $game->white_player_avatar ?: $game->opponent_avatar_url;
                $game->opponent_rating = $game->white_player_rating ?? $game->opponent_rating ?? 1200;
                $game->opponent_score = $game->white_player_score ?? $game->opponent_score;
            }
            // Ensure game_mode is set for frontend detection
            if (!$game->game_mode || $game->game_mode !== 'multiplayer') {
                $game->game_mode = 'multiplayer';
            }

            $game->white_player = [
                'id' => $game->white_player_id,
                'name' => $game->white_player_name,
                'avatar' => $game->white_player_avatar,
                'rating' => $game->white_player_rating ?? 1200
            ];
            $game->black_player = [
                'id' => $game->black_player_id,
                'name' => $game->black_player_name,
                'avatar' => $game->black_player_avatar,
                'rating' => $game->black_player_rating ?? 1200
            ];
        } elseif (!$game->game_mode || $game->game_mode === 'computer') {
            $game->opponent_name = $game->opponent_name ?: 'Computer';
            $game->opponent_avatar_url = $game->opponent_avatar_url ?: null;
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
