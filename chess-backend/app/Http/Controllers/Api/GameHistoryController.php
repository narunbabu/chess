
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GameHistory;
use App\Models\User;
use Illuminate\Http\Request;

class GameHistoryController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        
        $games = GameHistory::where('user_id', $user ? $user->id : null)
            ->orWhere('is_guest_game', true)
            ->orderBy('created_at', 'desc')
            ->paginate(10);

        return response()->json($games);
    }

    public function show($id)
    {
        $game = GameHistory::findOrFail($id);
        
        return response()->json($game);
    }

    public function showByToken($token)
    {
        $game = GameHistory::where('share_token', $token)->firstOrFail();
        
        return response()->json([
            'game' => $game,
            'user' => $game->user ? [
                'name' => $game->user->name,
                'total_games' => $game->user->total_games,
                'win_rate' => $game->user->win_rate
            ] : null
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'pgn' => 'required|string',
            'result' => 'required|in:win,loss,draw',
            'moves' => 'required|integer|min:1',
            'duration' => 'required|integer|min:1',
            'metadata' => 'nullable|array',
            'opponent_type' => 'required|in:stockfish,llm,human,guest',
            'opponent_name' => 'nullable|string',
            'difficulty_level' => 'required|integer|min:1|max:20',
            'credits_wagered' => 'integer|min:0',
            'is_guest_game' => 'boolean'
        ]);

        $user = $request->user();
        $isGuestGame = $validated['is_guest_game'] ?? false;

        // Calculate credit cost
        $creditCost = $this->calculateCreditCost($validated['opponent_type'], $validated['difficulty_level']);
        
        // For registered users, check and deduct credits
        if ($user && !$isGuestGame) {
            if ($user->credits < $creditCost) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Insufficient credits',
                    'required' => $creditCost,
                    'available' => $user->credits
                ], 400);
            }
        }

        $game = GameHistory::create([
            'user_id' => $user && !$isGuestGame ? $user->id : null,
            'pgn' => $validated['pgn'],
            'result' => $validated['result'],
            'moves' => $validated['moves'],
            'duration' => $validated['duration'],
            'metadata' => $validated['metadata'],
            'opponent_type' => $validated['opponent_type'],
            'opponent_name' => $validated['opponent_name'],
            'difficulty_level' => $validated['difficulty_level'],
            'credits_wagered' => $creditCost,
            'is_guest_game' => $isGuestGame
        ]);

        // Handle credits for registered users
        if ($user && !$isGuestGame) {
            // Deduct wager
            $user->deductCredits($creditCost, 'game_loss', 'Game vs ' . $validated['opponent_type'], $game->id);
            
            // Calculate winnings
            if ($validated['result'] === 'win') {
                $winnings = $this->calculateWinnings($creditCost, $validated['opponent_type']);
                $user->addCredits($winnings, 'game_win', 'Won game vs ' . $validated['opponent_type'], $game->id);
                $game->update(['credits_won' => $winnings]);
            }
            
            // Update user stats
            $user->updateGameStats($validated['result']);
        }

        return response()->json([
            'status' => 'success',
            'game' => $game,
            'credits_remaining' => $user ? $user->fresh()->credits : null
        ]);
    }

    public function generateShare(Request $request, $id)
    {
        $game = GameHistory::findOrFail($id);
        
        // This would generate actual GIF/video
        // For now, we'll just return the share URL
        $shareUrl = $game->share_url;
        
        return response()->json([
            'status' => 'success',
            'share_url' => $shareUrl,
            'share_token' => $game->share_token
        ]);
    }

    public function rankings()
    {
        $rankings = User::select(['id', 'name', 'total_games', 'wins', 'losses', 'draws', 'current_streak', 'best_streak'])
            ->where('total_games', '>', 0)
            ->orderByDesc('wins')
            ->orderByDesc('total_games')
            ->limit(100)
            ->get();

        $rankings->each(function ($user, $index) {
            $user->rank = $index + 1;
            $user->win_rate = $user->total_games > 0 ? round(($user->wins / $user->total_games) * 100, 1) : 0;
        });

        return response()->json($rankings);
    }

    private function calculateCreditCost($opponentType, $difficultyLevel)
    {
        switch ($opponentType) {
            case 'stockfish':
                return 1 + $difficultyLevel;
            case 'llm':
                return $difficultyLevel * 3; // Higher cost for LLM
            case 'human':
                return 5; // Fixed cost for PvP
            default:
                return 0; // Guest games are free
        }
    }

    private function calculateWinnings($wagered, $opponentType)
    {
        switch ($opponentType) {
            case 'stockfish':
                return intval($wagered * 1.5);
            case 'llm':
                return $wagered * 2;
            case 'human':
                return $wagered * 2;
            default:
                return 0;
        }
    }
}
