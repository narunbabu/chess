<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Covers the sign-ups histogram data on the admin overview endpoint
 * (GET /admin/dashboard/overview -> signups_by_day). Also guards the
 * DATE(created_at) grouping, which must run on both SQLite and MySQL.
 */
class AdminDashboardSignupsTest extends TestCase
{
    private function platformAdmin(): User
    {
        $role = Role::firstOrCreate(
            ['name' => 'platform_admin'],
            ['display_name' => 'Platform Admin', 'hierarchy_level' => 100, 'is_system_role' => true]
        );
        $admin = User::factory()->create();
        $admin->assignRole($role);

        return $admin;
    }

    public function test_overview_returns_signups_grouped_by_day(): void
    {
        // Two users today, one three days ago.
        User::factory()->count(2)->create(['created_at' => Carbon::today()->setHour(10)]);
        User::factory()->create(['created_at' => Carbon::today()->subDays(3)->setHour(10)]);

        Sanctum::actingAs($this->platformAdmin());

        $res = $this->getJson('/api/admin/dashboard/overview?period=7d');
        $res->assertOk();

        $byDay = collect($res->json('signups_by_day'));
        $this->assertNotEmpty($byDay);

        // Each entry has a date + integer count, and today has at least the 2 we made.
        $byDay->each(function ($row) {
            $this->assertArrayHasKey('date', $row);
            $this->assertArrayHasKey('count', $row);
            $this->assertIsInt($row['count']);
        });

        $today = Carbon::today()->toDateString();
        $todayRow = $byDay->firstWhere('date', $today);
        $this->assertNotNull($todayRow);
        $this->assertGreaterThanOrEqual(2, $todayRow['count']);
    }
}
