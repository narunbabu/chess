<?php

require_once __DIR__ . '/vendor/autoload.php';

// Bootstrap Laravel
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Championship;
use App\Models\User;
use App\Models\ChampionshipParticipant;
use App\Enums\PaymentStatus;

echo "👥 Adding Test Participants to Championship 15\n";
echo str_repeat("=", 50) . "\n";

$championship = Championship::find(15);
if (!$championship) {
    echo "❌ Championship 15 not found\n";
    exit;
}

echo "✅ Championship: {$championship->title}\n";

// Get some test users
$users = User::take(3)->get(); // Get first 3 users
if ($users->count() < 2) {
    echo "❌ Need at least 2 users in database\n";
    exit;
}

echo "📋 Found {$users->count()} users for registration\n\n";

$addedCount = 0;
foreach ($users as $user) {
    // Check if user is already a participant
    $existingParticipant = ChampionshipParticipant::where('championship_id', 15)
        ->where('user_id', $user->id)
        ->first();

    if ($existingParticipant) {
        echo "⚠️  User {$user->name} is already registered\n";
        continue;
    }

    // Create new participant with completed payment
    $participant = ChampionshipParticipant::create([
        'championship_id' => 15,
        'user_id' => $user->id,
        'registration_status' => 'registered',
        'payment_status_id' => PaymentStatus::COMPLETED->getId(),
        'registered_at' => now(),
        'payment_completed_at' => now(),
    ]);

    if ($participant) {
        echo "✅ Added participant: {$user->name} (ID: {$user->id})\n";
        $addedCount++;
    } else {
        echo "❌ Failed to add participant: {$user->name}\n";
    }
}

echo "\n📊 Results:\n";
echo "   - Participants added: {$addedCount}\n";

// Update championship participant count
$championship->refresh();
echo "   - Total participants now: {$championship->participants_count}\n";

echo "\n🎉 Championship 15 is now ready for tournament generation!\n";
echo "   - Quick Generate All Rounds button should be ACTIVE\n";
echo "   - Configure button should work properly\n";
echo "   - Generate Tournament should succeed\n";

echo "\n✅ Test complete\n";