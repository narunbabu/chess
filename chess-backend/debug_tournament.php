<?php

require_once __DIR__ . '/vendor/autoload.php';

// Bootstrap Laravel
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Championship;

// Check tournament configuration
$championship = Championship::find(2);

if (!$championship) {
    echo "Championship not found!\n";
    exit(1);
}

echo "=== Championship Info ===\n";
echo "ID: " . $championship->id . "\n";
echo "Title: " . $championship->title . "\n";
echo "Max Participants: " . $championship->max_participants . "\n";
echo "Total Rounds: " . $championship->total_rounds . "\n";
echo "Tournament Generated: " . ($championship->tournament_generated ? 'Yes' : 'No') . "\n";

// Get tournament config
$config = $championship->getOrCreateTournamentConfig();
echo "\n=== Tournament Configuration ===\n";
echo "Mode: " . $config->mode . "\n";
echo "Round Structure:\n";

foreach ($config->roundStructure as $i => $round) {
    echo "  Round " . ($i + 1) . ":\n";
    echo "    Round Number: " . $round['round'] . "\n";
    echo "    Type: " . $round['type'] . "\n";
    echo "    Participant Selection: " . json_encode($round['participant_selection']) . "\n";

    if (isset($round['enforce_coverage'])) {
        echo "    Enforce Coverage: " . ($round['enforce_coverage'] ? 'Yes' : 'No') . "\n";
    }

    if (isset($round['coverage_pairs'])) {
        echo "    Coverage Pairs: " . json_encode($round['coverage_pairs']) . "\n";
    }

    if (isset($round['determined_by_round'])) {
        echo "    Determined By Round: " . $round['determined_by_round'] . "\n";
    }

    echo "\n";
}

// Check existing matches
echo "=== Existing Matches ===\n";
$matches = $championship->matches()->orderBy('round_number')->orderBy('id')->get();

$roundCounts = [];
foreach ($matches as $match) {
    $roundNumber = $match->round_number;
    if (!isset($roundCounts[$roundNumber])) {
        $roundCounts[$roundNumber] = 0;
    }
    $roundCounts[$roundNumber]++;
}

foreach ($roundCounts as $round => $count) {
    echo "Round {$round}: {$count} matches\n";
}

echo "\nTotal matches: " . $matches->count() . "\n";

// Check if matches match expected pattern
echo "\n=== Expected vs Actual ===\n";
$expectedPattern = [3, 2, 2, 2, 1]; // Round 1: 3, Round 2: 2, Round 3: 2, Round 4: 2, Round 5: 1
$actualPattern = [];

for ($i = 1; $i <= 5; $i++) {
    $actualPattern[] = $roundCounts[$i] ?? 0;
}

echo "Expected pattern: " . implode(', ', $expectedPattern) . "\n";
echo "Actual pattern:   " . implode(', ', $actualPattern) . "\n";

if ($expectedPattern === $actualPattern) {
    echo "✅ Pattern matches!\n";
} else {
    echo "❌ Pattern mismatch!\n";
}