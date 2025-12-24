<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Performance Controller
 *
 * Provides performance analytics and statistics:
 * - Game performance metrics
 * - Historical performance data
 * - User performance statistics
 * - Move quality analytics
 */
class PerformanceController extends Controller
{
    /**
     * Get performance data for a specific game
     *
     * GET /api/games/{gameId}/performance
     *
     * @param int $gameId
     * @return \Illuminate\Http\JsonResponse
     */
    public function getGamePerformance(int $gameId)
    {
        try {
            $user = Auth::user();
            $game = Game::find($gameId);

            if (!$game) {
                return response()->json(['error' => 'Game not found'], 404);
            }

            // Verify user is a player in this game
            if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }

            // Get performance data from database
            $performance = DB::table('game_performance')
                ->where('game_id', $gameId)
                ->where('user_id', $user->id)
                ->first();

            if (!$performance) {
                return response()->json([
                    'message' => 'Performance data not available yet',
                    'game_id' => $gameId
                ], 404);
            }

            return response()->json([
                'game_id' => $gameId,
                'performance' => [
                    'performance_score' => $performance->performance_score,
                    'performance_grade' => $performance->performance_grade,
                    'accuracy' => $performance->accuracy,
                    'acpl' => $performance->acpl,
                    'move_quality' => [
                        'brilliant' => $performance->brilliant_moves,
                        'excellent' => $performance->excellent_moves,
                        'good' => $performance->good_moves,
                        'inaccuracies' => $performance->inaccuracies,
                        'mistakes' => $performance->mistakes,
                        'blunders' => $performance->blunders
                    ],
                    'time_score' => $performance->time_score,
                    'feedback_message' => $performance->feedback_message,
                    'analyzed_at' => $performance->created_at
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Game performance fetch failed', [
                'game_id' => $gameId,
                'user_id' => Auth::id(),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to get game performance',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get performance history for the authenticated user
     *
     * GET /api/performance/history
     *
     * Query params:
     * - limit: number of recent games (default: 20)
     * - game_type: 'computer' or 'multiplayer' (optional)
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getPerformanceHistory(Request $request)
    {
        try {
            $user = Auth::user();
            $limit = $request->query('limit', 20);
            $gameType = $request->query('game_type'); // 'computer' or 'multiplayer'

            // Build query
            $query = DB::table('game_performance')
                ->join('games', 'game_performance.game_id', '=', 'games.id')
                ->where('game_performance.user_id', $user->id)
                ->select(
                    'game_performance.*',
                    'games.result',
                    'games.created_at as game_date',
                    'games.computer_level'
                )
                ->orderBy('game_performance.created_at', 'desc')
                ->limit($limit);

            // Filter by game type if specified
            if ($gameType === 'computer') {
                $query->whereNotNull('games.computer_player_id');
            } elseif ($gameType === 'multiplayer') {
                $query->whereNull('games.computer_player_id');
            }

            $performanceHistory = $query->get();

            // Calculate statistics
            $stats = $this->calculatePerformanceStats($performanceHistory);

            return response()->json([
                'performance_history' => $performanceHistory,
                'statistics' => $stats,
                'count' => count($performanceHistory)
            ]);

        } catch (\Exception $e) {
            Log::error('Performance history fetch failed', [
                'user_id' => Auth::id(),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to get performance history',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get performance statistics for the authenticated user
     *
     * GET /api/performance/stats
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getPerformanceStats(Request $request)
    {
        try {
            $user = Auth::user();

            // Get all performance data for the user
            $allPerformance = DB::table('game_performance')
                ->join('games', 'game_performance.game_id', '=', 'games.id')
                ->where('game_performance.user_id', $user->id)
                ->select('game_performance.*', 'games.computer_level')
                ->get();

            if ($allPerformance->isEmpty()) {
                return response()->json([
                    'message' => 'No performance data available',
                    'stats' => null
                ]);
            }

            // Calculate comprehensive statistics
            $stats = [
                'overall' => $this->calculatePerformanceStats($allPerformance),
                'by_game_type' => [
                    'computer' => $this->calculatePerformanceStats(
                        $allPerformance->where('computer_level', '!=', null)
                    ),
                    'multiplayer' => $this->calculatePerformanceStats(
                        $allPerformance->where('computer_level', '===', null)
                    )
                ],
                'trends' => $this->calculatePerformanceTrends($allPerformance),
                'move_quality_distribution' => $this->calculateMoveQualityDistribution($allPerformance)
            ];

            return response()->json([
                'user_id' => $user->id,
                'statistics' => $stats,
                'games_analyzed' => count($allPerformance)
            ]);

        } catch (\Exception $e) {
            Log::error('Performance stats fetch failed', [
                'user_id' => Auth::id(),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to get performance statistics',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get move analysis for a specific game
     *
     * GET /api/games/{gameId}/analysis
     *
     * @param int $gameId
     * @return \Illuminate\Http\JsonResponse
     */
    public function getGameAnalysis(int $gameId)
    {
        try {
            $user = Auth::user();
            $game = Game::find($gameId);

            if (!$game) {
                return response()->json(['error' => 'Game not found'], 404);
            }

            // Verify user is a player in this game
            if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }

            // Get player color
            $playerColor = $game->getPlayerColor($user->id);

            // Get move analysis from engine_evaluations table
            $moveAnalysis = DB::table('engine_evaluations')
                ->where('game_id', $gameId)
                ->where('player_color', $playerColor)
                ->orderBy('move_number', 'asc')
                ->get();

            if ($moveAnalysis->isEmpty()) {
                return response()->json([
                    'message' => 'Move analysis not available yet',
                    'game_id' => $gameId
                ], 404);
            }

            return response()->json([
                'game_id' => $gameId,
                'player_color' => $playerColor,
                'moves' => $moveAnalysis,
                'move_count' => count($moveAnalysis)
            ]);

        } catch (\Exception $e) {
            Log::error('Game analysis fetch failed', [
                'game_id' => $gameId,
                'user_id' => Auth::id(),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'error' => 'Failed to get game analysis',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Calculate performance statistics from performance data
     *
     * @param mixed $performanceData Collection of performance records
     * @return array Statistics
     */
    private function calculatePerformanceStats($performanceData): array
    {
        if (empty($performanceData) || count($performanceData) === 0) {
            return [
                'average_performance_score' => 0,
                'average_accuracy' => 0,
                'average_acpl' => 0,
                'best_performance' => 0,
                'worst_performance' => 0,
                'grade_distribution' => []
            ];
        }

        $performanceScores = [];
        $accuracies = [];
        $acpls = [];
        $grades = [];

        foreach ($performanceData as $perf) {
            $performanceScores[] = $perf->performance_score;
            $accuracies[] = $perf->accuracy;
            $acpls[] = $perf->acpl;
            $grades[] = $perf->performance_grade;
        }

        return [
            'average_performance_score' => round(array_sum($performanceScores) / count($performanceScores), 2),
            'average_accuracy' => round(array_sum($accuracies) / count($accuracies), 2),
            'average_acpl' => round(array_sum($acpls) / count($acpls), 2),
            'best_performance' => max($performanceScores),
            'worst_performance' => min($performanceScores),
            'grade_distribution' => array_count_values($grades)
        ];
    }

    /**
     * Calculate performance trends over time
     *
     * @param mixed $performanceData Collection of performance records
     * @return array Trend data
     */
    private function calculatePerformanceTrends($performanceData): array
    {
        if (count($performanceData) < 2) {
            return [
                'improving' => null,
                'recent_average' => null,
                'overall_average' => null
            ];
        }

        $recent = $performanceData->take(5);
        $overall = $performanceData;

        $recentAvg = $recent->avg('performance_score');
        $overallAvg = $overall->avg('performance_score');

        return [
            'improving' => $recentAvg > $overallAvg,
            'recent_average' => round($recentAvg, 2),
            'overall_average' => round($overallAvg, 2),
            'difference' => round($recentAvg - $overallAvg, 2)
        ];
    }

    /**
     * Calculate move quality distribution
     *
     * @param mixed $performanceData Collection of performance records
     * @return array Distribution data
     */
    private function calculateMoveQualityDistribution($performanceData): array
    {
        $totalBrilliant = $performanceData->sum('brilliant_moves');
        $totalExcellent = $performanceData->sum('excellent_moves');
        $totalGood = $performanceData->sum('good_moves');
        $totalInaccuracies = $performanceData->sum('inaccuracies');
        $totalMistakes = $performanceData->sum('mistakes');
        $totalBlunders = $performanceData->sum('blunders');

        $totalMoves = $totalBrilliant + $totalExcellent + $totalGood +
                      $totalInaccuracies + $totalMistakes + $totalBlunders;

        if ($totalMoves === 0) {
            return [];
        }

        return [
            'brilliant' => [
                'count' => $totalBrilliant,
                'percentage' => round(($totalBrilliant / $totalMoves) * 100, 2)
            ],
            'excellent' => [
                'count' => $totalExcellent,
                'percentage' => round(($totalExcellent / $totalMoves) * 100, 2)
            ],
            'good' => [
                'count' => $totalGood,
                'percentage' => round(($totalGood / $totalMoves) * 100, 2)
            ],
            'inaccuracies' => [
                'count' => $totalInaccuracies,
                'percentage' => round(($totalInaccuracies / $totalMoves) * 100, 2)
            ],
            'mistakes' => [
                'count' => $totalMistakes,
                'percentage' => round(($totalMistakes / $totalMoves) * 100, 2)
            ],
            'blunders' => [
                'count' => $totalBlunders,
                'percentage' => round(($totalBlunders / $totalMoves) * 100, 2)
            ]
        ];
    }
}
