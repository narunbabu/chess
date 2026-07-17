<?php

namespace App\Services;

use App\Models\GuardianChildRelationship;
use App\Models\User;
use Illuminate\Support\Facades\Log;

/**
 * Records the parent/guardian a minor names at signup (P0-3 launch-readiness).
 *
 * The guardian email is always stored on the child. If a guardian account
 * already exists, a pending, child-initiated consent request is created that the
 * guardian approves from the "My Kids" dashboard (ParentDashboardController@accept),
 * which stamps users.guardian_consent_at.
 *
 * TODO(P0-3 follow-up): email a signed consent/claim link to guardians who don't
 * yet have an account, for verifiable parental consent end-to-end.
 */
class GuardianConsentService
{
    public function requestConsentForMinor(User $child, string $guardianEmail): ?GuardianChildRelationship
    {
        $guardianEmail = strtolower(trim($guardianEmail));

        // A guardian must be a different person than the child.
        if ($guardianEmail === '' || $guardianEmail === strtolower((string) $child->email)) {
            return null;
        }

        // Persist the named guardian regardless of whether an account exists yet.
        if ($child->guardian_email !== $guardianEmail) {
            $child->forceFill(['guardian_email' => $guardianEmail])->save();
        }

        $guardian = User::query()
            ->whereRaw('LOWER(email) = ?', [$guardianEmail])
            ->first();

        if (!$guardian || $guardian->id === $child->id) {
            // No account yet — the guardian can claim & consent when they register
            // or link from the dashboard. (Consent email is a documented follow-up.)
            return null;
        }

        $relationship = GuardianChildRelationship::query()
            ->where('guardian_id', $guardian->id)
            ->where('child_id', $child->id)
            ->first();

        // Respect an already-active/pending link — never downgrade it.
        if ($relationship && $relationship->status !== GuardianChildRelationship::STATUS_REVOKED) {
            return $relationship;
        }

        $relationship ??= new GuardianChildRelationship([
            'guardian_id' => $guardian->id,
            'child_id' => $child->id,
        ]);

        $relationship->fill([
            'status' => GuardianChildRelationship::STATUS_PENDING,
            'initiated_by' => GuardianChildRelationship::INITIATED_BY_CHILD,
            'invite_email' => $guardianEmail,
            'invited_at' => now(),
            'accepted_at' => null,
            'revoked_at' => null,
        ]);
        $relationship->save();

        Log::info('Guardian consent requested for minor at signup', [
            'child_id' => $child->id,
            'guardian_id' => $guardian->id,
        ]);

        return $relationship;
    }
}
