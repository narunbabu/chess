<?php

/**
 * Database Content Transfer Script for Chess Web Application
 *
 * This script transfers data from a backup database to a fresh database
 * while handling schema changes and data validation.
 *
 * Usage: php database_transfer.php <backup_file>
 */

require_once __DIR__ . '/vendor/autoload.php';

use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

class DatabaseTransfer
{
    private string $sourceDatabase;
    private string $targetDatabase;
    private array $transferLog = [];

    public function __construct(string $backupFile)
    {
        if (!file_exists($backupFile)) {
            throw new Exception("Backup file not found: {$backupFile}");
        }

        $this->sourceDatabase = $backupFile;
        $this->targetDatabase = config('database.connections.sqlite.database');

        echo "🔄 Database Transfer Initialized\n";
        echo "📁 Source: {$this->sourceDatabase}\n";
        echo "🎯 Target: {$this->targetDatabase}\n";
    }

    /**
     * Execute complete transfer process
     */
    public function execute(): bool
    {
        try {
            $this->log("Starting database transfer...");

            // 1. Validate source database
            $this->validateSourceDatabase();

            // 2. Connect to source database
            $this->connectToSource();

            // 3. Transfer data table by table
            $this->transferAllTables();

            // 4. Validate transfer
            $this->validateTransfer();

            $this->log("✅ Database transfer completed successfully!");

            // 5. Display transfer summary
            $this->displaySummary();

            return true;

        } catch (Exception $e) {
            $this->log("❌ Transfer failed: " . $e->getMessage());
            throw $e;
        } finally {
            $this->saveTransferLog();
        }
    }

    /**
     * Validate source database structure
     */
    private function validateSourceDatabase(): void
    {
        echo "🔍 Validating source database...\n";

        try {
            // Test connection to source database
            $source = new PDO("sqlite:{$this->sourceDatabase}");
            $tables = $source->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")->fetchAll(PDO::FETCH_COLUMN);

            if (empty($tables)) {
                throw new Exception("Source database has no tables");
            }

            $this->log("Found " . count($tables) . " tables in source database");
            echo "✅ Source database validation passed\n";

        } catch (PDOException $e) {
            throw new Exception("Invalid source database: " . $e->getMessage());
        }
    }

    /**
     * Connect to source database
     */
    private function connectToSource(): void
    {
        try {
            // Temporarily modify database config for source
            config(['database.connections.sqlite.database' => $this->sourceDatabase]);
            $this->log("Connected to source database");
        } catch (Exception $e) {
            throw new Exception("Failed to connect to source database: " . $e->getMessage());
        }
    }

    /**
     * Transfer all tables from source to target
     */
    private function transferAllTables(): void
    {
        echo "📦 Transferring table data...\n";

        // Get all tables from source
        $sourceTables = DB::select("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");

        foreach ($sourceTables as $table) {
            $tableName = $table->name;
            $this->transferTable($tableName);
        }

        echo "✅ All tables transferred\n";
    }

    /**
     * Transfer individual table
     */
    private function transferTable(string $tableName): void
    {
        echo "📋 Transferring table: {$tableName}\n";

        try {
            // Check if table exists in target
            if (!Schema::hasTable($tableName)) {
                echo "⚠️  Table {$tableName} does not exist in target, skipping...\n";
                $this->log("Skipped table {$tableName} (not in target schema)");
                return;
            }

            // Get data from source
            $data = DB::table($tableName)->get();
            $sourceCount = count($data);

            if ($sourceCount === 0) {
                echo "ℹ️  Table {$tableName} is empty, skipping...\n";
                return;
            }

            // Switch back to target database
            config(['database.connections.sqlite.database' => $this->targetDatabase]);

            // Clear target table (if not empty)
            $targetCount = DB::table($tableName)->count();
            if ($targetCount > 0) {
                echo "🧹 Clearing existing data from target table {$tableName} ({$targetCount} records)\n";
                DB::table($tableName)->delete();
            }

            // Transfer data in batches
            $this->transferDataInBatches($tableName, $data);

            echo "✅ Transferred {$sourceCount} records to {$tableName}\n";
            $this->log("Transferred {$sourceCount} records to table {$tableName}");

        } catch (Exception $e) {
            echo "❌ Failed to transfer table {$tableName}: " . $e->getMessage() . "\n";
            $this->log("Error transferring table {$tableName}: " . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Transfer data in batches to avoid memory issues
     */
    private function transferDataInBatches(string $tableName, $data, int $batchSize = 1000): void
    {
        $data = $data->toArray();
        $total = count($data);
        $transferred = 0;

        for ($i = 0; $i < $total; $i += $batchSize) {
            $batch = array_slice($data, $i, $batchSize);

            foreach ($batch as $record) {
                $record = (array)$record;

                // Remove auto-increment primary keys to avoid conflicts
                $record = $this->sanitizeRecord($tableName, $record);

                if (!empty($record)) {
                    DB::table($tableName)->insert($record);
                    $transferred++;
                }
            }

            // Show progress
            $progress = min(100, round(($transferred / $total) * 100));
            echo "📊 Progress: {$progress}% ({$transferred}/{$total})\r";
        }
        echo "\n";
    }

    /**
     * Sanitize record before insertion
     */
    private function sanitizeRecord(string $tableName, array $record): array
    {
        // Get table columns
        $columns = Schema::getColumnListing($tableName);

        // Remove columns that don't exist in target schema
        $record = array_intersect_key($record, array_flip($columns));

        // Remove auto-increment primary keys
        $primaryKey = $this->getPrimaryKey($tableName);
        if ($primaryKey && isset($record[$primaryKey])) {
            unset($record[$primaryKey]);
        }

        // Handle special cases
        $record = $this->handleSpecialCases($tableName, $record);

        return $record;
    }

    /**
     * Handle special cases for specific tables
     */
    private function handleSpecialCases(string $tableName, array $record): array
    {
        switch ($tableName) {
            case 'users':
                // Ensure password field is present
                if (!isset($record['password']) || empty($record['password'])) {
                    // Skip users without passwords (shouldn't happen but just in case)
                    return [];
                }
                break;

            case 'championships':
                // Handle new tournament fields
                if (isset($record['tournament_generated']) && $record['tournament_generated']) {
                    // Ensure tournament_generated_at is set
                    if (!isset($record['tournament_generated_at']) || empty($record['tournament_generated_at'])) {
                        $record['tournament_generated_at'] = now();
                    }
                }
                break;

            case 'championship_matches':
                // Handle new fields like scheduling status
                if (!isset($record['scheduling_status'])) {
                    $record['scheduling_status'] = 'pending';
                }
                break;
        }

        return $record;
    }

    /**
     * Get primary key for table
     */
    private function getPrimaryKey(string $tableName): ?string
    {
        $indexes = DB::select("PRAGMA table_info({$tableName})");

        foreach ($indexes as $index) {
            if ($index->pk) {
                return $index->name;
            }
        }

        return null;
    }

    /**
     * Validate transfer results
     */
    private function validateTransfer(): void
    {
        echo "🔍 Validating transfer results...\n";

        $validationErrors = [];

        // Check critical tables
        $criticalTables = ['users', 'championships', 'games', 'championship_matches', 'championship_participants'];

        foreach ($criticalTables as $tableName) {
            $count = DB::table($tableName)->count();
            $this->log("Table {$tableName}: {$count} records");

            if ($count === 0) {
                $validationErrors[] = "Critical table {$tableName} is empty after transfer";
            }
        }

        if (!empty($validationErrors)) {
            throw new Exception("Transfer validation failed: " . implode(', ', $validationErrors));
        }

        echo "✅ Transfer validation passed\n";
    }

    /**
     * Display transfer summary
     */
    private function displaySummary(): void
    {
        echo "\n" . str_repeat("=", 60) . "\n";
        echo "📊 TRANSFER SUMMARY\n";
        echo str_repeat("=", 60) . "\n";

        $tables = DB::select("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");

        foreach ($tables as $table) {
            $count = DB::table($table->name)->count();
            echo sprintf("%-40s %10d records\n", $table->name, $count);
        }

        echo str_repeat("=", 60) . "\n";
        echo "✅ Transfer completed successfully!\n";
        echo str_repeat("=", 60) . "\n";
    }

    /**
     * Log transfer activity
     */
    private function log(string $message): void
    {
        $timestamp = date('Y-m-d H:i:s');
        $this->transferLog[] = "[{$timestamp}] {$message}";
        echo "📝 {$message}\n";
    }

    /**
     * Save transfer log to file
     */
    private function saveTransferLog(): void
    {
        $logFile = __DIR__ . '/database/transfer_logs/transfer_' . date('Y_m_d_His') . '.log';
        $logDir = dirname($logFile);

        if (!is_dir($logDir)) {
            mkdir($logDir, 0755, true);
        }

        file_put_contents($logFile, implode("\n", $this->transferLog));
        echo "📋 Transfer log saved to: {$logFile}\n";
    }
}

// Command line interface
if (php_sapi_name() === 'cli') {
    try {
        if (empty($argv[1])) {
            echo "❌ Please specify backup file to transfer from\n";
            echo "Usage: php database_transfer.php <backup_file>\n";
            echo "Example: php database_transfer.php database/backups/chess_web_backup_2025_12_06_143022.sqlite\n";
            exit(1);
        }

        $backupFile = $argv[1];

        if (!file_exists($backupFile)) {
            echo "❌ Backup file not found: {$backupFile}\n";
            exit(1);
        }

        $transfer = new DatabaseTransfer($backupFile);
        $success = $transfer->execute();

        if ($success) {
            echo "\n🎉 Database transfer completed successfully!\n";
            echo "🔍 You can now verify the data integrity.\n";
        } else {
            echo "\n❌ Database transfer failed!\n";
            exit(1);
        }

    } catch (Exception $e) {
        echo "❌ Fatal error: " . $e->getMessage() . "\n";
        exit(1);
    }
} else {
    echo "This script must be run from the command line.\n";
    exit(1);
}