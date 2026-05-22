<?php

namespace Tests\Unit;

use App\Http\Controllers\TacticalProgressController;
use Tests\TestCase;

class TacticalPuzzleScoreTest extends TestCase
{
    private function computeScore(
        int $wrongCount,
        int $myFound,
        int $myTotal,
        int $oppFound,
        int $oppTotal,
        bool $cctUnavailable,
        bool $solutionShown
    ): array {
        $controller = new TacticalProgressController();
        $method = new \ReflectionMethod($controller, 'computePuzzleScore');
        $method->setAccessible(true);

        return $method->invoke(
            $controller,
            $wrongCount,
            $myFound,
            $myTotal,
            $oppFound,
            $oppTotal,
            $cctUnavailable,
            $solutionShown
        );
    }

    /** @test */
    public function zero_available_ccts_are_scored_as_complete(): void
    {
        $score = $this->computeScore(0, 0, 0, 0, 0, true, false);

        $this->assertTrue($score['cctAttempted']);
        $this->assertTrue($score['cctUnavailable']);
        $this->assertSame(100, $score['cctScore']);
        $this->assertSame(1.0, $score['cctQuality']);
        $this->assertSame(100, $score['combined']);
    }

    /** @test */
    public function missing_cct_metadata_still_stays_pending_without_unavailable_flag(): void
    {
        $score = $this->computeScore(0, 0, 0, 0, 0, false, false);

        $this->assertFalse($score['cctAttempted']);
        $this->assertFalse($score['cctUnavailable']);
        $this->assertNull($score['cctScore']);
        $this->assertNull($score['combined']);
    }
}
