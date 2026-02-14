<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\URL;

class EmailPreferenceService
{
    /**
     * Known email types for the preference system.
     */
    public const EMAIL_TYPES = [
        'play_reminder',
        'weekly_digest',
        'tournament_announcement',
        'match_reminder',
    ];

    /**
     * Check if a user can receive marketing/batch emails right now.
     * Enforces master toggle, unsubscribe status, and throttle (max 1 per 3 days).
     */
    public function canReceiveEmail(User $user): bool
    {
        if (!$user->email) {
            return false;
        }

        if (!$user->email_notifications_enabled) {
            return false;
        }

        if ($user->email_unsubscribed_at) {
            return false;
        }

        if ($user->last_email_sent_at && $user->last_email_sent_at->gt(now()->subDays(3))) {
            return false;
        }

        return true;
    }

    /**
     * Check if a user wants a specific email type.
     */
    public function wantsEmailType(User $user, string $type): bool
    {
        return $user->wantsEmailType($type);
    }

    /**
     * Generate a signed unsubscribe URL (no auth required, CAN-SPAM compliant).
     */
    public function unsubscribeUrl(User $user): string
    {
        return URL::signedRoute('email.unsubscribe', ['user' => $user->id]);
    }

    /**
     * Generate a signed preferences URL.
     */
    public function preferencesUrl(User $user): string
    {
        return URL::signedRoute('email.preferences', ['user' => $user->id]);
    }

    /**
     * Globally unsubscribe a user.
     */
    public function unsubscribe(User $user): void
    {
        $user->update([
            'email_notifications_enabled' => false,
            'email_unsubscribed_at' => now(),
        ]);
    }

    /**
     * Re-subscribe a user (master toggle on, clear unsubscribe timestamp).
     */
    public function resubscribe(User $user): void
    {
        $user->update([
            'email_notifications_enabled' => true,
            'email_unsubscribed_at' => null,
        ]);
    }

    /**
     * Update per-type preferences.
     *
     * @param array<string, bool> $preferences  e.g. ['play_reminder' => false, 'weekly_digest' => true]
     */
    public function updatePreferences(User $user, array $preferences): void
    {
        $current = $user->email_preferences ?? [];

        foreach ($preferences as $type => $enabled) {
            if (in_array($type, self::EMAIL_TYPES, true)) {
                $current[$type] = (bool) $enabled;
            }
        }

        $user->update(['email_preferences' => $current]);
    }

    /**
     * Record that a marketing email was sent to this user (for throttle).
     */
    public function recordEmailSent(User $user): void
    {
        $user->update(['last_email_sent_at' => now()]);
    }
}
