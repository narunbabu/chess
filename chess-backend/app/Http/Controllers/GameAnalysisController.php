<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\GameAnalysis;
use App\Services\MoveAnalysisService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class GameAnalysisController extends Controller
{
    private MoveAnalysisService $analysisService;

    public function __construct(MoveAnalysisService $analysisService)
    {
        $this->analysisService = $analysisService;
    }

    /**
     * POST /api/games/{id}/analyze
     *
     * Run Stockfish analysis on every move of a completed game.
     * Each move is classified as brilliant/excellent/good/inaccuracy/mistake/blunder
     * based on centipawn loss thresholds. Results are stored in game_analyses.
     */
    public function analyze(Request $request, int $id): JsonResponse
    {
        $user = Auth::user();
        $game = Game::find($id);

        if (!$game) {
            return response()->json(['error' => 'Game not found'], 404);
        }

        if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        if (!$game->isFinished()) {
            return response()->json(['error' => 'Can only analyze completed games'], 400);
        }

        $moves = $game->moves ?? [];
        if (empty($moves)) {
            return response()->json(['error' => 'No moves to analyze'], 400);
        }

        // Return cached result if already completed
        $existing = GameAnalysis::where('game_id', $id)->first();
        if ($existing && $existing->status === 'completed') {
            return response()->json([
                'message' => 'Analysis already exists',
                'analysis' => $existing,
            ]);
        }
        if ($existing && $existing->status === 'in_progress') {
            return response()->json([
                'message' => 'Analysis already in progress',
                'analysis' => $existing,
            ], 409);
        }

        // Create or reset the analysis record
        $analysis = $existing ?? GameAnalysis::create([
            'game_id' => $id,
            'status' => 'in_progress',
            'depth' => 18,
        ]);
        $analysis->update(['status' => 'in_progress']);

        try {
            $result = $this->runAnalysis($game, $moves);

            $analysis->update([
                'status' => 'completed',
                'move_analyses' => $result['moves'],
                'accuracy_white' => $result['accuracy_white'],
                'accuracy_black' => $result['accuracy_black'],
                'acpl_white' => $result['acpl_white'],
                'acpl_black' => $result['acpl_black'],
                'quality_counts' => $result['quality_counts'],
                'completed_at' => now(),
            ]);

            return response()->json([
                'message' => 'Analysis complete',
                'analysis' => $analysis->fresh(),
            ]);
        } catch (\Throwable $e) {
            Log::error('Game analysis failed', [
                'game_id' => $id,
                'error' => $e->getMessage(),
            ]);

            $analysis->update([
                'status' => 'failed',
                'error_message' => mb_substr($e->getMessage(), 0, 500),
            ]);

            return response()->json([
                'error' => 'Analysis failed',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Run Stockfish on every move and classify each.
     *
     * CP loss thresholds (from white's perspective, negated for black):
     *   brilliant  — sacrifice that improves eval, or only winning move
     *   excellent  — cp loss <= 10
     *   good       — cp loss <= 30
     *   inaccuracy — cp loss <= 70
     *   mistake    — cp loss <= 200
     *   blunder    — cp loss > 200
     */
    private function runAnalysis(Game $game, array $moves): array
    {
        $startFen = $game->fen
            ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

        // Rebuild positions: collect the FEN before each move
        // The moves array has fen_before/fen or just the starting fen
        $fenBefore = $startFen;
        $moveAnalyses = [];
        $whiteCpLosses = [];
        $blackCpLosses = [];
        $qualityCounts = [
            'white' => ['brilliant' => 0, 'excellent' => 0, 'good' => 0, 'inaccuracy' => 0, 'mistake' => 0, 'blunder' => 0],
            'black' => ['brilliant' => 0, 'excellent' => 0, 'good' => 0, 'inaccuracy' => 0, 'mistake' => 0, 'blunder' => 0],
        ];

        foreach ($moves as $index => $move) {
            $color = ($index % 2 === 0) ? 'white' : 'black';
            $moveNumber = (int) floor($index / 2) + 1;
            $san = $move['san'] ?? $move['move'] ?? '';

            // Use fen_before if available, otherwise use the tracked fen
            $positionFen = $move['fen_before'] ?? $fenBefore;

            // Evaluate position before the move
            $evalBefore = $this->analysisService->evaluatePosition($positionFen, 18);

            // Evaluate position after the move
            $fenAfter = $move['fen'] ?? null;
            if ($fenAfter) {
                $evalAfter = $this->analysisService->evaluatePosition($fenAfter, 18);
                $fenBefore = $fenAfter;
            } else {
                // Can't evaluate without the resulting FEN
                $evalAfter = $evalBefore;
            }

            // Calculate cp loss from the moving player's perspective
            $cpBefore = $evalBefore['score_cp'] ?? 0;
            $cpAfter = $evalAfter['score_cp'] ?? 0;

            // Stockfish returns cp from white's perspective.
            // For white: loss = cpBefore - cpAfter (positive = bad)
            // For black: loss = cpAfter - cpBefore (positive = bad, since negative cp = black advantage)
            $cpLoss = $color === 'white'
                ? ($cpBefore - $cpAfter)
                : ($cpAfter - $cpBefore);

            // Clamp: if position was already lost, don't penalize further
            if ($color === 'white' && $cpBefore < -500) {
                $cpLoss = max(0, $cpLoss);
            }
            if ($color === 'black' && $cpBefore > 500) {
                $cpLoss = max(0, $cpLoss);
            }

            // Get best move for comparison
            $bestMove = $evalBefore['best_move'] ?? null;
            $playedUci = ($move['from'] ?? '') . ($move['to'] ?? '');
            $promotion = $move['promotion'] ?? null;
            if ($promotion) {
                $playedUci .= $promotion;
            }

            $quality = $this->classifyMove(abs($cpLoss), $san, $bestMove, $playedUci, $cpBefore, $cpAfter, $color);

            $qualityCounts[$color][$quality]++;

            if ($color === 'white') {
                $whiteCpLosses[] = abs($cpLoss);
            } else {
                $blackCpLosses[] = abs($cpLoss);
            }

            $moveAnalyses[] = [
                'move_number' => $moveNumber,
                'color' => $color,
                'san' => $san,
                'from' => $move['from'] ?? '',
                'to' => $move['to'] ?? '',
                'fen_before' => $positionFen,
                'fen_after' => $fenAfter,
                'eval_before_cp' => $cpBefore,
                'eval_after_cp' => $cpAfter,
                'cp_loss' => $cpLoss,
                'best_move' => $bestMove,
                'classification' => $quality,
            ];
        }

        return [
            'moves' => $moveAnalyses,
            'accuracy_white' => $this->calculateAccuracy($whiteCpLosses),
            'accuracy_black' => $this->calculateAccuracy($blackCpLosses),
            'acpl_white' => $this->calculateAcpl($whiteCpLosses),
            'acpl_black' => $this->calculateAcpl($blackCpLosses),
            'quality_counts' => $qualityCounts,
        ];
    }

    /**
     * Classify a single move by absolute cp loss.
     */
    private function classifyMove(
        int $absCpLoss,
        string $san,
        ?string $bestMove,
        string $playedUci,
        int $cpBefore,
        int $cpAfter,
        string $color
    ): string {
        // Brilliant: sacrifice that improves eval significantly
        $improved = $color === 'white'
            ? ($cpAfter - $cpBefore > 100)
            : ($cpBefore - $cpAfter > 100);

        $isSacrifice = (str_contains($san, 'x') && preg_match('/[QRBN]/', $san))
            || (str_contains($san, '=') && str_contains($san, 'x'));

        if ($isSacrifice && $improved) {
            return 'brilliant';
        }

        // Played the best move
        if ($bestMove && $playedUci && $bestMove === $playedUci && $absCpLoss <= 10) {
            return 'brilliant';
        }

        // Standard thresholds
        if ($absCpLoss <= 10)  return 'excellent';
        if ($absCpLoss <= 30)  return 'good';
        if ($absCpLoss <= 70)  return 'inaccuracy';
        if ($absCpLoss <= 200) return 'mistake';
        return 'blunder';
    }

    /**
     * Accuracy: 100 - (average cp loss * 0.5), clamped 0-100.
     * A heuristic similar to chess.com's accuracy metric.
     */
    private function calculateAccuracy(array $cpLosses): float
    {
        if (empty($cpLosses)) {
            return 100.0;
        }
        $avg = array_sum($cpLosses) / count($cpLosses);
        return round(max(0, min(100, 100 - $avg * 0.5)), 1);
    }

    /**
     * Average centipawn loss.
     */
    private function calculateAcpl(array $cpLosses): float
    {
        if (empty($cpLosses)) {
            return 0.0;
        }
        return round(array_sum($cpLosses) / count($cpLosses), 1);
    }
}
