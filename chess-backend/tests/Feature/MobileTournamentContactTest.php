<?php

namespace Tests\Feature;

use App\Models\Championship;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Feature tests for mobile/tournament-contact fields:
 *  - Profile update accepts/rejects mobile numbers
 *  - Tournament registration gates on mobile + consent
 *  - Public endpoints never expose mobile fields
 */
class MobileTournamentContactTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private function openChampionship(int $maxParticipants = 8): Championship
    {
        return Championship::factory()->create([
            'entry_fee'                 => 0,
            'status'                    => 'registration_open',
            'max_participants'          => $maxParticipants,
            'registration_deadline'     => now()->addDays(3),
            'start_date'                => now()->addDays(7),
            'allow_public_registration' => true,
            'visibility'                => 'public',
            'total_rounds'              => 3,
            'swiss_rounds'              => 3,
        ]);
    }

    private function paidChampionship(int $fee = 100): Championship
    {
        return Championship::factory()->create([
            'entry_fee'                 => $fee,
            'status'                    => 'registration_open',
            'max_participants'          => 16,
            'registration_deadline'     => now()->addDays(3),
            'start_date'                => now()->addDays(7),
            'allow_public_registration' => true,
            'visibility'                => 'public',
        ]);
    }

    // ── 1. Profile update accepts valid mobile ────────────────────────────

    public function test_profile_update_accepts_valid_indian_mobile(): void
    {
        $response = $this->actingAs($this->user, 'sanctum')
            ->postJson('/api/profile', [
                'mobile_country_code'       => '+91',
                'mobile_number'             => '9876543210',
                'tournament_contact_consent' => true,
                'whatsapp_updates_opt_in'   => true,
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('user.mobile_number', '9876543210')
            ->assertJsonPath('user.mobile_country_code', '+91');

        $this->assertNotNull($this->user->refresh()->tournament_contact_consent_at);
        $this->assertTrue($this->user->refresh()->whatsapp_updates_opt_in);
    }

    public function test_profile_update_normalizes_mobile_with_formatting(): void
    {
        $response = $this->actingAs($this->user, 'sanctum')
            ->postJson('/api/profile', [
                'mobile_country_code'       => '+91',
                'mobile_number'             => '987-654-3210',
                'tournament_contact_consent' => true,
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('user.mobile_number', '9876543210');
    }

    public function test_profile_update_accepts_international_mobile(): void
    {
        $response = $this->actingAs($this->user, 'sanctum')
            ->postJson('/api/profile', [
                'mobile_country_code'       => '+1',
                'mobile_number'             => '5551234567',
                'tournament_contact_consent' => true,
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('user.mobile_number', '5551234567');
    }

    // ── 2. Profile update rejects invalid mobile ──────────────────────────

    public function test_profile_update_rejects_indian_mobile_with_9_digits(): void
    {
        $response = $this->actingAs($this->user, 'sanctum')
            ->postJson('/api/profile', [
                'mobile_country_code' => '+91',
                'mobile_number'       => '987654321',   // 9 digits
            ]);

        $response->assertStatus(422);
    }

    public function test_profile_update_rejects_indian_mobile_with_11_digits(): void
    {
        $response = $this->actingAs($this->user, 'sanctum')
            ->postJson('/api/profile', [
                'mobile_country_code' => '+91',
                'mobile_number'       => '98765432101',  // 11 digits
            ]);

        $response->assertStatus(422);
    }

    public function test_profile_update_rejects_too_short_international_mobile(): void
    {
        $response = $this->actingAs($this->user, 'sanctum')
            ->postJson('/api/profile', [
                'mobile_country_code' => '+1',
                'mobile_number'       => '12345',  // 5 digits, below minimum 6
            ]);

        $response->assertStatus(422);
    }

    // ── 3. Tournament-contact endpoint ────────────────────────────────────

    public function test_tournament_contact_endpoint_sets_fields(): void
    {
        $response = $this->actingAs($this->user, 'sanctum')
            ->postJson('/api/profile/tournament-contact', [
                'mobile_country_code'       => '+91',
                'mobile_number'             => '9876543210',
                'tournament_contact_consent' => true,
                'whatsapp_updates_opt_in'   => true,
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('user.mobile_country_code', '+91')
            ->assertJsonPath('user.mobile_number', '9876543210');

        $fresh = $this->user->refresh();
        $this->assertNotNull($fresh->tournament_contact_consent_at);
        $this->assertTrue($fresh->whatsapp_updates_opt_in);
    }

    public function test_tournament_contact_rejects_invalid_mobile(): void
    {
        $response = $this->actingAs($this->user, 'sanctum')
            ->postJson('/api/profile/tournament-contact', [
                'mobile_country_code'       => '+91',
                'mobile_number'             => '12345',  // too short for +91
                'tournament_contact_consent' => true,
            ]);

        $response->assertStatus(422);
    }

    // ── 4. Tournament register returns MOBILE_REQUIRED 422 when missing ───

    public function test_register_returns_mobile_required_without_mobile(): void
    {
        $championship = $this->openChampionship();

        $response = $this->actingAs($this->user, 'sanctum')
            ->postJson("/api/v1/championships/{$championship->id}/register");

        $response->assertStatus(422)
            ->assertJsonPath('code', 'MOBILE_REQUIRED')
            ->assertJsonPath('requires_mobile', true);
    }

    public function test_register_returns_mobile_required_without_consent(): void
    {
        $championship = $this->openChampionship();

        // Set mobile but no consent timestamp
        $this->user->update([
            'mobile_country_code' => '+91',
            'mobile_number'       => '9876543210',
            // tournament_contact_consent_at stays null
        ]);

        $response = $this->actingAs($this->user, 'sanctum')
            ->postJson("/api/v1/championships/{$championship->id}/register");

        $response->assertStatus(422)
            ->assertJsonPath('code', 'MOBILE_REQUIRED');
    }

    // ── 5. Tournament register succeeds when mobile + consent present ─────

    public function test_register_succeeds_with_mobile_and_consent(): void
    {
        $championship = $this->openChampionship();
        $this->addMobileConsent($this->user);

        $response = $this->actingAs($this->user, 'sanctum')
            ->postJson("/api/v1/championships/{$championship->id}/register");

        $response->assertStatus(201)
            ->assertJsonPath('message', 'Registration successful');

        $this->assertDatabaseHas('championship_participants', [
            'championship_id' => $championship->id,
            'user_id'         => $this->user->id,
        ]);
    }

    // ── 6. registerWithPayment also gates before Razorpay ─────────────────

    public function test_register_with_payment_returns_mobile_required(): void
    {
        $championship = $this->paidChampionship();

        $response = $this->actingAs($this->user, 'sanctum')
            ->postJson("/api/v1/championships/{$championship->id}/register-with-payment");

        $response->assertStatus(422)
            ->assertJsonPath('code', 'MOBILE_REQUIRED')
            ->assertJsonPath('requires_mobile', true);

        // No participant should have been created
        $this->assertDatabaseCount('championship_participants', 0);
    }

    // ── 7. Public endpoints do not expose mobile fields ───────────────────

    public function test_public_user_list_excludes_mobile_fields(): void
    {
        $this->addMobileConsent($this->user);
        // Set last_activity_at so the user appears as "online"
        $this->user->update(['last_activity_at' => now()]);

        $response = $this->getJson('/api/users');

        $response->assertStatus(200);

        $users = $response->json();
        $found = collect($users)->first(fn ($u) => $u['id'] === $this->user->id);

        $this->assertNotNull($found, 'User should appear in public user list');
        $this->assertArrayNotHasKey('mobile_number', $found);
        $this->assertArrayNotHasKey('mobile_country_code', $found);
        $this->assertArrayNotHasKey('tournament_contact_consent_at', $found);
        $this->assertArrayNotHasKey('whatsapp_updates_opt_in', $found);
        $this->assertArrayNotHasKey('mobile_verified_at', $found);
    }

    public function test_championship_show_participants_exclude_mobile_fields(): void
    {
        $championship = $this->openChampionship();
        $this->addMobileConsent($this->user);

        // Register the user
        $this->actingAs($this->user, 'sanctum')
            ->postJson("/api/v1/championships/{$championship->id}/register")
            ->assertStatus(201);

        // Public show endpoint includes participants
        $response = $this->getJson("/api/v1/championships/{$championship->id}");

        $response->assertStatus(200);

        $participants = $response->json('championship.participants');
        $this->assertNotEmpty($participants);

        $participant = collect($participants)->first();
        $user = $participant['user'] ?? null;

        $this->assertNotNull($user);
        $this->assertArrayNotHasKey('mobile_number', $user);
        $this->assertArrayNotHasKey('mobile_country_code', $user);
        $this->assertArrayNotHasKey('tournament_contact_consent_at', $user);
        $this->assertArrayNotHasKey('whatsapp_updates_opt_in', $user);
    }
}
