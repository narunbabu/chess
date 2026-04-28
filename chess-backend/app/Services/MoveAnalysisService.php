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
    private ?string $stockfishPath = null;

    public function __construct()
    {
        $this->stockfishPath = config('services.stockfish.path', env('STOCKFISH_PATH', 'stockfish'));
    }

    /**
     * Evaluate a position using Stockfish and return centipawn score.
     *
     * Uses a persistent process pipe (proc_open) to avoid cold-start overhead.
     *
     * @param string $fen    Position in FEN notation
     * @param int    $depth  Analysis depth (default 20)
     * @return array{score_cp: int|null, depth: int, best_move: string|null, fen: string, is_mate: bool, mate_in: int|null}
     */
    public function evaluatePosition(string $fen, int $depth = 20): array
    {
        Log::info('MoveAnalysisService: Evaluating position via Stockfish', [
            'fen' => $fen,
            'depth' => $depth,
        ]);

        try {
            return $this->runStockfish($fen, $depth, 1);
        } catch (\Throwable $e) {
            Log::error('MoveAnalysisService: Stockfish evaluation failed', [
                'fen' => $fen,
                'error' => $e->getMessage(),
            ]);

            return [
                'score_cp' => null,
                'depth' => 0,
                'best_move' => null,
                'fen' => $fen,
                'is_mate' => false,
                'mate_in' => null,
            ];
        }
    }

    /**
     * Run Stockfish analysis on a FEN position.
     *
     * @param string $fen
     * @param int    $depth
     * @param int    $multiPV  Number of principal variations (1-5)
     * @return array
     * @throws \RuntimeException if Stockfish binary is unavailable
     */
    private function runStockfish(string $fen, int $depth, int $multiPV = 1): array
    {
        $binary = $this->stockfishPath;

        if (empty($binary) || !$this->isBinaryAvailable($binary)) {
            throw new \RuntimeException("Stockfish binary not found at: {$binary}");
        }

        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];

        $process = proc_open($binary, $descriptors, $pipes);

        if (!is_resource($process)) {
            throw new \RuntimeException('Failed to start Stockfish process');
        }

        // Build UCI commands
        $commands = [
            'uci',
            'isready',
            "setoption name MultiPV value {$multiPV}",
            "position fen {$fen}",
            "go depth {$depth}",
        ];

        foreach ($commands as $cmd) {
            fwrite($pipes[0], $cmd . "\n");
        }
        fwrite($pipes[0], "quit\n");

        // Read output until process exits
        $output = stream_get_contents($pipes[1]);
        fclose($pipes[0]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        proc_close($process);

        // Parse the last "info depth ... pv ..." line
        return $this->parseStockfishOutput($output, $fen, $depth, $multiPV);
    }

    /**
     * Parse Stockfish stdout into structured result.
     */
    private function parseStockfishOutput(string $output, string $fen, int $requestedDepth, int $multiPV): array
    {
        $lines = explode("\n", trim($output));
        $lastInfo = null;
        $bestMove = null;
        $pvLines = [];

        foreach ($lines as $line) {
            $line = trim($line);
            if (str_starts_with($line, 'info depth')) {
                $lastInfo = $line;
            }
            if (str_starts_with($line, 'bestmove')) {
                $parts = explode(' ', $line);
                $bestMove = $parts[1] ?? null;
            }
        }

        $scoreCp = null;
        $isMate = false;
        $mateIn = null;
        $actualDepth = 0;

        if ($lastInfo) {
            // Extract score
            if (preg_match('/score cp (-?\d+)/', $lastInfo, $m)) {
                $scoreCp = (int) $m[1];
            }
            if (preg_match('/score mate (-?\d+)/', $lastInfo, $m)) {
                $isMate = true;
                $mateIn = (int) $m[1];
                // Convert mate to large centipawn value for consistent downstream use
                $scoreCp = $mateIn > 0 ? 100000 - abs($mateIn) : -100000 + abs($mateIn);
            }
            if (preg_match('/\bdepth (\d+)/', $lastInfo, $m)) {
                $actualDepth = (int) $m[1];
            }
        }

        return [
            'score_cp' => $scoreCp,
            'depth' => $actualDepth,
            'best_move' => $bestMove,
            'fen' => $fen,
            'is_mate' => $isMate,
            'mate_in' => $mateIn,
        ];
    }

    /**
     * Check if the Stockfish binary exists and is executable.
     */
    private function isBinaryAvailable(string $path): bool
    {
        // If it's a bare name like "stockfish", check if it's on PATH
        if (!str_contains($path, '/')) {
            $result = shell_exec('which ' . escapeshellarg($path) . ' 2>/dev/null');
            return !empty(trim((string) $result));
        }

        return file_exists($path) && is_executable($path);
    }

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
        // Check if we have cached evaluation
        $cached = DB::table('engine_evaluations')
            ->where('fen', $fen)
            ->first();

        if ($cached) {
            return (float) ($playerColor === 'white' ? $cached->eval_after : -$cached->eval_after);
        }

        // Try Stockfish evaluation
        try {
            $result = $this->evaluatePosition($fen, 18);
            if ($result['score_cp'] !== null) {
                $cp = $result['score_cp'];
                return $playerColor === 'white'
                    ? $cp / 100.0
                    : -$cp / 100.0;
            }
        } catch (\Throwable $e) {
            Log::warning('MoveAnalysisService: Stockfish unavailable, falling back to material balance', [
                'error' => $e->getMessage(),
            ]);
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
        try {
            $binary = $this->stockfishPath;
            if (empty($binary) || !$this->isBinaryAvailable($binary)) {
                return [];
            }

            $descriptors = [
                0 => ['pipe', 'r'],
                1 => ['pipe', 'w'],
                2 => ['pipe', 'w'],
            ];

            $process = proc_open($binary, $descriptors, $pipes);
            if (!is_resource($process)) {
                return [];
            }

            $commands = [
                'uci',
                'isready',
                "setoption name MultiPV value {$multiPV}",
                "position fen {$fen}",
                'go depth 18',
            ];
            foreach ($commands as $cmd) {
                fwrite($pipes[0], $cmd . "\n");
            }
            fwrite($pipes[0], "quit\n");

            $output = stream_get_contents($pipes[1]);
            fclose($pipes[0]);
            fclose($pipes[1]);
            fclose($pipes[2]);
            proc_close($process);

            return $this->parseMultiPVOutput($output, $multiPV);
        } catch (\Throwable $e) {
            Log::warning('MoveAnalysisService: Stockfish MultiPV failed', [
                'error' => $e->getMessage(),
            ]);
            return [];
        }
    }

    /**
     * Parse MultiPV output from Stockfish into top moves array.
     */
    private function parseMultiPVOutput(string $output, int $multiPV): array
    {
        $lines = explode("\n", trim($output));
        $pvData = [];

        foreach ($lines as $line) {
            if (!str_starts_with(trim($line), 'info depth')) {
                continue;
            }
            if (!preg_match('/multipv (\d+)/', $line, $pvMatch)) {
                continue;
            }
            $pvIndex = (int) $pvMatch[1];

            $score = null;
            if (preg_match('/score cp (-?\d+)/', $line, $m)) {
                $score = (int) $m[1];
            }
            if (preg_match('/score mate (-?\d+)/', $line, $m)) {
                $mateIn = (int) $m[1];
                $score = $mateIn > 0 ? 100000 - abs($mateIn) : -100000 + abs($mateIn);
            }

            $move = null;
            if (preg_match('/\bpv (\S+)/', $line, $m)) {
                $move = $m[1];
            }

            $depth = 0;
            if (preg_match('/\bdepth (\d+)/', $line, $m)) {
                $depth = (int) $m[1];
            }

            // Keep deepest entry per PV line
            if (!isset($pvData[$pvIndex]) || $depth > ($pvData[$pvIndex]['depth'] ?? 0)) {
                $pvData[$pvIndex] = [
                    'move' => $move,
                    'eval' => $score !== null ? $score / 100.0 : null,
                    'depth' => $depth,
                ];
            }
        }

        ksort($pvData);
        return array_values($pvData);
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
        Log::info('MoveAnalysisService: Analyzing position', [
            'fen' => $fen,
            'depth' => $depth,
        ]);

        try {
            $eval = $this->evaluatePosition($fen, $depth);
            $topMoves = $this->getBestMoves($fen, 3);

            return [
                'evaluation' => $eval['score_cp'] !== null ? $eval['score_cp'] / 100.0 : null,
                'best_move' => $eval['best_move'],
                'top_moves' => $topMoves,
                'depth' => $eval['depth'],
                'is_mate' => $eval['is_mate'],
                'mate_in' => $eval['mate_in'],
            ];
        } catch (\Throwable $e) {
            Log::warning('MoveAnalysisService: Stockfish unavailable for position analysis', [
                'error' => $e->getMessage(),
            ]);

            return [
                'evaluation' => 0.0,
                'best_move' => null,
                'top_moves' => [],
                'depth' => 0,
                'is_mate' => false,
                'mate_in' => null,
            ];
        }
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
