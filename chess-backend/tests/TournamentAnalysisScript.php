<?php

require_once __DIR__ . '/../vendor/autoload.php';

use Illuminate\Foundation\Application;
use App\Services\TournamentGenerationService;
use App\Services\SwissPairingService;
use App\Models\Championship;
use App\Models\ChampionshipFormat;
use App\Models\ChampionshipStatus;

/**
 * Tournament Analysis Script
 *
 * This script analyzes tournament generation for different player counts
 * and validates compliance with minimum 2 games requirement.
 */

echo "🏆 Tournament Analysis Script\n";
echo str_repeat("=", 50) . "\n";
echo "Testing Tournament Generation Compliance\n";
echo "Player Counts: 3, 5, 10, 50, 200\n\n";

// Bootstrap Laravel
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

// Initialize service
$swissService = new SwissPairingService();
$tournamentService = new TournamentGenerationService($swissService);

// Test data
$playerCounts = [3, 5, 10, 50, 200];
$results = [];
$totalPassed = 0;

foreach ($playerCounts as $playerCount) {
    echo "🎯 Testing {$playerCount}-Player Tournament\n";
    echo str_repeat("-", 40) . "\n";

    try {
        // Create championship
        $championship = new Championship();
        $championship->title = "{$playerCount} Player Analysis Tournament";
        $championship->description = "Analysis test for {$playerCount} players";
        $championship->max_participants = $playerCount;
        $championship->total_rounds = calculateOptimalRounds($playerCount);
        $championship->format_id = ChampionshipFormat::where('code', 'swiss_elimination')->first()->id;
        $championship->status_id = ChampionshipStatus::where('code', 'upcoming')->first()->id;
        $championship->save();

        echo "✅ Championship created (ID: {$championship->id})\n";

        // Generate tournament
        $tournamentData = $tournamentService->generateTournament($championship);

        echo "✅ Tournament generated\n";

        // Analyze results
        $analysis = analyzeTournamentData($tournamentData, $playerCount);
        $results[$playerCount] = $analysis;

        // Print analysis
        printTournamentAnalysis($analysis);

        if ($analysis['compliant']) {
            $totalPassed++;
        }

        // Cleanup
        $championship->delete();

    } catch (Exception $e) {
        echo "❌ Failed: " . $e->getMessage() . "\n";
        $results[$playerCount] = [
            'player_count' => $playerCount,
            'compliant' => false,
            'error' => $e->getMessage()
        ];
    }

    echo "\n";
}

// Generate final report
generateFinalReport($results, $totalPassed);

/**
 * Calculate optimal rounds for player count
 */
function calculateOptimalRounds(int $playerCount): int
{
    if ($playerCount <= 4) return 5;
    if ($playerCount <= 8) return 5;
    if ($playerCount <= 16) return 6;
    if ($playerCount <= 32) return 7;
    if ($playerCount <= 64) return 8;
    if ($playerCount <= 128) return 9;
    return 10;
}

/**
 * Analyze tournament data
 */
function analyzeTournamentData(array $tournamentData, int $playerCount): array
{
    $totalMatches = 0;
    $roundMatches = [];
    $complianceIssues = [];

    foreach ($tournamentData['rounds'] as $roundIndex => $round) {
        $matchCount = count($round['matches'] ?? []);
        $totalMatches += $matchCount;
        $roundMatches[] = $matchCount;

        // Check minimum 2 compliance (excluding final round)
        if ($roundIndex < count($tournamentData['rounds']) - 1 && $matchCount < 2) {
            $complianceIssues[] = $roundIndex + 1;
        }
    }

    return [
        'player_count' => $playerCount,
        'total_rounds' => count($tournamentData['rounds']),
        'total_matches' => $totalMatches,
        'round_matches' => $roundMatches,
        'compliance_issues' => $complianceIssues,
        'compliant' => empty($complianceIssues),
        'avg_matches_per_round' => round($totalMatches / count($tournamentData['rounds']), 1),
        'efficiency' => round($totalMatches / ($playerCount * 2), 2)
    ];
}

/**
 * Print tournament analysis
 */
function printTournamentAnalysis(array $analysis): void
{
    echo "📊 Analysis Results:\n";
    echo "  Players: {$analysis['player_count']}\n";
    echo "  Rounds: {$analysis['total_rounds']}\n";
    echo "  Total Matches: {$analysis['total_matches']}\n";
    echo "  Average Matches/Round: {$analysis['avg_matches_per_round']}\n";
    echo "  Tournament Efficiency: {$analysis['efficiency']}\n";

    if ($analysis['compliant']) {
        echo "  ✅ Minimum 2 Compliance: PASSED\n";
    } else {
        echo "  ❌ Minimum 2 Compliance: FAILED\n";
        echo "  📍 Problematic Rounds: " . implode(', ', $analysis['compliance_issues']) . "\n";
    }

    echo "📋 Round Breakdown:\n";
    foreach ($analysis['round_matches'] as $i => $matches) {
        $compliance = $matches >= 2 ? '✅' : '❌';
        echo sprintf("    Round %2d: %2d matches %s\n", $i + 1, $matches, $compliance);
    }
}

/**
 * Generate final report
 */
function generateFinalReport(array $results, int $totalPassed): void
{
    echo str_repeat("🏆", 20) . "\n";
    echo "📊 COMPREHENSIVE ANALYSIS REPORT\n";
    echo str_repeat("🏆", 20) . "\n\n";

    echo "📈 Tournament Scale Overview:\n";
    echo str_repeat("─", 80) . "\n";
    printf("%-10s %-12s %-12s %-15s %-15s %-15s\n",
        "Players", "Rounds", "Total Matches", "Compliance", "Avg/Round", "Efficiency");
    echo str_repeat("─", 80) . "\n";

    foreach ($results as $playerCount => $result) {
        if (isset($result['error'])) {
            printf("%-10d %-12s %-12s %-15s %-15s %-15s\n",
                $playerCount, "ERROR", "ERROR", "❌ FAILED", "N/A", "N/A");
        } else {
            printf("%-10d %-12d %-12d %-15s %-15.1f %-15.2f\n",
                $playerCount,
                $result['total_rounds'],
                $result['total_matches'],
                $result['compliant'] ? '✅ PASSED' : '❌ FAILED',
                $result['avg_matches_per_round'],
                $result['efficiency']
            );
        }
    }

    echo str_repeat("─", 80) . "\n\n";

    // Compliance Summary
    $totalTournaments = count($results);
    $complianceRate = round(($totalPassed / $totalTournaments) * 100, 1);

    echo "📋 Compliance Summary:\n";
    echo "  Overall Compliance Rate: {$complianceRate}% ({$totalPassed}/{$totalTournaments})\n";

    if ($totalPassed === $totalTournaments) {
        echo "  ✅ SYSTEM HEALTH: EXCELLENT\n";
        echo "  🚀 Production Ready: YES\n";
        echo "  🎉 All tournaments meet minimum requirements\n";
    } else {
        echo "  ⚠️  SYSTEM HEALTH: NEEDS ATTENTION\n";
        echo "  🚨 Production Ready: NO\n";
        echo "  🔧 Fix required tournaments before deployment\n";
    }

    // Detailed Insights
    echo "\n🔍 Tournament Scale Insights:\n";

    foreach ($results as $playerCount => $result) {
        if (isset($result['error'])) {
            continue;
        }

        echo "\n  🎯 {$playerCount}-Player Tournament:\n";

        if ($result['compliant']) {
            echo "    ✅ Fully compliant with minimum 2 matches requirement\n";

            if ($result['avg_matches_per_round'] >= 3.0) {
                echo "    ⚡ High match density ({$result['avg_matches_per_round']} avg/round)\n";
            } elseif ($result['avg_matches_per_round'] >= 2.0) {
                echo "    ⚡ Good match density ({$result['avg_matches_per_round']} avg/round)\n";
            } else {
                echo "    ⚠️  Low match density ({$result['avg_matches_per_round']} avg/round)\n";
            }

            if ($result['efficiency'] >= 0.8) {
                echo "    🎯 High tournament efficiency ({$result['efficiency']})\n";
            } else {
                echo "    📈 Moderate tournament efficiency ({$result['efficiency']})\n";
            }
        } else {
            echo "    ❌ Non-compliant: Rounds " . implode(', ', $result['compliance_issues']) . " have <2 matches\n";
        }

        // Scale-specific insights
        if ($playerCount <= 5) {
            echo "    🧪 Small Scale: Perfect for core functionality testing\n";
        } elseif ($playerCount <= 10) {
            echo "    🎮 Club Level: Ideal for local tournaments\n";
        } elseif ($playerCount <= 50) {
            echo "    🏟️  Regional Level: Competitive tournament size\n";
        } else {
            echo "    🌐 National Level: Large-scale tournament validation\n";
        }
    }

    echo "\n💡 Recommendations:\n";
    if ($totalPassed === $totalTournaments) {
        echo "  🎯 System is ready for production deployment\n";
        echo "  📈 Consider implementing automated monitoring for ongoing compliance\n";
        echo "  🔄 Test with additional edge cases (odd numbers, power of 2)\n";
    } else {
        echo "  🔧 Fix non-compliant tournaments before deployment\n";
        echo "  🛠️  Review pairing algorithm for better match distribution\n";
        echo "  🧪 Additional testing required\n";
    }

    echo "\n🏁 Analysis complete!\n";
    echo str_repeat("🏆", 20) . "\n";
}