<?php

require_once __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "🔍 Checking Tables that Reference 'games' table...\n";
echo str_repeat("=", 60) . "\n";

// Get all tables
$tables = DB::select("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");

$referencingTables = [];

foreach ($tables as $table) {
    $tableName = $table->name;

    // Skip the games table itself
    if ($tableName === 'games') {
        continue;
    }

    try {
        // Check if this table has foreign key references to games
        $fks = DB::select("PRAGMA foreign_key_list({$tableName})");

        foreach ($fks as $fk) {
            if ($fk->table === 'games') {
                $referencingTables[] = [
                    'table' => $tableName,
                    'column' => $fk->from,
                    'games_column' => $fk->to,
                    'on_delete' => isset($fk->on_delete) ? $fk->on_delete : 'NO ACTION'
                ];
                echo "🔗 Found: {$tableName}.{$fk->from} -> games.{$fk->to} (ON DELETE " . (isset($fk->on_delete) ? $fk->on_delete : 'NO ACTION') . ")\n";
            }
        }
    } catch (Exception $e) {
        echo "⚠️  Could not check table {$tableName}: " . $e->getMessage() . "\n";
    }
}

if (empty($referencingTables)) {
    echo "\n✅ No tables found referencing 'games' table\n";
} else {
    echo "\n📊 Summary:\n";
    echo "- Found " . count($referencingTables) . " tables referencing 'games'\n";
    echo "- Tables need to be dropped BEFORE 'games' table\n";
    echo "- This is causing the migration rollback to fail\n";
}

// Check if championship_matches table exists
if (Schema::hasTable('championship_matches')) {
    echo "\n🎯 championship_matches table exists with " . DB::table('championship_matches')->count() . " records\n";
} else {
    echo "\n❌ championship_matches table does not exist\n";
}