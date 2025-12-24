<?php
require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

echo "=== Checking GameStatus Model ===\n\n";

// Check if GameStatus model exists
if (!class_exists('\App\Models\GameStatus')) {
    echo "❌ GameStatus model does NOT exist!\n";
    echo "This is the root cause of the invitation error.\n\n";

    // Check if the table exists
    try {
        $statuses = DB::select("SELECT * FROM game_statuses");
        echo "✅ game_statuses table exists with " . count($statuses) . " records:\n";
        foreach ($statuses as $status) {
            echo "  - ID: {$status->id}, Code: {$status->code}, Name: {$status->name}\n";
        }
    } catch (\Exception $e) {
        echo "❌ game_statuses table does NOT exist\n";
        echo "Error: " . $e->getMessage() . "\n";
    }
} else {
    echo "✅ GameStatus model exists\n\n";

    // Test getIdByCode method
    if (method_exists('\App\Models\GameStatus', 'getIdByCode')) {
        echo "✅ getIdByCode method exists\n";

        // Test with 'waiting' status
        try {
            $id = \App\Models\GameStatus::getIdByCode('waiting');
            echo "✅ getIdByCode('waiting') returns: " . ($id ?? 'NULL') . "\n";
        } catch (\Exception $e) {
            echo "❌ getIdByCode('waiting') failed: " . $e->getMessage() . "\n";
        }
    } else {
        echo "❌ getIdByCode method does NOT exist\n";
    }
}

echo "\n=== Checking GameEndReason Model ===\n\n";

if (!class_exists('\App\Models\GameEndReason')) {
    echo "❌ GameEndReason model does NOT exist!\n\n";

    // Check if the table exists
    try {
        $reasons = DB::select("SELECT * FROM game_end_reasons");
        echo "✅ game_end_reasons table exists with " . count($reasons) . " records:\n";
        foreach ($reasons as $reason) {
            echo "  - ID: {$reason->id}, Code: {$reason->code}, Name: {$reason->name}\n";
        }
    } catch (\Exception $e) {
        echo "❌ game_end_reasons table does NOT exist\n";
        echo "Error: " . $e->getMessage() . "\n";
    }
} else {
    echo "✅ GameEndReason model exists\n";
}
