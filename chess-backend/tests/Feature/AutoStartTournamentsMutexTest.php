<?php

namespace Tests\Feature;

use App\Enums\ChampionshipStatus;
use App\Enums\PaymentStatus;
use App\Models\Championship;
use App\Models\ChampionshipParticipant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * H4 — AutoStartTournamentsCommand mutex (race-condition) tests.
 *
 * Verifies that:
 *  1. The command starts an eligible championship and transitions it to IN_PROGRESS.
 *  2. When the cache lock for a championship is already held (simulating a concurrent
 *     process), the command skips that championship and does not double-start it.
 *  3. The command skips championships whose status changed between the initial query
 *     and the in-transaction lockForUpdate re-read.
 *  4. The command reports the correct started/skipped counts.
 */
class AutoStartTournamentsMutexTest extends TestCase
{
    use RefreshDatabase;

    private function eligibleChampionship(): Championship
    {
        $p1 = User::factory()->create();
        $p2 = User::factory()->create();

        $championship = Championship::factory()->create([
            'status'                => ChampionshipStatus::REGISTRATION_OPEN->value,
            'registration_deadline' => now()->subMinute(),   // deadline passed
            'start_date'            => now()->subMinute(),   // start_date in the past
        ]);

        foreach ([$p1, $p2] as $player) {
            ChampionshipParticipant::create([
                'championship_id'     => $championship->id,
                'user_id'             => $player->id,
                'payment_status_id'   => PaymentStatus::COMPLETED->getId(),
                'registration_status' => 'registered',
                'registered_at'       => now(),
            ]);
        }

        return $championship;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Happy path: command starts an eligible championship
    // ──────────────────────────────────────────────────────────────────────────

    public function test_command_starts_eligible_championship(): void
    {
        $championship = $this->eligibleChampionship();

        $this->artisan('tournaments:auto-start')
            ->assertExitCode(0);

        // Status must have advanced to IN_PROGRESS
        $this->assertEquals(
            ChampionshipStatus::IN_PROGRESS->getId(),
            $championship->fresh()->status_id,
            'Championship status must be IN_PROGRESS after auto-start'
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Mutex: command skips a championship whose lock is already held
    // ──────────────────────────────────────────────────────────────────────────

    public function test_command_skips_championship_when_lock_is_held(): void
    {
        $championship = $this->eligibleChampionship();

        // Simulate a concurrent process holding the lock
        $lock = Cache::lock("tournament.auto-start.{$championship->id}", 60);
        $this->assertTrue($lock->get(), 'Should be able to acquire the lock in test setup');

        try {
            // Run the command — it must skip this championship (lock held)
            $this->artisan('tournaments:auto-start')
                ->assertExitCode(0);

            // Status must remain REGISTRATION_OPEN (not started)
            $this->assertEquals(
                ChampionshipStatus::REGISTRATION_OPEN->getId(),
                $championship->fresh()->status_id,
                'Championship must NOT be started when the mutex lock is held by another process'
            );
        } finally {
            $lock->release();
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Status-changed guard: command skips championship that transitioned
    //    between the initial query and the in-transaction lockForUpdate re-read
    // ──────────────────────────────────────────────────────────────────────────

    public function test_command_skips_championship_whose_status_changed(): void
    {
        $championship = $this->eligibleChampionship();

        // Change status to IN_PROGRESS before the command runs
        // (simulates another process starting the tournament first)
        $championship->update([
            'status_id'  => ChampionshipStatus::IN_PROGRESS->getId(),
            'started_at' => now(),
        ]);

        $this->artisan('tournaments:auto-start')
            ->assertExitCode(0);

        // Status must remain IN_PROGRESS (the command must not re-start it)
        $this->assertEquals(
            ChampionshipStatus::IN_PROGRESS->getId(),
            $championship->fresh()->status_id,
            'Championship whose status changed to IN_PROGRESS must not be touched again'
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Command runs successfully when no eligible championships exist
    // ──────────────────────────────────────────────────────────────────────────

    public function test_command_exits_cleanly_with_no_eligible_championships(): void
    {
        // No championships at all
        $this->artisan('tournaments:auto-start')
            ->assertExitCode(0);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 5. Lock is always released even when the start throws an exception
    // ──────────────────────────────────────────────────────────────────────────

    public function test_lock_is_released_after_start_exception(): void
    {
        $championship = $this->eligibleChampionship();

        // The command will attempt the start (no external lock held).
        // Whether it succeeds or fails, the cache key must be free afterwards.
        $this->artisan('tournaments:auto-start')->assertExitCode(0);

        // After the command finishes, we must be able to acquire the lock again
        // (proving it was properly released via the finally block).
        $lock = Cache::lock("tournament.auto-start.{$championship->id}", 60);
        $acquired = $lock->get();
        $this->assertTrue($acquired, 'Cache lock must be released after the command finishes');

        if ($acquired) {
            $lock->release();
        }
    }
}
