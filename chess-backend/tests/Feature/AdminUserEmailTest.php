<?php

namespace Tests\Feature;

use App\Mail\AdminCustomMail;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Covers the admin "send custom email" endpoint
 * (POST /admin/dashboard/user/{id}/email):
 *  - platform admin can queue a custom mail to a user,
 *  - non-admins are blocked by the admin.dashboard middleware (403),
 *  - invalid payloads are rejected (422),
 *  - org admins cannot email users outside their organization.
 */
class AdminUserEmailTest extends TestCase
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

    public function test_platform_admin_can_queue_custom_email(): void
    {
        Mail::fake();
        Sanctum::actingAs($this->platformAdmin());
        $target = User::factory()->create(['email' => 'recipient@example.com']);

        $res = $this->postJson("/api/admin/dashboard/user/{$target->id}/email", [
            'subject' => 'Welcome to Chess99',
            'body'    => "Hi there,\nThanks for joining.",
        ]);

        $res->assertOk()->assertJson(['success' => true]);
        Mail::assertQueued(AdminCustomMail::class, function ($mail) use ($target) {
            return $mail->hasTo($target->email)
                && $mail->subjectLine === 'Welcome to Chess99';
        });
    }

    public function test_non_admin_is_forbidden(): void
    {
        Mail::fake();
        Sanctum::actingAs(User::factory()->create());
        $target = User::factory()->create();

        $this->postJson("/api/admin/dashboard/user/{$target->id}/email", [
            'subject' => 'Hi',
            'body'    => 'Hello',
        ])->assertForbidden();

        Mail::assertNothingQueued();
    }

    public function test_invalid_payload_is_rejected(): void
    {
        Mail::fake();
        Sanctum::actingAs($this->platformAdmin());
        $target = User::factory()->create();

        $this->postJson("/api/admin/dashboard/user/{$target->id}/email", [
            'subject' => '',
            'body'    => '',
        ])->assertStatus(422);

        Mail::assertNothingQueued();
    }

    public function test_org_admin_cannot_email_user_outside_org(): void
    {
        Mail::fake();

        $orgRole = Role::firstOrCreate(
            ['name' => 'organization_admin'],
            ['display_name' => 'Organization Admin', 'hierarchy_level' => 50, 'is_system_role' => true]
        );
        $orgA = \App\Models\Organization::create(['name' => 'Org A', 'slug' => 'org-a']);
        $orgB = \App\Models\Organization::create(['name' => 'Org B', 'slug' => 'org-b']);

        $orgAdmin = User::factory()->create(['organization_id' => $orgA->id]);
        $orgAdmin->assignRole($orgRole);
        Sanctum::actingAs($orgAdmin);

        $target = User::factory()->create(['organization_id' => $orgB->id]);

        $this->postJson("/api/admin/dashboard/user/{$target->id}/email", [
            'subject' => 'Hi',
            'body'    => 'Hello',
        ])->assertForbidden();

        Mail::assertNothingQueued();
    }
}
