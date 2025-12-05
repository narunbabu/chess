<?php

require_once 'vendor/autoload.php';

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$championshipId = 102;

echo "Fixing payment status for Championship ID: $championshipId\n";

$championship = App\Models\Championship::find($championshipId);

if (!$championship) {
    echo "Championship not found\n";
    exit;
}

$participants = $championship->participants()->get();
echo "Found " . $participants->count() . " participants\n";

$updated = 0;
foreach ($participants as $participant) {
    if ($participant->payment_status_id == 1) { // PENDING
        $participant->update(['payment_status_id' => 2]); // COMPLETED
        echo "- Updated user: " . $participant->user->email . " (ID: " . $participant->user->id . ")\n";
        $updated++;
    }
}

echo "\nSummary:\n";
echo "- Total participants: " . $participants->count() . "\n";
echo "- Updated to COMPLETED: $updated\n";
echo "- Already had correct status: " . ($participants->count() - $updated) . "\n";

echo "\nVerification:\n";
$championship->refresh();
$participants = $championship->participants()->with('paymentStatusRelation')->get();
$paymentStats = $participants->groupBy('payment_status_id');

foreach ($paymentStats as $statusId => $group) {
    $statusName = $group->first()->paymentStatusRelation->name ?? 'Unknown';
    echo "Status " . $statusId . " (" . $statusName . "): " . $group->count() . " participants\n";
}

echo "\n✅ Payment status fix completed!\n";