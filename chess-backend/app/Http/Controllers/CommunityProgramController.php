<?php

namespace App\Http\Controllers;

use App\Models\AmbassadorApplication;
use App\Models\TesterApplication;
use App\Models\TesterSubmission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CommunityProgramController extends Controller
{
    public const PROMOTER_CAP = 20;
    public const PROMOTER_MONTHLY_MAX = 5000;

    public function overview(): JsonResponse
    {
        $ambassadorRoleId = DB::table('roles')->where('name', 'ambassador')->value('id');
        $activePromoters = $ambassadorRoleId
            ? DB::table('user_roles')->where('role_id', $ambassadorRoleId)->count()
            : 0;

        return response()->json([
            'organization' => 'Ameyem Geo Solutions',
            'programs' => [
                'tester' => [
                    'title' => 'Internal game and app tester',
                    'payment_policy' => 'Monthly payment is considered after a complete, useful, and verified test report. The amount varies by assignment and is processed manually.',
                    'rating_policy' => 'Testers are never paid for Play Store ratings or reviews.',
                ],
                'promoter' => [
                    'title' => 'Chess99 community promoter',
                    'active_members' => $activePromoters,
                    'capacity' => self::PROMOTER_CAP,
                    'monthly_max' => self::PROMOTER_MONTHLY_MAX,
                    'payment_policy' => 'Verified Chess99 referrals and qualifying activity determine monthly earnings; up to ₹5,000/month, subject to the published terms and review.',
                ],
            ],
        ]);
    }

    public function testerApplication(Request $request): JsonResponse
    {
        $application = TesterApplication::where('user_id', $request->user()->id)
            ->withCount('submissions')
            ->latest()
            ->first();

        return response()->json(['application' => $application]);
    }

    public function applyTester(Request $request): JsonResponse
    {
        $user = $request->user();
        $existing = TesterApplication::where('user_id', $user->id)
            ->where('status', 'pending')
            ->first();

        if ($existing) {
            return response()->json([
                'error' => 'You already have a pending tester application.',
                'application' => $existing,
            ], 409);
        }

        $data = $request->validate([
            'name' => 'required|string|max:120',
            'mobile' => 'required|string|max:32',
            'upi_id' => 'required|string|max:120',
            'reason' => 'nullable|string|max:1000',
            'terms_accepted' => ['accepted'],
        ]);

        $application = TesterApplication::create([
            'user_id' => $user->id,
            'name' => $data['name'],
            'mobile' => $data['mobile'],
            'upi_id' => $data['upi_id'],
            'reason' => $data['reason'] ?? null,
            'consented_at' => now(),
            'status' => 'pending',
        ]);

        return response()->json([
            'message' => 'Tester application submitted for review.',
            'application' => $application,
        ], 201);
    }

    public function submissions(Request $request): JsonResponse
    {
        $submissions = TesterSubmission::where('user_id', $request->user()->id)
            ->latest()
            ->get();

        return response()->json(['submissions' => $submissions]);
    }

    public function submitReport(Request $request): JsonResponse
    {
        $application = TesterApplication::where('user_id', $request->user()->id)
            ->where('status', 'approved')
            ->latest()
            ->first();

        if (!$application) {
            return response()->json(['error' => 'An approved tester application is required before submitting reports.'], 403);
        }

        $data = $request->validate([
            'period' => ['required', 'date_format:Y-m'], Rule::unique('tester_submissions')->where(fn ($query) => $query
                ->where('user_id', $request->user()->id)
                ->where('app_name', $request->input('app_name'))),
            'app_name' => 'required|string|max:120',
            'test_link' => 'required|url|max:500',
            'feedback_summary' => 'required|string|min:30|max:4000',
            'issue_count' => 'nullable|integer|min:0|max:500',
        ]);

        $submission = TesterSubmission::create([
            'tester_application_id' => $application->id,
            'user_id' => $request->user()->id,
            'period' => $data['period'],
            'app_name' => $data['app_name'],
            'test_link' => $data['test_link'],
            'feedback_summary' => $data['feedback_summary'],
            'issue_count' => $data['issue_count'] ?? 0,
            'status' => 'pending',
        ]);

        return response()->json([
            'message' => 'Test report submitted. We will review it before processing any payment.',
            'submission' => $submission,
        ], 201);
    }

    public function adminOverview(Request $request): JsonResponse
    {
        $status = $request->input('status', 'pending');
        $query = TesterApplication::with('user:id,name,email')->withCount('submissions')->latest();
        if ($status !== 'all') {
            $query->where('status', $status);
        }

        return response()->json([
            'applications' => $query->get(),
            'submissions' => TesterSubmission::with('user:id,name,email', 'application:id,name')
                ->when($status !== 'all', fn ($q) => $q->where('status', $status))
                ->latest()
                ->get(),
            'promoter' => $this->promoterCapacity(),
        ]);
    }

    public function approveTester(Request $request, int $id): JsonResponse
    {
        $application = TesterApplication::findOrFail($id);
        if ($application->status !== 'pending') {
            return response()->json(['error' => 'Application is not pending.'], 400);
        }

        $application->update([
            'status' => 'approved',
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
            'decline_reason' => null,
        ]);

        return response()->json(['message' => 'Tester application approved.', 'application' => $application->fresh()]);
    }

    public function rejectTester(Request $request, int $id): JsonResponse
    {
        $application = TesterApplication::findOrFail($id);
        if ($application->status !== 'pending') {
            return response()->json(['error' => 'Application is not pending.'], 400);
        }

        $data = $request->validate(['decline_reason' => 'nullable|string|max:1000']);
        $application->update([
            'status' => 'rejected',
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
            'decline_reason' => $data['decline_reason'] ?? null,
        ]);

        return response()->json(['message' => 'Tester application rejected.', 'application' => $application->fresh()]);
    }

    public function reviewSubmission(Request $request, int $id): JsonResponse
    {
        $submission = TesterSubmission::findOrFail($id);
        $data = $request->validate([
            'status' => 'required|in:approved,rejected,paid',
            'payout_amount' => 'nullable|numeric|min:0|max:5000',
            'reviewer_note' => 'nullable|string|max:1000',
        ]);

        $status = $data['status'];
        if ($status === 'paid' && $submission->status !== 'approved') {
            return response()->json(['error' => 'Only an approved report can be marked paid.'], 422);
        }

        if ($status === 'approved' && $submission->status !== 'pending') {
            return response()->json(['error' => 'Only a pending report can be approved.'], 422);
        }

        if ($status === 'paid' && (float) ($data['payout_amount'] ?? $submission->payout_amount) <= 0) {
            return response()->json(['error' => 'Enter a payout amount before marking a report paid.'], 422);
        }

        $submission->update([
            'status' => $status,
            'payout_amount' => $data['payout_amount'] ?? $submission->payout_amount,
            'reviewer_note' => $data['reviewer_note'] ?? null,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
            'payout_processed_at' => $status === 'paid' ? now() : $submission->payout_processed_at,
        ]);

        return response()->json(['message' => 'Tester submission updated.', 'submission' => $submission->fresh()]);
    }

    private function promoterCapacity(): array
    {
        $roleId = DB::table('roles')->where('name', 'ambassador')->value('id');
        $active = $roleId ? DB::table('user_roles')->where('role_id', $roleId)->count() : 0;

        return [
            'active_members' => $active,
            'capacity' => self::PROMOTER_CAP,
            'remaining' => max(0, self::PROMOTER_CAP - $active),
            'monthly_max' => self::PROMOTER_MONTHLY_MAX,
        ];
    }
}
