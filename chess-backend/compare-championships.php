<?php

require_once __DIR__ . '/vendor/autoload.php';

// Bootstrap Laravel
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\User;

echo "🔍 Comparing Championship 5 vs 14\n";
echo str_repeat("=", 60) . "\n";

// Get user for API testing
$user = User::first();
if (!$user) {
    echo "❌ No users found\n";
    exit;
}

$token = $user->createToken('test-api')->plainTextToken;
echo "✅ Using user: {$user->name}\n\n";

function testAPI($championshipId, $token) {
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

    echo "🏆 Championship {$championshipId} my-matches (HTTP {$httpCode}):\n";
    if ($httpCode === 200) {
        $data = json_decode($response, true);
        if (isset($data['matches'])) {
            echo "   Found " . count($data['matches']) . " matches\n";
            return $data;
        } else {
            echo "   No matches key in response\n";
            echo "   Response: " . substr($response, 0, 200) . "...\n";
        }
    } else {
        echo "   HTTP Error: {$httpCode}\n";
        echo "   Response: " . substr($response, 0, 200) . "...\n";
    }
    echo "\n";
    return null;
}

// Test both championships
$champ5Data = testAPI(5, $token);
$champ14Data = testAPI(14, $token);

// Compare database data directly
echo "📊 Database Comparison:\n";

function getDatabaseInfo($championshipId) {
    $championship = Championship::find($championshipId);
    $matches = ChampionshipMatch::where('championship_id', $championshipId)->get();

    echo "\n   Championship {$championshipId}:\n";
    echo "   Title: " . ($championship ? $championship->title : 'Not found') . "\n";
    echo "   Status: " . ($championship ? $championship->status : 'N/A') . "\n";
    echo "   Matches in DB: " . $matches->count() . "\n";

    if ($matches->count() > 0) {
        echo "   Sample match data:\n";
        $match = $matches->first();
        echo "     - Round: " . $match->round_number . "\n";
        echo "     - White Player ID: " . $match->white_player_id . "\n";
        echo "     - Black Player ID: " . $match->black_player_id . "\n";
        echo "     - Player1 ID: " . $match->player1_id . "\n";
        echo "     - Player2 ID: " . $match->player2_id . "\n";
        echo "     - Status: " . ($match->status ?? 'NULL') . "\n";
        echo "     - Status ID: " . $match->status_id . "\n";
        echo "     - Created: " . $match->created_at . "\n";
        echo "     - Updated: " . $match->updated_at . "\n";
    }
}

getDatabaseInfo(5);
getDatabaseInfo(14);

// Check user participation
echo "\n👥 User Participation Check:\n";
$user = User::first();

$champ5 = Championship::find(5);
$champ14 = Championship::find(14);

if ($champ5) {
    $isRegistered5 = $champ5->isUserRegistered($user->id);
    $hasPaid5 = $champ5->hasUserPaid($user->id);
    echo "   Championship 5: Registered=" . ($isRegistered5 ? 'Yes' : 'No') . ", Paid=" . ($hasPaid5 ? 'Yes' : 'No') . "\n";
}

if ($champ14) {
    $isRegistered14 = $champ14->isUserRegistered($user->id);
    $hasPaid14 = $champ14->hasUserPaid($user->id);
    echo "   Championship 14: Registered=" . ($isRegistered14 ? 'Yes' : 'No') . ", Paid=" . ($hasPaid14 ? 'Yes' : 'No') . "\n";
}

echo "\n✅ Comparison complete\n";