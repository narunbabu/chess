<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\EntitlementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EntitlementApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_requires_authentication(): void
    {
        $this->getJson('/api/entitlements/me')
            ->assertUnauthorized();
    }

    public function test_it_returns_free_user_entitlements(): void
    {
        $user = User::factory()->create(['subscription_tier' => 'free']);
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/entitlements/me');

        $response
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.effective_tier', 'free')
            ->assertJsonPath('data.active_subscription', false)
            ->assertJsonPath('data.limits.online_games.daily_limit', 5)
            ->assertJsonPath('data.limits.online_games.remaining', 5);

        $capabilities = $response->json('data.capabilities');
        $this->assertTrue($capabilities[EntitlementService::CAP_PLAY_ONLINE_DAILY_LIMIT]);
        $this->assertFalse($capabilities[EntitlementService::CAP_PLAY_ONLINE_UNLIMITED]);
    }

    public function test_it_returns_active_silver_entitlements(): void
    {
        $user = User::factory()->create([
            'subscription_tier' => 'silver',
            'subscription_expires_at' => now()->addMonth(),
        ]);
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/entitlements/me');

        $response
            ->assertOk()
            ->assertJsonPath('data.effective_tier', 'silver')
            ->assertJsonPath('data.active_subscription', true)
            ->assertJsonPath('data.limits.online_games.unlimited', true)
            ->assertJsonPath('data.limits.online_games.daily_limit', null);

        $capabilities = $response->json('data.capabilities');
        $this->assertTrue($capabilities[EntitlementService::CAP_PLAY_ONLINE_UNLIMITED]);
        $this->assertTrue($capabilities[EntitlementService::CAP_TRAINING_DRILLS_SILVER]);
        $this->assertFalse($capabilities[EntitlementService::CAP_TRAINING_DRILLS_GOLD]);
    }

    public function test_expired_paid_subscription_falls_back_to_free_entitlements(): void
    {
        $user = User::factory()->create([
            'subscription_tier' => 'gold',
            'subscription_expires_at' => now()->subDays(4),
        ]);
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/entitlements/me');

        $response
            ->assertOk()
            ->assertJsonPath('data.personal_tier', 'gold')
            ->assertJsonPath('data.effective_tier', 'free')
            ->assertJsonPath('data.active_subscription', false)
            ->assertJsonPath('data.limits.online_games.daily_limit', 5);

        $capabilities = $response->json('data.capabilities');
        $this->assertFalse($capabilities[EntitlementService::CAP_PLAY_ONLINE_UNLIMITED]);
        $this->assertFalse($capabilities[EntitlementService::CAP_TRAINING_DRILLS_GOLD]);
    }
}
