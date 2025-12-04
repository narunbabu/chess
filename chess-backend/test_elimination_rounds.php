<?php

/**
 * Test script to verify elimination round pairing logic
 *
 * This script tests the new elimination bracket functionality
 * by creating a championship with Swiss rounds followed by elimination rounds
 */

require __DIR__ . '/vendor/autoload.php';

use App\Models\Championship;
use App\Models\User;
use App\ValueObjects\TournamentConfig;
use App\Services\TournamentGenerationService;
use App\Services\SwissPairingService;
use Illuminate\Support\Facades\DB;

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "🧪 Testing Elimination Round Pairings\n";
echo str_repeat("=", 60) . "\n\n";

try {
    DB::beginTransaction();

    // Find or create a test championship with 8 participants
    $championship = Championship::where('name', 'like', '%Test Elimination%')->first();

    if (!$championship) {
        echo "❌ No test championship found. Please create one with 8 participants first.\n";
        echo "   Championship name should contain 'Test Elimination'\n";
        exit(1);
    }

    echo "✅ Found championship: {$championship->name}\n";
    echo "   ID: {$championship->id}\n";
    echo "   Participants: " . $championship->participants()->count() . "\n\n";

    // Create tournament configuration with elimination rounds
    $config = [
        'round_structure' => [
            [
                'round' => 1,
                'name' => 'Round 1',
                'type' => 'swiss',
                'participant_selection' => 'all',
                'matches_per_player' => 1,
                'pairing_method' => 'random_seeded',
            ],
            [
                'round' => 2,
                'name' => 'Round 2',
                'type' => 'swiss',
                'participant_selection' => 'all',
                'matches_per_player' => 1,
                'pairing_method' => 'standings_based',
            ],
            [
                'round' => 3,
                'name' => 'Quarter Final',
                'type' => 'quarter_final',
                'participant_selection' => ['top_k' => 8],
                'matches_per_player' => 1,
                'pairing_method' => 'standings_based',
            ],
            [
                'round' => 4,
                'name' => 'Semi Final',
                'type' => 'semi_final',
                'participant_selection' => ['top_k' => 4],
                'matches_per_player' => 1,
                'pairing_method' => 'standings_based',
            ],
            [
                'round' => 5,
                'name' => 'Final',
                'type' => 'final',
                'participant_selection' => ['top_k' => 2],
                'matches_per_player' => 1,
                'pairing_method' => 'standings_based',
            ],
        ],
    ];

    $tournamentConfig = TournamentConfig::fromArray($config);

    echo "📋 Tournament Configuration:\n";
    foreach ($tournamentConfig->roundStructure as $round) {
        echo "   Round {$round['round']}: {$round['name']} ({$round['type']})\n";
    }
    echo "\n";

    // Clear existing matches if any
    $championship->matches()->delete();
    $championship->tournament_generated = false;
    $championship->save();

    // Generate tournament
    $swissService = new SwissPairingService();
    $generationService = new TournamentGenerationService($swissService);

    echo "🔄 Generating tournament...\n\n";

    $summary = $generationService->generateFullTournament($championship, $tournamentConfig);

    echo "✅ Tournament Generated Successfully!\n\n";
    echo "📊 Summary:\n";
    echo "   Total Rounds: {$summary['total_rounds']}\n";
    echo "   Total Matches: {$summary['total_matches']}\n";
    echo "   Participants: {$summary['participants']}\n\n";

    echo "🎯 Round Details:\n";
    foreach ($summary['rounds'] as $roundInfo) {
        echo "   Round {$roundInfo['round']}: {$roundInfo['type']}\n";
        echo "      Participants: {$roundInfo['participants']}\n";
        echo "      Matches Created: {$roundInfo['matches_created']}\n";
        echo "      Byes: {$roundInfo['byes']}\n";
    }
    echo "\n";

    // Verify elimination rounds
    echo "🔍 Verifying Elimination Rounds:\n\n";

    $quarterFinal = $championship->matches()->where('round_number', 3)->get();
    $semiFinal = $championship->matches()->where('round_number', 4)->get();
    $final = $championship->matches()->where('round_number', 5)->get();

    echo "   Quarter Final (Round 3):\n";
    echo "      Expected: 4 matches with 8 participants\n";
    echo "      Actual: {$quarterFinal->count()} matches\n";
    if ($quarterFinal->count() === 4) {
        echo "      ✅ PASS\n";
    } else {
        echo "      ❌ FAIL\n";
    }

    echo "\n   Semi Final (Round 4):\n";
    echo "      Expected: 2 matches with 4 participants\n";
    echo "      Actual: {$semiFinal->count()} matches\n";
    if ($semiFinal->count() === 2) {
        echo "      ✅ PASS\n";
    } else {
        echo "      ❌ FAIL\n";
    }

    echo "\n   Final (Round 5):\n";
    echo "      Expected: 1 match with 2 participants\n";
    echo "      Actual: {$final->count()} matches\n";
    if ($final->count() === 1) {
        echo "      ✅ PASS\n";
    } else {
        echo "      ❌ FAIL\n";
    }

    echo "\n";

    // Show actual pairings
    echo "📝 Actual Pairings:\n\n";

    echo "   Quarter Final Matches:\n";
    foreach ($quarterFinal as $match) {
        $p1 = User::find($match->player1_id);
        $p2 = User::find($match->player2_id);
        echo "      {$p1->name} vs {$p2->name}\n";
    }

    echo "\n   Semi Final Matches:\n";
    foreach ($semiFinal as $match) {
        $p1 = User::find($match->player1_id);
        $p2 = User::find($match->player2_id);
        echo "      {$p1->name} vs {$p2->name}\n";
    }

    echo "\n   Final Match:\n";
    foreach ($final as $match) {
        $p1 = User::find($match->player1_id);
        $p2 = User::find($match->player2_id);
        echo "      {$p1->name} vs {$p2->name}\n";
    }

    DB::rollBack();
    echo "\n✅ Test completed successfully (rolled back)\n";

} catch (\Exception $e) {
    DB::rollBack();
    echo "\n❌ Error: " . $e->getMessage() . "\n";
    echo "\nStack trace:\n";
    echo $e->getTraceAsString() . "\n";
    exit(1);
}
