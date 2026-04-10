<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\GameStatus;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class UserProgressController extends Controller
{
    /**
     * Daily progress data for the authenticated user (charts).
     *
     * GET /user/progress?period=30d
     */
    public function progress(Request $request): JsonResponse
    {
        $id = $request->user()->id;

        $period = $request->input('period', '30d');
        $periodStart = match ($period) {
            'today' => Carbon::today(),
            '7d'    => Carbon::now()->subDays(7),
            '30d'   => Carbon::now()->subDays(30),
            default => null,
        };

        $finishedStatusId = GameStatus::getIdByCode('finished');

        // Rating progression (day-wise)
        $ratingProgression = DB::table('ratings_history')
            ->select(
                DB::raw('DATE(created_at) as date'),
                DB::raw('MAX(new_rating) as rating'),
                DB::raw('SUM(rating_change) as `change`'),
                DB::raw('COUNT(*) as games')
            )
            ->where('user_id', $id)
            ->when($periodStart, fn($q) => $q->where('created_at', '>=', $periodStart))
            ->groupBy(DB::raw('DATE(created_at)'))
            ->orderBy('date')
            ->get()
            ->map(fn($row) => [
                'date'   => $row->date,
                'rating' => (int) $row->rating,
                'change' => (int) $row->change,
                'games'  => (int) $row->games,
            ]);

        // Points earned per day
        $pointsPerDay = DB::table('ratings_history')
            ->select(
                DB::raw('DATE(created_at) as date'),
                DB::raw('SUM(CASE WHEN rating_change > 0 THEN rating_change ELSE 0 END) as points'),
                DB::raw('SUM(CASE WHEN rating_change < 0 THEN rating_change ELSE 0 END) as lost'),
                DB::raw('COUNT(*) as games')
            )
            ->where('user_id', $id)
            ->when($periodStart, fn($q) => $q->where('created_at', '>=', $periodStart))
            ->groupBy(DB::raw('DATE(created_at)'))
            ->orderBy('date')
            ->get()
            ->map(fn($row) => [
                'date'   => $row->date,
                'points' => (float) $row->points,
                'lost'   => (float) $row->lost,
                'games'  => (int) $row->games,
            ]);

        // Games per day with win/draw/loss breakdown
        $gamesPerDay = Game::query()
            ->select(
                DB::raw('DATE(ended_at) as date'),
                DB::raw('COUNT(*) as total'),
                DB::raw("SUM(CASE WHEN winner_user_id = {$id} THEN 1 ELSE 0 END) as wins"),
                DB::raw("SUM(CASE WHEN result = '1/2-1/2' THEN 1 ELSE 0 END) as draws")
            )
            ->where('status_id', $finishedStatusId)
            ->where(function ($q) use ($id) {
                $q->where('white_player_id', $id)->orWhere('black_player_id', $id);
            })
            ->when($periodStart, fn($q) => $q->where('ended_at', '>=', $periodStart))
            ->groupBy(DB::raw('DATE(ended_at)'))
            ->orderBy('date')
            ->get()
            ->map(fn($row) => [
                'date'   => $row->date,
                'total'  => (int) $row->total,
                'wins'   => (int) $row->wins,
                'draws'  => (int) $row->draws,
                'losses' => (int) $row->total - (int) $row->wins - (int) $row->draws,
            ]);

        return response()->json([
            'rating_progression' => $ratingProgression,
            'points_per_day'     => $pointsPerDay,
            'games_per_day'      => $gamesPerDay,
            'meta'               => ['period' => $period, 'user_id' => $id],
        ]);
    }
}
