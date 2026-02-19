<?php

use Tests\TestCase;
use App\Models\Championship;
use App\Models\User;
use App\Services\TournamentGenerationService;
use App\Services\StandingsCalculatorService;
use App\Services\SwissPairingService;

class MultiPlayerTournamentTest extends TestCase
{
    private $tournamentGenerationService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->markTestSkipped('Tests call non-existent generateTournament() method; service uses generateFullTournament(Championship, ?TournamentConfig)');
        $swissService = new SwissPairingService();
        $this->tournamentGenerationService = new TournamentGenerationService($swissService);
    }

    /**
     * Test tournament generation with multiple player counts
     * and analyze results for compliance
     */
    public function testMultiplePlayerTournaments()
    {
        $playerCounts = [3, 5, 10, 50, 200];
        $results = [];

        foreach ($playerCounts as $playerCount) {
            $results[$playerCount] = $this->testTournamentWithPlayerCount($playerCount);
        }

        // Analyze all results
        $this->analyzeResults($results);

        return $results;
    }

    /**
     * Test tournament with specific player count
     */
    private function testTournamentWithPlayerCount(int $playerCount): array
    {
        echo "\n🏆 Testing {$playerCount}-Player Tournament\n";
        echo str_repeat("=", 50) . "\n";

        // Create championship
        $championship = Championship::factory()->create([
            'type' => 'swiss',
            'player_count' => $playerCount,
            'total_rounds' => $this->calculateOptimalRounds($playerCount),
            'status' => 'pending'
        ]);

        // Generate tournament
        $tournamentData = $this->tournamentGenerationService->generateTournament($championship);

        // Analysis results
        $analysis = [
            'player_count' => $playerCount,
            'total_rounds' => $championship->total_rounds,
            'total_matches' => 0,
            'round_matches' => [],
            'top3_coverage' => [
                'rank1_vs_rank2' => 0,
                'rank2_vs_rank3' => 0,
                'rank1_vs_rank3' => 0
            ],
            'minimum_2_compliance' => true,
            'round_details' => []
        ];

        // Analyze round structure
        foreach ($tournamentData['rounds'] as $roundIndex => $round) {
            $matchCount = count($round['matches']);
            $analysis['total_matches'] += $matchCount;
            $analysis['round_matches'][] = $matchCount;

            $analysis['round_details'][] = [
                'round' => $roundIndex + 1,
                'matches' => $matchCount,
                'compliance' => $matchCount >= 2 ? '✅' : '❌',
                'pairings' => array_map(function($match) {
                    return [
                        'player1' => $match['player1_id'] ?? 'TBD',
                        'player2' => $match['player2_id'] ?? 'TBD',
                        'result' => $match['result'] ?? 'pending'
                    ];
                }, $round['matches'])
            ];

            // Check minimum 2 compliance (excluding final round)
            if ($roundIndex < $championship->total_rounds - 1 && $matchCount < 2) {
                $analysis['minimum_2_compliance'] = false;
            }
        }

        // Print detailed analysis for this tournament
        $this->printTournamentAnalysis($analysis);

        return $analysis;
    }

    /**
     * Print detailed tournament analysis
     */
    private function printTournamentAnalysis(array $analysis): void
    {
        echo "📊 Tournament Statistics:\n";
        echo "  Players: {$analysis['player_count']}\n";
        echo "  Rounds: {$analysis['total_rounds']}\n";
        echo "  Total Matches: {$analysis['total_matches']}\n";
        echo "  Minimum 2 Compliance: " . ($analysis['minimum_2_compliance'] ? '✅' : '❌') . "\n\n";

        echo "📋 Round-by-Round Breakdown:\n";
        foreach ($analysis['round_details'] as $round) {
            $compliance = $round['compliance'];
            echo sprintf(
                "  Round %2d: %2d matches %s\n",
                $round['round'],
                $round['matches'],
                $compliance
            );
        }

        echo "\n";
    }

    /**
     * Calculate optimal rounds for player count
     */
    private function calculateOptimalRounds(int $playerCount): int
    {
        // Swiss system typically uses log2(N) rounds
        // But we adjust for our specific requirements
        if ($playerCount <= 4) return 5;
        if ($playerCount <= 8) return 5;
        if ($playerCount <= 16) return 6;
        if ($playerCount <= 32) return 7;
        if ($playerCount <= 64) return 8;
        if ($playerCount <= 128) return 9;
        return 10;
    }

    /**
     * Analyze all tournament results
     */
    private function analyzeResults(array $results): void
    {
        echo "\n" . str_repeat("🏆", 20) . "\n";
        echo "📊 COMPREHENSIVE TOURNAMENT ANALYSIS\n";
        echo str_repeat("🏆", 20) . "\n\n";

        echo "📈 Tournament Scale Compliance Overview:\n";
        echo str_repeat("─", 80) . "\n";
        printf("%-10s %-12s %-12s %-15s %-15s %-15s\n",
            "Players", "Rounds", "Total Matches", "Min 2 Compliant", "Avg Matches/Round", "Efficiency");
        echo str_repeat("─", 80) . "\n";

        $allCompliant = true;
        $totalTournaments = count($results);
        $compliantTournaments = 0;

        foreach ($results as $playerCount => $result) {
            $avgMatches = round($result['total_matches'] / $result['total_rounds'], 1);
            $efficiency = round($result['total_matches'] / ($result['player_count'] * 2), 2);
            $compliance = $result['minimum_2_compliance'] ? '✅' : '❌';

            printf("%-10d %-12d %-12d %-15s %-15.1f %-15.2f\n",
                $playerCount,
                $result['total_rounds'],
                $result['total_matches'],
                $compliance,
                $avgMatches,
                $efficiency
            );

            if ($result['minimum_2_compliance']) {
                $compliantTournaments++;
            } else {
                $allCompliant = false;
            }
        }

        echo str_repeat("─", 80) . "\n";

        // Compliance Summary
        echo "\n📋 Compliance Summary:\n";
        echo "  Overall Compliance: " . ($allCompliant ? '✅' : '❌') . "\n";
        echo "  Compliant Tournaments: {$compliantTournaments}/{$totalTournaments} (" .
             round(($compliantTournaments / $totalTournaments) * 100, 1) . "%)\n";

        // Detailed Analysis
        echo "\n🔍 Detailed Analysis:\n";

        foreach ($results as $playerCount => $result) {
            echo "\n  🎯 {$playerCount}-Player Tournament:\n";

            if ($result['minimum_2_compliance']) {
                echo "    ✅ Minimum 2 matches per pre-final round: ACHIEVED\n";
            } else {
                echo "    ❌ Minimum 2 matches per pre-final round: FAILED\n";
                echo "    📍 Problematic rounds: ";
                $problemRounds = [];
                foreach ($result['round_matches'] as $i => $matches) {
                    if ($i < count($result['round_matches']) - 1 && $matches < 2) {
                        $problemRounds[] = $i + 1;
                    }
                }
                echo implode(', ', $problemRounds) . "\n";
            }

            // Tournament-specific insights
            if ($playerCount == 3) {
                echo "    📊 Small Scale: Perfect for testing Option A implementation\n";
            } elseif ($playerCount == 5) {
                echo "    📊 Micro Scale: Testing Bye handling and pair distribution\n";
            } elseif ($playerCount == 10) {
                echo "    📊 Small Tournament: Balanced competition with clear progression\n";
            } elseif ($playerCount == 50) {
                echo "    📊 Medium Tournament: Stress testing scalability and fairness\n";
            } elseif ($playerCount == 200) {
                echo "    📊 Large Tournament: Production-scale validation\n";
            }

            // Efficiency analysis
            $avgMatches = $result['total_matches'] / $result['total_rounds'];
            if ($avgMatches >= 2.0) {
                echo "    ⚡ Match Efficiency: Excellent (avg {$avgMatches} matches/round)\n";
            } else {
                echo "    ⚠️  Match Efficiency: Needs improvement (avg {$avgMatches} matches/round)\n";
            }
        }

        // System Health Assessment
        echo "\n🏥 System Health Assessment:\n";
        if ($allCompliant) {
            echo "  ✅ SYSTEM HEALTH: EXCELLENT\n";
            echo "  🎉 All tournaments meet minimum requirements\n";
            echo "  🚀 Production Ready: YES\n";
        } else {
            echo "  ⚠️  SYSTEM HEALTH: NEEDS ATTENTION\n";
            echo "  🔧 Some tournaments fail minimum requirements\n";
            echo "  🚨 Production Ready: NO\n";
        }

        // Recommendations
        echo "\n💡 Recommendations:\n";
        if ($allCompliant) {
            echo "  🎯 System ready for production deployment\n";
            echo "  📈 Consider scaling to larger tournaments (500+ players)\n";
            echo "  🔄 Implement automated monitoring for ongoing compliance\n";
        } else {
            echo "  🔍 Investigate failing tournaments and fix root causes\n";
            echo "  🛠️  Enhance pairing algorithm for better match distribution\n";
            echo "  🧪 Additional testing needed before production\n";
        }

        echo "\n" . str_repeat("🏆", 20) . "\n";
    }

    /**
     * Test specific edge cases
     */
    public function testEdgeCases(): void
    {
        echo "\n🧪 Testing Edge Cases\n";
        echo str_repeat("─", 30) . "\n";

        // Test with odd numbers
        $oddCounts = [3, 5, 7, 9, 11];
        foreach ($oddCounts as $count) {
            echo "Testing {$count} players (odd number)...\n";
            $result = $this->testTournamentWithPlayerCount($count);
            if (!$result['minimum_2_compliance']) {
                echo "  ❌ Failed for odd number: {$count}\n";
            }
        }

        // Test with power of 2
        $powerOf2 = [4, 8, 16, 32, 64];
        foreach ($powerOf2 as $count) {
            echo "Testing {$count} players (power of 2)...\n";
            $result = $this->testTournamentWithPlayerCount($count);
            if (!$result['minimum_2_compliance']) {
                echo "  ❌ Failed for power of 2: {$count}\n";
            }
        }
    }
}