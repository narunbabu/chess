<?php
require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

echo "=== Game Statuses Lookup Table ===\n";
$statuses = DB::table('game_statuses')->orderBy('id')->get();
if ($statuses->isEmpty()) {
    echo "❌ Table is EMPTY!\n\n";
} else {
    foreach ($statuses as $status) {
        echo "ID: {$status->id} | Code: '{$status->code}' | Name: '{$status->name}'\n";
    }
}

echo "\n=== Game End Reasons Lookup Table ===\n";
$reasons = DB::table('game_end_reasons')->orderBy('id')->get();
if ($reasons->isEmpty()) {
    echo "❌ Table is EMPTY!\n\n";
} else {
    foreach ($reasons as $reason) {
        echo "ID: {$reason->id} | Code: '{$reason->code}' | Name: '{$reason->name}'\n";
    }
}
