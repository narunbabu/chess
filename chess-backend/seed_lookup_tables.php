<?php
require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

echo "=== Seeding Lookup Tables ===\n\n";

try {
    // Check if tables exist
    if (!Schema::hasTable('game_statuses')) {
        echo "❌ game_statuses table does not exist!\n";
        echo "Run: php artisan migrate\n";
        exit(1);
    }

    if (!Schema::hasTable('game_end_reasons')) {
        echo "❌ game_end_reasons table does not exist!\n";
        echo "Run: php artisan migrate\n";
        exit(1);
    }

    echo "✅ Both tables exist\n\n";

    // Seed game_statuses
    echo "Seeding game_statuses...\n";
    DB::table('game_statuses')->delete(); // Clear existing
    DB::table('game_statuses')->insert([
        ['code' => 'waiting', 'label' => 'Waiting for opponent', 'created_at' => now(), 'updated_at' => now()],
        ['code' => 'active', 'label' => 'In progress', 'created_at' => now(), 'updated_at' => now()],
        ['code' => 'finished', 'label' => 'Finished', 'created_at' => now(), 'updated_at' => now()],
        ['code' => 'aborted', 'label' => 'Aborted', 'created_at' => now(), 'updated_at' => now()],
        ['code' => 'paused', 'label' => 'Paused', 'created_at' => now(), 'updated_at' => now()],
    ]);
    echo "✅ game_statuses seeded with " . DB::table('game_statuses')->count() . " rows\n\n";

    // Seed game_end_reasons
    echo "Seeding game_end_reasons...\n";
    DB::table('game_end_reasons')->delete(); // Clear existing
    DB::table('game_end_reasons')->insert([
        ['code' => 'checkmate', 'label' => 'Checkmate', 'created_at' => now(), 'updated_at' => now()],
        ['code' => 'resignation', 'label' => 'Resignation', 'created_at' => now(), 'updated_at' => now()],
        ['code' => 'stalemate', 'label' => 'Stalemate', 'created_at' => now(), 'updated_at' => now()],
        ['code' => 'timeout', 'label' => 'Timeout', 'created_at' => now(), 'updated_at' => now()],
        ['code' => 'draw_agreed', 'label' => 'Draw by agreement', 'created_at' => now(), 'updated_at' => now()],
        ['code' => 'threefold', 'label' => 'Threefold repetition', 'created_at' => now(), 'updated_at' => now()],
        ['code' => 'fifty_move', 'label' => 'Fifty-move rule', 'created_at' => now(), 'updated_at' => now()],
        ['code' => 'insufficient_material', 'label' => 'Insufficient material', 'created_at' => now(), 'updated_at' => now()],
        ['code' => 'aborted', 'label' => 'Game aborted', 'created_at' => now(), 'updated_at' => now()],
        ['code' => 'forfeit', 'label' => 'Forfeit', 'created_at' => now(), 'updated_at' => now()],
        ['code' => 'abandoned_mutual', 'label' => 'Abandoned by agreement', 'created_at' => now(), 'updated_at' => now()],
        ['code' => 'timeout_inactivity', 'label' => 'Timeout', 'created_at' => now(), 'updated_at' => now()],
    ]);
    echo "✅ game_end_reasons seeded with " . DB::table('game_end_reasons')->count() . " rows\n\n";

    echo "=== Verification ===\n\n";

    // Verify data
    $statuses = DB::table('game_statuses')->get();
    echo "game_statuses:\n";
    foreach ($statuses as $status) {
        echo "  - {$status->code} ({$status->label})\n";
    }

    echo "\ngame_end_reasons:\n";
    $reasons = DB::table('game_end_reasons')->get();
    foreach ($reasons as $reason) {
        echo "  - {$reason->code} ({$reason->label})\n";
    }

    echo "\n✅ ALL DONE! Lookup tables successfully seeded.\n";

} catch (\Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . ":" . $e->getLine() . "\n";
    exit(1);
}
