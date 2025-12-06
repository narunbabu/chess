<?php

/**
 * Smart Database Restore
 *
 * Restores from SQLite backup with intelligent schema migration support
 * Fixes Windows/WAL file issues by cleaning up helper files before copy.
 *
 * Usage: php smart_restore.php [backup_file.sqlite]
 */

require_once __DIR__ . '/vendor/autoload.php';

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

class SmartRestore
{
    private string $backupFile;
    private string $databasePath;

    public function __construct(array $args)
    {
        if (count($args) < 2) {
            echo "❌ Please specify backup file to restore\n";
            echo "Usage: php smart_restore.php [backup_file.sqlite]\n";
            exit(1);
        }

        $this->backupFile = $args[1];
        $this->databasePath = config('database.connections.sqlite.database');
    }

    public function execute(): void
    {
        try {
            echo "🔄 Starting Smart Database Restore\n";
            echo str_repeat("=", 50) . "\n";

            // Check if backup file exists
            if (!file_exists($this->backupFile)) {
                throw new Exception("Backup file not found: {$this->backupFile}");
            }

            echo "📁 Restoring from: " . basename($this->backupFile) . "\n";

            // Check backup tables first
            $backupTables = $this->getTableNames($this->backupFile);
            echo "📊 Tables in Backup: " . count($backupTables) . "\n";

            // Step 1: Check if target database exists
            if (!file_exists($this->databasePath)) {
                echo "📋 Database file missing, copying backup file directly...\n";
                $this->directFileCopy();
            } else {
                echo "📋 Database file exists, checking schema compatibility...\n";
                $this->intelligentRestore($backupTables);
            }

            // Force Reconnect to ensure we see the new data
            DB::purge('sqlite');
            DB::reconnect('sqlite');

            echo "✅ Database restored successfully!\n";
            echo "📁 Database location: " . $this->databasePath . "\n";

            // Show verification
            $this->verifyRestore();

        } catch (Exception $e) {
            echo "\n❌ Restore failed: " . $e->getMessage() . "\n";
            exit(1);
        }
    }

    private function directFileCopy(): void
    {
        // 1. Disconnect to release file locks
        DB::disconnect('sqlite');

        // 2. Clean up ALL existing database files (Main, WAL, SHM)
        // This is critical on Windows to prevent "Stale WAL" issues
        $filesToDelete = [
            $this->databasePath,
            $this->databasePath . '-shm',
            $this->databasePath . '-wal'
        ];

        foreach ($filesToDelete as $file) {
            if (file_exists($file)) {
                if (!@unlink($file)) {
                    // Try one more time with a small delay if locked
                    usleep(100000); // 100ms
                    if (!@unlink($file)) {
                        echo "⚠️  Warning: Could not delete $file (might be in use)\n";
                    }
                }
            }
        }

        // 3. Copy backup file to database location
        if (!copy($this->backupFile, $this->databasePath)) {
            throw new Exception("Failed to copy backup file to database location");
        }
        
        // 4. Ensure permissions are correct
        @chmod($this->databasePath, 0664); // Read/Write
        
        echo "✅ Backup file copied (Clean restore)\n";
    }

    private function intelligentRestore(array $backupTables): void
    {
        $currentTables = $this->getTableNames($this->databasePath);

        echo "📊 Current tables: " . count($currentTables) . "\n";

        // If current database has very few tables (likely after migrate:reset), just copy backup directly
        if (count($currentTables) < 5) {
            echo "📋 Current database has minimal tables, copying backup directly...\n";
            $this->directFileCopy();
            return;
        }

        // If schemas are compatible, copy directly
        if ($this->areSchemasCompatible($backupTables, $currentTables)) {
            echo "✅ Schemas are compatible, copying backup directly...\n";
            $this->directFileCopy();
        } else {
            echo "⚠️  Schema mismatch detected, using data transfer mode...\n";
            $this->dataTransferRestore();
        }
    }

    private function getTableNames(string $databaseFile): array
    {
        try {
            $db = new SQLite3($databaseFile);
            $result = $db->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
            $tables = [];

            while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
                $tables[] = $row['name'];
            }

            $db->close();
            return $tables;
        } catch (Exception $e) {
            echo "⚠️  Could not read tables from $databaseFile: " . $e->getMessage() . "\n";
            return [];
        }
    }

    private function areSchemasCompatible(array $backupTables, array $currentTables): bool
    {
        if (count($currentTables) < count($backupTables) * 0.5) {
            return false;
        }

        $commonTables = array_intersect($backupTables, $currentTables);
        $compatibilityRatio = count($commonTables) / count($backupTables);

        return $compatibilityRatio > 0.8;
    }

    private function dataTransferRestore(): void
    {
        echo "🔄 Transferring data between schemas...\n";

        $backupBasename = basename($this->backupFile, '.sqlite');
        // Logic to find the correct JSON file based on timestamp
        $timestamp = str_replace('chess_web_backup_', '', $backupBasename);
        $jsonFile = dirname($this->backupFile) . '/chess_web_data_' . $timestamp . '.json';

        if (!file_exists($jsonFile)) {
            // Try to find ANY json file with similar timestamp if exact match fails
            $jsonFiles = glob(dirname($this->backupFile) . '/chess_web_data_*.json');
            if (!empty($jsonFiles)) {
                // Use the one closest in time/name
                $jsonFile = end($jsonFiles); 
            } else {
                throw new Exception("JSON data file not found for data transfer.");
            }
        }

        echo "📋 Using JSON data file: " . basename($jsonFile) . "\n";

        $output = [];
        $returnCode = 0;
        exec("php " . __DIR__ . "/restore_from_json.php \"$jsonFile\"", $output, $returnCode);

        if ($returnCode !== 0) {
            echo "⚠️  Data transfer output:\n" . implode("\n", $output) . "\n";
            throw new Exception("Data transfer failed");
        }

        echo "✅ Data transfer completed\n";
    }

    private function verifyRestore(): void
    {
        echo "\n🔍 Verification:\n";

        try {
            // Ensure we are reading fresh data
            DB::connection('sqlite')->reconnect();
            
            $tables = DB::select("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
            echo "📊 Total tables: " . count($tables) . "\n";

            $keyTables = ['users', 'championships', 'migrations'];
            foreach ($keyTables as $table) {
                if (Schema::hasTable($table)) {
                    $count = DB::table($table)->count();
                    echo "📋 {$table}: {$count} records\n";
                } else {
                    echo "📋 {$table}: Table not found\n";
                }
            }

        } catch (Exception $e) {
            echo "⚠️  Could not verify database: " . $e->getMessage() . "\n";
        }
    }
}

// Command line interface
if (php_sapi_name() === 'cli') {
    try {
        $restore = new SmartRestore($argv);
        $restore->execute();

        echo "\n🎯 Smart restore completed!\n";

    } catch (Exception $e) {
        echo "❌ Fatal error: " . $e->getMessage() . "\n";
        exit(1);
    }
} else {
    echo "This script must be run from the command line.\n";
    exit(1);
}