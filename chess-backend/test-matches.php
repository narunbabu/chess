<?php

require_once __DIR__ . '/vendor/autoload.php';

// Bootstrap Laravel
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Championship;
use App\Models\ChampionshipMatch;

echo "🔍 Testing Championship 14 Matches\n";
echo str_repeat("=", 50) . "\n";

// Check if championship exists
$championship = Championship::find(14);
if (!$championship) {
    echo "❌ Championship 14 not found\n";
    exit;
}

echo "✅ Found championship: {$championship->title}\n";

// Check if matches exist for this championship
$matches = ChampionshipMatch::where('championship_id', 14)->get();
echo "📊 Found {$matches->count()} matches for championship 14\n";

if ($matches->count() > 0) {
    echo "\n📋 Match Details:\n";
    foreach ($matches as $match) {
        echo sprintf(
            "   Round %d: %s vs %s (Status: %s, Winner: %s)\n",
            $match->round_number,
            $match->white_player_id ? "User {$match->white_player_id}" : 'NULL',
            $match->black_player_id ? "User {$match->black_player_id}" : 'NULL',
            $match->status ?? 'NULL',
            $match->winner_id ? "User {$match->winner_id}" : 'NULL'
        );
    }
} else {
    echo "❌ No matches found in database!\n";
}

// Test with relationships
echo "\n🔗 Testing with relationships:\n";
$matchesWithRelations = ChampionshipMatch::where('championship_id', 14)
    ->with(['white_player', 'black_player'])
    ->get();

echo "📊 Found {$matchesWithRelations->count()} matches with relations\n";

if ($matchesWithRelations->count() > 0) {
    foreach ($matchesWithRelations as $match) {
        $whiteName = $match->white_player ? $match->white_player->name : 'No player';
        $blackName = $match->black_player ? $match->black_player->name : 'No player';
        echo sprintf("   Round %d: %s vs %s\n", $match->round_number, $whiteName, $blackName);
    }
}

echo "\n✅ Test completed\n";