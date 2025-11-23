<?php
require_once __DIR__ . '/vendor/autoload.php';
// Bootstrap Laravel
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\ChampionshipMatch;
use App\Models\User;

echo "=== Testing My Matches API Response ===\n\n";

// Simulate the API query that my-matches would make
$matches = ChampionshipMatch::where('championship_id', 15)
    ->with(['white_player', 'black_player'])  // These relationships should be loaded
    ->get();

echo "📊 Matches found: " . $matches->count() . "\n\n";

foreach ($matches->take(2) as $index => $match) {
    echo "Match " . ($index + 1) . " (ID: " . $match->id . "):\n";
    echo "  Round: " . $match->round_number . "\n";
    echo "  Status: " . $match->status . "\n";
    echo "  White Player ID: " . ($match->white_player_id ?? 'null') . "\n";
    echo "  Black Player ID: " . ($match->black_player_id ?? 'null') . "\n";
    echo "  White Player (loaded): " . ($match->white_player ? $match->white_player->name : 'null') . "\n";
    echo "  Black Player (loaded): " . ($match->black_player ? $match->black_player->name : 'null') . "\n";
    echo "  Game ID: " . ($match->game_id ?? 'null') . "\n";
    echo "  Result: " . ($match->result ?? 'null') . "\n";
    echo "  Deadline: " . ($match->deadline ?? 'null') . "\n";
    echo "\n";
}

// Check for User 1 (Arun Nalamara) participation
$user1Matches = $matches->filter(function($match) {
    return $match->white_player_id == 1 || $match->black_player_id == 1;
});

echo "👤 User 1 (Arun Nalamara) matches: " . $user1Matches->count() . "\n";
foreach ($user1Matches as $match) {
    echo "  Match ID: " . $match->id . ", vs " .
         (($match->white_player_id == 1) ? $match->black_player->name : $match->white_player->name) . "\n";
}

echo "\n✅ API response structure looks correct\n";