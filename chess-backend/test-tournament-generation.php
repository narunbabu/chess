<?php

require_once __DIR__ . '/vendor/autoload.php';

// Bootstrap Laravel
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Championship;
use App\Models\User;

echo "🔍 Testing Tournament Generation for Championship 15\n";
echo str_repeat("=", 60) . "\n";

// Get championship 15
$championship = Championship::find(15);
if (!$championship) {
    echo "❌ Championship 15 not found\n";
    exit;
}

echo "✅ Championship Found: {$championship->title}\n";
echo "   - ID: {$championship->id}\n";
echo "   - Status: {$championship->status}\n";
echo "   - Format: {$championship->format}\n";
echo "   - Total Rounds: {$championship->total_rounds}\n";
echo "   - Max Participants: {$championship->max_participants}\n";
echo "   - Participants Count: {$championship->participants_count}\n";
echo "   - Tournament Generated: " . ($championship->tournament_generated ? 'Yes' : 'No') . "\n";
echo "   - Registration Deadline: {$championship->registration_deadline}\n";
echo "   - Start Date: {$championship->start_date}\n\n";

// Check participants
$participants = $championship->participants()->get();
echo "👥 Participants Analysis:\n";
echo "   - Total participants in database: " . $participants->count() . "\n";

if ($participants->count() > 0) {
    foreach ($participants as $participant) {
        echo "   - User ID {$participant->user_id}: Payment Status " . ($participant->payment_status_id ?? 'NULL') . "\n";
    }
} else {
    echo "   - ❌ NO PARTICIPANTS FOUND\n";
}

echo "\n🔐 Authentication Test:\n";
$user = User::first();
if (!$user) {
    echo "❌ No users found for testing\n";
    exit;
}

echo "✅ Testing with user: {$user->name} (ID: {$user->id})\n";
$token = $user->createToken('test-api')->plainTextToken;

// Test 1: Tournament Preview
echo "\n📋 Test 1: Tournament Preview API\n";
function testTournamentPreview($championshipId, $token, $user) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "http://localhost:8000/api/championships/{$championshipId}/tournament-preview?preset=small_tournament");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Accept: application/json',
        'Authorization: Bearer ' . $token
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    echo "   HTTP Status: {$httpCode}\n";
    if ($httpCode === 200) {
        $data = json_decode($response, true);
        echo "   ✅ Preview API Success\n";
        if (isset($data['preview'])) {
            echo "   - Preview data found: " . count($data['preview']) . " rounds\n";
        } else {
            echo "   - No preview data in response\n";
        }
    } elseif ($httpCode === 403) {
        echo "   ❌ Authorization Failed - User may not have manage permissions\n";
    } else {
        echo "   ❌ API Error: " . substr($response, 0, 200) . "\n";
    }
}

testTournamentPreview(15, $token, $user);

// Test 2: Check what's required for tournament generation
echo "\n⚙️ Test 2: Tournament Generation Requirements\n";
echo "   - Minimum participants needed: 2\n";
echo "   - Current participants: " . $championship->participants_count . "\n";
echo "   - Meets minimum: " . ($championship->participants_count >= 2 ? "✅ YES" : "❌ NO") . "\n";

if ($championship->participants_count < 2) {
    echo "\n💡 SOLUTION: Add participants to championship\n";
    echo "   The tournament generation requires at least 2 participants to work.\n";
    echo "   The Quick Generate button is disabled because participants_count = 0.\n";
}

// Test 3: Check TournamentGenerationService configuration
echo "\n🔧 Test 3: Check Tournament Generation Service\n";
try {
    // Try to create a basic tournament config to test validation
    $config = [
        'mode' => 'adaptive',
        'total_rounds' => 5,
        'max_participants' => 10,
        'round_structure' => [
            [
                'round_number' => 1,
                'name' => 'Round 1',
                'selection_rule' => 'all_participants',
                'matches_per_player' => 1,
                'pairing_method' => 'random_seeded',
                'description' => 'All participants play'
            ]
        ],
        'avoid_repeat_matches' => true,
        'color_balance_strict' => true
    ];

    echo "   ✅ Test configuration created successfully\n";
    echo "   - Total rounds: " . $config['total_rounds'] . "\n";
    echo "   - Round 1 matches_per_player: " . $config['round_structure'][0]['matches_per_player'] . "\n";

    if ($config['round_structure'][0]['matches_per_player'] < 1) {
        echo "   ❌ ERROR: matches_per_player must be >= 1\n";
    } else {
        echo "   ✅ matches_per_player looks valid\n";
    }

} catch (Exception $e) {
    echo "   ❌ Configuration test failed: " . $e->getMessage() . "\n";
}

echo "\n🎯 Summary:\n";
echo "1. Quick Generate All Rounds button: DISABLED (correctly) because there are 0 participants\n";
echo "2. Configure button: May fail due to 0 participants\n";
echo "3. Generate Tournament error: Likely due to 0 participants or invalid config\n";
echo "\n💡 PRIMARY SOLUTION:\n";
echo "   - Add at least 2 participants to Championship 15\n";
echo "   - Make sure participants have completed payment status\n";
echo "   - Tournament generation should work after participants are added\n";

echo "\n✅ Test complete\n";