<?php

/**
 * Test script to simulate large log file rotation
 * This creates a large log file and tests the rotation process
 */

require_once __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\File;

echo "🧪 Testing Large Log File Rotation\n\n";

$logPath = storage_path('logs/laravel.log');
$originalSize = file_exists($logPath) ? filesize($logPath) : 0;

echo "Original log size: " . formatBytes($originalSize) . "\n";

// Create a large test log file (simulate 32MB like your original)
echo "📝 Creating large test log file...\n";

$testLogContent = str_repeat(
    "[" . date('Y-m-d H:i:s') . "] local.INFO: Test log entry for rotation testing\n" .
    "[" . date('Y-m-d H:i:s') . "] local.DEBUG: Debug information with some sample data\n" .
    "[" . date('Y-m-d H:i:s') . "] local.ERROR: Sample error message for testing purposes\n",
    10000 // This will create a substantial file
);

file_put_contents($logPath, $testLogContent);
$newSize = filesize($logPath);

echo "✅ Created test log file: " . formatBytes($newSize) . "\n";

// Test the rotation command
echo "\n🔄 Running log rotation test...\n";

$startTime = microtime(true);
$output = [];
$returnCode = 0;

exec('php artisan logs:rotate --force --compress=7 --cleanup=30 2>&1', $output, $returnCode);

$endTime = microtime(true);
$executionTime = round(($endTime - $startTime) * 1000, 2);

echo "⏱️  Execution time: {$executionTime}ms\n";
echo "🔢 Return code: {$returnCode}\n";

echo "\n📋 Command output:\n";
foreach ($output as $line) {
    echo "   {$line}\n";
}

// Verify results
echo "\n📊 Results verification:\n";

$currentSize = file_exists($logPath) ? filesize($logPath) : 0;
echo "   Current log size: " . formatBytes($currentSize) . "\n";

$rotatedFiles = glob(storage_path('logs/laravel-*.log'));
$compressedFiles = glob(storage_path('logs/laravel-*.log.gz'));

echo "   Rotated files: " . count($rotatedFiles) . "\n";
echo "   Compressed files: " . count($compressedFiles) . "\n";

$totalSpaceSaved = 0;
foreach ($compressedFiles as $file) {
    echo "   📦 " . basename($file) . ": " . formatBytes(filesize($file)) . "\n";
}

// Performance analysis
if ($newSize > 0) {
    $compressionRatio = count($compressedFiles) > 0 ?
        (filesize($compressedFiles[0]) / $newSize) * 100 : 0;
    echo "\n📈 Performance metrics:\n";
    echo "   Compression ratio: " . round($compressionRatio, 1) . "%\n";
    echo "   Processing speed: " . round($newSize / 1024 / 1024 / ($executionTime / 1000), 2) . " MB/s\n";
}

echo "\n✅ Large log rotation test completed!\n";

function formatBytes($bytes) {
    $units = ['B', 'KB', 'MB', 'GB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    $bytes /= pow(1024, $pow);
    return round($bytes, 1) . ' ' . $units[$pow];
}