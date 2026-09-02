<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class MobileReleaseConfigurationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ThrottleRequests::class);
        Notification::fake();
    }

    public function test_health_exposes_chat_kill_switch(): void
    {
        Config::set('features.chat_enabled', false);

        $this->getJson('/api/v1/health')
            ->assertOk()
            ->assertJsonPath('features.chat_enabled', false);
    }

    public function test_native_registration_does_not_require_web_captcha(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'name' => 'Native Player',
            'email' => 'native-player@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'birthday' => now()->subYears(25)->toDateString(),
            'referral_code' => null,
        ])->assertOk();

        $this->assertDatabaseHas('users', [
            'email' => 'native-player@example.com',
        ]);
    }

    public function test_web_registration_still_requires_captcha(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Web Player',
            'email' => 'web-player@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'birthday' => now()->subYears(25)->toDateString(),
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('captcha_token');

        $this->assertDatabaseMissing('users', [
            'email' => 'web-player@example.com',
        ]);
    }
}
