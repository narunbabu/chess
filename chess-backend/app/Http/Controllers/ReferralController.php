<?php

namespace App\Http\Controllers;

use App\Models\ReferralPayout;
use App\Services\ReferralService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReferralController extends Controller
{
    const ADMIN_EMAILS = [
        'nalamara.arun@gmail.com',
        'ab@ameyem.com',
    ];

    public function __construct(
        protected ReferralService $referralService
    ) {}

    /**
     * GET /api/referrals/my-codes
     * List the authenticated user's referral codes.
     */
    public function myCodes(Request $request): JsonResponse
    {
        $stats = $this->referralService->getUserStats($request->user());

        return response()->json($stats);
    }

    /**
     * POST /api/referrals/generate
     * Generate a new referral code for the user.
     */
    public function generate(Request $request): JsonResponse
    {
        $request->validate([
            'label' => 'nullable|string|max:100',
            'max_uses' => 'nullable|integer|min:1|max:10000',
            'expires_at' => 'nullable|date|after:now',
        ]);

        $code = $this->referralService->generateCode(
            $request->user(),
            $request->label,
            $request->max_uses,
            $request->expires_at,
        );

        return response()->json([
            'status' => 'success',
            'code' => $code,
        ], 201);
    }

    /**
     * GET /api/referrals/validate/{code}
     * Public endpoint: check if a referral code is valid.
     */
    public function validateCode(string $code): JsonResponse
    {
        $referralCode = $this->referralService->validateCode($code);

        if (!$referralCode) {
            return response()->json([
                'valid' => false,
                'message' => 'Invalid or expired referral code.',
            ]);
        }

        $referrer = $referralCode->user;
        $orgData = null;

        // If the referrer is an org admin, include org info for auto-selection
        if ($referrer->organization_id && $referrer->hasRole('organization_admin')) {
            $org = $referrer->organization;
            if ($org) {
                $orgData = [
                    'id' => $org->id,
                    'name' => $org->name,
                ];
            }
        }

        return response()->json([
            'valid' => true,
            'referrer_name' => $referrer->name,
            'organization' => $orgData,
        ]);
    }

    /**
     * GET /api/referrals/stats
     * Get referral stats for the authenticated user.
     */
    public function stats(Request $request): JsonResponse
    {
        $stats = $this->referralService->getUserStats($request->user());

        return response()->json($stats);
    }

    /**
     * GET /api/referrals/referred-users
     * List users referred by the authenticated user.
     */
    public function referredUsers(Request $request): JsonResponse
    {
        $users = \App\Models\User::where('referred_by_user_id', $request->user()->id)
            ->select('id', 'name', 'avatar_url', 'created_at', 'subscription_tier')
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['referred_users' => $users]);
    }

    /**
     * GET /api/referrals/earnings
     * List earnings for the authenticated user.
     */
    public function earnings(Request $request): JsonResponse
    {
        $earnings = \App\Models\ReferralEarning::where('referrer_user_id', $request->user()->id)
            ->with(['referredUser:id,name', 'referralCode:id,code,label'])
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($earnings);
    }

    /**
     * GET /api/referrals/payouts
     * List payout history for the authenticated user.
     */
    public function payouts(Request $request): JsonResponse
    {
        $payouts = ReferralPayout::where('referrer_user_id', $request->user()->id)
            ->orderByDesc('period')
            ->get();

        return response()->json(['payouts' => $payouts]);
    }

    // -------------------------------------------------------
    // ADMIN ENDPOINTS (restricted to ADMIN_EMAILS)
    // -------------------------------------------------------

    /**
     * GET /api/admin/referrals/overview
     * Admin dashboard: overview of all referral activity.
     */
    public function adminOverview(Request $request): JsonResponse
    {
        if (!$this->isAdmin($request)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $period = $request->query('period'); // e.g. "2026-03"
        $overview = $this->referralService->getAdminOverview($period);

        return response()->json($overview);
    }

    /**
     * POST /api/admin/referrals/calculate-payouts
     * Admin: trigger monthly payout calculation.
     */
    public function calculatePayouts(Request $request): JsonResponse
    {
        if (!$this->isAdmin($request)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $request->validate([
            'period' => 'nullable|string|regex:/^\d{4}-\d{2}$/',
        ]);

        $payouts = $this->referralService->calculateMonthlyPayouts($request->period);

        return response()->json([
            'status' => 'success',
            'payouts_created' => count($payouts),
            'total_amount' => collect($payouts)->sum('total_amount'),
            'payouts' => $payouts,
        ]);
    }

    /**
     * POST /api/admin/referrals/payouts/{id}/mark-paid
     * Admin: mark a payout as paid.
     */
    public function markPaid(Request $request, int $id): JsonResponse
    {
        if (!$this->isAdmin($request)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $payout = ReferralPayout::findOrFail($id);

        if ($payout->status === 'paid') {
            return response()->json([
                'error' => 'Already paid',
                'message' => 'This payout has already been marked as paid.',
            ], 409);
        }

        $request->validate([
            'notes' => 'nullable|string|max:500',
        ]);

        $payout->markAsPaid($request->user()->email, $request->notes);

        return response()->json([
            'status' => 'success',
            'payout' => $payout->fresh(),
        ]);
    }

    /**
     * GET /api/admin/referrals/payouts
     * Admin: list all payouts across all referrers.
     */
    public function adminPayouts(Request $request): JsonResponse
    {
        if (!$this->isAdmin($request)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $query = ReferralPayout::with('referrer:id,name,email');

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('period')) {
            $query->where('period', $request->period);
        }

        $payouts = $query->orderByDesc('created_at')->paginate(50);

        return response()->json($payouts);
    }

    private function isAdmin(Request $request): bool
    {
        $user = $request->user();
        return $user && in_array($user->email, self::ADMIN_EMAILS);
    }
}
