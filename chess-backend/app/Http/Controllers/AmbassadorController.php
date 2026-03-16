<?php

namespace App\Http\Controllers;

use App\Models\AmbassadorTier;
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
     * Ambassador's own stats: referrals, subscriptions, profit share, tier, QR link.
     */
    public function dashboard(Request $request): JsonResponse
    {
        $user = $request->user();

        // Referred users
        $referredUsers = User::where('referred_by_user_id', $user->id)
            ->select('id', 'name', 'avatar_url', 'created_at', 'subscription_tier', 'last_activity_at', 'organization_id')
            ->orderByDesc('created_at')
            ->get();

        $totalReferred = $referredUsers->count();
        $subscribedCount = $referredUsers->where('subscription_tier', '!=', 'free')
            ->where('subscription_tier', '!=', null)
            ->count();
        $activeThisWeek = $referredUsers->where('last_activity_at', '>=', Carbon::now()->subDays(7))->count();

        // Tier info
        $tierInfo = $this->referralService->getTierInfo($user);
        $commissionRate = $tierInfo['current_tier']['commission_rate'] ?? 0.10;

        // Earnings this month
        $monthStart = Carbon::now()->startOfMonth();
        $earningsThisMonth = ReferralEarning::where('referrer_user_id', $user->id)
            ->where('created_at', '>=', $monthStart)
            ->sum('earning_amount');

        $totalEarnings = ReferralEarning::where('referrer_user_id', $user->id)
            ->sum('earning_amount');

        $pendingEarnings = ReferralEarning::where('referrer_user_id', $user->id)
            ->whereIn('status', ['pending', 'approved'])
            ->sum('earning_amount');

        $paidEarnings = ReferralEarning::where('referrer_user_id', $user->id)
            ->where('status', 'paid')
            ->sum('earning_amount');

        // Referral codes
        $codes = ReferralCode::where('user_id', $user->id)->get();

        // Build join link
        $joinCode = $user->referral_code;
        $joinUrl = config('app.frontend_url', 'https://chess99.com') . '/join/' . $joinCode;

        return response()->json([
            'stats' => [
                'total_referred' => $totalReferred,
                'subscribed_count' => $subscribedCount,
                'active_this_week' => $activeThisWeek,
                'earnings_this_month' => round($earningsThisMonth, 2),
                'total_earnings' => round($totalEarnings, 2),
                'pending_earnings' => round($pendingEarnings, 2),
                'paid_earnings' => round($paidEarnings, 2),
                'commission_rate' => round($commissionRate * 100) . '%',
            ],
            'tier' => $tierInfo,
            'join_url' => $joinUrl,
            'join_code' => $joinCode,
            'codes' => $codes,
            'referred_users' => $referredUsers,
        ]);
    }

    /**
     * GET /admin/ambassadors
     * Admin: list all ambassadors with their stats and tier.
     */
    public function adminList(Request $request): JsonResponse
    {
        $ambassadorRoleId = DB::table('roles')->where('name', 'ambassador')->value('id');

        if (!$ambassadorRoleId) {
            return response()->json(['ambassadors' => [], 'tiers' => AmbassadorTier::allOrdered()]);
        }

        $ambassadorIds = DB::table('user_roles')
            ->where('role_id', $ambassadorRoleId)
            ->pluck('user_id');

        $ambassadors = User::whereIn('id', $ambassadorIds)
            ->select('id', 'name', 'email', 'referral_code', 'organization_id', 'created_at')
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

                $tier = AmbassadorTier::getTierForCount($subscribedCount);

                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'referral_code' => $user->referral_code,
                    'organization_id' => $user->organization_id,
                    'referred_count' => $referredCount,
                    'subscribed_count' => $subscribedCount,
                    'active_this_week' => $activeThisWeek,
                    'earnings_this_month' => round($earningsThisMonth, 2),
                    'tier_name' => $tier ? $tier->name : 'Starter',
                    'commission_rate' => $tier ? round($tier->commission_rate * 100) . '%' : '10%',
                ];
            });

        return response()->json([
            'ambassadors' => $ambassadors,
            'tiers' => AmbassadorTier::allOrdered(),
        ]);
    }

    /**
     * GET /admin/ambassador-tiers
     * Admin: get all tiers for editing.
     */
    public function getTiers(): JsonResponse
    {
        return response()->json(['tiers' => AmbassadorTier::allOrdered()]);
    }

    /**
     * PUT /admin/ambassador-tiers
     * Admin: bulk-update all tiers.
     * Expects: { tiers: [{ id?, name, min_paid_referrals, commission_rate }] }
     */
    public function updateTiers(Request $request): JsonResponse
    {
        $request->validate([
            'tiers' => 'required|array|min:1',
            'tiers.*.name' => 'required|string|max:50',
            'tiers.*.min_paid_referrals' => 'required|integer|min:0',
            'tiers.*.commission_rate' => 'required|numeric|min:0.01|max:1.00',
        ]);

        $incomingTiers = $request->input('tiers');

        // Validate no duplicate thresholds
        $thresholds = array_column($incomingTiers, 'min_paid_referrals');
        if (count($thresholds) !== count(array_unique($thresholds))) {
            return response()->json(['error' => 'Duplicate thresholds are not allowed'], 422);
        }

        // Must have a tier starting at 0
        if (!in_array(0, $thresholds)) {
            return response()->json(['error' => 'A base tier with 0 paid referrals is required'], 422);
        }

        DB::transaction(function () use ($incomingTiers) {
            // Delete existing tiers and recreate (simple approach for admin-managed config)
            AmbassadorTier::truncate();

            foreach ($incomingTiers as $i => $tierData) {
                AmbassadorTier::create([
                    'name' => $tierData['name'],
                    'min_paid_referrals' => $tierData['min_paid_referrals'],
                    'commission_rate' => $tierData['commission_rate'],
                    'sort_order' => $i + 1,
                ]);
            }
        });

        return response()->json([
            'message' => 'Tiers updated successfully',
            'tiers' => AmbassadorTier::allOrdered(),
        ]);
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
}
