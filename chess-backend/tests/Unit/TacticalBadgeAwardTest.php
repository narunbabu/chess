<?php

namespace Tests\Unit;

use App\Http\Controllers\TacticalProgressController;
use App\Models\TacticalBadge;
use App\Models\TacticalPuzzleAttempt;
use App\Models\UserTacticalBadge;
use App\Models\UserTacticalStats;
use App\Models\User;
use Tests\TestCase;

class TacticalBadgeAwardTest extends TestCase
{
    private int $userId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->userId = User::factory()->create()->id;
    }

    private function awardBadges(UserTacticalStats $stats): array
    {
        $controller = new TacticalProgressController();
        $method = new \ReflectionMethod($controller, 'awardBadges');
        $method->setAccessible(true);
        return $method->invoke($controller, $this->userId, $stats);
    }

    /** @test */
    public function first_solve_awarded_when_total_solved_is_one(): void
    {
        $stats = UserTacticalStats::create([
            'user_id' => $this->userId,
            'rating' => 1000,
            'total_solved' => 1,
            'total_attempted' => 1,
            'streak' => 1,
            'best_streak' => 1,
            'peak_rating' => 1000,
        ]);

        $awarded = $this->awardBadges($stats);

        $this->assertContains('first_solve', collect($awarded)->pluck('slug'));

        $badge = TacticalBadge::where('slug', 'first_solve')->first();
        $this->assertDatabaseHas('user_tactical_badges', [
            'user_id' => $this->userId,
            'badge_id' => $badge->id,
        ]);
    }

    /** @test */
    public function first_solve_not_awarded_when_total_solved_is_zero(): void
    {
        $stats = UserTacticalStats::create([
            'user_id' => $this->userId,
            'rating' => 1000,
            'total_solved' => 0,
            'total_attempted' => 1,
            'streak' => 0,
            'best_streak' => 0,
            'peak_rating' => 1000,
        ]);

        $awarded = $this->awardBadges($stats);

        $this->assertNotContains('first_solve', collect($awarded)->pluck('slug'));
    }

    /** @test */
    public function first_solve_not_duplicated_on_second_call(): void
    {
        $stats = UserTacticalStats::create([
            'user_id' => $this->userId,
            'rating' => 1000,
            'total_solved' => 1,
            'total_attempted' => 1,
            'streak' => 1,
            'best_streak' => 1,
            'peak_rating' => 1000,
        ]);

        $first = $this->awardBadges($stats);
        $this->assertContains('first_solve', collect($first)->pluck('slug'));

        $second = $this->awardBadges($stats);
        $this->assertNotContains('first_solve', collect($second)->pluck('slug'));

        $badge = TacticalBadge::where('slug', 'first_solve')->first();
        $this->assertEquals(1, UserTacticalBadge::where('user_id', $this->userId)->where('badge_id', $badge->id)->count());
    }

    /** @test */
    public function non_cct_successful_attempt_awards_first_solve_after_gate_fix(): void
    {
        // After the cctAttempted gate fix: a successful non-CCT solve
        // must still increment total_solved so badges are awarded.
        $stats = UserTacticalStats::create([
            'user_id' => $this->userId,
            'rating' => 1000,
            'total_solved' => 1,
            'total_attempted' => 0,
            'streak' => 1,
            'best_streak' => 1,
            'peak_rating' => 1000,
        ]);

        TacticalPuzzleAttempt::create([
            'user_id' => $this->userId,
            'stage_id' => 0,
            'puzzle_id' => 'puz_001',
            'success' => true,
            'wrong_count' => 0,
            'solution_shown' => false,
            'cct_attempted' => false,
            'rating_delta' => 0,
            'rating_before' => 1000,
            'rating_after' => 1000,
            'created_at' => now(),
        ]);

        $awarded = $this->awardBadges($stats);

        $this->assertContains(
            'first_solve',
            collect($awarded)->pluck('slug'),
            'Non-CCT successful attempt should award first_solve when total_solved=1'
        );
    }
}
