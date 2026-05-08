<?php

namespace App\Http\Controllers;

use App\Models\AmbassadorApplication;
use App\Models\PayoutRequest;
use App\Models\ReferralCode;
use App\Models\ReferralEarning;
use App\Models\User;
use App\Services\ReferralService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AmbassadorController extends Controller
{
    public function __construct(
        protected ReferralService $referralService
    ) {}

    /**
     * GET /ambassador/dashboard
     * Ambassador's own stats: referrals + per-user activity (mini-tutor view),
     * milestone earnings, year-by-year subscription earnings, share links.
     */
    public function dashboard(Request $request): JsonResponse
    {
        $user = $request->user();

        // ── Referred users with activity counts (mini-tutor view) ────────
        // Pull tactical_solved counts in one query keyed by user_id.
        $referredUsers = User::where('referred_by_user_id', $user->id)
            ->select(
                'id', 'name', 'avatar_url', 'created_at', 'subscription_tier',
                'subscription_started_at', 'last_activity_at', 'organization_id',
                'games_played', 'mobile_country_code', 'mobile_number'
            )
            ->orderByDesc('created_at')
            ->get();

        $referredIds = $referredUsers->pluck('id');

        $tacticalByUser = DB::table('user_tactical_stats')
            ->whereIn('user_id', $referredIds)
            ->pluck('total_solved', 'user_id');

        // Milestone earnings keyed by referred_user → event_type
        $milestonesByUser = ReferralEarning::where('referrer_user_id', $user->id)
            ->whereIn('event_type', ['signup_phone', 'first_activity', 'activity_100'])
            ->get()
            ->groupBy('referred_user_id');

        // Subscription earnings grouped by year for the headline split
        $earningsByYear = ReferralEarning::where('referrer_user_id', $user->id)
            ->where('event_type', 'subscription')
            ->whereNotNull('subscription_year')
            ->select('subscription_year', DB::raw('SUM(earning_amount) as total'), DB::raw('COUNT(*) as count'))
            ->groupBy('subscription_year')
            ->orderBy('subscription_year')
            ->get()
            ->keyBy('subscription_year');

        $referredEnriched = $referredUsers->map(function ($u) use ($tacticalByUser, $milestonesByUser) {
            $puzzlesSolved = (int) ($tacticalByUser[$u->id] ?? 0);
            $games = (int) ($u->games_played ?? 0);
            $combined = $games + $puzzlesSolved;

            $userMilestones = $milestonesByUser->get($u->id, collect());
            $earnedTypes = $userMilestones->pluck('event_type')->all();

            $hasPhone = !empty($u->mobile_country_code) && !empty($u->mobile_number);

            // Current subscription year + rate (only if they're a paid subscriber)
            $subYear = null;
            $subRate = null;
            if ($u->subscription_tier && $u->subscription_tier !== 'free' && $u->subscription_started_at) {
                $daysSince = max(0, Carbon::parse($u->subscription_started_at)->diffInDays(now()));
                $subYear = (int) floor($daysSince / 365) + 1;
                $subRate = $this->referralService->rateForSubscriptionYear($subYear);
            }

            return [
                'id' => $u->id,
                'name' => $u->name,
                'avatar_url' => $u->avatar_url,
                'joined_at' => $u->created_at,
                'subscription_tier' => $u->subscription_tier,
                'subscription_year' => $subYear,
                'subscription_rate' => $subRate,
                'last_activity_at' => $u->last_activity_at,
                'has_phone' => $hasPhone,
                'games_played' => $games,
                'puzzles_solved' => $puzzlesSolved,
                'activity_combined' => $combined,
                'activity_100_progress' => min(100, (int) round($combined / ReferralService::ACTIVITY_100_THRESHOLD * 100)),
                'milestones' => [
                    'signup_phone' => in_array('signup_phone', $earnedTypes, true),
                    'first_activity' => in_array('first_activity', $earnedTypes, true),
                    'activity_100' => in_array('activity_100', $earnedTypes, true),
                ],
                'earned_from_user' => round($userMilestones->sum('earning_amount'), 2),
            ];
        });

        $totalReferred = $referredEnriched->count();
        $subscribedCount = $referredEnriched->where('subscription_tier', '!=', 'free')
            ->whereNotNull('subscription_tier')->count();
        $activeThisWeek = $referredEnriched->filter(fn ($u) =>
            $u['last_activity_at'] && Carbon::parse($u['last_activity_at'])->gte(Carbon::now()->subDays(7))
        )->count();

        // ── Earnings rollups ─────────────────────────────────────────────
        $monthStart = Carbon::now()->startOfMonth();

        $earningsBase = ReferralEarning::where('referrer_user_id', $user->id);
        $totalEarnings = (clone $earningsBase)->sum('earning_amount');
        $earningsThisMonth = (clone $earningsBase)->where('created_at', '>=', $monthStart)->sum('earning_amount');
        $pendingEarnings = (clone $earningsBase)->whereIn('status', ['pending', 'approved'])->sum('earning_amount');
        $paidEarnings = (clone $earningsBase)->where('status', 'paid')->sum('earning_amount');

        // Earnings split by source — useful headline for the dashboard.
        $milestoneTotals = ReferralEarning::where('referrer_user_id', $user->id)
            ->select('event_type', DB::raw('SUM(earning_amount) as total'), DB::raw('COUNT(*) as count'))
            ->groupBy('event_type')
            ->get()
            ->keyBy('event_type');

        $yearBreakdown = collect([1, 2, 3, 4])->map(function ($y) use ($earningsByYear) {
            $row = $earningsByYear->get($y);
            return [
                'year' => $y,
                'rate_pct' => (int) round((ReferralService::SUBSCRIPTION_RATE_BY_YEAR[$y] ?? 0) * 100),
                'count' => $row ? (int) $row->count : 0,
                'total' => $row ? round((float) $row->total, 2) : 0.0,
            ];
        })->all();

        // ── Share links ──────────────────────────────────────────────────
        $codes = ReferralCode::where('user_id', $user->id)->get();
        $joinCode = $user->referral_code;
        $frontendUrl = config('app.frontend_url', 'https://chess99.com');

        return response()->json([
            'stats' => [
                'total_referred' => $totalReferred,
                'subscribed_count' => $subscribedCount,
                'active_this_week' => $activeThisWeek,
                'earnings_this_month' => round($earningsThisMonth, 2),
                'total_earnings' => round($totalEarnings, 2),
                'pending_earnings' => round($pendingEarnings, 2),
                'paid_earnings' => round($paidEarnings, 2),
            ],
            'milestones' => [
                'signup_phone' => [
                    'amount' => ReferralService::MILESTONE_SIGNUP_PHONE,
                    'count' => (int) ($milestoneTotals['signup_phone']->count ?? 0),
                    'total' => round((float) ($milestoneTotals['signup_phone']->total ?? 0), 2),
                ],
                'first_activity' => [
                    'amount' => ReferralService::MILESTONE_FIRST_ACTIVITY,
                    'count' => (int) ($milestoneTotals['first_activity']->count ?? 0),
                    'total' => round((float) ($milestoneTotals['first_activity']->total ?? 0), 2),
                ],
                'activity_100' => [
                    'amount' => ReferralService::MILESTONE_ACTIVITY_100,
                    'count' => (int) ($milestoneTotals['activity_100']->count ?? 0),
                    'total' => round((float) ($milestoneTotals['activity_100']->total ?? 0), 2),
                ],
            ],
            'subscription_years' => $yearBreakdown,
            'commission_schedule' => [
                'years' => ReferralService::SUBSCRIPTION_RATE_BY_YEAR,
                'note' => 'Y5+ pays nothing — referrer ages out four years after the user\'s first paid subscription.',
            ],
            'share' => [
                'code' => $joinCode,
                'short_url' => $frontendUrl . '/r/' . $joinCode,
                'join_url'  => $frontendUrl . '/join/' . $joinCode,
            ],
            'codes' => $codes,
            'referred_users' => $referredEnriched,
        ]);
    }

    /**
     * GET /admin/ambassadors
     * Admin: list all ambassadors with referral counts + month-to-date
     * earnings. The cumulative tier model has been retired — commission is
     * now time-decaying per subscription year (see ReferralService).
     */
    public function adminList(Request $request): JsonResponse
    {
        $ambassadorRoleId = DB::table('roles')->where('name', 'ambassador')->value('id');

        if (!$ambassadorRoleId) {
            return response()->json(['ambassadors' => []]);
        }

        $ambassadorIds = DB::table('user_roles')
            ->where('role_id', $ambassadorRoleId)
            ->pluck('user_id');

        $ambassadors = User::whereIn('id', $ambassadorIds)
            ->select('id', 'name', 'email', 'referral_code', 'organization_id',
                'mobile_country_code', 'mobile_number', 'created_at')
            ->get()
            ->map(function ($user) {
                $referredCount = User::where('referred_by_user_id', $user->id)->count();
                $subscribedCount = User::where('referred_by_user_id', $user->id)
                    ->where('subscription_tier', '!=', 'free')
                    ->whereNotNull('subscription_tier')
                    ->count();
                $activeThisWeek = User::where('referred_by_user_id', $user->id)
                    ->where('last_activity_at', '>=', Carbon::now()->subDays(7))
                    ->count();
                $earningsThisMonth = ReferralEarning::where('referrer_user_id', $user->id)
                    ->where('created_at', '>=', Carbon::now()->startOfMonth())
                    ->sum('earning_amount');
                $totalEarnings = ReferralEarning::where('referrer_user_id', $user->id)
                    ->sum('earning_amount');

                $mobile = $user->mobile_country_code && $user->mobile_number
                    ? $user->mobile_country_code . $user->mobile_number
                    : null;

                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'mobile' => $mobile,
                    'referral_code' => $user->referral_code,
                    'organization_id' => $user->organization_id,
                    'referred_count' => $referredCount,
                    'subscribed_count' => $subscribedCount,
                    'active_this_week' => $activeThisWeek,
                    'earnings_this_month' => round($earningsThisMonth, 2),
                    'total_earnings' => round($totalEarnings, 2),
                ];
            });

        return response()->json(['ambassadors' => $ambassadors]);
    }

    /**
     * POST /admin/ambassadors/{userId}/assign
     */
    public function assign(Request $request, int $userId): JsonResponse
    {
        $targetUser = User::findOrFail($userId);
        $ambassadorRoleId = DB::table('roles')->where('name', 'ambassador')->value('id');

        if (!$ambassadorRoleId) {
            return response()->json(['error' => 'Ambassador role not found'], 500);
        }

        $exists = DB::table('user_roles')
            ->where('user_id', $userId)
            ->where('role_id', $ambassadorRoleId)
            ->exists();

        if ($exists) {
            return response()->json(['message' => 'User is already an ambassador'], 200);
        }

        DB::table('user_roles')->insert([
            'user_id' => $userId,
            'role_id' => $ambassadorRoleId,
            'assigned_by' => $request->user()->id,
            'assigned_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'message' => "Assigned ambassador role to {$targetUser->name}",
        ]);
    }

    /**
     * DELETE /admin/ambassadors/{userId}/remove
     */
    public function remove(int $userId): JsonResponse
    {
        $targetUser = User::findOrFail($userId);
        $ambassadorRoleId = DB::table('roles')->where('name', 'ambassador')->value('id');

        if (!$ambassadorRoleId) {
            return response()->json(['error' => 'Ambassador role not found'], 500);
        }

        DB::table('user_roles')
            ->where('user_id', $userId)
            ->where('role_id', $ambassadorRoleId)
            ->delete();

        return response()->json([
            'message' => "Removed ambassador role from {$targetUser->name}",
        ]);
    }

    /**
     * POST /ambassador/self-assign
     */
    public function selfAssign(Request $request): JsonResponse
    {
        $user = $request->user();
        $ambassadorRoleId = DB::table('roles')->where('name', 'ambassador')->value('id');

        if (!$ambassadorRoleId) {
            return response()->json(['error' => 'Ambassador role not found'], 500);
        }

        $exists = DB::table('user_roles')
            ->where('user_id', $user->id)
            ->where('role_id', $ambassadorRoleId)
            ->exists();

        if ($exists) {
            return response()->json(['message' => 'You are already an ambassador'], 200);
        }

        DB::table('user_roles')->insert([
            'user_id' => $user->id,
            'role_id' => $ambassadorRoleId,
            'assigned_by' => $user->id,
            'assigned_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'message' => 'You are now a Chess99 Ambassador!',
        ]);
    }

    /**
     * GET /admin/ambassadors/search-users
     */
    public function searchUsers(Request $request): JsonResponse
    {
        $search = $request->input('q', '');
        if (strlen($search) < 2) {
            return response()->json(['users' => []]);
        }

        $users = User::where(function ($q) use ($search) {
            $q->where('name', 'like', "%{$search}%")
              ->orWhere('email', 'like', "%{$search}%");
        })
            ->select('id', 'name', 'email')
            ->limit(10)
            ->get();

        return response()->json(['users' => $users]);
    }

    /**
     * POST /ambassador/payout-request
     */
    public function payoutRequest(Request $request): JsonResponse
    {
        $user = $request->user();

        $rules = [
            'amount' => 'required|numeric|min:100',
            'payment_method' => 'required|in:bank,upi',
        ];

        if ($request->input('payment_method') === 'bank') {
            $rules['bank_account_name'] = 'required|string|max:100';
            $rules['bank_account_number'] = 'required|string|max:20';
            $rules['bank_ifsc'] = 'required|string|max:11';
            $rules['bank_name'] = 'nullable|string|max:100';
        } else {
            $rules['upi_id'] = 'required|string|max:100';
        }

        $validated = $request->validate($rules);

        // Check pending earnings suffice
        $pendingEarnings = ReferralEarning::where('referrer_user_id', $user->id)
            ->whereIn('status', ['pending', 'approved'])
            ->sum('earning_amount');

        if ($validated['amount'] > $pendingEarnings) {
            return response()->json([
                'error' => "Requested amount (₹{$validated['amount']}) exceeds pending earnings (₹{$pendingEarnings})",
            ], 422);
        }

        // Only one pending request at a time
        $existingPending = PayoutRequest::where('user_id', $user->id)
            ->where('status', 'pending')
            ->exists();

        if ($existingPending) {
            return response()->json([
                'error' => 'You already have a pending payout request. Please wait for it to be processed.',
            ], 422);
        }

        $payout = PayoutRequest::create([
            'user_id' => $user->id,
            'amount' => $validated['amount'],
            'currency' => 'INR',
            'payment_method' => $validated['payment_method'],
            'bank_account_name' => $validated['bank_account_name'] ?? null,
            'bank_account_number' => $validated['bank_account_number'] ?? null,
            'bank_ifsc' => $validated['bank_ifsc'] ?? null,
            'bank_name' => $validated['bank_name'] ?? null,
            'upi_id' => $validated['upi_id'] ?? null,
            'status' => 'pending',
        ]);

        return response()->json([
            'message' => 'Payout request submitted successfully',
            'payout' => $payout,
        ], 201);
    }

    /**
     * GET /ambassador/payout-requests
     */
    public function payoutHistory(Request $request): JsonResponse
    {
        $payouts = PayoutRequest::where('user_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['payout_requests' => $payouts]);
    }

    /**
     * POST /ambassador/apply — user-submitted ambassador application.
     */
    public function apply(Request $request): JsonResponse
    {
        $user = $request->user();

        $ambassadorRoleId = DB::table('roles')->where('name', 'ambassador')->value('id');
        if ($ambassadorRoleId) {
            $alreadyAmbassador = DB::table('user_roles')
                ->where('user_id', $user->id)
                ->where('role_id', $ambassadorRoleId)
                ->exists();
            if ($alreadyAmbassador) {
                return response()->json(['error' => 'You are already an ambassador'], 409);
            }
        }

        $existing = AmbassadorApplication::where('user_id', $user->id)
            ->where('status', 'pending')
            ->first();
        if ($existing) {
            return response()->json([
                'error' => 'You already have a pending application',
                'application' => $existing,
            ], 409);
        }

        $data = $request->validate([
            'name' => 'required|string|max:120',
            'mobile' => 'required|string|max:32',
            'upi_id' => 'required|string|max:120',
            'reason' => 'nullable|string|max:1000',
        ]);

        $application = AmbassadorApplication::create([
            'user_id' => $user->id,
            'name' => $data['name'],
            'mobile' => $data['mobile'],
            'upi_id' => $data['upi_id'],
            'reason' => $data['reason'] ?? null,
            'status' => 'pending',
        ]);

        return response()->json([
            'message' => 'Application submitted. We will review and get back to you.',
            'application' => $application,
        ], 201);
    }

    /**
     * GET /ambassador/application — current user's latest application.
     */
    public function myApplication(Request $request): JsonResponse
    {
        $application = AmbassadorApplication::where('user_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->first();

        return response()->json(['application' => $application]);
    }

    /**
     * GET /admin/ambassadors/applications — admin queue.
     */
    public function adminApplications(Request $request): JsonResponse
    {
        $status = $request->input('status', 'pending');

        $query = AmbassadorApplication::with('user:id,name,email')
            ->orderByDesc('created_at');

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        return response()->json(['applications' => $query->get()]);
    }

    /**
     * POST /admin/ambassadors/applications/{id}/approve
     */
    public function approveApplication(Request $request, int $id): JsonResponse
    {
        $application = AmbassadorApplication::findOrFail($id);

        if ($application->status !== 'pending') {
            return response()->json(['error' => 'Application is not pending'], 400);
        }

        $ambassadorRoleId = DB::table('roles')->where('name', 'ambassador')->value('id');
        if (!$ambassadorRoleId) {
            return response()->json(['error' => 'Ambassador role not found'], 500);
        }

        $exists = DB::table('user_roles')
            ->where('user_id', $application->user_id)
            ->where('role_id', $ambassadorRoleId)
            ->exists();

        if (!$exists) {
            DB::table('user_roles')->insert([
                'user_id' => $application->user_id,
                'role_id' => $ambassadorRoleId,
                'assigned_by' => $request->user()->id,
                'assigned_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $application->update([
            'status' => 'approved',
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        return response()->json([
            'message' => 'Application approved. Ambassador role assigned.',
            'application' => $application->fresh(),
        ]);
    }

    /**
     * POST /admin/ambassadors/applications/{id}/reject
     */
    public function rejectApplication(Request $request, int $id): JsonResponse
    {
        $application = AmbassadorApplication::findOrFail($id);

        if ($application->status !== 'pending') {
            return response()->json(['error' => 'Application is not pending'], 400);
        }

        $data = $request->validate([
            'decline_reason' => 'nullable|string|max:1000',
        ]);

        $application->update([
            'status' => 'rejected',
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
            'decline_reason' => $data['decline_reason'] ?? null,
        ]);

        return response()->json([
            'message' => 'Application rejected.',
            'application' => $application->fresh(),
        ]);
    }
}
