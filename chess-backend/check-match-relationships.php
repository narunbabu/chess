<?php

require_once __DIR__ . '/vendor/autoload.php';

// Bootstrap Laravel
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\ChampionshipMatch;
use App\Models\User;

echo "🔍 Checking Match-User Relationships for Championship 14\n";
echo str_repeat("=", 60) . "\n";

// Get Round 3 matches
$round3Matches = ChampionshipMatch::where('championship_id', 14)
    ->where('round_number', 3)
    ->get();

echo "📊 Round 3 Matches Analysis:\n\n";

foreach ($round3Matches as $match) {
    echo "Match ID: {$match->id}\n";
    echo "  - White Player ID: " . ($match->white_player_id ?? 'NULL') . "\n";
    echo "  - Black Player ID: " . ($match->black_player_id ?? 'NULL') . "\n";
    echo "  - Player1 ID: " . ($match->player1_id ?? 'NULL') . "\n";
    echo "  - Player2 ID: " . ($match->player2_id ?? 'NULL') . "\n";
    echo "  - Status: '{$match->status}'\n";
    echo "  - Winner ID: " . ($match->winner_id ?? 'NULL') . "\n";

    // Check if relationships are loaded
    $match->load(['white_player', 'black_player', 'player1', 'player2']);

    echo "  🤝 Relationships:\n";
    echo "    - White Player: " . ($match->white_player ? "✅ EXISTS - {$match->white_player->name}" : "❌ NULL") . "\n";
    echo "    - Black Player: " . ($match->black_player ? "✅ EXISTS - {$match->black_player->name}" : "❌ NULL") . "\n";
    echo "    - Player1: " . ($match->player1 ? "✅ EXISTS - {$match->player1->name}" : "❌ NULL") . "\n";
    echo "    - Player2: " . ($match->player2 ? "✅ EXISTS - {$match->player2->name}" : "❌ NULL") . "\n";

    echo "\n";
}

// Also check Round 1 & 2 matches for comparison
echo "📋 Comparison with Completed Rounds:\n\n";

$completedMatches = ChampionshipMatch::where('championship_id', 14)
    ->where('round_number', '<=', 2)
    ->limit(2)
    ->get();

foreach ($completedMatches as $match) {
    echo "Completed Match ID: {$match->id} (Round {$match->round_number})\n";
    echo "  - White Player ID: " . ($match->white_player_id ?? 'NULL') . "\n";
    echo "  - Black Player ID: " . ($match->black_player_id ?? 'NULL') . "\n";
    echo "  - Player1 ID: " . ($match->player1_id ?? 'NULL') . "\n";
    echo "  - Player2 ID: " . ($match->player2_id ?? 'NULL') . "\n";
    echo "  - Status: '{$match->status}'\n";
    echo "  - Winner ID: " . ($match->winner_id ?? 'NULL') . "\n";

    $match->load(['white_player', 'black_player', 'player1', 'player2']);

    echo "  🤝 Relationships:\n";
    echo "    - White Player: " . ($match->white_player ? "✅ EXISTS - {$match->white_player->name}" : "❌ NULL") . "\n";
    echo "    - Black Player: " . ($match->black_player ? "✅ EXISTS - {$match->black_player->name}" : "❌ NULL") . "\n";
    echo "    - Player1: " . ($match->player1 ? "✅ EXISTS - {$match->player1->name}" : "❌ NULL") . "\n";
    echo "    - Player2: " . ($match->player2 ? "✅ EXISTS - {$match->player2->name}" : "❌ NULL") . "\n";

    echo "\n";
}

// Check if users 1, 2, 3 actually exist
echo "👥 User Verification:\n";
for ($i = 1; $i <= 3; $i++) {
    $user = User::find($i);
    echo "  - User ID {$i}: " . ($user ? "✅ EXISTS - {$user->name} ({$user->email})" : "❌ NOT FOUND") . "\n";
}

echo "\n🔧 My-Matches API Test:\n";
function testMyMatchesAPI($championshipId, $userId, $token) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "http://localhost:8000/api/championships/{$championshipId}/my-matches");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Accept: application/json',
        'Authorization: Bearer ' . $token
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return ['httpCode' => $httpCode, 'response' => $response];
}

$user = User::first();
if ($user) {
    $token = $user->createToken('test-api')->plainTextToken;

    // Test for user 1
    $result = testMyMatchesAPI(14, 1, $token);
    echo "  - User 1 my-matches: HTTP {$result['httpCode']}\n";

    if ($result['httpCode'] === 200) {
        $data = json_decode($result['response'], true);
        $matchCount = isset($data['matches']) ? count($data['matches']) : 0;
        echo "    Found {$matchCount} matches for User 1\n";

        if ($matchCount > 0) {
            foreach ($data['matches'] as $index => $match) {
                echo "    Match " . ($index + 1) . ": Round " . ($match['round_number'] ?? 'N/A') .
                     " (White: " . ($match['white_player_id'] ?? 'N/A') .
                     ", Black: " . ($match['black_player_id'] ?? 'N/A') . ")\n";
            }
        }
    }
}

echo "\n✅ Analysis complete\n";