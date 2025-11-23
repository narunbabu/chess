<?php

require_once __DIR__ . '/vendor/autoload.php';

// Bootstrap Laravel
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;

echo "🔐 Testing Authenticated Matches API\n";
echo str_repeat("=", 50) . "\n";

// Get first user and create token
$user = User::first();
if (!$user) {
    echo "❌ No users found in database\n";
    exit;
}

echo "✅ Found user: {$user->name} ({$user->email})\n";

// Create Sanctum token
$token = $user->createToken('test-api')->plainTextToken;
echo "✅ Generated auth token\n";

// Test API call with token
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'http://localhost:8000/api/championships/14/matches');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Accept: application/json',
    'Authorization: Bearer ' . $token
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "\n📡 API Response (HTTP {$httpCode}):\n";
echo $response . "\n";

if ($httpCode === 200) {
    $data = json_decode($response, true);
    if (isset($data['matches'])) {
        echo "✅ Success! Found " . count($data['matches']) . " matches\n";
    } else {
        echo "❌ Unexpected response format\n";
    }
} else {
    echo "❌ API call failed with HTTP {$httpCode}\n";
}

echo "\n🔑 Test Token (copy this for frontend testing):\n";
echo $token . "\n";