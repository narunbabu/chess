<?php

/**
 * MySQL Database Restore Script
 *
 * This script restores a MySQL database from a mysqldump backup file
 *
 * Usage: php restore_mysql_backup.php <backup_file.sql>
 */

if ($argc < 2) {
    echo "❌ Usage: php restore_mysql_backup.php <backup_file.sql>\n";
    exit(1);
}

$backupFile = $argv[1];

if (!file_exists($backupFile)) {
    echo "❌ Backup file not found: {$backupFile}\n";
    exit(1);
}

// Get Laravel database configuration
require_once __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$dbConfig = config('database.connections.mysql');

$host = $dbConfig['host'];
$port = $dbConfig['port'] ?? 3306;
$database = $dbConfig['database'];
$username = $dbConfig['username'];
$password = $dbConfig['password'];

echo "🚀 Starting MySQL database restore...\n";
echo "📁 Backup file: {$backupFile}\n";
echo "🗄️  Database: {$database}@{$host}:{$port}\n";
echo "👤 User: {$username}\n\n";

// Get password if not in config
if (empty($password)) {
    echo "🔐 Enter MySQL password for user '{$username}': ";
    $password = trim(fgets(STDIN));
}

// Build mysql command
$command = sprintf(
    'mysql -h%s -P%s -u%s -p%s %s < %s',
    escapeshellarg($host),
    escapeshellarg($port),
    escapeshellarg($username),
    escapeshellarg($password),
    escapeshellarg($database),
    escapeshellarg($backupFile)
);

echo "🔧 Executing MySQL restore command...\n";

// Execute command and capture output
$output = [];
$returnCode = 0;
exec($command, $output, $returnCode);

if ($returnCode !== 0) {
    echo "❌ MySQL restore failed. Return code: {$returnCode}\n";
    if (!empty($output)) {
        echo "Output: " . implode("\n", $output) . "\n";
    }
    exit(1);
}

echo "✅ Database restored successfully!\n";
echo "🎉 Restore completed successfully!\n";

// Optionally show any output from mysql
if (!empty($output)) {
    echo "\n📋 MySQL output:\n";
    foreach ($output as $line) {
        echo $line . "\n";
    }
}