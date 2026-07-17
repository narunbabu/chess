<?php

namespace App\Observers;

use App\Models\User;
use App\Services\ReferralService;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Fires the ambassador "signup_phone" (₹2) milestone the moment a referred
 * user gets a phone number on file. Whether the phone is captured at
 * registration, on the first profile-edit, or via a later flow is irrelevant —
 * the saved event covers them all.
 *
 * The recording itself is idempotent (ReferralService::recordMilestone) so
 * being called repeatedly is harmless.
 */
class UserReferralObserver
{
    public function __construct(protected ReferralService $referralService) {}

    public function saved(User $user): void
    {
        // Cheap-path early exits — keep this observer essentially free for
        // non-referred users and users without a phone.
        if (!$user->referred_by_user_id) {
            return;
        }
        if (empty($user->mobile_country_code) || empty($user->mobile_number)) {
            return;
        }

        // A-1 anti-fraud: don't reward a phone number that already belongs to
        // another account (blocks the cheapest farming vector — reusing numbers).
        $duplicatePhone = User::where('id', '!=', $user->id)
            ->where('mobile_country_code', $user->mobile_country_code)
            ->where('mobile_number', $user->mobile_number)
            ->exists();
        if ($duplicatePhone) {
            Log::warning('Skipping signup_phone milestone — phone already used by another account', [
                'user_id' => $user->id,
            ]);
            return;
        }

        try {
            $this->referralService->recordMilestone($user, 'signup_phone');
        } catch (Throwable $e) {
            // Never let a milestone failure block a user save. Log via the
            // service's own logger; here we just swallow.
            report($e);
        }
    }
}
