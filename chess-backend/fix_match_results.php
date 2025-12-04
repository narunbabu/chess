<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\ChampionshipMatch;

echo "=== Fixing Match Results Issue ===\n\n";

$match = ChampionshipMatch::find(1098);

if (!$match) {
    echo "Match #1098 not found!\n";
    exit;
}

echo "Current Match State:\n";
echo "ID: " . $match->id . "\n";
echo "Player 1 ID: " . $match->player1_id . "\n";
echo "Player 2 ID: " . $match->player2_id . "\n";
echo "Winner ID: " . ($match->winner_id ?? 'null') . "\n";
echo "Status: " . $match->status . "\n\n";

// The issue: winner_id (602) doesn't match either player1_id (603) or player2_id (604)
// This is causing both players to show as 'loss' in the API response

if ($match->winner_id != $match->player1_id && $match->winner_id != $match->player2_id) {
    echo "❌ PROBLEM: winner_id ({$match->winner_id}) doesn't match either player!\n";
    echo "  Player 1 ID: {$match->player1_id}\n";
    echo "  Player 2 ID: {$match->player2_id}\n\n";

    // Since this is a semi-final match and player2 (ID 604) should be the winner based on the request
    echo "Fix: Setting player2 as winner since this is a semi-final\n";

    // Option 1: Update winner_id to match player2
    $match->winner_id = $match->player2_id;
    $match->save();

    echo "✅ Fixed: Updated winner_id to {$match->player2_id} (Player 2)\n";

    // Note: player1_result and player2_result don't exist in database
    // They are calculated on the fly by the API based on winner_id
    echo "✅ API will now correctly calculate results based on winner_id\n\n";

    echo "Updated Match State:\n";
    echo "Winner ID: " . $match->winner_id . "\n";
    echo "Player 1 (ID {$match->player1_id}) will show as: loss\n";
    echo "Player 2 (ID {$match->player2_id}) will show as: win\n";

} else {
    echo "✅ winner_id correctly matches one of the players\n";
}

// Let's also check for other matches with the same issue
echo "\n=== Checking for Similar Issues in Championship ===\n";

$championshipId = $match->championship_id;
$problematicMatches = ChampionshipMatch::where('championship_id', $championshipId)
    ->where('status', 'completed')
    ->whereNotNull('winner_id')
    ->where(function($query) {
        $query->whereRaw('winner_id != player1_id')
              ->whereRaw('winner_id != player2_id');
    })
    ->get();

if ($problematicMatches->count() > 0) {
    echo "Found {$problematicMatches->count()} other matches with the same issue:\n";

    foreach ($problematicMatches as $badMatch) {
        echo "  Match {$badMatch->id}: winner_id={$badMatch->winner_id}, p1={$badMatch->player1_id}, p2={$badMatch->player2_id}\n";
    }
} else {
    echo "✅ No other matches with this issue found\n";
}

echo "\nFix complete.\n";