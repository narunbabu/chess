<?php

namespace Tests\Feature;

use App\Enums\PaymentStatus;
use App\Exceptions\InvalidStateTransitionException;
use App\Models\Championship;
use App\Models\ChampionshipParticipant;
use App\Models\User;
use App\Services\RazorpayService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Covers the payment-status state machine on ChampionshipParticipant and the
 * HTTP registration endpoints that drive it.
 *
 * State machine under test:
 *   pending   → completed | failed
 *   completed → refunded
 *   failed    → pending   (retry)
 *   refunded  → (terminal)
 */
class ChampionshipRegistrationStateMachineTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private Championship $freeChampionship;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();

        // Free, registration-open championship — usable by most tests
        $this->freeChampionship = Championship::factory()->create([
            'entry_fee' => 0,
            'status'    => 'registration_open',
        ]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Insert a participant row directly (bypasses HTTP to test model behaviour).
     */
    private function makeParticipant(string $status = 'pending', ?Championship $champ = null): ChampionshipParticipant
    {
        return ChampionshipParticipant::create([
            'championship_id' => ($champ ?? $this->freeChampionship)->id,
            'user_id'         => $this->user->id,
            'payment_status'  => $status,
            'registered_at'   => now(),
        ]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 1. ALLOWED_TRANSITIONS constant
    // ──────────────────────────────────────────────────────────────────────────

    public function test_allowed_transitions_constant_covers_all_statuses(): void
    {
        $transitions = ChampionshipParticipant::ALLOWED_TRANSITIONS;

        $this->assertArrayHasKey('pending',   $transitions);
        $this->assertArrayHasKey('completed', $transitions);
        $this->assertArrayHasKey('failed',    $transitions);
        $this->assertArrayHasKey('refunded',  $transitions);
    }

    public function test_allowed_transitions_constant_has_correct_edges(): void
    {
        $t = ChampionshipParticipant::ALLOWED_TRANSITIONS;

        $this->assertContains('completed', $t['pending'],   'pending → completed must be allowed');
        $this->assertContains('failed',    $t['pending'],   'pending → failed must be allowed');
        $this->assertContains('refunded',  $t['completed'], 'completed → refunded must be allowed');
        $this->assertContains('pending',   $t['failed'],    'failed → pending (retry) must be allowed');
        $this->assertEmpty($t['refunded'],                  'refunded must be a terminal state');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Valid state transitions (model level)
    // ──────────────────────────────────────────────────────────────────────────

    public function test_pending_transitions_to_completed(): void
    {
        $p = $this->makeParticipant('pending');
        $p->transitionTo(PaymentStatus::COMPLETED);

        $this->assertSame('completed', $p->fresh()->payment_status);
    }

    public function test_pending_transitions_to_failed(): void
    {
        $p = $this->makeParticipant('pending');
        $p->transitionTo(PaymentStatus::FAILED);

        $this->assertSame('failed', $p->fresh()->payment_status);
    }

    public function test_failed_can_retry_to_pending(): void
    {
        $p = $this->makeParticipant('failed');
        $p->transitionTo(PaymentStatus::PENDING);

        $this->assertSame('pending', $p->fresh()->payment_status);
    }

    public function test_completed_transitions_to_refunded(): void
    {
        $p = $this->makeParticipant('completed');
        $p->transitionTo(PaymentStatus::REFUNDED);

        $this->assertSame('refunded', $p->fresh()->payment_status);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Invalid state transitions (model level — must throw)
    // ──────────────────────────────────────────────────────────────────────────

    public function test_completed_cannot_transition_to_failed(): void
    {
        $p = $this->makeParticipant('completed');

        $this->expectException(InvalidStateTransitionException::class);
        $p->transitionTo(PaymentStatus::FAILED);
    }

    public function test_completed_cannot_transition_to_pending(): void
    {
        $p = $this->makeParticipant('completed');

        $this->expectException(InvalidStateTransitionException::class);
        $p->transitionTo(PaymentStatus::PENDING);
    }

    public function test_failed_cannot_transition_to_completed_directly(): void
    {
        $p = $this->makeParticipant('failed');

        $this->expectException(InvalidStateTransitionException::class);
        $p->transitionTo(PaymentStatus::COMPLETED);
    }

    public function test_failed_cannot_transition_to_refunded(): void
    {
        $p = $this->makeParticipant('failed');

        $this->expectException(InvalidStateTransitionException::class);
        $p->transitionTo(PaymentStatus::REFUNDED);
    }

    public function test_refunded_is_terminal_state_cannot_go_to_pending(): void
    {
        $p = $this->makeParticipant('refunded');

        $this->expectException(InvalidStateTransitionException::class);
        $p->transitionTo(PaymentStatus::PENDING);
    }

    public function test_refunded_is_terminal_state_cannot_go_to_completed(): void
    {
        $p = $this->makeParticipant('refunded');

        $this->expectException(InvalidStateTransitionException::class);
        $p->transitionTo(PaymentStatus::COMPLETED);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. markAsPaid / markAsFailed / markAsRefunded convenience methods
    // ──────────────────────────────────────────────────────────────────────────

    public function test_mark_as_paid_sets_completed_and_stores_razorpay_ids(): void
    {
        $p = $this->makeParticipant('pending');
        $p->markAsPaid('pay_test123', 'sig_test456');

        $fresh = $p->fresh();
        $this->assertSame('completed',   $fresh->payment_status);
        $this->assertSame('pay_test123', $fresh->razorpay_payment_id);
        $this->assertSame('sig_test456', $fresh->razorpay_signature);
    }

    public function test_mark_as_paid_throws_if_already_completed(): void
    {
        $p = $this->makeParticipant('completed');

        $this->expectException(InvalidStateTransitionException::class);
        $p->markAsPaid('pay_dup', 'sig_dup');
    }

    public function test_mark_as_paid_throws_if_refunded(): void
    {
        $p = $this->makeParticipant('refunded');

        $this->expectException(InvalidStateTransitionException::class);
        $p->markAsPaid('pay_dup', 'sig_dup');
    }

    public function test_mark_as_failed_transitions_from_pending(): void
    {
        $p = $this->makeParticipant('pending');
        $p->markAsFailed();

        $this->assertSame('failed', $p->fresh()->payment_status);
    }

    public function test_mark_as_failed_throws_if_completed(): void
    {
        $p = $this->makeParticipant('completed');

        $this->expectException(InvalidStateTransitionException::class);
        $p->markAsFailed();
    }

    public function test_mark_as_refunded_transitions_from_completed(): void
    {
        $p = $this->makeParticipant('completed');
        $p->markAsRefunded();

        $this->assertSame('refunded', $p->fresh()->payment_status);
    }

    public function test_mark_as_refunded_throws_if_pending(): void
    {
        $p = $this->makeParticipant('pending');

        $this->expectException(InvalidStateTransitionException::class);
        $p->markAsRefunded();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 5. HTTP endpoint: free registration
    // ──────────────────────────────────────────────────────────────────────────

    public function test_free_registration_creates_completed_participant(): void
    {
        $this->actingAs($this->user);

        $response = $this->postJson("/api/championships/{$this->freeChampionship->id}/register");

        $response->assertStatus(201);
        $this->assertDatabaseHas('championship_participants', [
            'championship_id'   => $this->freeChampionship->id,
            'user_id'           => $this->user->id,
            'payment_status_id' => PaymentStatus::COMPLETED->getId(),
        ]);
    }

    public function test_unauthenticated_registration_is_rejected(): void
    {
        $response = $this->postJson("/api/championships/{$this->freeChampionship->id}/register");

        $response->assertStatus(401);
        $this->assertDatabaseMissing('championship_participants', [
            'championship_id' => $this->freeChampionship->id,
        ]);
    }

    public function test_duplicate_free_registration_is_rejected_with_409(): void
    {
        $this->actingAs($this->user);

        $this->postJson("/api/championships/{$this->freeChampionship->id}/register");
        $response = $this->postJson("/api/championships/{$this->freeChampionship->id}/register");

        $response->assertStatus(409);
        $this->assertSame(
            1,
            ChampionshipParticipant::where([
                'championship_id' => $this->freeChampionship->id,
                'user_id'         => $this->user->id,
            ])->count(),
            'Only one participant record should exist'
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 6. HTTP endpoint: paid registration
    // ──────────────────────────────────────────────────────────────────────────

    public function test_paid_registration_creates_pending_participant_with_order_id(): void
    {
        $paidChamp = Championship::factory()->create([
            'entry_fee' => 100,
            'status'    => 'registration_open',
        ]);

        $this->mock(RazorpayService::class, function ($mock) {
            $mock->shouldReceive('createOrder')->once()->andReturn([
                'order_id' => 'order_abc123',
                'amount'   => 10000,
                'currency' => 'INR',
                'key_id'   => 'rzp_test_key',
            ]);
        });

        $this->actingAs($this->user);
        $response = $this->postJson("/api/championships/{$paidChamp->id}/register-with-payment");

        $response->assertStatus(201);
        $this->assertDatabaseHas('championship_participants', [
            'championship_id'   => $paidChamp->id,
            'user_id'           => $this->user->id,
            'payment_status_id' => PaymentStatus::PENDING->getId(),
            'razorpay_order_id' => 'order_abc123',
        ]);
    }

    public function test_razorpay_failure_cleans_up_pending_participant(): void
    {
        $paidChamp = Championship::factory()->create([
            'entry_fee' => 100,
            'status'    => 'registration_open',
        ]);

        $this->mock(RazorpayService::class, function ($mock) {
            $mock->shouldReceive('createOrder')
                 ->once()
                 ->andThrow(new \RuntimeException('Razorpay API unavailable'));
        });

        $this->actingAs($this->user);
        $response = $this->postJson("/api/championships/{$paidChamp->id}/register-with-payment");

        $response->assertStatus(502);
        // Critical: no orphaned PENDING record that would block a retry
        $this->assertDatabaseMissing('championship_participants', [
            'championship_id' => $paidChamp->id,
            'user_id'         => $this->user->id,
        ]);
    }

    public function test_duplicate_paid_registration_is_rejected_with_409(): void
    {
        $paidChamp = Championship::factory()->create([
            'entry_fee' => 100,
            'status'    => 'registration_open',
        ]);

        $this->mock(RazorpayService::class, function ($mock) {
            $mock->shouldReceive('createOrder')->once()->andReturn([
                'order_id' => 'order_first',
                'amount'   => 10000,
                'currency' => 'INR',
                'key_id'   => 'rzp_test',
            ]);
        });

        $this->actingAs($this->user);

        // First registration succeeds
        $this->postJson("/api/championships/{$paidChamp->id}/register-with-payment");

        // Second should be rejected
        $response = $this->postJson("/api/championships/{$paidChamp->id}/register-with-payment");
        $response->assertStatus(409);

        $this->assertSame(
            1,
            ChampionshipParticipant::where([
                'championship_id' => $paidChamp->id,
                'user_id'         => $this->user->id,
            ])->count()
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 7. Guard: registration closed
    // ──────────────────────────────────────────────────────────────────────────

    public function test_registration_rejected_when_not_open(): void
    {
        $closedChamp = Championship::factory()->create([
            'entry_fee' => 0,
            'status'    => 'upcoming',  // not yet open
        ]);

        $this->actingAs($this->user);
        $response = $this->postJson("/api/championships/{$closedChamp->id}/register");

        $response->assertStatus(422);
        $this->assertDatabaseMissing('championship_participants', [
            'championship_id' => $closedChamp->id,
            'user_id'         => $this->user->id,
        ]);
    }
}
