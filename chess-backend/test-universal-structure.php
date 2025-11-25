<?php

/**
 * Test script for universal tournament structure generation
 */

require_once __DIR__ . '/vendor/autoload.php';

use App\ValueObjects\TournamentConfig;

echo "Testing Universal Tournament Structure Generation\n";
echo "================================================\n\n";

// Test cases for different participant counts
$testCases = [3, 4, 5, 8, 12, 16, 24, 32, 48, 64, 96];

foreach ($testCases as $participantCount) {
    echo "Testing {$participantCount} players:\n";
    echo str_repeat("-", 40) . "\n";

    // Test K4 calculation
    $k4 = TournamentConfig::calculateK4($participantCount);
    echo "K4 (Round 4 contenders): {$k4}\n";

    // Generate universal structure
    $structure = TournamentConfig::generateUniversalTournamentStructure($participantCount, 5);

    echo "Structure generated:\n";
    foreach ($structure as $round) {
        $selection = is_array($round['participant_selection'])
            ? 'top ' . $round['participant_selection']['top_k']
            : $round['participant_selection'];

        echo "  Round {$round['round']}: {$round['type']} | {$selection} participants | {$round['pairing_method']} method | {$round['matches_per_player']} matches/player\n";
    }

    // Create config and validate
    $config = TournamentConfig::fromUniversal($participantCount, 5);
    $errors = $config->validate();

    if (empty($errors)) {
        echo "✅ Configuration valid\n";
    } else {
        echo "❌ Configuration errors:\n";
        foreach ($errors as $error) {
            echo "   - {$error}\n";
        }
    }

    // Calculate total matches
    $totalMatches = $config->calculateTotalMatches($participantCount);
    echo "Total matches: {$totalMatches}\n";

    echo "\n";
}

echo "Special test: 3-player detailed structure\n";
echo str_repeat("=", 50) . "\n";

$threePlayerConfig = TournamentConfig::fromUniversal(3, 5);
echo "3-player tournament structure:\n";
foreach ($threePlayerConfig->roundStructure as $round) {
    $selection = is_array($round['participant_selection'])
        ? 'top ' . $round['participant_selection']['top_k']
        : $round['participant_selection'];

    echo "Round {$round['round']}: {$round['type']} | {$selection} | {$round['pairing_method']}";

    if (isset($round['coverage_pairs'])) {
        echo " | coverage: " . json_encode($round['coverage_pairs']);
    }
    if (isset($round['force_complete_round_robin']) && $round['force_complete_round_robin']) {
        echo " | complete round-robin";
    }
    echo "\n";
}

echo "\n✅ Universal tournament structure testing completed!\n";