<?php

namespace App\Http\Controllers;

use App\Models\PayoutRequest;
use App\Models\ReferralEarning;
use App\Models\ReferralPayout;
use App\Services\ReferralService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

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
     * Admin: list all payouts across all referrers, enriched with the
     * referrer's mobile, last-known UPI (from PayoutRequest history) and
     * earning breakdown by event_type. The admin pays manually via UPI at
     * end of month, so they need this contact + breakdown info inline.
     */
    public function adminPayouts(Request $request): JsonResponse
    {
        if (!$this->isAdmin($request)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $query = ReferralPayout::with('referrer:id,name,email,mobile_country_code,mobile_number');

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('period')) {
            $query->where('period', $request->period);
        }

        $payouts = $query->orderByDesc('created_at')->paginate(50);

        // Bulk-fetch last UPI + breakdown for the page.
        $referrerIds = $payouts->pluck('referrer_user_id')->unique();
        $payoutIds = $payouts->pluck('id');

        $lastUpiByUser = PayoutRequest::whereIn('user_id', $referrerIds)
            ->where('payment_method', 'upi')
            ->whereNotNull('upi_id')
            ->orderByDesc('created_at')
            ->get(['user_id', 'upi_id'])
            ->groupBy('user_id')
            ->map(fn ($rows) => $rows->first()->upi_id);

        $breakdownByPayout = ReferralEarning::whereIn('payout_id', $payoutIds)
            ->select('payout_id', 'event_type',
                DB::raw('SUM(earning_amount) as total'),
                DB::raw('COUNT(*) as count'))
            ->groupBy('payout_id', 'event_type')
            ->get()
            ->groupBy('payout_id');

        $payouts->getCollection()->transform(function ($p) use ($lastUpiByUser, $breakdownByPayout) {
            $ref = $p->referrer;
            $mobile = $ref && $ref->mobile_country_code && $ref->mobile_number
                ? $ref->mobile_country_code . $ref->mobile_number
                : null;
            $p->referrer_mobile = $mobile;
            $p->referrer_upi = $lastUpiByUser[$p->referrer_user_id] ?? null;
            $p->breakdown = ($breakdownByPayout[$p->id] ?? collect())->map(fn ($r) => [
                'event_type' => $r->event_type,
                'count' => (int) $r->count,
                'total' => round((float) $r->total, 2),
            ])->values();
            return $p;
        });

        return response()->json($payouts);
    }

    /**
     * GET /api/admin/referrals/payouts/export
     * Admin: stream a CSV of payouts (paste-ready for bulk UPI transfers).
     * Same status/period filters as adminPayouts.
     */
    public function payoutsCsv(Request $request): StreamedResponse
    {
        if (!$this->isAdmin($request)) {
            abort(403, 'Unauthorized');
        }

        $status = $request->query('status', 'pending');
        $period = $request->query('period');

        $filename = 'chess99-payouts-' . ($period ?: 'all') . '-' . $status . '.csv';

        return response()->streamDownload(function () use ($status, $period) {
            $out = fopen('php://output', 'w');
            fputcsv($out, [
                'Period', 'Ambassador', 'Email', 'Mobile', 'UPI', 'Amount (INR)',
                'Earnings #', 'Status', 'Paid At', 'Notes',
            ]);

            $q = ReferralPayout::with('referrer:id,name,email,mobile_country_code,mobile_number')
                ->orderBy('period')->orderBy('referrer_user_id');
            if ($status) {
                $q->where('status', $status);
            }
            if ($period) {
                $q->where('period', $period);
            }

            $referrerIds = (clone $q)->pluck('referrer_user_id')->unique();
            $lastUpi = PayoutRequest::whereIn('user_id', $referrerIds)
                ->where('payment_method', 'upi')
                ->whereNotNull('upi_id')
                ->orderByDesc('created_at')
                ->get(['user_id', 'upi_id'])
                ->groupBy('user_id')
                ->map(fn ($rows) => $rows->first()->upi_id);

            $q->chunk(200, function ($rows) use ($out, $lastUpi) {
                foreach ($rows as $p) {
                    $ref = $p->referrer;
                    $mobile = $ref && $ref->mobile_country_code && $ref->mobile_number
                        ? $ref->mobile_country_code . $ref->mobile_number
                        : '';
                    fputcsv($out, [
                        $p->period,
                        $ref->name ?? '',
                        $ref->email ?? '',
                        $mobile,
                        $lastUpi[$p->referrer_user_id] ?? '',
                        number_format((float) $p->total_amount, 2, '.', ''),
                        $p->earnings_count,
                        $p->status,
                        $p->paid_at?->toDateTimeString() ?? '',
                        $p->notes ?? '',
                    ]);
                }
            });

            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    private function isAdmin(Request $request): bool
    {
        $user = $request->user();
        return $user && in_array($user->email, self::ADMIN_EMAILS);
    }
}
