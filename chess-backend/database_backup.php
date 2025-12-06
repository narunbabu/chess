<?php

/**
 * Database Backup Script for Chess Web Application
 *
 * This script creates a complete backup of the database including:
 * - Schema (structure) - via mysqldump for MySQL
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
    private string $dbType;
    private array $dbConfig;

    public function __construct()
    {
        $this->backupPath = __DIR__ . '/database/backups';
        $this->dbType = config('database.default');
        $this->dbConfig = config("database.connections.{$this->dbType}");

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

        // Determine file extension based on database type
        $extension = $this->dbType === 'mysql' ? 'sql' : 'sqlite';
        $backupFile = $this->backupPath . "/chess_web_backup_{$timestamp}.{$extension}";
        $dataFile = $this->backupPath . "/chess_web_data_{$timestamp}.json";

        echo "🚀 Starting database backup...\n";
        echo "🔧 Database type: {$this->dbType}\n";
        echo "📁 Backup location: {$backupFile}\n";
        echo "🕐 Local time: " . LocalTimestamp::displayDateTime() . "\n";

        if ($this->dbType === 'mysql') {
            // MySQL backup using mysqldump
            $this->createMySQLBackup($backupFile);
        } else {
            // SQLite backup by copying file
            $this->createSQLiteBackup($backupFile);
        }

        echo "✅ Database backup created successfully\n";

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
     * Create MySQL backup using mysqldump
     */
    private function createMySQLBackup(string $backupFile): void
    {
        $host = $this->dbConfig['host'];
        $port = $this->dbConfig['port'] ?? 3306;
        $database = $this->dbConfig['database'];
        $username = $this->dbConfig['username'];

        // Get password from environment or prompt user
        $password = $this->dbConfig['password'] ?? $this->getPassword();

        // Build mysqldump command
        $command = sprintf(
            'mysqldump -h%s -P%s -u%s -p%s --single-transaction --routines --triggers %s > %s',
            escapeshellarg($host),
            escapeshellarg($port),
            escapeshellarg($username),
            escapeshellarg($password),
            escapeshellarg($database),
            escapeshellarg($backupFile)
        );

        echo "🔧 Executing MySQL backup command...\n";

        // Execute command and capture output
        $output = [];
        $returnCode = 0;
        exec($command, $output, $returnCode);

        if ($returnCode !== 0) {
            throw new Exception("MySQL backup failed. Return code: {$returnCode}. Output: " . implode("\n", $output));
        }

        if (!file_exists($backupFile) || filesize($backupFile) === 0) {
            throw new Exception("MySQL backup file was not created or is empty");
        }
    }

    /**
     * Create SQLite backup by copying file
     */
    private function createSQLiteBackup(string $backupFile): void
    {
        $databasePath = $this->dbConfig['database'];
        if (!copy($databasePath, $backupFile)) {
            throw new Exception("Failed to create SQLite database backup");
        }
    }

    /**
     * Get password from user input if not in config
     */
    private function getPassword(): string
    {
        echo "🔐 Enter MySQL password for user '{$this->dbConfig['username']}': ";
        $password = trim(fgets(STDIN));
        return $password;
    }

    /**
     * Create JSON backup of all table data
     */
    private function createJsonBackup(string $dataFile): int
    {
        $tables = $this->getAllTables();
        $backupData = [];
        $totalRecords = 0;

        foreach ($tables as $tableName) {
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
     * Get all tables based on database type
     */
    private function getAllTables(): array
    {
        if ($this->dbType === 'mysql') {
            $tables = DB::select("SHOW TABLES");
            $key = array_keys((array)$tables[0])[0];
            return array_map(fn($table) => $table->$key, $tables);
        } else {
            $tables = DB::select("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
            return array_map(fn($table) => $table->name, $tables);
        }
    }

    /**
     * Create backup information file
     */
    private function createBackupInfo(string $infoFile, string $dbFile, string $dataFile): void
    {
        $info = [
            'timestamp' => LocalTimestamp::displayDateTime(),
            'timezone' => LocalTimestamp::getTimezone(),
            'database_type' => $this->dbType,
            'database_file' => basename($dbFile),
            'data_file' => basename($dataFile),
            'tables' => [],
            'total_records' => 0
        ];

        $tables = $this->getAllTables();

        foreach ($tables as $tableName) {
            $count = DB::table($tableName)->count();
            $info['tables'][$tableName] = $count;
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

        // Look for both SQLite and MySQL backups
        $files = array_merge(
            glob($this->backupPath . "/chess_web_backup_*.sqlite"),
            glob($this->backupPath . "/chess_web_backup_*.sql")
        );

        foreach ($files as $file) {
            $backups[] = [
                'file' => basename($file),
                'size' => filesize($file),
                'type' => pathinfo($file, PATHINFO_EXTENSION) === 'sql' ? 'MySQL' : 'SQLite',
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
        // Look for both SQLite and MySQL backup files
        $backupFiles = array_merge(
            glob($this->backupPath . "/chess_web_backup_*.sqlite"),
            glob($this->backupPath . "/chess_web_backup_*.sql")
        );
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
     * Restore from backup (handles both MySQL and SQLite)
     */
    public function restoreFromBackup(string $backupFile): bool
    {
        if (!file_exists($backupFile)) {
            throw new Exception("Backup file not found: {$backupFile}");
        }

        $extension = strtolower(pathinfo($backupFile, PATHINFO_EXTENSION));

        if ($extension === 'sql') {
            // MySQL restore
            return $this->restoreMySQLBackup($backupFile);
        } elseif ($extension === 'sqlite') {
            // SQLite restore
            return $this->restoreSQLiteBackup($backupFile);
        } else {
            throw new Exception("Unsupported backup file type: {$extension}");
        }
    }

    /**
     * Restore MySQL backup
     */
    private function restoreMySQLBackup(string $backupFile): bool
    {
        echo "📥 Restoring MySQL database from: " . basename($backupFile) . "\n";

        $host = $this->dbConfig['host'];
        $port = $this->dbConfig['port'] ?? 3306;
        $database = $this->dbConfig['database'];
        $username = $this->dbConfig['username'];

        // Get password from environment or prompt user
        $password = $this->dbConfig['password'] ?? $this->getPassword();

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
            throw new Exception("MySQL restore failed. Return code: {$returnCode}. Output: " . implode("\n", $output));
        }

        echo "✅ MySQL database restored successfully!\n";

        // Optionally show any output from mysql
        if (!empty($output)) {
            echo "\n📋 MySQL output:\n";
            foreach ($output as $line) {
                echo $line . "\n";
            }
        }

        return true;
    }

    /**
     * Restore SQLite backup
     */
    private function restoreSQLiteBackup(string $backupFile): bool
    {
        echo "📥 Restoring SQLite database from: " . basename($backupFile) . "\n";

        // Find corresponding JSON file
        $baseName = str_replace('.sqlite', '', basename($backupFile));
        $jsonFile = $this->backupPath . "/chess_web_data_" . str_replace('chess_web_backup_', '', $baseName) . ".json";

        if (!file_exists($jsonFile)) {
            echo "⚠️  JSON backup file not found, using SQLite backup directly\n";
            // Fallback to direct SQLite restore
            $databasePath = $this->dbConfig['database'];
            return copy($backupFile, $databasePath);
        }

        // Use the JSON restore functionality
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