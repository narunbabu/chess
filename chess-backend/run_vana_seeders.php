<?php
/**
 * Run Only Seeders Starting with "vana"
 *
 * This script finds and runs all seeder files in database/seeders
 * whose filenames start with "vana" (case-insensitive).
 *
 * Usage: php run_vana_seeders.php
 */

// Bootstrap Laravel
require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

// Find seeders starting with "vana"
$seedersPath = __DIR__ . '/database/seeders';
$seederFiles = glob($seedersPath . '/vana*.php') ?: glob($seedersPath . '/Vana*.php') ?: [];

if (empty($seederFiles)) {
    echo "\n❌ No seeder files starting with 'vana' found in database/seeders/\n\n";
    echo "Available seeders:\n";

    $allSeeders = glob($seedersPath . '/*.php');
    foreach ($allSeeders as $file) {
        echo "  - " . basename($file) . "\n";
    }

    echo "\nTo create new seeders:\n";
    echo "  php artisan make:seeder VanaExampleSeeder\n\n";
    exit(1);
}

echo "\n🌱 Found " . count($seederFiles) . " seeder(s) starting with 'vana':\n";
foreach ($seederFiles as $file) {
    echo "  ✓ " . basename($file) . "\n";
}

echo "\n🔄 Running seeders...\n\n";

foreach ($seederFiles as $file) {
    $className = 'Database\\Seeders\\' . basename($file, '.php');

    try {
        echo "Running: $className ... ";

        // Create an instance and run the seeder
        $seeder = app()->make($className);
        $seeder->run();

        echo "✅ SUCCESS\n";
    } catch (\Exception $e) {
        echo "❌ FAILED\n";
        echo "Error: " . $e->getMessage() . "\n\n";
    }
}

echo "\n✨ All seeders completed!\n\n";
