<?php

require_once __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "🔍 Checking Foreign Key Constraints...\n";
echo str_repeat("=", 50) . "\n";

// Check if any championships use the paused status
$pausedChampionships = DB::table('championships')
    ->where('status_id', 6) // ID 6 should be 'paused'
    ->count();

echo "📊 Championships with status_id = 6 (paused): {$pausedChampionships}\n";

// Check all championship status references
$statusReferences = DB::table('championships')
    ->select('status_id', DB::raw('count(*) as count'))
    ->groupBy('status_id')
    ->get();

echo "\n📋 Championship Status Usage:\n";
foreach ($statusReferences as $ref) {
    $status = DB::table('championship_statuses')->find($ref->status_id);
    $code = $status ? $status->code : 'unknown';
    echo "  Status ID {$ref->status_id} ({$code}): {$ref->count} championships\n";
}

// Check the paused status record
$pausedStatus = DB::table('championship_statuses')->where('code', 'paused')->first();
if ($pausedStatus) {
    echo "\n📝 Paused Status Record:\n";
    echo "  ID: {$pausedStatus->id}\n";
    echo "  Code: {$pausedStatus->code}\n";
    echo "  Label: {$pausedStatus->label}\n";
}

echo "\n💡 Solution:\n";
if ($pausedChampionships > 0) {
    echo "❌ Cannot delete paused status - {$pausedChampionships} championships are using it!\n";
    echo "✅ Fix: Update those championships to use a different status before rollback\n";
} else {
    echo "✅ No championships are using paused status - should be safe to delete\n";
}