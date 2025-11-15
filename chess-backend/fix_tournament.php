<?php

require_once __DIR__ . '/vendor/autoload.php';

// Bootstrap Laravel
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Championship;
use App\Services\TournamentGenerationService;
use App\Services\SwissPairingService;

echo "🔧 Regenerating Tournament for Championship ID 2\n";
echo str_repeat("=", 50) . "\n";

try {
    $championship = Championship::find(2);

    if (!$championship) {
        echo "❌ Championship not found!\n";
        exit(1);
    }

    echo "📊 Championship Info:\n";
    echo "  ID: " . $championship->id . "\n";
    echo "  Title: " . $championship->title . "\n";
    echo "  Max Participants: " . $championship->max_participants . "\n";
    echo "  Total Rounds: " . $championship->total_rounds . "\n";

    // Check participant count
    $participantCount = $championship->participants()->count();
    echo "  Actual Participants: " . $participantCount . "\n";

    if ($participantCount != 3) {
        echo "⚠️  This championship has {$participantCount} participants, not 3.\n";
        echo "   The fix is specifically for 3-player tournaments.\n";
    }

    // Get new tournament configuration
    $config = $championship->getOrCreateTournamentConfig();

    echo "\n📋 New Tournament Configuration:\n";
    echo "  Mode: " . $config->mode . "\n";
    echo "  Round Structure:\n";

    foreach ($config->roundStructure as $i => $round) {
        $roundNum = $i + 1;
        echo "    Round {$roundNum} (round " . $round['round'] . "):\n";
        echo "      Type: " . $round['type'] . "\n";
        echo "      Participants: " . json_encode($round['participant_selection']) . "\n";
        echo "      Matches per player: " . $round['matches_per_player'] . "\n";

        if (isset($round['enforce_coverage']) && $round['enforce_coverage']) {
            echo "      ✅ Coverage enforcement: ENABLED\n";
            echo "      Coverage pairs: " . json_encode($round['coverage_pairs']) . "\n";
        }

        echo "\n";
    }

    // Initialize tournament generation service
    $swissService = new SwissPairingService();
    $tournamentService = new TournamentGenerationService($swissService);

    echo "🔄 Regenerating tournament...\n";

    // Regenerate the tournament
    $summary = $tournamentService->regenerateTournament($championship, $config);

    echo "✅ Tournament regenerated successfully!\n";
    echo "\n📊 Generation Summary:\n";
    echo "  Total rounds: " . $summary['total_rounds'] . "\n";
    echo "  Total matches: " . $summary['total_matches'] . "\n";

    echo "\n📋 Round-by-Round Results:\n";
    foreach ($summary['rounds'] as $round) {
        echo "  Round " . $round['round'] . " (" . $round['type'] . "): ";
        echo $round['matches_created'] . " matches created\n";

        if (isset($round['coverage_pairs_enforced'])) {
            echo "    Coverage pairs enforced: " . $round['coverage_pairs_enforced'] . "\n";
        }
    }

    // Verify the results
    echo "\n🔍 Verification:\n";
    $matches = $championship->matches()->orderBy('round_number')->get();

    $roundCounts = [];
    foreach ($matches as $match) {
        $roundNumber = $match->round_number;
        if (!isset($roundCounts[$roundNumber])) {
            $roundCounts[$roundNumber] = 0;
        }
        $roundCounts[$roundNumber]++;
    }

    $expectedPattern = [3, 2, 2, 2, 1]; // Expected for 3-player Option A
    $actualPattern = [];

    for ($i = 1; $i <= 5; $i++) {
        $actualPattern[] = $roundCounts[$i] ?? 0;
    }

    echo "Expected pattern: " . implode(', ', $expectedPattern) . "\n";
    echo "Actual pattern:   " . implode(', ', $actualPattern) . "\n";

    if ($expectedPattern === $actualPattern) {
        echo "🎉 ✅ Pattern matches! Option A successfully implemented!\n";
    } else {
        echo "❌ Pattern mismatch! Issue still exists.\n";

        // Show detailed breakdown
        echo "\n📊 Detailed Match Breakdown:\n";
        foreach ($roundCounts as $round => $count) {
            $status = $count >= 2 || $round == 5 ? '✅' : '❌';
            echo "  Round {$round}: {$count} matches {$status}\n";
        }
    }

    echo "\n🏁 Tournament fix completed!\n";

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}