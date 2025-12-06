<?php

/**
 * Database Backup Script for Chess Web Application
 *
 * This script creates a complete backup of the database including:
 * - Schema (structure)
 * - All data
 * - Stores in timestamped backup files
 *
 * Usage: php database_backup.php
 */

require_once __DIR__ . '/vendor/autoload.php';

use Illuminate\Foundation\Application;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

class DatabaseBackup
{
    private string $backupPath;
    private string $databasePath;

    public function __construct()
    {
        $this->backupPath = __DIR__ . '/database/backups';
        $this->databasePath = config('database.connections.sqlite.database');

        // Ensure backup directory exists
        if (!is_dir($this->backupPath)) {
            mkdir($this->backupPath, 0755, true);
        }
    }

    public function getBackupPath(): string
    {
        return $this->backupPath;
    }

    /**
     * Create complete database backup
     */
    public function createBackup(): string
    {
        // Clean up old backups first (keep only 1)
        $this->cleanupOldBackups();

        // Include timestamp helper and use local timezone
        require_once __DIR__ . '/timestamp_helper.php';
        $timestamp = LocalTimestamp::backupTimestamp();
        $backupFile = $this->backupPath . "/chess_web_backup_{$timestamp}.sqlite";
        $dataFile = $this->backupPath . "/chess_web_data_{$timestamp}.json";

        echo "🚀 Starting database backup...\n";
        echo "📁 Backup location: {$backupFile}\n";
        echo "🕐 Local time: " . LocalTimestamp::displayDateTime() . "\n";

        // 1. Copy the database file (schema + data)
        if (!copy($this->databasePath, $backupFile)) {
            throw new Exception("Failed to create database backup");
        }

        echo "✅ Database file backed up successfully\n";

        // 2. Create JSON backup of all data for easy inspection
        $totalRecords = $this->createJsonBackup($dataFile);

        echo "✅ JSON data backup created: {$dataFile} ({$totalRecords} records)\n";

        // 3. Create backup info file
        $infoFile = $this->backupPath . "/backup_info_{$timestamp}.json";
        $this->createBackupInfo($infoFile, $backupFile, $dataFile);

        echo "✅ Backup info file created: {$infoFile}\n";
        echo "🎉 Backup completed successfully!\n";
        echo "📊 Backup size: " . number_format(filesize($backupFile)) . " bytes\n";

        return $backupFile;
    }

    /**
     * Create JSON backup of all table data
     */
    private function createJsonBackup(string $dataFile): int
    {
        $tables = DB::select("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        $backupData = [];
        $totalRecords = 0;

        foreach ($tables as $table) {
            $tableName = $table->name;
            $data = DB::table($tableName);
            $count = $data->count();
            $totalRecords += $count;

            $status = $count > 0 ? "({$count} records)" : "(empty)";
            echo "📋 Backing up table: {$tableName} {$status}\n";

            if ($count > 0) {
                $backupData[$tableName] = json_decode(json_encode($data->get()), true);
            } else {
                $backupData[$tableName] = [];
            }
        }

        file_put_contents($dataFile, json_encode($backupData, JSON_PRETTY_PRINT));
        return $totalRecords;
    }

    /**
     * Create backup information file
     */
    private function createBackupInfo(string $infoFile, string $dbFile, string $dataFile): void
    {
        $info = [
            'timestamp' => LocalTimestamp::displayDateTime(),
            'timezone' => LocalTimestamp::getTimezone(),
            'database_file' => basename($dbFile),
            'data_file' => basename($dataFile),
            'tables' => [],
            'total_records' => 0
        ];

        $tables = DB::select("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");

        foreach ($tables as $table) {
            $count = DB::table($table->name)->count();
            $info['tables'][$table->name] = $count;
            $info['total_records'] += $count;
        }

        file_put_contents($infoFile, json_encode($info, JSON_PRETTY_PRINT));
    }

    /**
     * List all available backups
     */
    public function listBackups(): array
    {
        $backups = [];
        $files = glob($this->backupPath . "/chess_web_backup_*.sqlite");

        foreach ($files as $file) {
            $backups[] = [
                'file' => basename($file),
                'size' => filesize($file),
                'created' => date('Y-m-d H:i:s', filemtime($file))
            ];
        }

        rsort($backups);
        return $backups;
    }

    /**
     * Clean up old backup files (keep only 1)
     */
    private function cleanupOldBackups(): void
    {
        $backupFiles = glob($this->backupPath . "/chess_web_backup_*.sqlite");
        $dataFiles = glob($this->backupPath . "/chess_web_data_*.json");
        $infoFiles = glob($this->backupPath . "/backup_info_*.json");

        // Sort files by modification time (oldest first)
        usort($backupFiles, function($a, $b) {
            return filemtime($a) - filemtime($b);
        });
        usort($dataFiles, function($a, $b) {
            return filemtime($a) - filemtime($b);
        });
        usort($infoFiles, function($a, $b) {
            return filemtime($a) - filemtime($b);
        });

        // Keep only the newest backup files
        $filesToDelete = array_slice($backupFiles, 0, -1);
        $dataFilesToDelete = array_slice($dataFiles, 0, -1);
        $infoFilesToDelete = array_slice($infoFiles, 0, -1);

        $deletedCount = 0;
        foreach ($filesToDelete as $file) {
            if (unlink($file)) {
                $deletedCount++;
            }
        }
        foreach ($dataFilesToDelete as $file) {
            unlink($file);
        }
        foreach ($infoFilesToDelete as $file) {
            unlink($file);
        }

        if ($deletedCount > 0) {
            echo "🧹 Cleaned up {$deletedCount} old backup file(s)\n";
        }
    }

    /**
     * Restore from backup (uses JSON data for better compatibility)
     */
    public function restoreFromBackup(string $backupFile): bool
    {
        if (!file_exists($backupFile)) {
            throw new Exception("Backup file not found: {$backupFile}");
        }

        // Find corresponding JSON file
        $baseName = str_replace('.sqlite', '', basename($backupFile));
        $jsonFile = $this->backupPath . "/chess_web_data_" . str_replace('chess_web_backup_', '', $baseName) . ".json";

        if (!file_exists($jsonFile)) {
            echo "⚠️  JSON backup file not found, using SQLite backup directly\n";
            // Fallback to direct SQLite restore
            return copy($backupFile, $this->databasePath);
        }

        echo "📥 Restoring from backup: " . basename($backupFile) . "\n";

        // Use the JSON restore functionality
        // We need to call the restore script in a separate process to avoid bootstrap conflicts
        $jsonFileEscaped = escapeshellarg($jsonFile);
        $restoreScript = __DIR__ . '/restore_from_json.php';
        $command = "php {$restoreScript} {$jsonFileEscaped}";

        echo "🔧 Executing: {$command}\n";

        $output = [];
        $returnCode = 0;
        exec($command, $output, $returnCode);

        if ($returnCode !== 0) {
            throw new Exception("Failed to restore from JSON backup. Command output: " . implode("\n", $output));
        }

        // Output the restore script results
        foreach ($output as $line) {
            echo $line . "\n";
        }

        return true;
    }
}

// Command line interface
if (php_sapi_name() === 'cli') {
    try {
        $backup = new DatabaseBackup();

        if ($argc > 1) {
            $command = $argv[1];

            switch ($command) {
                case 'list':
                    $backups = $backup->listBackups();
                    if (empty($backups)) {
                        echo "📭 No backups found.\n";
                    } else {
                        echo "📚 Available backups:\n";
                        foreach ($backups as $b) {
                            echo "- {$b['file']} ({$b['size']} bytes, {$b['created']})\n";
                        }
                    }
                    break;

                case 'restore':
                    if (empty($argv[2])) {
                        echo "❌ Please specify backup file to restore\n";
                        echo "Usage: php database_backup.php restore <backup_file>\n";
                        exit(1);
                    }
                    if ($backup->restoreFromBackup($argv[2])) {
                        echo "✅ Database restored successfully from: {$argv[2]}\n";
                    } else {
                        echo "❌ Failed to restore database\n";
                        exit(1);
                    }
                    break;

                default:
                    echo "❌ Unknown command: {$command}\n";
                    echo "Available commands: backup, list, restore\n";
                    exit(1);
            }
        } else {
            // Default: create backup
            $backupFile = $backup->createBackup();
            echo "\n🎯 Next steps:\n";
            echo "1. To rollback migrations: php artisan migrate:reset\n";
            echo "2. To re-run migrations: php artisan migrate\n";
            echo "3. To restore backup: php database_backup.php restore " . $backupFile . "\n";
        }
    } catch (Exception $e) {
        echo "❌ Error: " . $e->getMessage() . "\n";
        exit(1);
    }
} else {
    echo "This script must be run from the command line.\n";
    exit(1);
}