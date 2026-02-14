<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\EmailPreferenceService;
use Illuminate\Http\Request;

class EmailPreferenceController extends Controller
{
    public function __construct(
        private EmailPreferenceService $prefService,
    ) {}

    // ── Signed Web Routes (no auth required, CAN-SPAM) ─────────────────

    /**
     * GET /email/unsubscribe?user=X&signature=...
     */
    public function unsubscribe(Request $request)
    {
        $user = User::findOrFail($request->query('user'));

        $this->prefService->unsubscribe($user);

        return view('emails.unsubscribed', [
            'preferencesUrl' => $this->prefService->preferencesUrl($user),
        ]);
    }

    /**
     * GET /email/preferences?user=X&signature=...
     */
    public function showPreferences(Request $request)
    {
        $user = User::findOrFail($request->query('user'));

        return view('emails.preferences', [
            'user' => $user,
            'formAction' => url()->signedRoute('email.preferences.update', ['user' => $user->id]),
            'unsubscribeUrl' => $this->prefService->unsubscribeUrl($user),
        ]);
    }

    /**
     * POST /email/preferences?user=X&signature=...
     */
    public function updatePreferences(Request $request)
    {
        $user = User::findOrFail($request->query('user'));

        $masterToggle = $request->boolean('email_notifications_enabled');
        $user->update(['email_notifications_enabled' => $masterToggle]);

        if ($masterToggle) {
            $user->update(['email_unsubscribed_at' => null]);
        }

        $preferences = [];
        foreach (EmailPreferenceService::EMAIL_TYPES as $type) {
            $preferences[$type] = (bool) ($request->input("preferences.{$type}"));
        }
        $this->prefService->updatePreferences($user, $preferences);

        return redirect()->to(url()->signedRoute('email.preferences', ['user' => $user->id]))
            ->with('success', 'Your email preferences have been updated.');
    }

    // ── API Routes (Sanctum auth) ──────────────────────────────────────

    /**
     * GET /api/v1/email/preferences
     */
    public function apiGetPreferences(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'email_notifications_enabled' => $user->email_notifications_enabled,
            'email_preferences' => $user->email_preferences ?? [],
            'email_unsubscribed_at' => $user->email_unsubscribed_at,
            'available_types' => EmailPreferenceService::EMAIL_TYPES,
        ]);
    }

    /**
     * PUT /api/v1/email/preferences
     */
    public function apiUpdatePreferences(Request $request)
    {
        $request->validate([
            'email_notifications_enabled' => 'sometimes|boolean',
            'preferences' => 'sometimes|array',
            'preferences.*' => 'boolean',
        ]);

        $user = $request->user();

        if ($request->has('email_notifications_enabled')) {
            $enabled = $request->boolean('email_notifications_enabled');
            $user->update(['email_notifications_enabled' => $enabled]);

            if (!$enabled) {
                $this->prefService->unsubscribe($user);
            } else {
                $this->prefService->resubscribe($user);
            }
        }

        if ($request->has('preferences')) {
            $this->prefService->updatePreferences($user, $request->input('preferences'));
        }

        return response()->json([
            'message' => 'Email preferences updated.',
            'email_notifications_enabled' => $user->fresh()->email_notifications_enabled,
            'email_preferences' => $user->fresh()->email_preferences ?? [],
        ]);
    }
}
