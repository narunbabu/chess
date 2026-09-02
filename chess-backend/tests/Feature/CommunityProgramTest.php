<?php

namespace Tests\Feature;

use App\Models\TesterApplication;
use App\Models\TesterSubmission;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CommunityProgramTest extends TestCase
{
    private function adult(): User
    {
        return User::factory()->create(['birthday' => now()->subYears(25)]);
    }

    public function test_public_overview_exposes_both_roles_and_promoter_cap(): void
    {
        $this->getJson('/api/community-programs/overview')
            ->assertOk()
            ->assertJsonPath('organization', 'Ameyem Geo Solutions')
            ->assertJsonPath('programs.promoter.capacity', 20)
            ->assertJsonPath('programs.promoter.monthly_max', 5000)
            ->assertJsonPath('programs.tester.rating_policy', 'Testers are never paid for Play Store ratings or reviews.');
    }

    public function test_minor_cannot_apply_as_tester(): void
    {
        Sanctum::actingAs(User::factory()->create(['birthday' => now()->subYears(10)]));

        $this->postJson('/api/tester-program/apply', [
            'name' => 'Minor tester',
            'mobile' => '+919999999999',
            'upi_id' => 'minor@upi',
            'terms_accepted' => true,
        ])->assertForbidden()->assertJsonPath('error', 'adult_only');
    }

    public function test_adult_can_apply_and_submit_report_after_approval(): void
    {
        $user = $this->adult();
        Sanctum::actingAs($user);

        $this->postJson('/api/tester-program/apply', [
            'name' => 'Adult tester',
            'mobile' => '+919999999998',
            'upi_id' => 'adult@upi',
            'reason' => 'I can test Android and web flows.',
            'terms_accepted' => true,
        ])->assertCreated();

        $application = TesterApplication::where('user_id', $user->id)->firstOrFail();
        $this->postJson('/api/tester-program/submissions', [
            'period' => now()->format('Y-m'),
            'app_name' => 'Equation Runner',
            'test_link' => 'https://example.com/report',
            'feedback_summary' => 'Tested onboarding, the first game, and the settings flow on two Android devices.',
            'issue_count' => 2,
        ])->assertForbidden();

        $application->update(['status' => 'approved']);
        $this->postJson('/api/tester-program/submissions', [
            'period' => now()->format('Y-m'),
            'app_name' => 'Equation Runner',
            'test_link' => 'https://example.com/report',
            'feedback_summary' => 'Tested onboarding, the first game, and the settings flow on two Android devices.',
            'issue_count' => 2,
        ])->assertCreated()->assertJsonPath('submission.status', 'pending');

        $this->assertDatabaseHas('tester_submissions', [
            'user_id' => $user->id,
            'app_name' => 'Equation Runner',
            'status' => 'pending',
        ]);
    }

    public function test_admin_can_approve_report_and_mark_manual_payment(): void
    {
        $admin = $this->adult();
        $admin->assignRole('platform_admin');
        $user = $this->adult();
        $application = TesterApplication::create([
            'user_id' => $user->id,
            'name' => 'Tester',
            'mobile' => '+919999999997',
            'upi_id' => 'tester@upi',
            'consented_at' => now(),
            'status' => 'approved',
        ]);
        $submission = TesterSubmission::create([
            'tester_application_id' => $application->id,
            'user_id' => $user->id,
            'period' => now()->format('Y-m'),
            'app_name' => 'Sum Sprint',
            'test_link' => 'https://example.com/sum-report',
            'feedback_summary' => 'Tested the core loop and submitted reproducible feedback for the scoring flow.',
            'issue_count' => 1,
        ]);

        Sanctum::actingAs($admin);
        $this->postJson("/api/admin/community-programs/tester-submissions/{$submission->id}/review", [
            'status' => 'approved',
            'payout_amount' => 250,
        ])->assertOk();
        $this->postJson("/api/admin/community-programs/tester-submissions/{$submission->id}/review", [
            'status' => 'paid',
            'payout_amount' => 250,
        ])->assertOk();

        $this->assertDatabaseHas('tester_submissions', [
            'id' => $submission->id,
            'status' => 'paid',
            'payout_amount' => 250,
        ]);
    }

    public function test_promoter_self_enrollment_stops_at_twenty_members(): void
    {
        $roleId = DB::table('roles')->where('name', 'ambassador')->value('id');
        User::factory()->count(20)->create(['birthday' => now()->subYears(25)])->each(function (User $user) use ($roleId) {
            DB::table('user_roles')->insert([
                'user_id' => $user->id,
                'role_id' => $roleId,
                'assigned_by' => $user->id,
                'assigned_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        Sanctum::actingAs($this->adult());
        $this->postJson('/api/ambassador/self-assign')
            ->assertStatus(409)
            ->assertJsonPath('error', 'promoter_capacity_reached');
    }
}
