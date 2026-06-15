<?php

namespace Tests\Feature;

use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\User;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Covers the championship match result-reporting endpoint, which was broken at
 * multiple layers before this fix:
 *  - frontend stub never called the API,
 *  - the controller referenced non-existent ChampionshipResultType::NORMAL_WIN_*
 *    cases (fatal on every win/loss), and
 *  - the 'participate' policy ability was undefined (403 for everyone).
 *
 * assertOk() on a win/loss is itself the regression guard for the enum fatal.
 */
class ChampionshipReportResultTest extends TestCase
{
    private function setupMatch(): array
    {
        Queue::fake(); // isolate from GenerateNextRoundJob dispatched on round completion

        $p1 = User::factory()->create();
        $p2 = User::factory()->create();

        $championship = Championship::factory()->create([
            'visibility' => 'public',
            'format'     => 'swiss_only',
        ]);
        $championship->participantUsers()->attach([$p1->id, $p2->id]);

        $match = ChampionshipMatch::factory()->create([
            'championship_id' => $championship->id,
            'player1_id'      => $p1->id,
            'player2_id'      => $p2->id,
            'status'          => 'pending',
        ]);

        return [$championship, $match, $p1, $p2];
    }

    private function report(int $championshipId, int $matchId, string $result)
    {
        return $this->postJson(
            "/api/championships/{$championshipId}/matches/{$matchId}/result",
            ['result' => $result]
        );
    }

    public function test_participant_can_report_a_win(): void
    {
        [$championship, $match, $p1] = $this->setupMatch();
        Sanctum::actingAs($p1);

        $this->report($championship->id, $match->id, 'win')->assertOk();

        $match->refresh();
        $this->assertSame($p1->id, $match->winner_id);
        $this->assertTrue($match->getStatusEnum()->isFinished());
    }

    public function test_participant_reporting_a_loss_credits_the_opponent(): void
    {
        [$championship, $match, $p1, $p2] = $this->setupMatch();
        Sanctum::actingAs($p1);

        $this->report($championship->id, $match->id, 'loss')->assertOk();

        $match->refresh();
        $this->assertSame($p2->id, $match->winner_id);
    }

    public function test_draw_sets_no_winner(): void
    {
        [$championship, $match, $p1] = $this->setupMatch();
        Sanctum::actingAs($p1);

        $this->report($championship->id, $match->id, 'draw')->assertOk();

        $match->refresh();
        $this->assertNull($match->winner_id);
    }

    public function test_non_participant_cannot_report_result(): void
    {
        [$championship, $match] = $this->setupMatch();
        Sanctum::actingAs(User::factory()->create());

        $this->report($championship->id, $match->id, 'win')->assertStatus(403);
    }

    public function test_invalid_result_value_is_rejected(): void
    {
        [$championship, $match, $p1] = $this->setupMatch();
        Sanctum::actingAs($p1);

        // Validation rejects anything outside win|draw|loss. (Previously the global
        // exception handler turned this 422 into a 500 — fixed in bootstrap/app.php.)
        $this->report($championship->id, $match->id, 'forfeit_win')->assertStatus(422);
    }
}
