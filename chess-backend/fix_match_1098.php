<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\ChampionshipMatch;

echo "=== Investigating Match #1098 ===\n\n";

$match = ChampionshipMatch::find(1098);

if (!$match) {
    echo "Match #1098 not found!\n";
    exit;
}

echo "Current Match State:\n";
echo "ID: " . $match->id . "\n";
echo "Round Number: " . $match->round_number . "\n";
echo "Round Type: " . $match->round_type . "\n";
echo "Player 1 ID: " . $match->player1_id . "\n";
echo "Player 2 ID: " . $match->player2_id . "\n";
echo "Player 1 Result: " . ($match->player1_result ?? 'null') . "\n";
echo "Player 2 Result: " . ($match->player2_result ?? 'null') . "\n";
echo "Winner ID: " . ($match->winner_id ?? 'null') . "\n";
echo "Status: " . $match->status . "\n";
echo "Is Placeholder: " . ($match->is_placeholder ? 'true' : 'false') . "\n\n";

// Check if this is logically impossible
if ($match->player1_result === 'loss' && $match->player2_result === 'loss') {
    echo "❌ LOGICAL ERROR: Both players cannot have 'loss' results!\n";

    // Check who should be the winner based on winner_id
    if ($match->winner_id == $match->player1_id) {
        echo "Fix: Player 1 should be 'win', Player 2 should be 'loss'\n";
        $match->player1_result = 'win';
        $match->player2_result = 'loss';
    } elseif ($match->winner_id == $match->player2_id) {
        echo "Fix: Player 1 should be 'loss', Player 2 should be 'win'\n";
        $match->player1_result = 'loss';
        $match->player2_result = 'win';
    } else {
        echo "Warning: No valid winner_id found. Defaulting to Player 2 as winner\n";
        $match->player1_result = 'loss';
        $match->player2_result = 'win';
        $match->winner_id = $match->player2_id;
    }

    // Save the corrected match
    $match->save();

    echo "✅ Match corrected successfully!\n\n";

    echo "Updated Match State:\n";
    echo "Player 1 Result: " . $match->player1_result . "\n";
    echo "Player 2 Result: " . $match->player2_result . "\n";
    echo "Winner ID: " . $match->winner_id . "\n";
} else {
    echo "✅ Match results are logically consistent\n";
}

// Now let's check what might have caused this issue
echo "\n=== Investigating Root Cause ===\n";

// Check if this is a placeholder match that might have been incorrectly processed
if ($match->is_placeholder) {
    echo "This is a placeholder match. Checking assignment logic...\n";

    // Look for recent logs or operations that might have caused this
    $championshipId = $match->championship_id;
    echo "Championship ID: $championshipId\n";

    // Check other matches in the same round to see if they have similar issues
    $otherMatches = ChampionshipMatch::where('championship_id', $championshipId)
        ->where('round_number', $match->round_number)
        ->where('id', '!=', $match->id)
        ->get();

    echo "\nOther matches in round {$match->round_number}:\n";
    foreach ($otherMatches as $other) {
        $status = "✅";
        if ($other->player1_result === 'loss' && $other->player2_result === 'loss') {
            $status = "❌";
        }
        echo "  Match {$other->id}: P1={$other->player1_result}, P2={$other->player2_result} $status\n";
    }
}

echo "\nInvestigation complete.\n";