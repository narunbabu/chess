<?php

require_once __DIR__ . '/vendor/autoload.php';

// Bootstrap Laravel
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\ChampionshipMatch;

echo "🔍 Testing Round Leaderboard API\n";
echo str_repeat("=", 50) . "\n";

// Get user for API testing
$user = User::first();
if (!$user) {
    echo "❌ No users found\n";
    exit;
}

$token = $user->createToken('test-api')->plainTextToken;
echo "✅ Testing with user: {$user->name}\n\n";

// Test the API directly
function testLeaderboardAPI($championshipId, $round, $token) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "http://localhost:8000/api/championships/{$championshipId}/matches/round/{$round}/leaderboard");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Accept: application/json',
        'Authorization: Bearer ' . $token
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    echo "🏆 Championship {$championshipId} Round {$round} Leaderboard (HTTP {$httpCode}):\n";

    if ($httpCode === 200) {
        $data = json_decode($response, true);
        if (isset($data['leaderboard'])) {
            echo "   Found " . count($data['leaderboard']) . " players\n";

            // Show first few players with user data structure
            foreach (array_slice($data['leaderboard'], 0, 3) as $index => $player) {
                echo "   Player " . ($index + 1) . ":\n";
                echo "     - Rank: " . ($player['rank'] ?? 'N/A') . "\n";
                echo "     - Points: " . ($player['points'] ?? 'N/A') . "\n";
                echo "     - User data: ";
                if (isset($player['user'])) {
                    if ($player['user'] === null) {
                        echo "NULL ❌\n";
                    } else {
                        echo "EXISTS ✅\n";
                        echo "     - User ID: " . ($player['user']['id'] ?? 'N/A') . "\n";
                        echo "     - User Name: " . ($player['user']['name'] ?? 'N/A') . "\n";
                        echo "     - Avatar URL: " . ($player['user']['avatar_url'] ?? 'N/A') . "\n";
                    }
                } else {
                    echo "MISSING KEY ❌\n";
                }
                echo "\n";
            }
            return $data;
        } else {
            echo "   No leaderboard key in response\n";
            echo "   Response: " . substr($response, 0, 300) . "...\n";
        }
    } else {
        echo "   HTTP Error: {$httpCode}\n";
        echo "   Response: " . substr($response, 0, 300) . "...\n";
    }
    echo "\n";
    return null;
}

// Test Championship 14 Round 1
$champ14Data = testLeaderboardAPI(14, 1, $token);

// Test Championship 5 Round 1 for comparison
$champ5Data = testLeaderboardAPI(5, 1, $token);

// Also test the database directly to understand the relationships
echo "📊 Database Relationship Analysis:\n";

function analyzeChampionshipMatches($championshipId, $title) {
    echo "\n   {$title}:\n";

    $matches = ChampionshipMatch::where('championship_id', $championshipId)
        ->where('round_number', 1)
        ->where('status', 'completed')
        ->limit(2)
        ->get();

    foreach ($matches as $match) {
        echo "     Match ID: {$match->id}\n";
        echo "       - White Player ID: " . ($match->white_player_id ?? 'NULL') . "\n";
        echo "       - Black Player ID: " . ($match->black_player_id ?? 'NULL') . "\n";
        echo "       - Player1 ID: " . ($match->player1_id ?? 'NULL') . "\n";
        echo "       - Player2 ID: " . ($match->player2_id ?? 'NULL') . "\n";

        // Test relationship loading
        $match->load(['player1', 'player2', 'white_player', 'black_player']);

        echo "       - Player1 relationship: " . ($match->player1 ? 'EXISTS' : 'NULL') . "\n";
        echo "       - Player2 relationship: " . ($match->player2 ? 'EXISTS' : 'NULL') . "\n";
        echo "       - White_player relationship: " . ($match->white_player ? 'EXISTS' : 'NULL') . "\n";
        echo "       - Black_player relationship: " . ($match->black_player ? 'EXISTS' : 'NULL') . "\n";
        echo "\n";
    }
}

analyzeChampionshipMatches(14, "Championship 14");
analyzeChampionshipMatches(5, "Championship 5");

echo "✅ Analysis complete\n";