<?php

require_once __DIR__ . '/vendor/autoload.php';

// Bootstrap Laravel
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\ChampionshipMatch;

echo "🔧 Testing my-matches Fix for Championship 14\n";
echo str_repeat("=", 50) . "\n";

// Get user for testing
$user = User::first();
if (!$user) {
    echo "❌ No users found\n";
    exit;
}

echo "✅ Testing with user: {$user->name} (ID: {$user->id})\n";
echo "   Email: {$user->email}\n\n";

// Test the exact query that my-matches uses
echo "📊 Testing my-matches query logic:\n";

$matches = ChampionshipMatch::where('championship_id', 14)
    ->where(function ($query) use ($user) {
        $query->where('player1_id', $user->id)
            ->orWhere('player2_id', $user->id)
            ->orWhere('white_player_id', $user->id)
            ->orWhere('black_player_id', $user->id);
    })
    ->get();

echo "   Found {$matches->count()} matches for championship 14\n";

if ($matches->count() > 0) {
    echo "\n📋 Match Details:\n";
    foreach ($matches as $index => $match) {
        $whiteName = $match->white_player ? $match->white_player->name : 'Unknown';
        $blackName = $match->black_player ? $match->black_player->name : 'Unknown';
        $status = $match->status ?? 'Unknown';

        echo sprintf(
            "   %d. Round %d: %s (White: %s, Black: %s, Status: %s)\n",
            $index + 1,
            $match->round_number,
            $status,
            $whiteName,
            $blackName,
            $status
        );

        // Show which field matched
        if ($match->player1_id == $user->id) echo "       → Matched via player1_id\n";
        if ($match->player2_id == $user->id) echo "       → Matched via player2_id\n";
        if ($match->white_player_id == $user->id) echo "       → Matched via white_player_id\n";
        if ($match->black_player_id == $user->id) echo "       → Matched via black_player_id\n";
    }
}

// Test API call
echo "\n🌐 Testing API call:\n";
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'http://localhost:8000/api/championships/14/my-matches');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Accept: application/json',
    'Authorization: Bearer ' . $user->createToken('test-api')->plainTextToken
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "   HTTP Status: {$httpCode}\n";
if ($httpCode === 200) {
    $data = json_decode($response, true);
    if (isset($data['matches'])) {
        echo "   ✅ API Success! Found " . count($data['matches']) . " matches\n";
    } else {
        echo "   ⚠️  No matches key in response\n";
        echo "   Response: " . substr($response, 0, 300) . "...\n";
    }
} else {
    echo "   ❌ API Error: {$httpCode}\n";
    echo "   Response: " . substr($response, 0, 300) . "...\n";
}

echo "\n✅ Test completed\n";