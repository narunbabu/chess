<?php

namespace Tests\Feature;

use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * S15 — the Ambassador program (commission enrollment + bank/UPI payout
 * collection) must be adult-only on a platform marketed to ages 5-18:
 *  - a known minor (birthday < 18y) is blocked with 403 `adult_only`,
 *  - a user with NO birthday on file is blocked too (fail closed — we
 *    cannot prove adulthood for a financial feature just because age is
 *    unknown),
 *  - an adult (birthday >= 18y) passes the gate and reaches normal
 *    controller behavior,
 *  - an existing ambassador who turns out to be a minor is still blocked
 *    from submitting a payout request.
 *
 * Covers both route files: routes/api_v1.php (mobile) and the legacy
 * routes/api.php, since both independently register the `adult` gate.
 */
class AmbassadorAdultGateTest extends TestCase
{
    private function minor(): User
    {
        return User::factory()->create(['birthday' => now()->subYears(10)]);
    }

    private function noBirthday(): User
    {
        return User::factory()->create(['birthday' => null]);
    }

    private function adult(): User
    {
        return User::factory()->create(['birthday' => now()->subYears(25)]);
    }

    private function assertAdultOnly($response): void
    {
        $response->assertForbidden()
            ->assertJson([
                'error' => 'adult_only',
                'message' => 'The Ambassador program is only available to adults (18+).',
            ]);
    }

    // ─── /api/v1/ambassador (mobile route file) ──────────────────────────

    public function test_v1_minor_is_blocked_from_dashboard(): void
    {
        Sanctum::actingAs($this->minor());

        $this->assertAdultOnly($this->getJson('/api/v1/ambassador/dashboard'));
    }

    public function test_v1_minor_is_blocked_from_self_assign(): void
    {
        Sanctum::actingAs($this->minor());

        $this->assertAdultOnly($this->postJson('/api/v1/ambassador/self-assign'));
    }

    public function test_v1_minor_is_blocked_from_apply(): void
    {
        Sanctum::actingAs($this->minor());

        $this->assertAdultOnly($this->postJson('/api/v1/ambassador/apply', [
            'name' => 'Kid Ambassador',
            'mobile' => '+919998887777',
            'upi_id' => 'kid@upi',
        ]));
    }

    public function test_v1_minor_is_blocked_from_payout_request(): void
    {
        Sanctum::actingAs($this->minor());

        $this->assertAdultOnly($this->postJson('/api/v1/ambassador/payout-request', [
            'amount' => 100,
            'payment_method' => 'upi',
            'upi_id' => 'kid@upi',
        ]));
    }

    public function test_v1_null_birthday_is_blocked_from_all_endpoints(): void
    {
        Sanctum::actingAs($this->noBirthday());

        $this->assertAdultOnly($this->getJson('/api/v1/ambassador/dashboard'));
        $this->assertAdultOnly($this->postJson('/api/v1/ambassador/self-assign'));
        $this->assertAdultOnly($this->postJson('/api/v1/ambassador/apply', [
            'name' => 'No DOB',
            'mobile' => '+919998887766',
            'upi_id' => 'nodob@upi',
        ]));
        $this->assertAdultOnly($this->postJson('/api/v1/ambassador/payout-request', [
            'amount' => 100,
            'payment_method' => 'upi',
            'upi_id' => 'nodob@upi',
        ]));
    }

    public function test_v1_adult_passes_the_gate_on_all_endpoints(): void
    {
        // Each endpoint gets its own fresh adult user so one call's side
        // effect (e.g. self-assign granting the ambassador role) can't
        // change another call's expected "existing behavior" outcome.

        // dashboard: reaches normal (200) controller behavior.
        Sanctum::actingAs($this->adult());
        $this->getJson('/api/v1/ambassador/dashboard')->assertOk();

        // self-assign: reaches normal (200) controller behavior.
        Sanctum::actingAs($this->adult());
        $this->postJson('/api/v1/ambassador/self-assign')->assertOk();

        // apply: reaches normal (201) controller behavior.
        Sanctum::actingAs($this->adult());
        $this->postJson('/api/v1/ambassador/apply', [
            'name' => 'Adult Ambassador',
            'mobile' => '+919998880000',
            'upi_id' => 'adult@upi',
        ])->assertCreated();

        // payout-request: gate passes through to controller logic — a fresh
        // adult with zero pending earnings legitimately gets a 422 business
        // error ("exceeds pending earnings"), never a 403 adult_only. That
        // 422 (not 403) is the proof the gate let the request through.
        Sanctum::actingAs($this->adult());
        $response = $this->postJson('/api/v1/ambassador/payout-request', [
            'amount' => 100,
            'payment_method' => 'upi',
            'upi_id' => 'adult@upi',
        ]);
        $response->assertStatus(422);
        $response->assertJsonMissing(['error' => 'adult_only']);
    }

    // ─── /api/ambassador (legacy route file) ─────────────────────────────

    public function test_legacy_minor_is_blocked_from_dashboard(): void
    {
        Sanctum::actingAs($this->minor());

        $this->assertAdultOnly($this->getJson('/api/ambassador/dashboard'));
    }

    public function test_legacy_minor_is_blocked_from_self_assign(): void
    {
        Sanctum::actingAs($this->minor());

        $this->assertAdultOnly($this->postJson('/api/ambassador/self-assign'));
    }

    public function test_legacy_minor_is_blocked_from_apply(): void
    {
        Sanctum::actingAs($this->minor());

        $this->assertAdultOnly($this->postJson('/api/ambassador/apply', [
            'name' => 'Kid Ambassador',
            'mobile' => '+919998887777',
            'upi_id' => 'kid@upi',
        ]));
    }

    public function test_legacy_null_birthday_is_blocked_from_all_endpoints(): void
    {
        Sanctum::actingAs($this->noBirthday());

        $this->assertAdultOnly($this->getJson('/api/ambassador/dashboard'));
        $this->assertAdultOnly($this->postJson('/api/ambassador/self-assign'));
        $this->assertAdultOnly($this->postJson('/api/ambassador/apply', [
            'name' => 'No DOB',
            'mobile' => '+919998887766',
            'upi_id' => 'nodob@upi',
        ]));
    }

    public function test_legacy_adult_passes_the_gate(): void
    {
        // Separate fresh adult users per call — see the v1 equivalent test
        // for why (self-assign's side effect would otherwise change apply's
        // expected outcome).
        Sanctum::actingAs($this->adult());
        $this->getJson('/api/ambassador/dashboard')->assertOk();

        Sanctum::actingAs($this->adult());
        $this->postJson('/api/ambassador/self-assign')->assertOk();

        Sanctum::actingAs($this->adult());
        $this->postJson('/api/ambassador/apply', [
            'name' => 'Adult Ambassador',
            'mobile' => '+919998880001',
            'upi_id' => 'adult2@upi',
        ])->assertCreated();
    }

    // ─── Existing minor ambassador is still blocked ──────────────────────

    public function test_existing_minor_ambassador_is_blocked_from_payout_request(): void
    {
        $minorAmbassador = $this->minor();
        $minorAmbassador->assignRole('ambassador');

        Sanctum::actingAs($minorAmbassador);

        $this->assertAdultOnly($this->postJson('/api/v1/ambassador/payout-request', [
            'amount' => 100,
            'payment_method' => 'upi',
            'upi_id' => 'minor-ambassador@upi',
        ]));
    }
}
