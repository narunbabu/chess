<?php

namespace App\Services;

use App\Models\Game;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

/**
 * Move Analysis Service
 *
 * Analyzes chess moves using engine evaluation:
 * - Classifies moves as brilliant/excellent/good/inaccuracy/mistake/blunder
 * - Calculates evaluation changes (centipawns)
 * - Stores analysis in engine_evaluations table
 * - Supports MultiPV (top 3 moves) for finding best alternatives
 *
 * Move Quality Classification:
 * - Brilliant: Finding the only winning move or a significantly better move
 * - Excellent: Within 0.1 pawns of best move
 * - Good: Within 0.3 pawns of best move
 * - Inaccuracy: Evaluation drop 0.3-0.7 pawns
 * - Mistake: Evaluation drop 0.7-2.0 pawns
 * - Blunder: Evaluation drop > 2.0 pawns
 */
class MoveAnalysisService
{
    /**
     * Analyze all moves in a completed game
     *
     * @param Game $game The completed game
     * @return array Analysis results
     */
    public function analyzeGameMoves(Game $game): array
    {
        Log::info('MoveAnalysisService: Analyzing game moves', [
            'game_id' => $game->id,
            'move_count' => count($game->moves ?? [])
        ]);

        $moves = $game->moves ?? [];
        $analysisResults = [];

        // Analyze each move
        foreach ($moves as $index => $move) {
            $moveNumber = floor($index / 2) + 1;
            $playerColor = ($index % 2 === 0) ? 'white' : 'black';

            // Get position evaluation before and after the move
            $evalBefore = $this->getPositionEvaluation($game->fen, $playerColor, $moveNumber - 1);
            $evalAfter = $this->getPositionEvaluation($move['fen'] ?? $game->fen, $playerColor, $moveNumber);

            // Get best move alternatives using MultiPV
            $bestMoves = $this->getBestMoves($move['fen_before'] ?? $game->fen, 3);

            // Classify move quality
            $moveQuality = $this->classifyMoveQuality(
                $evalBefore,
                $evalAfter,
                $move['san'] ?? '',
                $bestMoves
            );

            // Store evaluation in database
            $evaluation = $this->storeEvaluation(
                $game->id,
                $moveNumber,
                $playerColor,
                $move['san'] ?? '',
                $move['from'] ?? '',
                $move['to'] ?? '',
                $evalBefore,
                $evalAfter,
                $bestMoves[0] ?? null,
                $moveQuality,
                $bestMoves
            );

            $analysisResults[] = $evaluation;
        }

        Log::info('MoveAnalysisService: Game analysis complete', [
            'game_id' => $game->id,
            'moves_analyzed' => count($analysisResults)
        ]);

        return $analysisResults;
    }

    /**
     * Get position evaluation using engine (or fallback to material)
     *
     * @param string $fen Position FEN
     * @param string $playerColor Player to evaluate for
     * @param int $moveNumber Move number
     * @return float Evaluation in pawns (positive = advantage for player)
     */
    private function getPositionEvaluation(string $fen, string $playerColor, int $moveNumber): float
    {
        // TODO: Integrate with Stockfish engine for actual evaluation
        // For now, use material balance as fallback

        // Check if we have cached evaluation
        $cached = DB::table('engine_evaluations')
            ->where('fen', $fen)
            ->first();

        if ($cached) {
            return (float) ($playerColor === 'white' ? $cached->eval_after : -$cached->eval_after);
        }

        // Fallback to material balance
        return $this->calculateMaterialBalance($fen, $playerColor);
    }

    /**
     * Calculate material balance from FEN
     *
     * @param string $fen Position FEN
     * @param string $playerColor Player color
     * @return float Material balance in pawns
     */
    private function calculateMaterialBalance(string $fen, string $playerColor): float
    {
        $fenParts = explode(' ', $fen);
        $boardPosition = $fenParts[0] ?? '';

        $pieceValues = [
            'Q' => 9, 'R' => 5, 'B' => 3, 'N' => 3, 'P' => 1,
            'q' => -9, 'r' => -5, 'b' => -3, 'n' => -3, 'p' => -1
        ];

        $balance = 0;
        for ($i = 0; $i < strlen($boardPosition); $i++) {
            $piece = $boardPosition[$i];
            if (isset($pieceValues[$piece])) {
                $balance += $pieceValues[$piece];
            }
        }

        // Normalize for player color
        return $playerColor === 'black' ? -$balance : $balance;
    }

    /**
     * Get best moves using MultiPV analysis
     *
     * @param string $fen Position FEN
     * @param int $multiPV Number of best moves to find
     * @return array Top moves with evaluations
     */
    private function getBestMoves(string $fen, int $multiPV = 3): array
    {
        // TODO: Integrate with Stockfish MultiPV analysis
        // For now, return empty array (will be populated when engine is integrated)

        return [
            // Example structure when engine is integrated:
            // [
            //     'move' => 'Nf6',
            //     'eval' => 0.5,
            //     'depth' => 20
            // ]
        ];
    }

    /**
     * Classify move quality based on evaluation change
     *
     * @param float $evalBefore Evaluation before move
     * @param float $evalAfter Evaluation after move
     * @param string $moveSan Move in algebraic notation
     * @param array $bestMoves Best move alternatives
     * @return string Move quality classification
     */
    private function classifyMoveQuality(
        float $evalBefore,
        float $evalAfter,
        string $moveSan,
        array $bestMoves
    ): string {
        // Calculate evaluation loss (positive = loss of advantage)
        $evalLoss = $evalBefore - $evalAfter;

        // Check if move is brilliant (finding only winning move or significantly better)
        if ($this->isBrilliantMove($evalBefore, $evalAfter, $moveSan, $bestMoves)) {
            return 'brilliant';
        }

        // Classify based on evaluation loss
        if ($evalLoss <= 0.1) {
            return 'excellent';
        } elseif ($evalLoss <= 0.3) {
            return 'good';
        } elseif ($evalLoss <= 0.7) {
            return 'inaccuracy';
        } elseif ($evalLoss <= 2.0) {
            return 'mistake';
        } else {
            return 'blunder';
        }
    }

    /**
     * Check if move is brilliant
     *
     * @param float $evalBefore Evaluation before
     * @param float $evalAfter Evaluation after
     * @param string $moveSan Move SAN
     * @param array $bestMoves Best alternatives
     * @return bool True if brilliant
     */
    private function isBrilliantMove(
        float $evalBefore,
        float $evalAfter,
        string $moveSan,
        array $bestMoves
    ): bool {
        // Check for sacrifices that improve position
        $isSacrifice = strpos($moveSan, 'x') !== false &&
                       preg_match('/[QRB]/', $moveSan);

        if ($isSacrifice && $evalAfter > $evalBefore + 1.0) {
            return true;
        }

        // Check if this is significantly better than second-best move
        if (count($bestMoves) >= 2) {
            $bestMoveEval = $bestMoves[0]['eval'] ?? 0;
            $secondBestEval = $bestMoves[1]['eval'] ?? 0;

            if (($bestMoveEval - $secondBestEval) > 1.5) {
                return true;
            }
        }

        return false;
    }

    /**
     * Store move evaluation in database
     *
     * @param int $gameId Game ID
     * @param int $moveNumber Move number
     * @param string $playerColor Player color
     * @param string $moveSan Move in SAN
     * @param string $fromSquare From square
     * @param string $toSquare To square
     * @param float $evalBefore Evaluation before
     * @param float $evalAfter Evaluation after
     * @param array|null $bestMove Best move
     * @param string $quality Move quality
     * @param array $topMoves Top 3 moves
     * @return array Stored evaluation data
     */
    private function storeEvaluation(
        int $gameId,
        int $moveNumber,
        string $playerColor,
        string $moveSan,
        string $fromSquare,
        string $toSquare,
        float $evalBefore,
        float $evalAfter,
        ?array $bestMove,
        string $quality,
        array $topMoves
    ): array {
        $evaluationData = [
            'game_id' => $gameId,
            'move_number' => $moveNumber,
            'player_color' => $playerColor,
            'move_san' => $moveSan,
            'from_square' => $fromSquare,
            'to_square' => $toSquare,
            'eval_before' => $evalBefore,
            'eval_after' => $evalAfter,
            'best_move' => $bestMove['move'] ?? null,
            'best_move_eval' => $bestMove['eval'] ?? null,
            'move_quality' => $quality,
            'top_moves' => json_encode($topMoves),
            'analysis_depth' => $bestMove['depth'] ?? null,
            'created_at' => now(),
            'updated_at' => now()
        ];

        DB::table('engine_evaluations')->insert($evaluationData);

        Log::debug('MoveAnalysisService: Evaluation stored', [
            'game_id' => $gameId,
            'move_number' => $moveNumber,
            'quality' => $quality
        ]);

        return $evaluationData;
    }

    /**
     * Get move analysis for a specific position
     *
     * @param string $fen Position FEN
     * @param int $depth Analysis depth
     * @return array Analysis result
     */
    public function analyzePosition(string $fen, int $depth = 20): array
    {
        // TODO: Integrate with Stockfish engine
        // This will be called from frontend to get real-time analysis

        Log::info('MoveAnalysisService: Analyzing position', [
            'fen' => $fen,
            'depth' => $depth
        ]);

        // Placeholder for engine integration
        return [
            'evaluation' => 0.0,
            'best_move' => null,
            'top_moves' => [],
            'depth' => $depth
        ];
    }

    /**
     * Get cached analysis for a game
     *
     * @param int $gameId Game ID
     * @return array Cached analysis
     */
    public function getCachedAnalysis(int $gameId): array
    {
        $evaluations = DB::table('engine_evaluations')
            ->where('game_id', $gameId)
            ->orderBy('move_number', 'asc')
            ->get()
            ->toArray();

        return array_map(function ($eval) {
            return (array) $eval;
        }, $evaluations);
    }

    /**
     * Clear cached analysis for a game
     *
     * @param int $gameId Game ID
     * @return void
     */
    public function clearCachedAnalysis(int $gameId): void
    {
        DB::table('engine_evaluations')
            ->where('game_id', $gameId)
            ->delete();

        Log::info('MoveAnalysisService: Cached analysis cleared', [
            'game_id' => $gameId
        ]);
    }
}
