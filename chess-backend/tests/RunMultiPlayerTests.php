<?php

require_once __DIR__ . '/../vendor/autoload.php';

use Tests\Feature\MultiPlayerTournamentTest;

/**
 * Multi-Player Tournament Test Runner
 *
 * This script executes comprehensive tests for different tournament sizes
 * and generates a detailed analysis report.
 */

echo "🏆 Multi-Player Tournament Test Suite\n";
echo str_repeat("=", 50) . "\n";
echo "Testing Tournament System with Multiple Player Counts\n";
echo "Player Counts: 3, 5, 10, 50, 200\n\n";

try {
    // Initialize test
    $test = new MultiPlayerTournamentTest();

    // Run main test suite
    echo "🚀 Starting Comprehensive Tournament Tests...\n\n";
    $results = $test->testMultiplePlayerTournaments();

    // Run edge case tests
    echo "\n🧪 Running Edge Case Tests...\n\n";
    $test->testEdgeCases();

    // Generate final report
    echo "\n📊 FINAL TEST REPORT\n";
    echo str_repeat("=", 50) . "\n";

    $successCount = 0;
    $totalTests = count($results);

    foreach ($results as $playerCount => $result) {
        $status = $result['minimum_2_compliance'] ? '✅ PASS' : '❌ FAIL';
        echo "Tournament {$playerCount} Players: {$status}\n";

        if ($result['minimum_2_compliance']) {
            $successCount++;
        }
    }

    echo "\n📈 Overall Results:\n";
    echo "Successful Tests: {$successCount}/{$totalTests}\n";
    echo "Success Rate: " . round(($successCount / $totalTests) * 100, 1) . "%\n";

    if ($successCount === $totalTests) {
        echo "\n🎉 ALL TESTS PASSED!\n";
        echo "✅ Tournament system is working correctly across all scales\n";
        echo "🚀 Ready for production deployment\n";
    } else {
        echo "\n⚠️ SOME TESTS FAILED\n";
        echo "🔧 Tournament system needs fixes before production\n";
    }

} catch (Exception $e) {
    echo "\n❌ Test execution failed with error:\n";
    echo $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
    exit(1);
}

echo "\n🏁 Test execution completed.\n";