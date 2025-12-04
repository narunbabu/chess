<?php

namespace Tests\Unit\Services;

use Tests\TestCase;
use App\Services\TournamentStructureCalculator;
use Illuminate\Foundation\Testing\RefreshDatabase;

class TournamentStructureCalculatorTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @dataProvider smallTournamentProvider
     */
    public function testSmallTournamentStructure(int $playerCount, array $expected)
    {
        $structure = TournamentStructureCalculator::calculateStructure($playerCount);

        $this->assertEquals($expected['swiss_rounds'], $structure['swiss_rounds'],
            "Swiss rounds mismatch for {$playerCount} players");
        $this->assertEquals($expected['top_k'], $structure['top_k'],
            "Top K mismatch for {$playerCount} players");
        $this->assertEquals($expected['elimination_rounds'], $structure['elimination_rounds'],
            "Elimination rounds mismatch for {$playerCount} players");
        $this->assertEquals($expected['total_rounds'], $structure['total_rounds'],
            "Total rounds mismatch for {$playerCount} players");
    }

    /**
     * @dataProvider mediumTournamentProvider
     */
    public function testMediumTournamentStructure(int $playerCount, array $expected)
    {
        $structure = TournamentStructureCalculator::calculateStructure($playerCount);

        $this->assertEquals($expected['swiss_rounds'], $structure['swiss_rounds']);
        $this->assertEquals($expected['top_k'], $structure['top_k']);
        $this->assertEquals($expected['elimination_rounds'], $structure['elimination_rounds']);
        $this->assertEquals($expected['total_rounds'], $structure['total_rounds']);
    }

    /**
     * @dataProvider largeTournamentProvider
     */
    public function testLargeTournamentStructure(int $playerCount, array $expected)
    {
        $structure = TournamentStructureCalculator::calculateStructure($playerCount);

        $this->assertEquals($expected['swiss_rounds'], $structure['swiss_rounds']);
        $this->assertEquals($expected['top_k'], $structure['top_k']);
        $this->assertEquals($expected['elimination_rounds'], $structure['elimination_rounds']);
        $this->assertEquals($expected['total_rounds'], $structure['total_rounds']);
    }

    /**
     * @dataProvider edgeCaseProvider
     */
    public function testEdgeCaseStructure(int $playerCount, array $expected)
    {
        $structure = TournamentStructureCalculator::calculateStructure($playerCount);

        $this->assertEquals($expected['swiss_rounds'], $structure['swiss_rounds']);
        $this->assertEquals($expected['top_k'], $structure['top_k']);
        $this->assertEquals($expected['elimination_rounds'], $structure['elimination_rounds']);
        $this->assertEquals($expected['total_rounds'], $structure['total_rounds']);
    }

    /**
     * Test specific 10-player tournament (your current case)
     */
    public function testTenPlayerTournament()
    {
        $structure = TournamentStructureCalculator::calculateStructure(10);

        // 10 players should have: 3 Swiss rounds, Top 4 elimination, 2 elimination rounds, 5 total
        $this->assertEquals(3, $structure['swiss_rounds']);
        $this->assertEquals(4, $structure['top_k']);
        $this->assertEquals(2, $structure['elimination_rounds']);
        $this->assertEquals(5, $structure['total_rounds']);
        $this->assertEquals('3 Swiss Rounds → Semifinals → Final', $structure['structure_name']);
    }

    /**
     * Test that Top K is always a power of 2
     */
    public function testTopKIsPowerOfTwo()
    {
        $playerCounts = [3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 16, 17, 20, 24, 25, 32, 33, 48, 50, 64];

        foreach ($playerCounts as $count) {
            $structure = TournamentStructureCalculator::calculateStructure($count);
            $topK = $structure['top_k'];

            if ($topK > 1) {
                // Check if topK is power of 2: (n & (n-1)) == 0 for powers of 2
                $this->assertTrue(($topK & ($topK - 1)) === 0,
                    "Top K {$topK} is not a power of 2 for {$count} players");
            }
        }
    }

    /**
     * Test Swiss rounds formula bounds
     */
    public function testSwissRoundsBounds()
    {
        $testCases = [
            [2, 2],    // Minimum
            [4, 2],    // Very small
            [8, 3],    // Standard small
            [10, 3],   // Your case
            [16, 4],   // Small maximum
            [32, 5],   // Medium standard
            [64, 6],   // Large standard
            [128, 7],  // Maximum supported
        ];

        foreach ($testCases as [$playerCount, $expectedSwiss]) {
            $structure = TournamentStructureCalculator::calculateStructure($playerCount);
            $this->assertEquals($expectedSwiss, $structure['swiss_rounds'],
                "Swiss rounds out of bounds for {$playerCount} players");
        }
    }

    /**
     * Test structure generation creates correct round types
     */
    public function testSwissEliminationRoundGeneration()
    {
        // Test 10 player tournament
        $rounds = TournamentStructureCalculator::generateSwissEliminationStructure(10);

        // Should have 5 rounds total
        $this->assertCount(5, $rounds);

        // Check round types
        $this->assertEquals('swiss', $rounds[0]['round_type']);
        $this->assertEquals('swiss', $rounds[1]['round_type']);
        $this->assertEquals('swiss', $rounds[2]['round_type']);
        $this->assertEquals('semi_final', $rounds[3]['round_type']);
        $this->assertEquals('final', $rounds[4]['round_type']);

        // Check participant counts
        $this->assertEquals(10, $rounds[0]['participant_count']);
        $this->assertEquals(10, $rounds[1]['participant_count']);
        $this->assertEquals(10, $rounds[2]['participant_count']);
        $this->assertEquals(4, $rounds[3]['participant_count']);
        $this->assertEquals(2, $rounds[4]['participant_count']);

        // Check match counts
        $this->assertEquals(5, $rounds[0]['match_count']);
        $this->assertEquals(5, $rounds[1]['match_count']);
        $this->assertEquals(5, $rounds[2]['match_count']);
        $this->assertEquals(2, $rounds[3]['match_count']);
        $this->assertEquals(1, $rounds[4]['match_count']);
    }

    /**
     * Test custom structure generation with overrides
     */
    public function testCustomStructureGeneration()
    {
        // 10 players with custom 4 Swiss rounds
        $structure = TournamentStructureCalculator::generateCustomStructure(10, 4, null);

        $this->assertEquals(4, $structure['swiss_rounds']);
        $this->assertEquals(4, $structure['top_k']); // Default Top K
        $this->assertEquals(2, $structure['elimination_rounds']);
        $this->assertEquals(6, $structure['total_rounds']);

        // 10 players with custom Top 8
        $structure = TournamentStructureCalculator::generateCustomStructure(10, null, 8);

        $this->assertEquals(3, $structure['swiss_rounds']); // Default Swiss
        $this->assertEquals(8, $structure['top_k']);
        $this->assertEquals(3, $structure['elimination_rounds']); // log2(8) = 3
        $this->assertEquals(6, $structure['total_rounds']);
    }

    public static function smallTournamentProvider(): array
    {
        return [
            [2, ['swiss_rounds' => 2, 'top_k' => 2, 'elimination_rounds' => 1, 'total_rounds' => 3]],
            [4, ['swiss_rounds' => 2, 'top_k' => 4, 'elimination_rounds' => 2, 'total_rounds' => 4]],
            [6, ['swiss_rounds' => 3, 'top_k' => 4, 'elimination_rounds' => 2, 'total_rounds' => 5]],
            [7, ['swiss_rounds' => 3, 'top_k' => 4, 'elimination_rounds' => 2, 'total_rounds' => 5]],
            [8, ['swiss_rounds' => 3, 'top_k' => 4, 'elimination_rounds' => 2, 'total_rounds' => 5]],
            [10, ['swiss_rounds' => 3, 'top_k' => 4, 'elimination_rounds' => 2, 'total_rounds' => 5]],
            [12, ['swiss_rounds' => 4, 'top_k' => 8, 'elimination_rounds' => 3, 'total_rounds' => 7]],
            [14, ['swiss_rounds' => 4, 'top_k' => 8, 'elimination_rounds' => 3, 'total_rounds' => 7]],
            [16, ['swiss_rounds' => 4, 'top_k' => 8, 'elimination_rounds' => 3, 'total_rounds' => 7]],
        ];
    }

    public static function mediumTournamentProvider(): array
    {
        return [
            [18, ['swiss_rounds' => 5, 'top_k' => 8, 'elimination_rounds' => 3, 'total_rounds' => 8]],
            [20, ['swiss_rounds' => 5, 'top_k' => 8, 'elimination_rounds' => 3, 'total_rounds' => 8]],
            [24, ['swiss_rounds' => 5, 'top_k' => 8, 'elimination_rounds' => 3, 'total_rounds' => 8]],
            [28, ['swiss_rounds' => 5, 'top_k' => 8, 'elimination_rounds' => 3, 'total_rounds' => 8]],
            [32, ['swiss_rounds' => 5, 'top_k' => 8, 'elimination_rounds' => 3, 'total_rounds' => 8]],
        ];
    }

    public static function largeTournamentProvider(): array
    {
        return [
            [36, ['swiss_rounds' => 6, 'top_k' => 16, 'elimination_rounds' => 4, 'total_rounds' => 10]],
            [40, ['swiss_rounds' => 6, 'top_k' => 16, 'elimination_rounds' => 4, 'total_rounds' => 10]],
            [48, ['swiss_rounds' => 6, 'top_k' => 16, 'elimination_rounds' => 4, 'total_rounds' => 10]],
            [56, ['swiss_rounds' => 6, 'top_k' => 32, 'elimination_rounds' => 5, 'total_rounds' => 11]],
            [64, ['swiss_rounds' => 6, 'top_k' => 32, 'elimination_rounds' => 5, 'total_rounds' => 11]],
        ];
    }

    public static function edgeCaseProvider(): array
    {
        return [
            [3, ['swiss_rounds' => 2, 'top_k' => 4, 'elimination_rounds' => 2, 'total_rounds' => 4]], // 3 players
            [5, ['swiss_rounds' => 3, 'top_k' => 4, 'elimination_rounds' => 2, 'total_rounds' => 5]], // 5 players
            [9, ['swiss_rounds' => 3, 'top_k' => 4, 'elimination_rounds' => 2, 'total_rounds' => 5]], // 9 players
            [11, ['swiss_rounds' => 4, 'top_k' => 8, 'elimination_rounds' => 3, 'total_rounds' => 7]], // 11 players
            [13, ['swiss_rounds' => 4, 'top_k' => 8, 'elimination_rounds' => 3, 'total_rounds' => 7]], // 13 players
            [15, ['swiss_rounds' => 4, 'top_k' => 8, 'elimination_rounds' => 3, 'total_rounds' => 7]], // 15 players
        ];
    }
}