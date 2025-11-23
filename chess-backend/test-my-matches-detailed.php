<?php

require_once __DIR__ . '/vendor/autoload.php';

// Bootstrap Laravel
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\ChampionshipMatch;

echo "🔍 Testing My-Matches API with Detailed Response\n";
echo str_repeat("=", 50) . "\n";

// Get user for API testing
$user = User::first();
if (!$user) {
    echo "❌ No users found\n";
    exit;
}

$token = $user->createToken('test-api')->plainTextToken;
echo "✅ Testing with user: {$user->name} (ID: {$user->id})\n\n";

// Test the API directly
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'http://localhost:8000/api/championships/14/my-matches');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Accept: application/json',
    'Authorization: Bearer ' . $token
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "📡 My-Matches API Response (HTTP {$httpCode}):\n\n";

if ($httpCode === 200) {
    $data = json_decode($response, true);

    if (isset($data['matches'])) {
        $matches = $data['matches'];
        echo "Found " . count($matches) . " matches\n\n";

        // Show Round 3 matches specifically
        $round3Matches = array_filter($matches, function($match) {
            return ($match['round_number'] ?? $match['round'] ?? 1) == 3;
        });

        echo "🎯 Round 3 Matches Analysis:\n";
        foreach ($round3Matches as $match) {
            echo "Match ID: " . ($match['id'] ?? 'N/A') . "\n";
            echo "  - White Player ID: " . ($match['white_player_id'] ?? 'N/A') . "\n";
            echo "  - Black Player ID: " . ($match['black_player_id'] ?? 'N/A') . "\n";
            echo "  - Status: " . ($match['status'] ?? 'N/A') . "\n";

            // Check if user relationships are included
            echo "  - White Player User: ";
            if (isset($match['white_player'])) {
                if ($match['white_player']) {
                    echo "✅ " . ($match['white_player']['name'] ?? 'No name') .
                         " (ID: " . ($match['white_player']['id'] ?? 'No ID') . ")";
                } else {
                    echo "❌ NULL";
                }
            } else {
                echo "❌ MISSING KEY";
            }
            echo "\n";

            echo "  - Black Player User: ";
            if (isset($match['black_player'])) {
                if ($match['black_player']) {
                    echo "✅ " . ($match['black_player']['name'] ?? 'No name') .
                         " (ID: " . ($match['black_player']['id'] ?? 'No ID') . ")";
                } else {
                    echo "❌ NULL";
                }
            } else {
                echo "❌ MISSING KEY";
            }
            echo "\n";

            // Check if current user is participating
            $currentUserId = $user->id;
            $isParticipant = ($match['white_player_id'] == $currentUserId) ||
                           ($match['black_player_id'] == $currentUserId);
            echo "  - Current user participates: " . ($isParticipant ? "✅ YES" : "❌ NO") . "\n";

            echo "\n";
        }

        if (empty($round3Matches)) {
            echo "❌ No Round 3 matches found\n";
        }
    } else {
        echo "❌ No matches key in response\n";
        echo "Response structure:\n";
        print_r(array_keys($data));
    }
} else {
    echo "❌ API Error: {$httpCode}\n";
    echo "Response: " . substr($response, 0, 500) . "...\n";
}

echo "\n✅ Test complete\n";