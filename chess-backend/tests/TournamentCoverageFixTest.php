<?php

/**
 * Tournament Coverage Fix Test
 *
 * This test validates that the small tournament structure fix
 * correctly generates coverage-enforced rounds for 3-participant tournaments
 */

echo "=== Tournament Coverage Fix Test ===" . PHP_EOL;

// Test 1: Validate TournamentConfig generates correct structure
echo "Test 1: TournamentConfig small tournament structure..." . PHP_EOL;

$tournamentConfig = new \App\ValueObjects\TournamentConfig();
$structure = $tournamentConfig::generateAdaptiveTournamentStructure(3);

echo "Generated structure for 3 participants:" . PHP_EOL;
foreach ($structure as $round) {
    echo "  Round {$round['round']}: {$round['type']} - {$round['pairing_method']}" . PHP_EOL;
    if (isset($round['enforce_coverage'])) {
        echo "    Coverage enforcement: " . ($round['enforce_coverage'] ? 'YES' : 'NO') . PHP_EOL;
        echo "    Coverage pairs: " . json_encode($round['coverage_pairs'] ?? []) . PHP_EOL;
    }
}

// Test 2: Validate coverage pairs are present for small tournaments
echo PHP_EOL . "Test 2: Coverage pairs validation..." . PHP_EOL;
$coverageErrors = $tournamentConfig->validateCoverageRequirements();
if (empty($coverageErrors)) {
    echo "✅ Coverage requirements validation passed" . PHP_EOL;
} else {
    echo "❌ Coverage requirements validation failed:" . PHP_EOL;
    foreach ($coverageErrors as $error) {
        echo "  - $error" . PHP_EOL;
    }
}

// Test 3: Check specific round configurations
echo PHP_EOL . "Test 3: Round-by-round analysis..." . PHP_EOL;

$expectedRounds = [
    1 => ['type' => 'dense', 'method' => 'random_seeded'],
    2 => ['type' => 'dense', 'method' => 'standings_based'],
    3 => ['type' => 'selective', 'method' => 'round_robin_top_k', 'coverage' => true],
    4 => ['type' => 'selective', 'method' => 'round_robin_top_k', 'coverage' => true],
    5 => ['type' => 'final', 'method' => 'direct']
];

foreach ($structure as $round) {
    $roundNum = $round['round'];
    if (isset($expectedRounds[$roundNum])) {
        $expected = $expectedRounds[$roundNum];

        echo "  Round $roundNum:" . PHP_EOL;
        echo "    Expected type: {$expected['type']}, Actual: {$round['type']} ";
        echo ($round['type'] === $expected['type'] ? '✅' : '❌') . PHP_EOL;

        echo "    Expected method: {$expected['method']}, Actual: {$round['pairing_method']} ";
        echo ($round['pairing_method'] === $expected['method'] ? '✅' : '❌') . PHP_EOL;

        if (isset($expected['coverage'])) {
            $hasCoverage = isset($round['enforce_coverage']) && $round['enforce_coverage'];
            echo "    Expected coverage: " . ($expected['coverage'] ? 'YES' : 'NO') . ", Actual: " . ($hasCoverage ? 'YES' : 'NO') . " ";
            echo ($hasCoverage === $expected['coverage'] ? '✅' : '❌') . PHP_EOL;
        }
    }
}

// Test 4: Verify coverage pairs for rounds 3 and 4
echo PHP_EOL . "Test 4: Coverage pairs verification..." . PHP_EOL;

$round3Config = null;
$round4Config = null;

foreach ($structure as $round) {
    if ($round['round'] === 3) $round3Config = $round;
    if ($round['round'] === 4) $round4Config = $round;
}

// Check Round 3 coverage pairs
if ($round3Config && isset($round3Config['coverage_pairs'])) {
    $round3Pairs = $round3Config['coverage_pairs'];
    $expectedRound3Pairs = [
        ['rank_1', 'rank_2'],
        ['rank_2', 'rank_3']
    ];

    echo "  Round 3 coverage pairs:" . PHP_EOL;
    echo "    Expected: " . json_encode($expectedRound3Pairs) . PHP_EOL;
    echo "    Actual: " . json_encode($round3Pairs) . PHP_EOL;
    echo "    Result: " . (json_encode($round3Pairs) === json_encode($expectedRound3Pairs) ? '✅' : '❌') . PHP_EOL;
} else {
    echo "  Round 3: Missing coverage pairs ❌" . PHP_EOL;
}

// Check Round 4 coverage pairs
if ($round4Config && isset($round4Config['coverage_pairs'])) {
    $round4Pairs = $round4Config['coverage_pairs'];
    $expectedRound4Pairs = [
        ['rank_1', 'rank_3']
    ];

    echo "  Round 4 coverage pairs:" . PHP_EOL;
    echo "    Expected: " . json_encode($expectedRound4Pairs) . PHP_EOL;
    echo "    Actual: " . json_encode($round4Pairs) . PHP_EOL;
    echo "    Result: " . (json_encode($round4Pairs) === json_encode($expectedRound4Pairs) ? '✅' : '❌') . PHP_EOL;
} else {
    echo "  Round 4: Missing coverage pairs ❌" . PHP_EOL;
}

echo PHP_EOL . "=== Test Complete ===" . PHP_EOL;
echo "Expected match distribution for 3 participants:" . PHP_EOL;
echo "  Round 1: 3 matches (all players, round-robin)" . PHP_EOL;
echo "  Round 2: 2 matches (all players, partial)" . PHP_EOL;
echo "  Round 3: 2 matches (top-3 coverage: rank1 vs rank2, rank2 vs rank3)" . PHP_EOL;
echo "  Round 4: 1 match (top-3 coverage: rank1 vs rank3)" . PHP_EOL;
echo "  Round 5: 1 match (final: rank1 vs rank2)" . PHP_EOL;
echo "Total: 9 matches (guaranteed top-3 coverage before final)" . PHP_EOL;