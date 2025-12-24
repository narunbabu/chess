<?php
require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

echo "=== Checking Invitation #4 ===\n\n";

// Check if invitation exists
$invitation = DB::table('invitations')->find(4);

if ($invitation) {
    echo "Invitation #4 Found:\n";
    echo json_encode($invitation, JSON_PRETTY_PRINT) . "\n\n";

    // Check if championship_match_id column exists
    if (property_exists($invitation, 'championship_match_id')) {
        echo "championship_match_id column EXISTS\n";
        echo "Value: " . ($invitation->championship_match_id ?? 'NULL') . "\n\n";

        // If it has a championship_match_id, check if the match exists
        if ($invitation->championship_match_id) {
            $match = DB::table('championship_matches')->find($invitation->championship_match_id);
            if ($match) {
                echo "Championship match EXISTS (ID: {$invitation->championship_match_id})\n";
            } else {
                echo "❌ ERROR: Championship match NOT FOUND (ID: {$invitation->championship_match_id})\n";
                echo "This is likely causing the 500 error!\n";
            }
        }
    } else {
        echo "❌ ERROR: championship_match_id column DOES NOT EXIST\n";
        echo "This is likely causing the 500 error!\n";
    }
} else {
    echo "❌ Invitation #4 NOT FOUND in database\n";
}

echo "\n=== Table Schema ===\n";
$columns = DB::select("PRAGMA table_info(invitations)");
echo "Columns in invitations table:\n";
foreach ($columns as $col) {
    echo "- {$col->name} ({$col->type})\n";
}
