<?php

namespace App\Http\Controllers;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class LeaderboardController extends Controller
{
    /**
     * Public leaderboard endpoint.
     *
     * GET /api/leaderboard?period=7d
     *
     * Returns 4 categories: most_games, most_wins, highest_points, by_rating.
     * Period options: today, 7d, 30d, all (default: 7d).
     * Results are cached per period (today=2min, 7d=5min, 30d=10min, all=15min).
     */
    public function index(Request $request): JsonResponse
    {
        $period = $request->input('period', '7d');
        $validPeriods = ['today', '7d', '30d', 'all'];
        if (!in_array($period, $validPeriods)) {
            $period = '7d';
        }

        $cacheTtl = match ($period) {
            'today' => 120,    // 2 minutes
            '7d'    => 300,    // 5 minutes
            '30d'   => 600,    // 10 minutes
            default => 900,    // 15 minutes
        };

        $data = Cache::remember("leaderboard:{$period}", $cacheTtl, function () use ($period) {
            $periodStart = match ($period) {
                'today' => Carbon::today(),
                '7d'    => Carbon::now()->subDays(7),
                '30d'   => Carbon::now()->subDays(30),
                default => null,
            };

            $limit = 20;

            // 1. Most Games — multiplayer only (exclude computer games)
            $mostGamesQuery = DB::table('game_histories')
                ->select('user_id', DB::raw('COUNT(*) as value'))
                ->whereNotNull('user_id')
                ->where('game_mode', 'multiplayer');
            if ($periodStart) {
                $mostGamesQuery->where('played_at', '>=', $periodStart);
            }
            $mostGames = $mostGamesQuery
                ->groupBy('user_id')
                ->orderByDesc('value')
                ->limit($limit)
                ->get();

            // 2. Most Wins — multiplayer + synthetic games (exclude pure computer games)
            $mostWinsQuery = DB::table('games')
                ->select('winner_user_id as user_id', DB::raw('COUNT(*) as value'))
                ->whereNotNull('winner_user_id')
                ->where('status_id', 3)
                ->where(function ($q) {
                    // Include real multiplayer games (no computer) OR synthetic bot games
                    $q->whereNull('computer_player_id')
                      ->orWhereNotNull('synthetic_player_id');
                });
            if ($periodStart) {
                $mostWinsQuery->where('ended_at', '>=', $periodStart);
            }
            $mostWins = $mostWinsQuery
                ->groupBy('winner_user_id')
                ->orderByDesc('value')
                ->limit($limit)
                ->get();

            // 3. Highest Points — multiplayer only (exclude computer games)
            $highestPointsQuery = DB::table('game_histories')
                ->select('user_id', DB::raw('ROUND(SUM(final_score), 1) as value'))
                ->whereNotNull('user_id')
                ->where('game_mode', 'multiplayer');
            if ($periodStart) {
                $highestPointsQuery->where('played_at', '>=', $periodStart);
            }
            $highestPoints = $highestPointsQuery
                ->groupBy('user_id')
                ->orderByDesc('value')
                ->limit($limit)
                ->get();

            // 4. By Rating — from users, ordered by rating (no period filter, minimum 5 games)
            $byRating = DB::table('users')
                ->select('id as user_id', DB::raw('rating as value'))
                ->where('games_played', '>=', 5)
                ->orderByDesc('rating')
                ->limit($limit)
                ->get();

            // Collect all unique user IDs for hydration
            $allUserIds = collect()
                ->merge($mostGames->pluck('user_id'))
                ->merge($mostWins->pluck('user_id'))
                ->merge($highestPoints->pluck('user_id'))
                ->merge($byRating->pluck('user_id'))
                ->unique()
                ->values();

            // Batch hydrate user details
            $users = User::whereIn('id', $allUserIds)
                ->get(['id', 'name', 'avatar_url', 'rating'])
                ->keyBy('id');

            // Helper to build ranked entries
            $buildEntries = function ($rows) use ($users) {
                $entries = [];
                $rank = 1;
                foreach ($rows as $row) {
                    $user = $users->get($row->user_id);
                    if (!$user) continue;
                    $entries[] = [
                        'rank'       => $rank++,
                        'user_id'    => (int) $row->user_id,
                        'name'       => $user->name,
                        'avatar_url' => $user->avatar_url,
                        'rating'     => (int) $user->rating,
                        'value'      => is_numeric($row->value) ? (float) $row->value : 0,
                    ];
                }
                return $entries;
            };

            return [
                'most_games'     => $buildEntries($mostGames),
                'most_wins'      => $buildEntries($mostWins),
                'highest_points' => $buildEntries($highestPoints),
                'by_rating'      => $buildEntries($byRating),
                'period'         => $period,
            ];
        });

        return response()->json($data);
    }
}
