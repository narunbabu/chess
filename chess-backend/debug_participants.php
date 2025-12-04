<?php

require __DIR__ . '/vendor/autoload.php';

use App\Models\Championship;
use App\Models\User;
use App\Models\ChampionshipParticipant;
use App\Enums\PaymentStatus;

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "🔍 DEBUG: Payment Status and Participants\n";
echo "========================================\n\n";

// Check PaymentStatus enum
echo "PaymentStatus::COMPLETED->getId() = " . PaymentStatus::COMPLETED->getId() . "\n";
echo "PaymentStatus::COMPLETED value = " . PaymentStatus::COMPLETED->value . "\n\n";

// Create test championship
$championship = Championship::create([
    'title' => "Debug Test",
    'format_id' => 1,
    'status_id' => \App\Enums\ChampionshipStatus::IN_PROGRESS->getId(),
    'match_time_window_hours' => 24,
    'registration_deadline' => now()->addDays(7),
    'start_date' => now()->addDay(),
    'total_rounds' => 10,
    'visibility' => 'public',
    'is_test_tournament' => true,
]);

echo "Created championship ID: {$championship->id}\n";

// Create test participant
$user = User::factory()->create([
    'name' => "Debug Player",
    'rating' => 1500,
]);

echo "Created user ID: {$user->id}\n";

$participant = ChampionshipParticipant::create([
    'championship_id' => $championship->id,
    'user_id' => $user->id,
    'payment_status_id' => PaymentStatus::COMPLETED->getId(),
]);

echo "Created participant with payment_status_id = " . $participant->payment_status_id . "\n";

// Test the query used in SwissPairingService
$eligibleParticipants = $championship->participants()
    ->where('payment_status_id', PaymentStatus::COMPLETED->getId())
    ->with('user')
    ->get();

echo "Eligible participants count: " . $eligibleParticipants->count() . "\n";

foreach ($eligibleParticipants as $p) {
    echo "  - User: {$p->user->name}, payment_status_id: {$p->payment_status_id}\n";
}

// Debug: try with raw value
$eligibleRaw = $championship->participants()
    ->where('payment_status_id', 2)
    ->with('user')
    ->get();

echo "Eligible (raw ID=2) participants count: " . $eligibleRaw->count() . "\n";

foreach ($eligibleRaw as $p) {
    echo "  - User: {$p->user->name}, payment_status_id: {$p->payment_status_id}\n";
}

// Test all participants
$allParticipants = $championship->participants()->with('user')->get();
echo "All participants count: " . $allParticipants->count() . "\n";

foreach ($allParticipants as $p) {
    echo "  - User: {$p->user->name}, payment_status_id: {$p->payment_status_id}, dropped: " . ($p->dropped ? 'true' : 'false') . "\n";
}

echo "\n✅ Debug completed\n";