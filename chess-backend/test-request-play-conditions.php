<?php

require_once __DIR__ . '/vendor/autoload.php';

// Bootstrap Laravel
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\ChampionshipMatch;

echo "🔍 Testing Request Play Button Conditions for Championship 14\n";
echo str_repeat("=", 60) . "\n";

// Get user for testing
$user = User::find(1); // User 1 who participates in Round 3 matches
if (!$user) {
    echo "❌ User 1 not found\n";
    exit;
}

echo "✅ Testing with user: {$user->name} (ID: {$user->id})\n\n";

// Get Round 3 matches
$round3Matches = ChampionshipMatch::where('championship_id', 14)
    ->where('round_number', 3)
    ->with(['white_player', 'black_player', 'player1', 'player2'])
    ->get();

echo "🎯 Round 3 Matches Analysis:\n\n";

foreach ($round3Matches as $match) {
    echo "Match ID: {$match->id}\n";
    echo "  - White Player ID: {$match->white_player_id}\n";
    echo "  - Black Player ID: {$match->black_player_id}\n";
    echo "  - Status: '{$match->status}'\n";
    echo "  - Game ID: " . ($match->game_id ?? 'NULL') . "\n";
    echo "  - Result: " . ($match->result ?? 'NULL') . "\n";

    // Check if user relationships are loaded
    echo "  - White Player User: " . ($match->white_player ? "✅ {$match->white_player->name}" : "❌ NULL") . "\n";
    echo "  - Black Player User: " . ($match->black_player ? "✅ {$match->black_player->name}" : "❌ NULL") . "\n";

    // Test Frontend Conditions (canUserRequestPlay logic)
    $isUserParticipant = ($match->white_player_id == $user->id) || ($match->black_player_id == $user->id);
    $isPendingOrScheduled = ($match->status === 'pending' || $match->status === 'scheduled');
    $noGameExists = !$match->game_id;
    $noResult = !$match->result;

    echo "\n  🔍 Frontend Conditions Check:\n";
    echo "    - isUserParticipantInMatch: " . ($isUserParticipant ? "✅ TRUE" : "❌ FALSE") . "\n";
    echo "    - match.status is pending/scheduled: " . ($isPendingOrScheduled ? "✅ TRUE" : "❌ FALSE") . "\n";
    echo "    - no game_id: " . ($noGameExists ? "✅ TRUE" : "❌ FALSE") . "\n";
    echo "    - no result: " . ($noResult ? "✅ TRUE" : "❌ FALSE") . "\n";

    $canUserRequestPlay = $isUserParticipant && $isPendingOrScheduled && $noGameExists && $noResult;
    echo "    - 📊 canUserRequestPlay (Final): " . ($canUserRequestPlay ? "✅ TRUE - BUTTON SHOULD SHOW" : "❌ FALSE - BUTTON HIDDEN") . "\n";

    // Test API endpoint that handleSendPlayRequest calls
    echo "\n  🔗 API Endpoint Test:\n";
    $token = $user->createToken('test-api')->plainTextToken;

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "http://localhost:8000/api/championships/14/matches/{$match->id}/can-play");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Accept: application/json',
        'Authorization: Bearer ' . $token
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    echo "    - /can-play API (HTTP {$httpCode}): ";
    if ($httpCode === 200) {
        $data = json_decode($response, true);
        echo $data['canPlay'] ? "✅ TRUE" : "❌ FALSE";
        if (isset($data['reason'])) {
            echo " - Reason: {$data['reason']}";
        }
    } else {
        echo "❌ ERROR - " . substr($response, 0, 100);
    }
    echo "\n";

    echo "\n" . str_repeat("-", 50) . "\n";
}

echo "\n✅ Analysis complete\n";
echo "\n💡 Summary:\n";
echo "- If canUserRequestPlay is FALSE, the Request Play button won't appear\n";
echo "- If /can-play API returns FALSE, the button click will show an error\n";
echo "- Check both conditions to determine why the button isn't working\n";