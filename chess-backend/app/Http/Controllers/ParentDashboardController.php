<?php

namespace App\Http\Controllers;

use App\Mail\ParentWeeklyReportMail;
use App\Models\GuardianChildRelationship;
use App\Models\User;
use App\Services\EmailPreferenceService;
use App\Services\ParentDashboardService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

class ParentDashboardController extends Controller
{
    public function index(Request $request, ParentDashboardService $reports)
    {
        return response()->json([
            'success' => true,
            'data' => $reports->dashboardForGuardian($request->user()),
        ]);
    }

    public function requestLink(Request $request, ParentDashboardService $reports)
    {
        $data = $request->validate([
            'child_email' => ['required', 'email'],
            'relationship_label' => ['nullable', 'string', 'max:64'],
        ]);

        $guardian = $request->user();
        $child = User::query()
            ->whereRaw('LOWER(email) = ?', [strtolower($data['child_email'])])
            ->first();

        if (!$child) {
            throw ValidationException::withMessages([
                'child_email' => ['No Chess99 child account was found for that email.'],
            ]);
        }

        if ($child->id === $guardian->id) {
            throw ValidationException::withMessages([
                'child_email' => ['You cannot link your own account as a child account.'],
            ]);
        }

        $relationship = GuardianChildRelationship::query()
            ->where('guardian_id', $guardian->id)
            ->where('child_id', $child->id)
            ->first();

        if ($relationship && $relationship->status !== GuardianChildRelationship::STATUS_REVOKED) {
            return response()->json([
                'success' => true,
                'data' => $reports->relationshipPayload($relationship),
            ]);
        }

        $relationship ??= new GuardianChildRelationship([
            'guardian_id' => $guardian->id,
            'child_id' => $child->id,
        ]);

        $relationship->fill([
            'status' => GuardianChildRelationship::STATUS_PENDING,
            'relationship_label' => $data['relationship_label'] ?? $relationship->relationship_label,
            'invite_email' => $child->email,
            'invited_at' => now(),
            'accepted_at' => null,
            'revoked_at' => null,
        ]);
        $relationship->save();

        return response()->json([
            'success' => true,
            'data' => $reports->relationshipPayload($relationship),
        ], 201);
    }

    public function accept(Request $request, GuardianChildRelationship $relationship, ParentDashboardService $reports)
    {
        if ($relationship->child_id !== $request->user()->id) {
            abort(403, 'Only the invited child account can accept this guardian link.');
        }

        if ($relationship->status !== GuardianChildRelationship::STATUS_PENDING) {
            throw ValidationException::withMessages([
                'relationship' => ['This guardian link is no longer pending.'],
            ]);
        }

        $relationship->update([
            'status' => GuardianChildRelationship::STATUS_ACTIVE,
            'accepted_at' => now(),
            'revoked_at' => null,
        ]);

        return response()->json([
            'success' => true,
            'data' => $reports->relationshipPayload($relationship->fresh(['guardian', 'child'])),
        ]);
    }

    public function revoke(Request $request, GuardianChildRelationship $relationship, ParentDashboardService $reports)
    {
        $userId = $request->user()->id;
        if ($relationship->guardian_id !== $userId && $relationship->child_id !== $userId) {
            abort(403, 'You cannot revoke this guardian link.');
        }

        $relationship->update([
            'status' => GuardianChildRelationship::STATUS_REVOKED,
            'revoked_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'data' => $reports->relationshipPayload($relationship->fresh(['guardian', 'child'])),
        ]);
    }

    public function show(Request $request, GuardianChildRelationship $relationship, ParentDashboardService $reports)
    {
        $this->ensureActiveGuardian($request, $relationship);

        return response()->json([
            'success' => true,
            'data' => $reports->reportForChild($relationship->child, $relationship),
        ]);
    }

    public function sendWeeklyReport(
        Request $request,
        GuardianChildRelationship $relationship,
        ParentDashboardService $reports,
        EmailPreferenceService $preferences
    ) {
        $this->ensureActiveGuardian($request, $relationship);

        $guardian = $request->user();
        if (!$preferences->wantsEmailType($guardian, 'weekly_digest')) {
            throw ValidationException::withMessages([
                'email' => ['Weekly digest emails are disabled for this account.'],
            ]);
        }

        $report = $reports->reportForChild($relationship->child, $relationship);

        Mail::to($guardian->email)->queue(new ParentWeeklyReportMail(
            $guardian,
            $relationship->child,
            $report
        ));
        $preferences->recordEmailSent($guardian);

        return response()->json([
            'success' => true,
            'message' => 'Weekly report queued.',
        ]);
    }

    public function updateChildProfile(Request $request, GuardianChildRelationship $relationship, ParentDashboardService $reports)
    {
        $this->ensureActiveGuardian($request, $relationship);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'password' => ['sometimes', 'nullable', 'string', 'min:8', 'confirmed'],
        ]);

        if (!array_key_exists('name', $data) && empty($data['password'])) {
            throw ValidationException::withMessages([
                'profile' => ['Provide a display name or password to update.'],
            ]);
        }

        $updates = [];
        if (array_key_exists('name', $data)) {
            $updates['name'] = $data['name'];
        }
        if (!empty($data['password'])) {
            $updates['password'] = Hash::make($data['password']);
        }

        $relationship->child->update($updates);

        return response()->json([
            'success' => true,
            'data' => $reports->relationshipPayload($relationship->fresh(['guardian', 'child'])),
        ]);
    }

    private function ensureActiveGuardian(Request $request, GuardianChildRelationship $relationship): void
    {
        if ($relationship->guardian_id !== $request->user()->id) {
            abort(403, 'Only the linked guardian can access this child report.');
        }

        if ($relationship->status !== GuardianChildRelationship::STATUS_ACTIVE) {
            abort(403, 'This guardian link is not active.');
        }

        $relationship->loadMissing(['guardian', 'child']);
    }
}
