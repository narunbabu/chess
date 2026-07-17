<?php

namespace Tests\Feature;

use App\Models\ReferralCode;
use App\Models\ReferralEarning;
use App\Models\User;
use App\Services\ReferralService;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * A-1 ambassador fraud hardening:
 *  - the ₹2 signup_phone milestone is HELD (unpayable) until real activity,
 *  - first_activity releases the held ₹2 to approved,
 *  - a phone number already used by another account earns nothing.
 */
class ReferralFraudHardeningTest extends TestCase
{
    private ReferralService $svc;

    protected function setUp(): void
    {
        parent::setUp();
        $this->svc = app(ReferralService::class);
    }

    private function referredUser(User $referrer, array $overrides = []): User
    {
        $code = ReferralCode::create([
            'user_id' => $referrer->id,
            'code' => strtoupper(Str::random(8)),
            'is_active' => true,
        ]);

        return User::factory()->create(array_merge([
            'referred_by_user_id' => $referrer->id,
            'referred_by_code_id' => $code->id,
        ], $overrides));
    }

    public function test_signup_phone_milestone_is_held_and_not_payable(): void
    {
        $referrer = User::factory()->create();
        $referred = $this->referredUser($referrer);

        $earning = $this->svc->recordMilestone($referred, 'signup_phone');

        $this->assertNotNull($earning);
        $this->assertSame(ReferralService::STATUS_HELD, $earning->status);

        // Held earnings are excluded from the ambassador's payable balance.
        $this->assertEqualsWithDelta(0.0, $this->svc->getUserStats($referrer)['pending_earnings'], 0.001);
    }

    public function test_first_activity_releases_the_held_signup_phone(): void
    {
        $referrer = User::factory()->create();
        $referred = $this->referredUser($referrer);

        $this->svc->recordMilestone($referred, 'signup_phone');
        $this->svc->recordMilestone($referred, 'first_activity');

        $this->assertSame('approved', ReferralEarning::where('referred_user_id', $referred->id)
            ->where('event_type', 'signup_phone')->value('status'));
        $this->assertSame('approved', ReferralEarning::where('referred_user_id', $referred->id)
            ->where('event_type', 'first_activity')->value('status'));

        // ₹2 + ₹3 now both count toward the payable balance.
        $this->assertEqualsWithDelta(5.0, $this->svc->getUserStats($referrer)['pending_earnings'], 0.001);
    }

    public function test_duplicate_phone_earns_no_signup_phone_milestone(): void
    {
        $referrer = User::factory()->create();

        // Another account already owns this number.
        User::factory()->create([
            'mobile_country_code' => '+91',
            'mobile_number' => '9998887777',
        ]);

        $referred = $this->referredUser($referrer);
        // Saving the phone fires UserReferralObserver::saved.
        $referred->update([
            'mobile_country_code' => '+91',
            'mobile_number' => '9998887777',
        ]);

        $this->assertDatabaseMissing('referral_earnings', [
            'referred_user_id' => $referred->id,
            'event_type' => 'signup_phone',
        ]);
    }

    public function test_unique_phone_still_earns_a_held_signup_phone(): void
    {
        $referrer = User::factory()->create();
        $referred = $this->referredUser($referrer);

        $referred->update([
            'mobile_country_code' => '+91',
            'mobile_number' => '9111222333',
        ]);

        $earning = ReferralEarning::where('referred_user_id', $referred->id)
            ->where('event_type', 'signup_phone')
            ->first();

        $this->assertNotNull($earning);
        $this->assertSame(ReferralService::STATUS_HELD, $earning->status);
    }
}
