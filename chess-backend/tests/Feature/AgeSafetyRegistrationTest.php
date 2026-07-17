<?php

namespace Tests\Feature;

use App\Models\GuardianChildRelationship;
use App\Models\User;
use App\Services\ChatSafetyService;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * P0-3 launch-readiness: age collection + guardian consent + fail-closed chat.
 *  - registration requires a date of birth,
 *  - a minor (<18) must name a guardian; a guardian account gets a pending,
 *    child-initiated consent request it can approve (stamps guardian_consent_at),
 *  - chat safety treats an unknown age as a child (fails closed).
 */
class AgeSafetyRegistrationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        // Age logic under test, not rate limiting — several registrations per run.
        $this->withoutMiddleware(ThrottleRequests::class);
        Notification::fake();
    }

    private function register(array $overrides = [])
    {
        return $this->postJson('/api/auth/register', array_merge([
            'name' => 'Test Player',
            'email' => 'newplayer@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'captcha_token' => 'test-token',
        ], $overrides));
    }

    public function test_registration_requires_a_birthday(): void
    {
        $this->register()
            ->assertStatus(422)
            ->assertJsonValidationErrors('birthday');
    }

    public function test_adult_can_register_without_a_guardian(): void
    {
        $this->register(['birthday' => now()->subYears(25)->toDateString()])
            ->assertOk()
            ->assertJsonPath('requires_verification', true);

        $user = User::where('email', 'newplayer@example.com')->firstOrFail();
        $this->assertFalse($user->is_minor);
        $this->assertNull($user->guardian_email);
    }

    public function test_minor_registration_requires_guardian_email(): void
    {
        $this->register(['birthday' => now()->subYears(10)->toDateString()])
            ->assertStatus(422)
            ->assertJsonPath('code', 'guardian_email_required');

        $this->assertDatabaseMissing('users', ['email' => 'newplayer@example.com']);
    }

    public function test_minor_signup_creates_pending_consent_request_for_existing_guardian(): void
    {
        $guardian = User::factory()->create(['email' => 'parent@example.com']);

        $this->register([
            'birthday' => now()->subYears(9)->toDateString(),
            'guardian_email' => 'PARENT@example.com', // case-insensitive match
        ])->assertOk();

        $child = User::where('email', 'newplayer@example.com')->firstOrFail();
        $this->assertTrue($child->is_under_13);
        $this->assertSame('parent@example.com', $child->guardian_email);

        $relationship = GuardianChildRelationship::where('child_id', $child->id)
            ->where('guardian_id', $guardian->id)
            ->firstOrFail();
        $this->assertSame(GuardianChildRelationship::STATUS_PENDING, $relationship->status);
        $this->assertSame(GuardianChildRelationship::INITIATED_BY_CHILD, $relationship->initiated_by);

        // Guardian sees it in the consent-request bucket and approves it.
        Sanctum::actingAs($guardian);
        $this->getJson('/api/parent/children')
            ->assertOk()
            ->assertJsonCount(1, 'data.pending_child_consent_requests')
            ->assertJsonCount(0, 'data.pending_children');

        $this->postJson("/api/parent/children/{$relationship->id}/accept")
            ->assertOk()
            ->assertJsonPath('data.status', GuardianChildRelationship::STATUS_ACTIVE);

        // Guardian approval = recorded parental consent.
        $this->assertNotNull($child->fresh()->guardian_consent_at);
    }

    public function test_child_cannot_approve_its_own_consent_request(): void
    {
        $guardian = User::factory()->create(['email' => 'mum@example.com']);
        $this->register([
            'birthday' => now()->subYears(9)->toDateString(),
            'guardian_email' => 'mum@example.com',
        ])->assertOk();

        $child = User::where('email', 'newplayer@example.com')->firstOrFail();
        $relationship = GuardianChildRelationship::where('child_id', $child->id)->firstOrFail();

        Sanctum::actingAs($child);
        $this->postJson("/api/parent/children/{$relationship->id}/accept")
            ->assertForbidden();

        $this->assertNull($child->fresh()->guardian_consent_at);
    }

    public function test_chat_fails_closed_when_birthday_missing(): void
    {
        $service = app(ChatSafetyService::class);

        $unknownAge = User::factory()->create(['birthday' => null]);
        $this->assertTrue($service->requiresPresetOnly($unknownAge));

        $child = User::factory()->create(['birthday' => now()->subYears(10)->toDateString()]);
        $this->assertTrue($service->requiresPresetOnly($child));

        $adult = User::factory()->create(['birthday' => now()->subYears(30)->toDateString()]);
        $this->assertFalse($service->requiresPresetOnly($adult));
    }
}
