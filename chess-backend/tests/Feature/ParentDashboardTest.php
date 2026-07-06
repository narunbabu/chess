<?php

namespace Tests\Feature;

use App\Mail\ParentWeeklyReportMail;
use App\Models\Game;
use App\Models\GuardianChildRelationship;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Covers the parent dashboard / "My Kids" report-card feature:
 *  - guardian invites a child by email, child accepts, guardian sees the report,
 *  - authorization rules (unknown email, self-link, only-child-accepts, active gate),
 *  - weekly report email is queued,
 *  - an active guardian can download a linked child's PGN (and strangers cannot).
 */
class ParentDashboardTest extends TestCase
{
    private function guardian(): User
    {
        return User::factory()->create([
            'email_notifications_enabled' => true,
        ]);
    }

    public function test_guardian_can_link_child_child_accepts_and_report_loads(): void
    {
        $guardian = $this->guardian();
        $child = User::factory()->create(['email' => 'kid@example.com']);

        // 1. Guardian invites the child.
        Sanctum::actingAs($guardian);
        $invite = $this->postJson('/api/parent/children/invitations', [
            'child_email' => 'KID@example.com', // case-insensitive match
            'relationship_label' => 'Father',
        ]);
        $invite->assertCreated()->assertJsonPath('data.status', GuardianChildRelationship::STATUS_PENDING);
        $relationshipId = $invite->json('data.id');

        // Guardian dashboard shows it as pending, not active.
        $this->getJson('/api/parent/children')
            ->assertOk()
            ->assertJsonCount(0, 'data.children')
            ->assertJsonCount(1, 'data.pending_children');

        // 2. Child accepts.
        Sanctum::actingAs($child);
        $this->getJson('/api/parent/children')
            ->assertOk()
            ->assertJsonCount(1, 'data.pending_guardian_requests');
        $this->postJson("/api/parent/children/{$relationshipId}/accept")
            ->assertOk()
            ->assertJsonPath('data.status', GuardianChildRelationship::STATUS_ACTIVE);

        // 3. Guardian now sees an active child report.
        Sanctum::actingAs($guardian);
        $dashboard = $this->getJson('/api/parent/children')->assertOk();
        $dashboard->assertJsonCount(1, 'data.children');
        $dashboard->assertJsonPath('data.children.0.child.email', 'kid@example.com');

        $report = $this->getJson("/api/parent/children/{$relationshipId}")->assertOk();
        $report->assertJsonPath('data.child.id', $child->id);
        $report->assertJsonStructure([
            'data' => [
                'week' => ['games_played', 'wins', 'losses', 'draws', 'puzzles_solved', 'lessons_completed'],
                'totals' => ['lessons_completed', 'puzzles_solved', 'tactical_rating'],
                'rating_trend',
                'recent_games',
            ],
        ]);
    }

    public function test_cannot_link_unknown_email(): void
    {
        Sanctum::actingAs($this->guardian());

        $this->postJson('/api/parent/children/invitations', [
            'child_email' => 'nobody@example.com',
        ])->assertStatus(422);
    }

    public function test_cannot_link_self(): void
    {
        $guardian = $this->guardian();
        Sanctum::actingAs($guardian);

        $this->postJson('/api/parent/children/invitations', [
            'child_email' => $guardian->email,
        ])->assertStatus(422);
    }

    public function test_only_invited_child_can_accept(): void
    {
        $guardian = $this->guardian();
        $child = User::factory()->create();
        $stranger = User::factory()->create();

        $relationship = GuardianChildRelationship::create([
            'guardian_id' => $guardian->id,
            'child_id' => $child->id,
            'status' => GuardianChildRelationship::STATUS_PENDING,
            'invited_at' => now(),
        ]);

        Sanctum::actingAs($stranger);
        $this->postJson("/api/parent/children/{$relationship->id}/accept")
            ->assertForbidden();
    }

    public function test_report_forbidden_until_link_active(): void
    {
        $guardian = $this->guardian();
        $child = User::factory()->create();

        $relationship = GuardianChildRelationship::create([
            'guardian_id' => $guardian->id,
            'child_id' => $child->id,
            'status' => GuardianChildRelationship::STATUS_PENDING,
            'invited_at' => now(),
        ]);

        Sanctum::actingAs($guardian);
        $this->getJson("/api/parent/children/{$relationship->id}")
            ->assertForbidden();
    }

    public function test_weekly_report_email_is_queued(): void
    {
        Mail::fake();

        $guardian = $this->guardian();
        $child = User::factory()->create();
        $relationship = GuardianChildRelationship::create([
            'guardian_id' => $guardian->id,
            'child_id' => $child->id,
            'status' => GuardianChildRelationship::STATUS_ACTIVE,
            'accepted_at' => now(),
        ]);

        Sanctum::actingAs($guardian);
        $this->postJson("/api/parent/children/{$relationship->id}/weekly-report")
            ->assertOk()
            ->assertJson(['success' => true]);

        Mail::assertQueued(ParentWeeklyReportMail::class, function ($mail) use ($guardian, $child) {
            return $mail->hasTo($guardian->email) && $mail->child->id === $child->id;
        });
    }

    public function test_active_guardian_can_download_child_pgn_but_stranger_cannot(): void
    {
        $guardian = $this->guardian();
        $child = User::factory()->create();
        $opponent = User::factory()->create();
        $stranger = User::factory()->create();

        GuardianChildRelationship::create([
            'guardian_id' => $guardian->id,
            'child_id' => $child->id,
            'status' => GuardianChildRelationship::STATUS_ACTIVE,
            'accepted_at' => now(),
        ]);

        $game = Game::factory()->create([
            'white_player_id' => $child->id,
            'black_player_id' => $opponent->id,
            'status' => 'finished',
            'result' => '1-0',
            'moves' => [['san' => 'e4'], ['san' => 'e5'], ['san' => 'Nf3']],
        ]);

        // Guardian (active link) can download the child's PGN.
        Sanctum::actingAs($guardian);
        $this->get("/api/games/{$game->id}/pgn")
            ->assertOk()
            ->assertHeader('Content-Type', 'application/x-chess-pgn');

        // Unrelated user cannot.
        Sanctum::actingAs($stranger);
        $this->getJson("/api/games/{$game->id}/pgn")
            ->assertForbidden();
    }
}
