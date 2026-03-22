<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\GameEndReason;
use App\Models\GameStatus;
use App\Models\Organization;
use App\Models\ReferralCode;
use App\Models\ReferralEarning;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminDashboardController extends Controller
{
    /**
     * Full dashboard overview.
     *
     * GET /admin/dashboard/overview
     *
     * Query params:
     *   period   = today|7d|30d|all  (default: 30d)
     *   org_id   = <int>             (platform admins only; org admins auto-scoped)
     *   search   = <string>          (user table search)
     *   sort     = name|rating|games_played|last_activity_at (default: rating)
     *   order    = asc|desc          (default: desc)
     *   page     = <int>             (default: 1)
     *   per_page = <int>             (default: 20, max 100)
     */
    public function overview(Request $request): JsonResponse
    {
        $user = $request->user();
        $isPlatformAdmin = $user->email === 'ab@ameyem.com' || $user->hasRole('platform_admin');
        $isOrgAdmin = $user->hasRole('organization_admin');

        // Determine org scope
        $orgId = null;
        if ($isOrgAdmin && !$isPlatformAdmin) {
            $orgId = $user->organization_id;
        } elseif ($isPlatformAdmin && $request->filled('org_id')) {
            $orgId = (int) $request->input('org_id');
        }

        // Period
        $period = $request->input('period', '30d');
        $periodStart = match ($period) {
            'today' => Carbon::today(),
            '7d'    => Carbon::now()->subDays(7),
            '30d'   => Carbon::now()->subDays(30),
            default => null, // all time
        };

        // ----- 1. Overview cards -----
        $userQuery = User::query();
        $gameQuery = Game::query();
        if ($orgId) {
            $userQuery->where('organization_id', $orgId);
            $gameQuery->where(function ($q) use ($orgId) {
                $q->whereHas('whitePlayer', fn($u) => $u->where('organization_id', $orgId))
                  ->orWhereHas('blackPlayer', fn($u) => $u->where('organization_id', $orgId));
            });
        }

        $totalUsers = (clone $userQuery)->count();
        $activeToday = (clone $userQuery)->where('last_activity_at', '>=', Carbon::today())->count();
        $activeWeek  = (clone $userQuery)->where('last_activity_at', '>=', Carbon::now()->subDays(7))->count();
        $activeMonth = (clone $userQuery)->where('last_activity_at', '>=', Carbon::now()->subDays(30))->count();

        $finishedStatusId = GameStatus::getIdByCode('finished');

        $finishedGameQuery = (clone $gameQuery)->where('status_id', $finishedStatusId);
        if ($periodStart) {
            $finishedGameQuery->where('created_at', '>=', $periodStart);
        }
        $totalGames = $finishedGameQuery->count();

        // Estimate total hours: sum move_count (proxy: avg 30s/move)
        $totalMoves = (clone $finishedGameQuery)->sum('move_count');
        $totalHours = round(($totalMoves * 30) / 3600, 1);

        // New sign-ups in period
        $newUsersQuery = (clone $userQuery);
        if ($periodStart) {
            $newUsersQuery->where('created_at', '>=', $periodStart);
        }
        $newUsers = $newUsersQuery->count();

        $overviewCards = [
            'total_users'  => $totalUsers,
            'active_today' => $activeToday,
            'active_week'  => $activeWeek,
            'active_month' => $activeMonth,
            'total_games'  => $totalGames,
            'total_hours'  => $totalHours,
            'new_users'    => $newUsers,
        ];

        // ----- 2. Game stats by outcome -----
        $endReasons = GameEndReason::all()->keyBy('id');
        $outcomeQuery = Game::query()->where('status_id', $finishedStatusId);
        if ($orgId) {
            $outcomeQuery->where(function ($q) use ($orgId) {
                $q->whereHas('whitePlayer', fn($u) => $u->where('organization_id', $orgId))
                  ->orWhereHas('blackPlayer', fn($u) => $u->where('organization_id', $orgId));
            });
        }
        if ($periodStart) {
            $outcomeQuery->where('created_at', '>=', $periodStart);
        }

        $outcomeCounts = (clone $outcomeQuery)
            ->select('end_reason_id', DB::raw('COUNT(*) as count'))
            ->groupBy('end_reason_id')
            ->pluck('count', 'end_reason_id');

        $gamesByOutcome = [];
        foreach ($outcomeCounts as $reasonId => $count) {
            $reason = $endReasons->get($reasonId);
            $gamesByOutcome[] = [
                'code'  => $reason ? $reason->code : 'unknown',
                'label' => $reason ? $reason->label : 'Unknown',
                'count' => $count,
            ];
        }
        usort($gamesByOutcome, fn($a, $b) => $b['count'] <=> $a['count']);

        // ----- 3. Game stats by mode (rated vs casual vs computer) -----
        $modeQuery = Game::query()->where('status_id', $finishedStatusId);
        if ($orgId) {
            $modeQuery->where(function ($q) use ($orgId) {
                $q->whereHas('whitePlayer', fn($u) => $u->where('organization_id', $orgId))
                  ->orWhereHas('blackPlayer', fn($u) => $u->where('organization_id', $orgId));
            });
        }
        if ($periodStart) {
            $modeQuery->where('created_at', '>=', $periodStart);
        }

        // Computer games have a non-null computer_player_id or synthetic_player_id
        $computerGames = (clone $modeQuery)->where(function ($q) {
            $q->whereNotNull('computer_player_id')->orWhereNotNull('synthetic_player_id');
        })->count();

        $humanGames = (clone $modeQuery)->whereNull('computer_player_id')->whereNull('synthetic_player_id');
        $ratedGames   = (clone $humanGames)->where('game_mode', 'rated')->count();
        $casualGames  = (clone $humanGames)->where('game_mode', 'casual')->count();

        $gamesByMode = [
            ['mode' => 'rated',    'label' => 'Rated',    'count' => $ratedGames],
            ['mode' => 'casual',   'label' => 'Casual',   'count' => $casualGames],
            ['mode' => 'computer', 'label' => 'Computer', 'count' => $computerGames],
        ];

        // ----- 4. Game stats by time control -----
        $tcQuery = Game::query()->where('status_id', $finishedStatusId);
        if ($orgId) {
            $tcQuery->where(function ($q) use ($orgId) {
                $q->whereHas('whitePlayer', fn($u) => $u->where('organization_id', $orgId))
                  ->orWhereHas('blackPlayer', fn($u) => $u->where('organization_id', $orgId));
            });
        }
        if ($periodStart) {
            $tcQuery->where('created_at', '>=', $periodStart);
        }

        $tcCounts = $tcQuery
            ->select('time_control_minutes', DB::raw('COUNT(*) as count'))
            ->groupBy('time_control_minutes')
            ->orderByDesc('count')
            ->get();

        $gamesByTimeControl = $tcCounts->map(function ($row) {
            $mins = $row->time_control_minutes;
            $label = match (true) {
                $mins <= 2  => 'Bullet',
                $mins <= 5  => 'Blitz',
                $mins <= 15 => 'Rapid',
                default     => 'Classical',
            };
            return [
                'minutes'  => $mins,
                'label'    => $label . " ({$mins}m)",
                'count'    => $row->count,
            ];
        })->values();

        // ----- 5. Rating distribution -----
        $ratingQuery = User::query()->where('is_active', true);
        if ($orgId) {
            $ratingQuery->where('organization_id', $orgId);
        }

        $brackets = [
            ['min' => 0,    'max' => 800,  'label' => '0-800'],
            ['min' => 800,  'max' => 1000, 'label' => '800-1000'],
            ['min' => 1000, 'max' => 1200, 'label' => '1000-1200'],
            ['min' => 1200, 'max' => 1400, 'label' => '1200-1400'],
            ['min' => 1400, 'max' => 1600, 'label' => '1400-1600'],
            ['min' => 1600, 'max' => 1800, 'label' => '1600-1800'],
            ['min' => 1800, 'max' => 2000, 'label' => '1800-2000'],
            ['min' => 2000, 'max' => 9999, 'label' => '2000+'],
        ];

        $ratingDistribution = [];
        foreach ($brackets as $b) {
            $count = (clone $ratingQuery)
                ->where('rating', '>=', $b['min'])
                ->where('rating', '<', $b['max'])
                ->count();
            $ratingDistribution[] = [
                'label' => $b['label'],
                'count' => $count,
            ];
        }

        // ----- 6. Tutorial & Learning stats -----
        $tutorialProgressQuery = DB::table('user_tutorial_progress')
            ->join('users', 'users.id', '=', 'user_tutorial_progress.user_id');
        if ($orgId) {
            $tutorialProgressQuery->where('users.organization_id', $orgId);
        }

        $usersCompletedLessons = (clone $tutorialProgressQuery)
            ->where('user_tutorial_progress.status', 'completed')
            ->distinct('user_tutorial_progress.user_id')
            ->count('user_tutorial_progress.user_id');

        $totalLessonCompletions = (clone $tutorialProgressQuery)
            ->where('user_tutorial_progress.status', 'completed')
            ->count();

        $usersMasteredLessons = (clone $tutorialProgressQuery)
            ->where('user_tutorial_progress.status', 'mastered')
            ->distinct('user_tutorial_progress.user_id')
            ->count('user_tutorial_progress.user_id');

        $tutorialStats = [
            'users_completed_lessons' => $usersCompletedLessons,
            'total_lesson_completions' => $totalLessonCompletions,
            'users_mastered_lessons' => $usersMasteredLessons,
        ];

        // ----- 7. Joined this week -----
        $joinedThisWeek = (clone $userQuery)->where('created_at', '>=', Carbon::now()->subDays(7))->count();

        // ----- 8. Ambassador stats (platform admin only) -----
        $ambassadorStats = [];
        if ($isPlatformAdmin) {
            $ambassadorRoleId = DB::table('roles')->where('name', 'ambassador')->value('id');
            if ($ambassadorRoleId) {
                $ambassadorIds = DB::table('user_roles')
                    ->where('role_id', $ambassadorRoleId)
                    ->pluck('user_id');

                $ambassadors = User::whereIn('id', $ambassadorIds)
                    ->select('id', 'name', 'email', 'referral_code', 'organization_id')
                    ->get()
                    ->map(function ($amb) {
                        $referred = User::where('referred_by_user_id', $amb->id)->count();
                        $subscribedPaid = User::where('referred_by_user_id', $amb->id)
                            ->where('subscription_tier', '!=', 'free')
                            ->whereNotNull('subscription_tier')
                            ->count();
                        $activeThisWeek = User::where('referred_by_user_id', $amb->id)
                            ->where('last_activity_at', '>=', Carbon::now()->subDays(7))
                            ->count();
                        $earningsMonth = ReferralEarning::where('referrer_user_id', $amb->id)
                            ->where('created_at', '>=', Carbon::now()->startOfMonth())
                            ->sum('earning_amount');
                        $totalEarnings = ReferralEarning::where('referrer_user_id', $amb->id)
                            ->sum('earning_amount');

                        $tier = \App\Models\AmbassadorTier::getTierForCount($subscribedPaid);

                        return [
                            'id' => $amb->id,
                            'name' => $amb->name,
                            'email' => $amb->email,
                            'referral_code' => $amb->referral_code,
                            'referred_count' => $referred,
                            'subscribed_paid' => $subscribedPaid,
                            'active_this_week' => $activeThisWeek,
                            'earnings_this_month' => round($earningsMonth, 2),
                            'total_earnings' => round($totalEarnings, 2),
                            'tier_name' => $tier ? $tier->name : 'Starter',
                            'commission_rate' => $tier ? round($tier->commission_rate * 100) . '%' : '10%',
                        ];
                    });

                $ambassadorStats = $ambassadors;
            }
        }

        // ----- 9. Per-institute breakdown -----
        $instituteBreakdown = [];
        if ($isPlatformAdmin) {
            $orgAdminRoleId = DB::table('roles')->where('name', 'organization_admin')->value('id');

            $instituteBreakdown = Organization::select('id', 'name', 'contact_email', 'type', 'created_by')
                ->with('creator:id,name,email')
                ->withCount('users as total_members')
                ->withCount(['users as joined_this_week' => function ($q) {
                    $q->where('created_at', '>=', Carbon::now()->subDays(7));
                }])
                ->withCount(['users as active_this_week' => function ($q) {
                    $q->where('last_activity_at', '>=', Carbon::now()->subDays(7));
                }])
                ->withCount(['users as active_today' => function ($q) {
                    $q->where('last_activity_at', '>=', Carbon::today());
                }])
                ->get()
                ->map(function ($org) use ($orgAdminRoleId) {
                    // Find org admins for this org
                    $adminIds = $orgAdminRoleId
                        ? DB::table('user_roles')->where('role_id', $orgAdminRoleId)->pluck('user_id')
                        : collect();
                    $orgAdmins = User::where('organization_id', $org->id)
                        ->whereIn('id', $adminIds)
                        ->select('id', 'name', 'email', 'referral_code')
                        ->get();

                    // Referral stats: how many users joined via org admins' codes
                    $referredViaOrg = User::where('organization_id', $org->id)
                        ->whereNotNull('referred_by_user_id')
                        ->count();

                    // Subscription stats for org members
                    $paidMembers = User::where('organization_id', $org->id)
                        ->where('subscription_tier', '!=', 'free')
                        ->whereNotNull('subscription_tier')
                        ->count();

                    return [
                        'id' => $org->id,
                        'name' => $org->name,
                        'type' => $org->type,
                        'contact_email' => $org->contact_email,
                        'created_by' => $org->creator ? ['name' => $org->creator->name, 'email' => $org->creator->email] : null,
                        'admins' => $orgAdmins,
                        'total_members' => $org->total_members,
                        'joined_this_week' => $org->joined_this_week,
                        'active_this_week' => $org->active_this_week,
                        'active_today' => $org->active_today,
                        'referred_via_org' => $referredViaOrg,
                        'paid_members' => $paidMembers,
                    ];
                });
        }

        // ----- 10. Recent finished games (last 20) -----
        $recentQuery = Game::query()
            ->where('status_id', $finishedStatusId)
            ->with([
                'whitePlayer:id,name,rating',
                'blackPlayer:id,name,rating',
                'syntheticPlayer:id,name,rating',
                'computerPlayer:id,name,rating',
                'endReasonRelation:id,code,label',
            ]);
        if ($orgId) {
            $recentQuery->where(function ($q) use ($orgId) {
                $q->whereHas('whitePlayer', fn($u) => $u->where('organization_id', $orgId))
                  ->orWhereHas('blackPlayer', fn($u) => $u->where('organization_id', $orgId));
            });
        }
        $recentGames = $recentQuery
            ->orderByDesc('ended_at')
            ->limit(20)
            ->get()
            ->map(function ($game) {
                $duration = null;
                if ($game->ended_at && $game->created_at) {
                    $duration = Carbon::parse($game->created_at)->diffInMinutes(Carbon::parse($game->ended_at));
                }

                // For computer/synthetic games, fill in the missing side
                $synth = $game->syntheticPlayer;
                $comp  = $game->computerPlayer;
                $botData = $synth
                    ? ['id' => 'synthetic_' . $synth->id, 'name' => $synth->name, 'rating' => $synth->rating]
                    : ($comp
                        ? ['id' => 'computer_' . $comp->id, 'name' => $comp->name, 'rating' => $comp->rating]
                        : ($game->computer_level
                            ? ['id' => 'computer_level_' . $game->computer_level, 'name' => 'Computer Lv.' . $game->computer_level, 'rating' => 800 + ($game->computer_level * 100)]
                            : null));

                return [
                    'id'           => $game->id,
                    'white'        => $game->whitePlayer
                        ? ['id' => $game->whitePlayer->id, 'name' => $game->whitePlayer->name, 'rating' => $game->whitePlayer->rating]
                        : $botData,
                    'black'        => $game->blackPlayer
                        ? ['id' => $game->blackPlayer->id, 'name' => $game->blackPlayer->name, 'rating' => $game->blackPlayer->rating]
                        : $botData,
                    'result'       => $game->result,
                    'end_reason'   => $game->endReasonRelation ? $game->endReasonRelation->label : null,
                    'game_mode'    => $game->game_mode,
                    'time_control' => $game->time_control_minutes . '+' . ($game->increment_seconds ?? 0),
                    'move_count'   => $game->move_count,
                    'duration_min' => $duration,
                    'ended_at'     => $game->ended_at,
                ];
            });

        // ----- 7. Organizations list (platform admin only) -----
        $organizations = [];
        if ($isPlatformAdmin) {
            $organizations = Organization::select('id', 'name')
                ->withCount('users as player_count')
                ->withCount(['users as active_today_count' => function ($q) {
                    $q->where('last_activity_at', '>=', Carbon::today());
                }])
                ->withAvg('users as avg_rating', 'rating')
                ->get()
                ->map(fn($org) => [
                    'id'                 => $org->id,
                    'name'               => $org->name,
                    'player_count'       => $org->player_count,
                    'active_today_count' => $org->active_today_count,
                    'avg_rating'         => $org->avg_rating ? round((float) $org->avg_rating) : null,
                ]);
        }

        // ----- 8. Paginated user table -----
        $search  = $request->input('search', '');
        $sort    = $request->input('sort', 'rating');
        $order   = $request->input('order', 'desc');
        $perPage = min((int) $request->input('per_page', 20), 100);

        $allowedSorts = ['name', 'rating', 'games_played', 'last_activity_at', 'created_at'];
        if (!in_array($sort, $allowedSorts)) {
            $sort = 'rating';
        }
        if (!in_array($order, ['asc', 'desc'])) {
            $order = 'desc';
        }

        $usersQuery = User::select('id', 'name', 'email', 'rating', 'games_played', 'last_activity_at', 'created_at', 'organization_id', 'is_active');
        if ($orgId) {
            $usersQuery->where('organization_id', $orgId);
        }
        if ($search) {
            $usersQuery->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }
        $usersQuery->orderBy($sort, $order);
        $usersPaginated = $usersQuery->paginate($perPage);

        return response()->json([
            'overview'             => $overviewCards,
            'games_by_outcome'     => $gamesByOutcome,
            'games_by_mode'        => $gamesByMode,
            'games_by_time_control' => $gamesByTimeControl,
            'rating_distribution'  => $ratingDistribution,
            'tutorial_stats'       => $tutorialStats,
            'joined_this_week'     => $joinedThisWeek,
            'ambassador_stats'     => $ambassadorStats,
            'institute_breakdown'  => $instituteBreakdown,
            'recent_games'         => $recentGames,
            'organizations'        => $organizations,
            'users'                => [
                'data'         => $usersPaginated->items(),
                'current_page' => $usersPaginated->currentPage(),
                'last_page'    => $usersPaginated->lastPage(),
                'per_page'     => $usersPaginated->perPage(),
                'total'        => $usersPaginated->total(),
            ],
            'meta' => [
                'period'           => $period,
                'org_id'           => $orgId,
                'is_platform_admin' => $isPlatformAdmin,
            ],
        ]);
    }

    /**
     * Detailed stats for a single user.
     *
     * GET /admin/dashboard/user/{id}?period=30d
     */
    public function userDetail(Request $request, $id): JsonResponse
    {
        $target = User::find($id);
        if (!$target) {
            return response()->json(['error' => 'User not found'], 404);
        }

        $period = $request->input('period', '30d');
        $periodStart = match ($period) {
            'today' => Carbon::today(),
            '7d'    => Carbon::now()->subDays(7),
            '30d'   => Carbon::now()->subDays(30),
            default => null,
        };

        $finishedStatusId = \App\Models\GameStatus::getIdByCode('finished');
        $endReasons = \App\Models\GameEndReason::all()->keyBy('id');

        // --- Profile ---
        $profile = [
            'id'               => $target->id,
            'name'             => $target->name,
            'email'            => $target->email,
            'rating'           => $target->rating,
            'games_played'     => $target->games_played,
            'created_at'       => $target->created_at,
            'last_activity_at' => $target->last_activity_at,
            'subscription_tier' => $target->subscription_tier ?? 'free',
            'organization_id'  => $target->organization_id,
            'referral_code'    => $target->referral_code,
            'referred_by_user_id' => $target->referred_by_user_id,
        ];

        // --- Games query scoped to this user + period ---
        $userGameQuery = fn() => Game::where('status_id', $finishedStatusId)
            ->where(function ($q) use ($id) {
                $q->where('white_player_id', $id)->orWhere('black_player_id', $id);
            });

        $periodGameQuery = function () use ($userGameQuery, $periodStart) {
            $q = $userGameQuery();
            if ($periodStart) $q->where('created_at', '>=', $periodStart);
            return $q;
        };

        // --- Overview stats ---
        $totalGames = $periodGameQuery()->count();

        $wins = $periodGameQuery()->where('winner_user_id', $id)->count();
        $draws = $periodGameQuery()->where('result', '1/2-1/2')->count();
        $losses = $totalGames - $wins - $draws;

        $winRate = $totalGames > 0 ? round(($wins / $totalGames) * 100, 1) : 0;

        $totalMoves = $periodGameQuery()->sum('move_count');
        $avgMoves = $totalGames > 0 ? round($totalMoves / $totalGames) : 0;

        // Streak (last 10 games)
        $recentResults = $userGameQuery()->orderByDesc('ended_at')->limit(10)
            ->get(['winner_user_id', 'result'])->map(function ($g) use ($id) {
                if ($g->winner_user_id == $id) return 'W';
                if ($g->result === '1/2-1/2') return 'D';
                return 'L';
            })->toArray();

        $currentStreak = 0;
        $streakType = $recentResults[0] ?? null;
        foreach ($recentResults as $r) {
            if ($r === $streakType) $currentStreak++;
            else break;
        }

        $overview = [
            'total_games' => $totalGames,
            'wins'        => $wins,
            'losses'      => $losses,
            'draws'       => $draws,
            'win_rate'    => $winRate,
            'avg_moves'   => $avgMoves,
            'streak'      => ($streakType ? $currentStreak . $streakType : '0'),
            'recent_form' => array_slice($recentResults, 0, 10),
        ];

        // --- Games by outcome ---
        $outcomeCounts = $periodGameQuery()
            ->select('end_reason_id', DB::raw('COUNT(*) as count'))
            ->groupBy('end_reason_id')
            ->pluck('count', 'end_reason_id');

        $gamesByOutcome = [];
        foreach ($outcomeCounts as $reasonId => $count) {
            $reason = $endReasons->get($reasonId);
            $gamesByOutcome[] = [
                'code'  => $reason ? $reason->code : 'unknown',
                'label' => $reason ? $reason->label : 'Unknown',
                'count' => $count,
            ];
        }
        usort($gamesByOutcome, fn($a, $b) => $b['count'] <=> $a['count']);

        // --- Games by mode ---
        $computerGames = $periodGameQuery()->where(function ($q) {
            $q->whereNotNull('computer_player_id')->orWhereNotNull('synthetic_player_id');
        })->count();
        $humanGames = $periodGameQuery()->whereNull('computer_player_id')->whereNull('synthetic_player_id');
        $ratedGames = (clone $humanGames)->where('game_mode', 'rated')->count();
        $casualGames = (clone $humanGames)->where('game_mode', 'casual')->count();

        $gamesByMode = [
            ['mode' => 'rated',    'label' => 'Rated',    'count' => $ratedGames],
            ['mode' => 'casual',   'label' => 'Casual',   'count' => $casualGames],
            ['mode' => 'computer', 'label' => 'Computer', 'count' => $computerGames],
        ];

        // --- Games by time control ---
        $tcCounts = $periodGameQuery()
            ->select('time_control_minutes', DB::raw('COUNT(*) as count'))
            ->groupBy('time_control_minutes')
            ->orderByDesc('count')
            ->get();

        $gamesByTimeControl = $tcCounts->map(function ($row) {
            $mins = $row->time_control_minutes;
            $label = match (true) {
                $mins <= 2  => 'Bullet',
                $mins <= 5  => 'Blitz',
                $mins <= 15 => 'Rapid',
                default     => 'Classical',
            };
            return ['minutes' => $mins, 'label' => $label . " ({$mins}m)", 'count' => $row->count];
        })->values();

        // --- Recent games (last 15) ---
        $recentGames = $userGameQuery()
            ->with([
                'whitePlayer:id,name,rating',
                'blackPlayer:id,name,rating',
                'syntheticPlayer:id,name,rating',
                'computerPlayer:id,name,rating',
                'endReasonRelation:id,code,label',
            ])
            ->orderByDesc('ended_at')
            ->limit(15)
            ->get()
            ->map(function ($game) use ($id) {
                $synth = $game->syntheticPlayer;
                $comp  = $game->computerPlayer;
                $botData = $synth
                    ? ['id' => 'synthetic_' . $synth->id, 'name' => $synth->name, 'rating' => $synth->rating]
                    : ($comp
                        ? ['id' => 'computer_' . $comp->id, 'name' => $comp->name, 'rating' => $comp->rating]
                        : null);

                $userIsWhite = $game->white_player_id == $id;

                return [
                    'id'           => $game->id,
                    'white'        => $game->whitePlayer
                        ? ['name' => $game->whitePlayer->name, 'rating' => $game->whitePlayer->rating]
                        : $botData,
                    'black'        => $game->blackPlayer
                        ? ['name' => $game->blackPlayer->name, 'rating' => $game->blackPlayer->rating]
                        : $botData,
                    'result'       => $game->result,
                    'user_won'     => $game->winner_user_id == $id,
                    'user_color'   => $userIsWhite ? 'white' : 'black',
                    'end_reason'   => $game->endReasonRelation?->label,
                    'game_mode'    => $game->game_mode,
                    'move_count'   => $game->move_count,
                    'ended_at'     => $game->ended_at,
                ];
            });

        // --- Tutorial progress ---
        $tutorialProgress = DB::table('user_tutorial_progress')
            ->where('user_id', $id)
            ->count();
        $tutorialCompleted = DB::table('user_tutorial_progress')
            ->where('user_id', $id)
            ->where('status', 'completed')
            ->count();
        $tutorialMastered = DB::table('user_tutorial_progress')
            ->where('user_id', $id)
            ->where('status', 'mastered')
            ->count();

        return response()->json([
            'profile'              => $profile,
            'overview'             => $overview,
            'games_by_outcome'     => $gamesByOutcome,
            'games_by_mode'        => $gamesByMode,
            'games_by_time_control' => $gamesByTimeControl,
            'recent_games'         => $recentGames,
            'tutorial'             => [
                'started'   => $tutorialProgress,
                'completed' => $tutorialCompleted,
                'mastered'  => $tutorialMastered,
            ],
            'meta' => ['period' => $period],
        ]);
    }

    /**
     * List all organizations with player stats.
     *
     * GET /admin/dashboard/organizations
     */
    public function organizations(): JsonResponse
    {
        $today = Carbon::today();

        $organizations = Organization::select('id', 'name')
            ->withCount(['users as player_count'])
            ->withCount(['users as active_today_count' => function ($query) use ($today) {
                $query->where('last_activity_at', '>=', $today);
            }])
            ->withAvg('users as avg_rating', 'rating')
            ->get();

        $topRatedByOrg = DB::table('users')
            ->select('organization_id', 'name', 'rating')
            ->whereNotNull('organization_id')
            ->whereIn('organization_id', $organizations->pluck('id'))
            ->whereRaw('(organization_id, rating) IN (
                SELECT organization_id, MAX(rating)
                FROM users
                WHERE organization_id IS NOT NULL
                GROUP BY organization_id
            )')
            ->get()
            ->keyBy('organization_id');

        $data = $organizations->map(function ($org) use ($topRatedByOrg) {
            $top = $topRatedByOrg->get($org->id);

            return [
                'id' => $org->id,
                'name' => $org->name,
                'player_count' => $org->player_count,
                'active_today_count' => $org->active_today_count,
                'avg_rating' => $org->avg_rating ? round((float) $org->avg_rating) : null,
                'top_rated_player' => $top ? [
                    'name' => $top->name,
                    'rating' => $top->rating,
                ] : null,
            ];
        });

        return response()->json(['organizations' => $data]);
    }

    /**
     * List referral agents (users who have referral codes).
     *
     * GET /admin/dashboard/agents
     */
    public function agents(): JsonResponse
    {
        $today = Carbon::today()->toDateTimeString();

        $agents = DB::table('referral_codes')
            ->join('users', 'users.id', '=', 'referral_codes.user_id')
            ->leftJoin('users as referred', 'referred.referred_by_user_id', '=', 'users.id')
            ->leftJoin('referral_earnings', 'referral_earnings.referrer_user_id', '=', 'users.id')
            ->select(
                'users.id',
                'users.name',
                'users.email',
                'referral_codes.code as referral_code',
                DB::raw('COUNT(DISTINCT referred.id) as students_recruited'),
                DB::raw('COUNT(DISTINCT CASE WHEN referred.last_activity_at >= ? THEN referred.id END) as students_active_today'),
                DB::raw('COALESCE(SUM(DISTINCT referral_earnings.id) / SUM(DISTINCT referral_earnings.id) * SUM(referral_earnings.earning_amount), 0) as total_earnings')
            )
            ->where('referral_codes.is_active', true)
            ->groupBy('users.id', 'users.name', 'users.email', 'referral_codes.code')
            ->orderByDesc('students_recruited')
            ->setBindings([$today])
            ->get();

        return response()->json(['agents' => $agents]);
    }
}
