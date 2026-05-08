<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TrainingDrillApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_lists_seeded_drills_with_access_flags(): void
    {
        $user = User::factory()->create(['subscription_tier' => 'free']);
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/training/drills');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'data' => [
                    'drills' => [
                        '*' => [
                            'slug',
                            'title',
                            'skill_band',
                            'required_tier',
                            'drill_type',
                            'theme',
                            'is_locked',
                            'progress',
                        ],
                    ],
                    'access',
                ],
            ]);

        $drills = collect($response->json('data.drills'));

        $this->assertFalse($drills->firstWhere('slug', 'queen-support-mate')['is_locked']);
        $this->assertTrue($drills->firstWhere('slug', 'knight-fork-king-rook')['is_locked']);
    }

    public function test_it_records_correct_attempt_and_progress(): void
    {
        $user = User::factory()->create(['subscription_tier' => 'free']);
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/training/drills/queen-support-mate/attempt', [
            'solution' => ['h7e7'],
            'time_spent_seconds' => 12,
            'hints_used' => 0,
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.correct', true)
            ->assertJsonPath('data.progress.attempts', 1)
            ->assertJsonPath('data.progress.solved_count', 1)
            ->assertJsonPath('data.progress.mastery_score', 1);

        $this->assertDatabaseHas('user_training_drill_attempts', [
            'user_id' => $user->id,
            'solved' => true,
            'time_spent_seconds' => 12,
        ]);

        $this->assertDatabaseHas('user_training_drill_progress', [
            'user_id' => $user->id,
            'attempts' => 1,
            'solved_count' => 1,
        ]);
    }

    public function test_it_rejects_paid_drill_for_free_user(): void
    {
        $user = User::factory()->create(['subscription_tier' => 'free']);
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/training/drills/knight-fork-king-rook/attempt', [
            'solution' => ['d4f5'],
        ]);

        $response->assertForbidden()
            ->assertJsonPath('success', false)
            ->assertJsonPath('required_tier', 'silver');
    }

    public function test_it_allows_paid_drill_for_active_silver_user(): void
    {
        $user = User::factory()->create([
            'subscription_tier' => 'silver',
            'subscription_expires_at' => now()->addMonth(),
        ]);
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/training/drills/knight-fork-king-rook/attempt', [
            'solution' => ['d4f5'],
            'time_spent_seconds' => 18,
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.correct', true)
            ->assertJsonPath('data.progress.solved_count', 1);
    }
}
