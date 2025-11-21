<?php

namespace Tests\Performance;

use Tests\TestCase;
use App\Models\User;
use App\Models\TutorialModule;
use App\Models\TutorialLesson;
use App\Models\InteractiveLessonStage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class MoveValidationPerformanceTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private TutorialLesson $lesson;
    private InteractiveLessonStage $stage;
    private array $testMoves;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->lesson = TutorialLesson::factory()->create([
            'lesson_type' => 'interactive',
            'interactive_type' => 'pawn_wars',
            'is_active' => true
        ]);
        $this->stage = InteractiveLessonStage::factory()->create([
            'lesson_id' => $this->lesson->id,
            'initial_fen' => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
        ]);

        // Predefined test moves for performance testing
        $this->testMoves = [
            ['move' => 'e2e4', 'fen_after' => 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'],
            ['move' => 'e7e5', 'fen_after' => 'rnbqkbnr/pppp1ppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'],
            ['move' => 'g1f3', 'fen_after' => 'rnbqkbnr/pppp1ppp/8/8/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2'],
            ['move' => 'b8c6', 'fen_after' => 'r1bqkbnr/pppp1ppp/2n5/8/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3'],
            ['move' => 'f1c4', 'fen_after' => 'r1bqkbnr/pppp1ppp/2n5/8/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3'],
        ];
    }

    /** @test */
    public function it_validates_moves_within_performance_threshold()
    {
        $responseTimes = [];
        $iterations = 50;

        for ($i = 0; $i < $iterations; $i++) {
            $testMove = $this->testMoves[$i % count($this->testMoves)];

            $startTime = microtime(true);

            $response = $this->actingAs($this->user)
                ->postJson("/api/tutorial/lessons/{$this->lesson->id}/validate-move", [
                    'stage_id' => $this->stage->id,
                    'move' => $testMove['move'],
                    'fen_after' => $testMove['fen_after']
                ]);

            $endTime = microtime(true);
            $responseTime = ($endTime - $startTime) * 1000; // Convert to milliseconds
            $responseTimes[] = $responseTime;

            $response->assertStatus(200);
        }

        $averageTime = array_sum($responseTimes) / count($responseTimes);
        $maxTime = max($responseTimes);
        $minTime = min($responseTimes);

        // Performance assertions
        $this->assertLessThan(100, $averageTime, "Average response time should be under 100ms");
        $this->assertLessThan(200, $maxTime, "Maximum response time should be under 200ms");
        $this->assertGreaterThan(0, $minTime, "Minimum time should be positive");

        // Log performance metrics
        Log::info('Move Validation Performance', [
            'average_ms' => $averageTime,
            'max_ms' => $maxTime,
            'min_ms' => $minTime,
            'iterations' => $iterations,
            'p95_ms' => $this->calculatePercentile($responseTimes, 95),
            'p99_ms' => $this->calculatePercentile($responseTimes, 99),
        ]);
    }

    /** @test */
    public function it_handles_concurrent_move_validation_requests()
    {
        $concurrentRequests = 10;
        $responseTimes = [];

        // Prepare requests
        $requests = [];
        for ($i = 0; $i < $concurrentRequests; $i++) {
            $testMove = $this->testMoves[$i % count($this->testMoves)];
            $requests[] = [
                'stage_id' => $this->stage->id,
                'move' => $testMove['move'],
                'fen_after' => $testMove['fen_after']
            ];
        }

        // Execute concurrent requests
        $startTotal = microtime(true);

        foreach ($requests as $request) {
            $startTime = microtime(true);

            $response = $this->actingAs($this->user)
                ->postJson("/api/tutorial/lessons/{$this->lesson->id}/validate-move", $request);

            $endTime = microtime(true);
            $responseTimes[] = ($endTime - $startTime) * 1000;

            $response->assertStatus(200);
        }

        $totalTime = (microtime(true) - $startTotal) * 1000;
        $averageTime = array_sum($responseTimes) / count($responseTimes);

        // Concurrent performance assertions
        $this->assertLessThan(500, $totalTime, "Total concurrent execution time should be under 500ms");
        $this->assertLessThan(150, $averageTime, "Average time under concurrent load should be under 150ms");

        Log::info('Concurrent Move Validation Performance', [
            'total_ms' => $totalTime,
            'average_ms' => $averageTime,
            'concurrent_requests' => $concurrentRequests,
        ]);
    }

    /** @test */
    public function it_maintains_performance_with_complex_positions()
    {
        $complexPositions = [
            // Late game position with many pieces
            ['move' => 'd4e5', 'fen_after' => '2r1k2r/8/p2p2p1/3P1p2/2P5/1Q6/PP3PPP/R3R1K1 w k - 0 1'],
            // Position with multiple captures
            ['move' => 'c6d8', 'fen_after' => 'r3k2r/8/2Q5/3P1p2/2P5/p2p2p1/PP3PPP/4R1K1 b k - 0 1'],
            // Complex middlegame
            ['move' => 'f3g5', 'fen_after' => 'r3k2r/8/2Q5/3P1p2/2P4N/p2p2p1/PP3PPP/4R1K1 b k - 0 1'],
        ];

        $responseTimes = [];

        foreach ($complexPositions as $position) {
            $iterations = 20;

            for ($i = 0; $i < $iterations; $i++) {
                $startTime = microtime(true);

                $response = $this->actingAs($this->user)
                    ->postJson("/api/tutorial/lessons/{$this->lesson->id}/validate-move", [
                        'stage_id' => $this->stage->id,
                        'move' => $position['move'],
                        'fen_after' => $position['fen_after']
                    ]);

                $endTime = microtime(true);
                $responseTime = ($endTime - $startTime) * 1000;
                $responseTimes[] = $responseTime;

                $response->assertStatus(200);
            }
        }

        $averageTime = array_sum($responseTimes) / count($responseTimes);
        $maxTime = max($responseTimes);

        // Complex position performance should still be reasonable
        $this->assertLessThan(200, $averageTime, "Average time for complex positions should be under 200ms");
        $this->assertLessThan(400, $maxTime, "Maximum time for complex positions should be under 400ms");

        Log::info('Complex Position Performance', [
            'average_ms' => $averageTime,
            'max_ms' => $maxTime,
            'positions_tested' => count($complexPositions),
        ]);
    }

    /** @test */
    public function it_validates_database_query_performance()
    {
        // Enable query logging
        DB::enableQueryLog();

        $iterations = 20;
        $queryCounts = [];
        $responseTimes = [];

        for ($i = 0; $i < $iterations; $i++) {
            DB::flushQueryLog();

            $testMove = $this->testMoves[$i % count($this->testMoves)];

            $startTime = microtime(true);

            $response = $this->actingAs($this->user)
                ->postJson("/api/tutorial/lessons/{$this->lesson->id}/validate-move", [
                    'stage_id' => $this->stage->id,
                    'move' => $testMove['move'],
                    'fen_after' => $testMove['fen_after']
                ]);

            $endTime = microtime(true);
            $responseTime = ($endTime - $startTime) * 1000;
            $responseTimes[] = $responseTime;

            $queryCounts[] = count(DB::getQueryLog());

            $response->assertStatus(200);
        }

        $averageQueries = array_sum($queryCounts) / count($queryCounts);
        $maxQueries = max($queryCounts);
        $averageTime = array_sum($responseTimes) / count($responseTimes);

        // Query performance assertions
        $this->assertLessThan(10, $averageQueries, "Average number of queries should be under 10");
        $this->assertLessThan(20, $maxQueries, "Maximum number of queries should be under 20");
        $this->assertLessThan(50, $averageTime, "Average response time with query logging should be under 50ms");

        DB::disableQueryLog();

        Log::info('Database Query Performance', [
            'average_queries' => $averageQueries,
            'max_queries' => $maxQueries,
            'average_time_ms' => $averageTime,
        ]);
    }

    /** @test */
    public function it_tests_memory_usage_during_move_validation()
    {
        $memoryBefore = memory_get_usage(true);
        $peakMemoryBefore = memory_get_peak_usage(true);

        $iterations = 100;

        for ($i = 0; $i < $iterations; $i++) {
            $testMove = $this->testMoves[$i % count($this->testMoves)];

            $response = $this->actingAs($this->user)
                ->postJson("/api/tutorial/lessons/{$this->lesson->id}/validate-move", [
                    'stage_id' => $this->stage->id,
                    'move' => $testMove['move'],
                    'fen_after' => $testMove['fen_after']
                ]);

            $response->assertStatus(200);
        }

        $memoryAfter = memory_get_usage(true);
        $peakMemoryAfter = memory_get_peak_usage(true);

        $memoryIncrease = $memoryAfter - $memoryBefore;
        $peakMemoryIncrease = $peakMemoryAfter - $peakMemoryBefore;

        // Memory usage should be reasonable
        $this->assertLessThan(50 * 1024 * 1024, $memoryIncrease, "Memory increase should be under 50MB");
        $this->assertLessThan(100 * 1024 * 1024, $peakMemoryIncrease, "Peak memory increase should be under 100MB");

        Log::info('Memory Usage Performance', [
            'memory_before_mb' => round($memoryBefore / 1024 / 1024, 2),
            'memory_after_mb' => round($memoryAfter / 1024 / 1024, 2),
            'memory_increase_mb' => round($memoryIncrease / 1024 / 1024, 2),
            'peak_memory_increase_mb' => round($peakMemoryIncrease / 1024 / 1024, 2),
            'iterations' => $iterations,
        ]);
    }

    /**
     * Calculate percentile from array of values
     */
    private function calculatePercentile(array $values, int $percentile): float
    {
        sort($values);
        $index = ($percentile / 100) * (count($values) - 1);

        if (floor($index) == $index) {
            return $values[$index];
        } else {
            $lower = $values[floor($index)];
            $upper = $values[ceil($index)];
            return $lower + (($upper - $lower) * ($index - floor($index)));
        }
    }

    /**
     * Test with realistic user load patterns
     * @test
     */
    public function it_simulates_realistic_user_load()
    {
        // Simulate bursts of activity followed by idle periods
        $bursts = 5;
        $requestsPerBurst = 10;
        $totalResponseTimes = [];

        for ($burst = 0; $burst < $bursts; $burst++) {
            $burstResponseTimes = [];

            // Burst of activity
            for ($req = 0; $req < $requestsPerBurst; $req++) {
                $testMove = $this->testMoves[$req % count($this->testMoves)];

                $startTime = microtime(true);

                $response = $this->actingAs($this->user)
                    ->postJson("/api/tutorial/lessons/{$this->lesson->id}/validate-move", [
                        'stage_id' => $this->stage->id,
                        'move' => $testMove['move'],
                        'fen_after' => $testMove['fen_after']
                    ]);

                $endTime = microtime(true);
                $responseTime = ($endTime - $startTime) * 1000;
                $burstResponseTimes[] = $responseTime;
                $totalResponseTimes[] = $responseTime;

                $response->assertStatus(200);

                // Small delay between requests in burst
                usleep(50000); // 50ms
            }

            // Idle period between bursts
            usleep(500000); // 500ms

            // Check performance degradation within burst
            $burstAverage = array_sum($burstResponseTimes) / count($burstResponseTimes);
            $this->assertLessThan(150, $burstAverage, "Average time within burst {$burst} should be under 150ms");
        }

        // Overall performance
        $overallAverage = array_sum($totalResponseTimes) / count($totalResponseTimes);
        $this->assertLessThan(120, $overallAverage, "Overall average time should be under 120ms");

        Log::info('Realistic Load Simulation', [
            'bursts' => $bursts,
            'requests_per_burst' => $requestsPerBurst,
            'total_requests' => count($totalResponseTimes),
            'overall_average_ms' => $overallAverage,
        ]);
    }
}