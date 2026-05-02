<?php

namespace Tests\Feature;

use App\Models\PendingLocation;
use App\Models\Role;
use App\Models\User;
use App\Models\PlaceRelated\Village;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PendingLocationApprovalTest extends TestCase
{
    use RefreshDatabase;

    public function test_profile_other_village_creates_pending_location_and_keeps_user_text(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/profile', [
                'location_country_id' => 1,
                'location_state_id' => 28,
                'location_district_id' => 5420,
                'location_mandal_id' => 100001,
                'location_village_id' => null,
                'location_other' => 'New Test Village',
            ]);

        $response->assertOk()
            ->assertJsonPath('user.location_other', 'New Test Village');

        $this->assertDatabaseHas('pending_locations', [
            'user_id' => $user->id,
            'level' => 'village',
            'name' => 'New Test Village',
            'mandal_id' => 100001,
            'status' => PendingLocation::STATUS_PENDING,
        ]);

        $this->assertDatabaseMissing('villages', [
            'name' => 'New Test Village',
            'mandal_id' => 100001,
        ]);
    }

    public function test_admin_approval_creates_village_and_backfills_matching_user(): void
    {
        $user = User::factory()->create([
            'location_country_id' => 1,
            'location_state_id' => 28,
            'location_district_id' => 5420,
            'location_mandal_id' => 100001,
            'location_other' => 'Approval Test Village',
        ]);
        $pending = PendingLocation::create([
            'user_id' => $user->id,
            'level' => 'village',
            'name' => 'Approval Test Village',
            'country_id' => 1,
            'state_id' => 28,
            'district_id' => 5420,
            'mandal_id' => 100001,
            'status' => PendingLocation::STATUS_PENDING,
        ]);
        $admin = $this->platformAdmin();

        $response = $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/pending-locations/{$pending->id}/approve");

        $response->assertOk()
            ->assertJsonPath('pending_location.status', PendingLocation::STATUS_APPROVED);

        $village = Village::where('name', 'Approval Test Village')
            ->where('mandal_id', 100001)
            ->first();

        $this->assertNotNull($village);
        $this->assertSame($village->id, $user->refresh()->location_village_id);
        $this->assertNull($user->location_other);
    }

    private function platformAdmin(): User
    {
        $role = Role::firstOrCreate(
            ['name' => 'platform_admin'],
            [
                'display_name' => 'Platform Admin',
                'hierarchy_level' => 100,
                'is_system_role' => true,
            ]
        );

        $admin = User::factory()->create();
        $admin->assignRole($role);

        return $admin;
    }
}
