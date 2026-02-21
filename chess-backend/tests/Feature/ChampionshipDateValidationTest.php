<?php

namespace Tests\Feature;

use App\Models\Championship;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Tests\TestCase;

/**
 * H5 — start_date validation tests.
 *
 * Verifies that:
 *  1. Creating a championship with start_date in the past is rejected (422).
 *  2. Creating a championship with start_date = today is accepted (201).
 *  3. Creating a championship with start_date in the future is accepted (201).
 *  4. Updating a championship with start_date in the past is rejected (422).
 *  5. Updating a championship with start_date in the future is accepted (200).
 *
 * Authorization is bypassed via Gate::before() so these tests focus solely
 * on date validation logic rather than the permission system.
 */
class ChampionshipDateValidationTest extends TestCase
{
    use RefreshDatabase;

    private User $organizer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->organizer = User::factory()->create();

        // Bypass the 'create-championship' gate so the tests focus on date
        // validation, not on the role/permission system.
        Gate::before(fn($user, $ability) => true);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helper — minimal valid payload for championship creation
    // ──────────────────────────────────────────────────────────────────────────

    private function validPayload(array $overrides = []): array
    {
        return array_merge([
            'title'                    => 'Test Championship',
            'description'              => 'A test championship for date validation',
            'entry_fee'                => 0,
            'max_participants'         => 8,
            'registration_deadline'    => now()->addDay()->toDateTimeString(),
            'start_date'               => now()->addDays(2)->toDateString(),
            'match_time_window_hours'  => 24,
            'time_control_minutes'     => 10,
            'time_control_increment'   => 0,
            'format'                   => 'swiss_only',
            'swiss_rounds'             => 3,
            'visibility'               => 'public',
            'allow_public_registration'=> true,
        ], $overrides);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CREATE — POST /api/v1/championships
    // ──────────────────────────────────────────────────────────────────────────

    public function test_create_with_past_start_date_returns_422(): void
    {
        $payload = $this->validPayload([
            'registration_deadline' => now()->subDays(2)->toDateTimeString(),
            'start_date'            => now()->subDay()->toDateString(),   // yesterday
        ]);

        $this->actingAs($this->organizer, 'sanctum')
            ->postJson('/api/v1/championships', $payload)
            ->assertStatus(422);
    }

    public function test_create_with_today_start_date_is_accepted(): void
    {
        // registration_deadline 1 hour from now, start_date 3 hours from now
        // (still "today" by date). This satisfies all rules:
        //   registration_deadline: after:now ✓
        //   start_date: after_or_equal:today ✓  AND  after:registration_deadline ✓
        $payload = $this->validPayload([
            'registration_deadline' => now()->addHour()->toDateTimeString(),
            'start_date'            => now()->addHours(3)->toDateTimeString(), // today, later
        ]);

        $this->actingAs($this->organizer, 'sanctum')
            ->postJson('/api/v1/championships', $payload)
            ->assertStatus(201);
    }

    public function test_create_with_future_start_date_is_accepted(): void
    {
        $payload = $this->validPayload([
            'registration_deadline' => now()->addDay()->toDateTimeString(),
            'start_date'            => now()->addDays(3)->toDateString(),
        ]);

        $this->actingAs($this->organizer, 'sanctum')
            ->postJson('/api/v1/championships', $payload)
            ->assertStatus(201);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // UPDATE — PUT /api/v1/championships/{id}
    // ──────────────────────────────────────────────────────────────────────────

    public function test_update_with_past_start_date_returns_422(): void
    {
        $championship = Championship::factory()->create([
            'status'    => 'registration_open',
            'created_by'=> $this->organizer->id,
        ]);

        $this->actingAs($this->organizer, 'sanctum')
            ->putJson("/api/v1/championships/{$championship->id}", [
                'registration_deadline' => now()->subDays(2)->toDateTimeString(),
                'start_date'            => now()->subDay()->toDateString(), // yesterday
            ])
            ->assertStatus(422);
    }

    public function test_update_with_future_start_date_is_accepted(): void
    {
        $championship = Championship::factory()->create([
            'status'    => 'registration_open',
            'created_by'=> $this->organizer->id,
        ]);

        $this->actingAs($this->organizer, 'sanctum')
            ->putJson("/api/v1/championships/{$championship->id}", [
                'start_date' => now()->addDays(14)->toDateString(),
            ])
            ->assertStatus(200);
    }
}
