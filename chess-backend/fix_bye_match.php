<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\ChampionshipMatch;

echo "=== Fixing BYE Match Issue ===\n\n";

$match = ChampionshipMatch::find(1101);

if (!$match) {
    echo "Match #1101 not found!\n";
    exit;
}

echo "Current Match State:\n";
echo "ID: " . $match->id . "\n";
echo "Round Number: " . $match->round_number . "\n";
echo "Round Type: " . $match->round_type . "\n";
echo "Player 1 ID: " . $match->player1_id . "\n";
echo "Player 2 ID: " . ($match->player2_id ?? 'null') . "\n";
echo "Winner ID: " . ($match->winner_id ?? 'null') . "\n";
echo "Status: " . $match->status . "\n";
echo "Is Placeholder: " . ($match->is_placeholder ? 'true' : 'false') . "\n\n";

// Check if this is a BYE match
if ($match->player2_id === null) {
    echo "This is a BYE match (Player 1 only)\n";

    // Check if other matches in the same round are completed
    $otherMatches = ChampionshipMatch::where('championship_id', $match->championship_id)
        ->where('round_number', $match->round_number)
        ->where('id', '!=', $match->id)
        ->get();

    $completedMatches = $otherMatches->where('status', 'completed')->count();
    $totalOtherMatches = $otherMatches->count();

    echo "Other matches in round {$match->round_number}: {$completedMatches}/{$totalOtherMatches} completed\n";

    if ($match->winner_id !== null && $completedMatches < $totalOtherMatches) {
        echo "❌ PROBLEM: BYE match has winner_id set but round is not complete\n";
        echo "Current state:\n";
        echo "  Player 1 (lone player): {$match->player1_id}\n";
        echo "  Winner ID: " . ($match->winner_id ?? 'null') . "\n";
        echo "  Status: {$match->status}\n\n";

        echo "Fix: Clearing winner_id until all round matches are completed\n";

        $match->winner_id = null;
        $match->status = 'pending';
        $match->save();

        echo "✅ Fixed: BYE match now correctly waits for round completion\n\n";

    } elseif ($match->winner_id === null && $completedMatches >= $totalOtherMatches) {
        echo "✅ CORRECT: Round is complete, BYE match can be completed\n";
        echo "Auto-completing BYE match with Player 1 as winner\n";

        $match->winner_id = $match->player1_id;
        $match->status = 'completed';
        $match->completed_at = now();
        $match->save();

        echo "✅ BYE match auto-completed successfully\n\n";

    } elseif ($match->winner_id === null && $completedMatches < $totalOtherMatches) {
        echo "✅ CORRECT: BYE match waiting for round completion\n";

    } elseif ($match->winner_id !== null && $completedMatches >= $totalOtherMatches) {
        echo "✅ CORRECT: BYE match already completed after round finished\n";
    }

    echo "Current Match State:\n";
    echo "Winner ID: " . ($match->winner_id ?? 'null') . "\n";
    echo "Status: " . $match->status . "\n";
} else {
    echo "✅ This is not a BYE match\n";
}

// Check for other similar BYE issues in the tournament
echo "\n=== Checking for Other BYE Issues in Tournament ===\n";

$championshipId = $match->championship_id;
$problematicByes = ChampionshipMatch::where('championship_id', $championshipId)
    ->where('player2_id', null) // BYE matches
    ->whereNotNull('winner_id')  // Should not have winner_id set
    ->get();

if ($problematicByes->count() > 0) {
    echo "Found {$problematicByes->count()} other BYE matches with issues:\n";

    foreach ($problematicByes as $byeMatch) {
        echo "  Match {$byeMatch->id}: player1={$byeMatch->player1_id}, winner_id={$byeMatch->winner_id}\n";
    }
} else {
    echo "✅ No other BYE issues found\n";
}

echo "\nBYE match fix complete.\n";