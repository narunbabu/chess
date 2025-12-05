<?php

require_once 'vendor/autoload.php';

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$championshipId = 102;
$championship = App\Models\Championship::find($championshipId);

if (!$championship) {
    echo "Championship not found\n";
    exit;
}

echo "Championship Details:\n";
echo "ID: " . $championship->id . "\n";
echo "Name: " . $championship->name . "\n";
echo "Type: " . $championship->type . "\n";
echo "Total Participants: " . $championship->participants()->count() . "\n";
echo "\n";

echo "Payment Status Breakdown:\n";
$participants = $championship->participants()->with('paymentStatusRelation')->get();
$paymentStats = $participants->groupBy('payment_status_id');

foreach ($paymentStats as $statusId => $group) {
    $statusName = $group->first()->paymentStatusRelation->name ?? 'Unknown';
    echo "Status " . $statusId . " (" . $statusName . "): " . $group->count() . " participants\n";
}

echo "\n";
echo "Individual Participants:\n";
foreach ($participants as $participant) {
    echo "- User: " . $participant->user->email .
         " | Payment: " . ($participant->paymentStatusRelation->name ?? 'N/A') .
         " | Status ID: " . $participant->payment_status_id .
         " | Code: " . $participant->payment_status . "\n";
}