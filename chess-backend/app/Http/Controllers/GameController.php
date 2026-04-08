<?php

namespace App\Http\Controllers;

use App\Enums\SubscriptionTier;
use App\Events\GameEndedEvent;
use App\Models\Game;
use App\Models\GameHistory;
use App\Models\User;
use App\Models\ComputerPlayer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class GameController extends Controller
{
    public function create(Request $request)
    {
        $request->validate([
            'opponent_id' => 'required|exists:users,id'
        ]);

        $user = Auth::user();

        // Enforce max 3 pending games per user
        [$allowed, $count] = Game::canUserStartGame($user->id);
        if (!$allowed) {
            return response()->json([
                'error' => "You already have {$count} pending games. Please finish or resign existing games before starting a new one.",
                'pending_count' => $count,
            ], 429);
        }

        // Enforce daily game limit by tier: free=5, silver=15, gold=unlimited
        $tier = $user->getSubscriptionTierEnum();
        if (!$tier->isAtLeast(SubscriptionTier::GOLD)) {
            $dailyLimit = $tier->isAtLeast(SubscriptionTier::SILVER) ? 15 : 5;
            $todayCount = Game::dailyOnlineGameCountForUser($user->id);
            if ($todayCount >= $dailyLimit) {
                $tierName = $tier->isAtLeast(SubscriptionTier::SILVER) ? 'Silver' : 'Free';
                $upgradeMsg = $tier->isAtLeast(SubscriptionTier::SILVER)
                    ? "Silver plan allows {$dailyLimit} games per day. Upgrade to Gold for unlimited games."
                    : "Free plan allows {$dailyLimit} online games per day. Upgrade to Silver for more games.";
                return response()->json([
                    'error' => $upgradeMsg,
                    'daily_limit' => $dailyLimit,
                    'games_today' => $todayCount,
                    'upgrade_url' => '/pricing',
                ], 429);
            }
        }

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
            'increment' => 'sometimes|integer|min:0|max:60', // seconds per move
            'synthetic_player_id' => 'sometimes|nullable|integer|exists:synthetic_players,id',
            'game_mode' => 'sometimes|in:rated,casual',
        ]);

        $user = Auth::user();

        // Enforce max 3 pending games per user
        [$allowed, $count] = Game::canUserStartGame($user->id);
        if (!$allowed) {
            return response()->json([
                'error' => "You already have {$count} pending games. Please finish or resign existing games before starting a new one.",
                'pending_count' => $count,
            ], 429);
        }
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
            'synthetic_player_id' => $request->synthetic_player_id,
            'player_color' => $playerColor,
            'game_mode' => $request->synthetic_player_id ? 'casual' : ($request->game_mode ?? 'casual'),
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
            'syntheticPlayer',
            'statusRelation',
            'endReasonRelation'
        ]);

        // Prefer synthetic player identity over generic computer player
        $syntheticPlayer = $game->syntheticPlayer;
        $opponentData = $syntheticPlayer ? [
            'id' => $syntheticPlayer->id,
            'level' => $computerPlayer->level,
            'name' => $syntheticPlayer->name,
            'rating' => $syntheticPlayer->rating,
            'avatar' => $syntheticPlayer->avatar_url,
            'type' => 'synthetic',
        ] : [
            'id' => $computerPlayer->id,
            'level' => $computerPlayer->level,
            'name' => $computerPlayer->name,
            'rating' => $computerPlayer->rating,
            'avatar' => $computerPlayer->avatar,
            'type' => 'computer',
        ];

        return response()->json([
            'message' => 'Computer game created successfully',
            'game' => $game,
            'computer_opponent' => $opponentData
        ]);
    }

    public function show($id)
    {
        $game = Game::with(['whitePlayer', 'blackPlayer', 'computerPlayer', 'syntheticPlayer', 'statusRelation', 'endReasonRelation'])->find($id);

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
        $isComputerGame = $game->computer_player_id !== null;
        $playerColor = (int) $game->white_player_id === (int) $user->id ? 'white' : 'black';

        // Build player data (handles computer/synthetic opponents)
        $computerData = null;
        if ($isComputerGame && $game->syntheticPlayer) {
            $computerData = [
                'id' => 'synthetic_' . $game->syntheticPlayer->id,
                'name' => $game->syntheticPlayer->name,
                'email' => null,
                'avatar' => $game->syntheticPlayer->avatar_url,
                'rating' => $game->syntheticPlayer->rating,
                'is_provisional' => false
            ];
        } elseif ($isComputerGame && $game->computerPlayer) {
            $computerData = [
                'id' => 'computer_' . $game->computerPlayer->id,
                'name' => $game->computerPlayer->name,
                'email' => null,
                'avatar' => null,
                'rating' => $game->computerPlayer->rating,
                'is_provisional' => false
            ];
        }

        // Fallback for when neither syntheticPlayer nor computerPlayer relationships exist
        if (!$computerData && $game->computer_level) {
            $computerData = [
                'id' => 'computer_level_' . $game->computer_level,
                'name' => 'Computer Lv.' . $game->computer_level,
                'email' => null,
                'avatar' => null,
                'rating' => 800 + ($game->computer_level * 100),
                'is_provisional' => false
            ];
        }

        $whitePlayerData = $game->whitePlayer ? [
            'id' => $game->whitePlayer->id,
            'name' => $game->whitePlayer->name,
            'email' => $game->whitePlayer->email,
            'avatar' => $game->whitePlayer->avatar_url,
            'rating' => $game->whitePlayer->rating,
            'is_provisional' => $game->whitePlayer->is_provisional
        ] : ($computerData ?? ['id' => null, 'name' => 'Computer', 'email' => null, 'avatar' => null, 'rating' => null, 'is_provisional' => false]);

        $blackPlayerData = $game->blackPlayer ? [
            'id' => $game->blackPlayer->id,
            'name' => $game->blackPlayer->name,
            'email' => $game->blackPlayer->email,
            'avatar' => $game->blackPlayer->avatar_url,
            'rating' => $game->blackPlayer->rating,
            'is_provisional' => $game->blackPlayer->is_provisional
        ] : ($computerData ?? ['id' => null, 'name' => 'Computer', 'email' => null, 'avatar' => null, 'rating' => null, 'is_provisional' => false]);

        // Detect opening name from first few moves
        $openingName = $this->detectOpening($game->moves ?? []);

        $response = [
            ...$game->toArray(),
            'player_color' => $playerColor,
            'white_player' => $whitePlayerData,
            'black_player' => $blackPlayerData,
            'time_control' => [
                'minutes' => $game->time_control_minutes,
                'increment' => $game->increment_seconds,
            ],
            'opening_name' => $openingName,
            'move_count' => count($game->moves ?? []),
        ];

        return response()->json($response);
    }

    /**
     * Detect chess opening name from moves list
     * Returns null if no known opening is matched
     */
    private function detectOpening(array $moves): ?string
    {
        if (empty($moves)) {
            return null;
        }

        // Extract SAN notation from first few moves
        $sans = [];
        foreach (array_slice($moves, 0, 6) as $move) {
            $san = $move['san'] ?? $move['move'] ?? null;
            if ($san) {
                $sans[] = $san;
            }
        }

        if (empty($sans)) {
            return null;
        }

        $moveStr = implode(' ', $sans);

        // Common openings lookup (first moves → name), ordered longest prefix first
        $openings = [
            'e4 e5 Nf3 Nc6 Bb5' => 'Ruy López',
            'e4 e5 Nf3 Nc6 Bc4' => 'Italian Game',
            'e4 e5 Nf3 Nc6 d4' => 'Scotch Game',
            'e4 e5 Nf3 Nc6' => 'Four Knights / Open Game',
            'e4 e5 Nf3 Nf6' => 'Petrov\'s Defense',
            'd4 d5 c4 dxc4' => 'Queen\'s Gambit Accepted',
            'd4 d5 c4 e6' => 'Queen\'s Gambit Declined',
            'd4 Nf6 c4 g6' => 'King\'s Indian Defense',
            'd4 Nf6 c4 e6' => 'Nimzo-Indian Defense',
            'e4 e5 f4' => 'King\'s Gambit',
            'd4 d5 c4' => 'Queen\'s Gambit',
            'd4 d5 Bf4' => 'London System',
            'Nf3 d5 g3' => 'Réti Opening',
            'e4 c5' => 'Sicilian Defense',
            'e4 e6' => 'French Defense',
            'e4 c6' => 'Caro-Kann Defense',
            'e4 d5' => 'Scandinavian Defense',
            'e4 e5' => 'Open Game',
            'd4 d5' => 'Closed Game',
            'd4 Nf6' => 'Indian Defense',
            'c4' => 'English Opening',
        ];

        // Match against move string (longest prefixes checked first due to array order)
        foreach ($openings as $prefix => $name) {
            if (str_starts_with($moveStr, $prefix)) {
                return $name;
            }
        }

        return null;
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

    /**
     * Mark a computer/synthetic game as completed.
     *
     * POST /games/{id}/complete
     */
    public function completeGame(Request $request, $id)
    {
        $game = Game::find($id);

        if (!$game) {
            return response()->json(['error' => 'Game not found'], 404);
        }

        $user = Auth::user();
        $userColor = $game->getPlayerColor($user->id);

        if (!$userColor) {
            return response()->json(['error' => 'You are not a participant in this game'], 403);
        }

        // Only allow completing active games
        if ($game->status_id !== \App\Models\GameStatus::getIdByCode('active')) {
            return response()->json(['error' => 'Game is not active'], 422);
        }

        $request->validate([
            'result'     => 'required|in:1-0,0-1,1/2-1/2',
            'end_reason' => 'required|string',
            'move_count' => 'nullable|integer|min:0',
            'fen'        => 'nullable|string|max:200',
            'moves'      => 'nullable|string',
        ]);

        $result    = $request->input('result');
        $endReason = $request->input('end_reason');
        $moveCount = $request->input('move_count', 0);
        $fen       = $request->input('fen');
        $moves     = $request->input('moves');

        // Determine winner
        $winnerColor = null;
        $winnerId = null;
        if ($result === '1-0') {
            $winnerColor = 'white';
            $winnerId = $game->white_player_id;
        } elseif ($result === '0-1') {
            $winnerColor = 'black';
            $winnerId = $game->black_player_id;
        }

        $updateData = [
            'status'         => 'finished',
            'result'         => $result,
            'end_reason'     => $endReason,
            'winner_user_id' => $winnerId,
            'winner_player'  => $winnerColor,
            'move_count'     => $moveCount,
            'ended_at'       => now(),
        ];
        // Save final FEN and moves if provided by the client
        if ($fen)   $updateData['fen']   = $fen;
        if ($moves) $updateData['moves'] = $moves;

        $game->update($updateData);

        // For synthetic bot games, create game_history + optionally apply Elo (rated mode)
        if ($game->synthetic_player_id) {
            $this->createSyntheticGameHistory($game, $result, $winnerId, $endReason);

            // Apply Elo for rated synthetic games (server-side authority)
            if ($game->game_mode === 'rated') {
                $this->applyRatedSyntheticElo($game, $result, $user);
            }

            // Invalidate leaderboard caches
            Cache::forget('leaderboard:today');
            Cache::forget('leaderboard:7d');
            Cache::forget('leaderboard:30d');
            Cache::forget('leaderboard:all');
        }

        // Build response (include rating change if Elo was just applied)
        $ratingData = null;
        if ($game->synthetic_player_id && $game->game_mode === 'rated') {
            $rh = \DB::table('ratings_history')
                ->where('user_id', $user->id)
                ->where('game_id', $game->id)
                ->first();
            if ($rh) {
                $ratingData = [
                    'old_rating'    => $rh->old_rating,
                    'new_rating'    => $rh->new_rating,
                    'rating_change' => $rh->rating_change,
                    'result'        => $rh->result,
                ];
            }
        }

        return response()->json([
            'message'     => 'Game completed',
            'rating_data' => $ratingData,
            'game'    => $game,
        ]);
    }

    /**
     * Create game_history record for the human player in a synthetic bot game.
     */
    private function createSyntheticGameHistory(Game $game, string $result, ?int $winnerId, string $endReason): void
    {
        try {
            $humanPlayerId = $game->white_player_id ?: $game->black_player_id;
            if (!$humanPlayerId) return;

            // Skip if already exists
            if (GameHistory::where('user_id', $humanPlayerId)->where('game_id', $game->id)->exists()) {
                return;
            }

            $synth = $game->syntheticPlayer;
            $playerColor = $game->white_player_id === $humanPlayerId ? 'w' : 'b';
            $isWinner = $winnerId && (int) $humanPlayerId === (int) $winnerId;
            $status = !$winnerId ? 'draw' : ($isWinner ? 'won' : 'lost');

            GameHistory::create([
                'user_id' => $humanPlayerId,
                'game_id' => $game->id,
                'played_at' => $game->ended_at ?? now(),
                'player_color' => $playerColor,
                'computer_level' => 0,
                'moves' => null,
                'final_score' => $playerColor === 'w' ? ($game->white_player_score ?? 0) : ($game->black_player_score ?? 0),
                'opponent_score' => $playerColor === 'w' ? ($game->black_player_score ?? 0) : ($game->white_player_score ?? 0),
                'result' => json_encode([
                    'status' => $status,
                    'end_reason' => $endReason,
                    'details' => $isWinner ? "You won by {$endReason}!" : ($status === 'draw' ? "Game ended in a draw by {$endReason}" : "You lost by {$endReason}"),
                ]),
                'opponent_name' => $synth->name ?? 'Bot',
                'opponent_avatar_url' => $synth->avatar_url ?? null,
                'opponent_rating' => $synth->rating ?? null,
                'game_mode' => 'multiplayer',
            ]);

            Log::info('Created game_history for synthetic game', [
                'game_id' => $game->id,
                'user_id' => $humanPlayerId,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to create synthetic game history', [
                'game_id' => $game->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Apply server-side Elo for a rated human-vs-synthetic-bot game.
     * Idempotent: skips if ratings_history already has a record for this game.
     */
    private function applyRatedSyntheticElo(Game $game, string $result, $user): void
    {
        try {
            // Idempotency: skip if already recorded
            if (\DB::table('ratings_history')->where('user_id', $user->id)->where('game_id', $game->id)->exists()) {
                return;
            }

            $synth = \App\Models\SyntheticPlayer::find($game->synthetic_player_id);
            if (!$synth) return;

            $humanColor = $game->white_player_id === $user->id ? 'white' : 'black';
            $humanResult = match (true) {
                $result === '1/2-1/2'           => 'draw',
                $result === '1-0' && $humanColor === 'white' => 'win',
                $result === '0-1' && $humanColor === 'black' => 'win',
                default                          => 'loss',
            };

            $oldRating     = (int) $user->rating;
            $opponentRating = (int) $synth->rating;
            $actualScore   = match ($humanResult) { 'win' => 1.0, 'draw' => 0.5, default => 0.0 };
            $expectedScore = 1 / (1 + pow(10, ($opponentRating - $oldRating) / 400));
            $gamesPlayed   = (int) ($user->games_played ?? 0);
            $kFactor       = $this->syntheticEloKFactor($gamesPlayed, $oldRating);
            $ratingChange  = (int) round($kFactor * ($actualScore - $expectedScore));
            if ($humanResult === 'win')  $ratingChange = max(1,  $ratingChange);
            if ($humanResult === 'loss') $ratingChange = min(-1, $ratingChange);

            $newRating = max(400, min(3200, $oldRating + $ratingChange));

            $user->rating              = $newRating;
            $user->games_played        = $gamesPlayed + 1;
            $user->rating_last_updated = now();
            if ($newRating > ($user->peak_rating ?? 0)) $user->peak_rating = $newRating;
            if ($user->games_played >= 10) $user->is_provisional = false;
            $user->save();

            \DB::table('ratings_history')->insert([
                'user_id'         => $user->id,
                'old_rating'      => $oldRating,
                'new_rating'      => $newRating,
                'rating_change'   => $ratingChange,
                'opponent_id'     => null,
                'opponent_rating' => $opponentRating,
                'computer_level'  => $game->computer_level,
                'result'          => $humanResult,
                'game_type'       => 'computer',
                'k_factor'        => $kFactor,
                'expected_score'  => round($expectedScore, 4),
                'actual_score'    => $actualScore,
                'game_id'         => $game->id,
                'created_at'      => now(),
                'updated_at'      => now(),
            ]);

            \Log::info('[ELO] Rated synthetic game Elo applied', [
                'game_id' => $game->id, 'user_id' => $user->id,
                'result' => $humanResult, 'change' => $ratingChange,
                'old' => $oldRating, 'new' => $newRating,
            ]);
        } catch (\Throwable $e) {
            \Log::error('[ELO] Rated synthetic Elo failed', ['game_id' => $game->id, 'error' => $e->getMessage()]);
        }
    }

    private function syntheticEloKFactor(int $gamesPlayed, int $rating): int
    {
        if ($gamesPlayed < 10) return 40;
        if ($gamesPlayed < 30) return 32;
        if ($rating < 1400)    return 32;
        if ($rating < 2000)    return 24;
        return 20;
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
        $game->load(['whitePlayer', 'blackPlayer', 'computerPlayer', 'syntheticPlayer']);

        // Build player data, handling computer games where one side has no User
        $synth = $game->syntheticPlayer;
        $computerData = $isComputerGame && $synth ? [
            'id' => 'synthetic_' . $synth->id,
            'name' => $synth->name,
            'email' => null,
            'avatar' => $synth->avatar_url,
            'rating' => $synth->rating
        ] : ($isComputerGame && $game->computerPlayer ? [
            'id' => 'computer_' . $game->computerPlayer->id,
            'name' => $game->computerPlayer->name,
            'email' => null,
            'avatar' => null,
            'rating' => $game->computerPlayer->rating
        ] : ($game->computer_level ? [
            'id' => 'computer_level_' . $game->computer_level,
            'name' => 'Computer Lv.' . $game->computer_level,
            'email' => null,
            'avatar' => null,
            'rating' => 800 + ($game->computer_level * 100)
        ] : null));

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

    /**
     * Abandon a stale/paused game (no rating impact).
     * Allows a player to get rid of a game where the opponent disappeared.
     * Only works on paused or waiting games.
     */
    public function abandonGame($id)
    {
        $game = Game::find($id);

        if (!$game) {
            return response()->json(['error' => 'Game not found'], 404);
        }

        $user = Auth::user();

        // Must be a player in this game
        if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
            return response()->json(['error' => 'Not your game'], 403);
        }

        // Only allow abandoning paused or waiting games (not active games mid-play)
        if (!in_array($game->status, ['paused', 'waiting'])) {
            return response()->json([
                'error' => 'Only paused or waiting games can be abandoned',
                'current_status' => $game->status
            ], 422);
        }

        // Abort the game with no winner (fair to both sides)
        $game->update([
            'status' => 'aborted',
            'result' => '*',
            'end_reason' => 'abandoned_mutual',
            'ended_at' => now(),
            'resume_requested_by' => null,
            'resume_requested_at' => null,
            'resume_status' => 'none',
        ]);

        // Clean up related invitations
        \App\Models\Invitation::where('game_id', $game->id)
            ->whereIn('status', ['pending'])
            ->update(['status' => 'declined']);

        \Log::info('Game abandoned by player', [
            'game_id' => $game->id,
            'user_id' => $user->id,
            'move_count' => $game->move_count ?? 0,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Game abandoned successfully. No rating impact.',
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
        // NOTE: games.status does not exist as a DB column — status is stored as status_id
        // (FK to game_statuses). Use whereHas on the statusRelation instead of whereIn('status').
        if ($request->has('status')) {
            $status = $request->get('status');
            if ($status === 'finished') {
                // 'finished' captures all terminal games (checkmate, resign, draw, timeout, etc.)
                // 'aborted' covers killed/abandoned games
                $query->whereHas('statusRelation', function ($q) {
                    $q->whereIn('code', ['finished', 'aborted']);
                });
            } else {
                $query->whereHas('statusRelation', function ($q) use ($status) {
                    $q->where('code', $status);
                });
            }
        }

        // Date range filters (ISO 8601 format: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)
        if ($request->has('date_from')) {
            $query->where('created_at', '>=', $request->get('date_from'));
        }
        if ($request->has('date_to')) {
            $query->where('created_at', '<=', $request->get('date_to'));
        }

        // Opponent player filter
        if ($request->has('opponent_id')) {
            $opponentId = $request->get('opponent_id');
            $query->where(function ($q) use ($opponentId) {
                $q->where('white_player_id', $opponentId)
                  ->orWhere('black_player_id', $opponentId);
            });
        }

        $query->with(['whitePlayer', 'blackPlayer', 'computerPlayer', 'syntheticPlayer', 'statusRelation', 'endReasonRelation'])
            ->orderBy('last_move_at', 'desc')
            ->orderBy('created_at', 'desc');

        // Paginate (default 15 per page, max 100)
        $perPage = min((int) $request->get('per_page', 15), 100);
        $paginated = $query->paginate($perPage);

        // Transform each game in the paginated results
        $transformed = collect($paginated->items())->map(function($game) {
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

        return response()->json([
            'data' => $transformed,
            'pagination' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
                'has_more' => $paginated->hasMorePages(),
            ]
        ]);
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

        // Auto-abort this user's paused games older than 1 hour (instant cleanup on access)
        $pausedCutoff = now()->subHour();
        $abortedStatusId = GameStatus::getIdByCode('aborted');
        $pausedStatusId = GameStatus::where('code', 'paused')->value('id');

        if ($pausedStatusId && $abortedStatusId) {
            $staleGames = Game::where(function($q) use ($user) {
                $q->where('white_player_id', $user->id)->orWhere('black_player_id', $user->id);
            })
            ->where('status_id', $pausedStatusId)
            ->where(function($q) use ($pausedCutoff) {
                $q->where('paused_at', '<', $pausedCutoff)
                  ->orWhere(function($sub) use ($pausedCutoff) {
                      $sub->whereNull('paused_at')->where('updated_at', '<', $pausedCutoff);
                  });
            })
            ->get();

            foreach ($staleGames as $stale) {
                $stale->update([
                    'status_id' => $abortedStatusId,
                    'ended_at' => now(),
                    'result' => '*',
                ]);
                Log::info('Auto-aborted stale paused game on access', [
                    'game_id' => $stale->id,
                    'user_id' => $user->id,
                    'paused_at' => $stale->paused_at,
                ]);
            }
        }

        // Only return games paused within the last hour
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
        ->where(function($query) use ($pausedCutoff) {
            // Exclude games paused more than 1 hour ago (stale/expired)
            $query->where('paused_at', '>=', $pausedCutoff)
                  ->orWhere(function($q) use ($pausedCutoff) {
                      $q->whereNull('paused_at')
                        ->where('updated_at', '>=', $pausedCutoff);
                  });
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

        // Rated games cannot be paused - players must complete or resign
        if ($game->game_mode === 'rated') {
            return response()->json([
                'error' => 'Rated games cannot be paused. Players must complete the game or resign.',
            ], 403);
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

    /**
     * Get daily game quota for the current user.
     * Returns today's online game count and limit based on subscription tier.
     *
     * GET /api/games/daily-quota
     */
    public function dailyQuota()
    {
        $user = Auth::user();
        $tier = $user->getSubscriptionTierEnum();
        $todayCount = Game::dailyOnlineGameCountForUser($user->id);

        if ($tier->isAtLeast(SubscriptionTier::GOLD)) {
            return response()->json([
                'tier' => $tier->value,
                'unlimited' => true,
                'games_today' => $todayCount,
            ]);
        }

        $dailyLimit = $tier->isAtLeast(SubscriptionTier::SILVER) ? 15 : 5;

        return response()->json([
            'tier' => $tier->value,
            'unlimited' => false,
            'daily_limit' => $dailyLimit,
            'games_today' => $todayCount,
            'remaining' => max(0, $dailyLimit - $todayCount),
        ]);
    }
}