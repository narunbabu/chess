<?php

/**
 * Safe Migration Refresh Script
 *
 * Safely refresh migrations by:
 * 1. Creating backup
 * 2. Rolling back all migrations
 * 3. Running fresh migrations
 * 4. Optionally restoring data
 *
 * Usage: php safe_refresh.php [--restore-data]
 */

require_once __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

class SafeMigrationRefresh
{
    private bool $restoreData;
    private ?string $backupFile;

    public function __construct(array $args = [])
    {
        $this->restoreData = in_array('--restore-data', $args);
        $this->backupFile = null;
    }

    /**
     * Execute safe migration refresh
     */
    public function execute(): void
    {
        try {
            echo "🔄 Starting Safe Migration Refresh Process\n";
            echo str_repeat("=", 70) . "\n";

            // Step 1: Create backup
            $this->createBackup();

            // Step 2: Safe database reset
            $this->safeDatabaseReset();

            // Step 3: Run migrations
            $this->runMigrations();

            // Step 4: Restore data if requested
            if ($this->restoreData && $this->backupFile) {
                $this->restoreData();
            }

            // Step 5: Verify database
            $this->verifyDatabase();

            echo "\n🎉 Safe migration refresh completed successfully!\n";
            echo str_repeat("=", 70) . "\n";

        } catch (Exception $e) {
            echo "\n❌ Migration refresh failed: " . $e->getMessage() . "\n";

            // Attempt to restore from backup
            if ($this->backupFile) {
                $this->restoreBackup();
            }

            exit(1);
        }
    }

    /**
     * Create backup of current database
     */
    private function createBackup(): void
    {
        echo "\n📦 Step 1: Creating database backup...\n";

        $backupScript = __DIR__ . '/database_backup.php';
        $output = [];
        $returnCode = 0;

        exec("php {$backupScript}", $output, $returnCode);

        if ($returnCode !== 0) {
            throw new Exception("Failed to create database backup");
        }

        foreach ($output as $line) {
            if (strpos($line, 'Backup location:') !== false) {
                $this->backupFile = trim(substr($line, strpos($line, ':') + 1));
                break;
            }
        }

        echo "✅ Backup created: " . basename($this->backupFile) . "\n";
    }

    /**
     * Safe database reset using our working rollback
     */
    private function safeDatabaseReset(): void
    {
        echo "\n🔄 Step 2: Performing safe database reset...\n";

        // Use our working safe rollback script
        $rollbackScript = __DIR__ . '/safe_rollback.php';
        $output = [];
        $returnCode = 0;

        exec("php {$rollbackScript}", $output, $returnCode);

        if ($returnCode !== 0) {
            throw new Exception("Failed to reset database");
        }

        echo "✅ Database reset completed\n";
    }

    /**
     * Run migrations
     */
    private function runMigrations(): void
    {
        echo "\n🏗️  Step 3: Running migrations...\n";

        $output = [];
        $returnCode = 0;
        exec("php artisan migrate --force 2>&1", $output, $returnCode);

        if ($returnCode !== 0) {
            echo "Migration output:\n" . implode("\n", $output) . "\n";
            throw new Exception("Failed to run migrations");
        }

        echo "✅ Migrations completed successfully\n";
    }

    /**
     * Restore data
     */
    private function restoreData(): void
    {
        echo "\n📥 Step 4: Restoring data...\n";

        if (!$this->backupFile) {
            echo "⚠️  No backup file available for data restoration\n";
            return;
        }

        // Find corresponding JSON file
        $baseName = str_replace('.sqlite', '', basename($this->backupFile));
        $jsonFile = dirname($this->backupFile) . "/chess_web_data_" . str_replace('chess_web_backup_', '', $baseName) . ".json";

        if (!file_exists($jsonFile)) {
            echo "⚠️  JSON backup file not found, skipping data restore\n";
            return;
        }

        $restoreScript = __DIR__ . '/restore_from_json.php';
        $output = [];
        $returnCode = 0;

        exec("php {$restoreScript} \"{$jsonFile}\"", $output, $returnCode);

        if ($returnCode !== 0) {
            echo "Restore output:\n" . implode("\n", $output) . "\n";
            throw new Exception("Failed to restore data");
        }

        echo "✅ Data restored successfully\n";
    }

    /**
     * Verify database integrity
     */
    private function verifyDatabase(): void
    {
        echo "\n🔍 Step 5: Verifying database integrity...\n";

        $criticalTables = [
            'users', 'championships', 'games', 'championship_matches',
            'championship_participants', 'migrations'
        ];

        $totalRecords = 0;
        foreach ($criticalTables as $table) {
            if (!Schema::hasTable($table)) {
                throw new Exception("Critical table '{$table}' is missing");
            }
            $count = DB::table($table)->count();
            $totalRecords += $count;
            echo "📊 {$table}: {$count} records\n";
        }

        echo "✅ Total critical records: {$totalRecords}\n";

        // Check migration status
        $output = [];
        exec("php artisan migrate:status", $output);

        $pendingMigrations = array_filter($output, function($line) {
            return strpos($line, 'Pending') !== false;
        });

        if (count($pendingMigrations) > 0) {
            echo "⚠️  Found " . count($pendingMigrations) . " pending migrations\n";
        } else {
            echo "✅ All migrations are up to date\n";
        }

        echo "✅ Database verification completed\n";
    }

    /**
     * Restore from backup
     */
    private function restoreBackup(): void
    {
        if (!$this->backupFile || !file_exists($this->backupFile)) {
            echo "❌ Backup file not found for restoration\n";
            return;
        }

        echo "🔄 Restoring database from backup...\n";

        $databasePath = config('database.connections.sqlite.database');

        if (copy($this->backupFile, $databasePath)) {
            echo "✅ Database restored from backup\n";
        } else {
            echo "❌ Failed to restore backup\n";
        }
    }

    /**
     * Check if data restoration is enabled
     */
    public function shouldRestoreData(): bool
    {
        return $this->restoreData;
    }
}

// Command line interface
if (php_sapi_name() === 'cli') {
    try {
        $refresh = new SafeMigrationRefresh($argv);
        $refresh->execute();

        echo "\n🎯 Refresh completed! Your database is now fresh and ready.\n";
        echo "\n📚 Next steps:\n";
        echo "1. php artisan serve                    (start the server)\n";
        echo "2. php artisan tinker                   (test the database)\n";
        echo "3. Visit http://localhost:8000          (test the application)\n";

        if ($refresh->shouldRestoreData()) {
            echo "4. Verify your data is intact\n";
        }

    } catch (Exception $e) {
        echo "❌ Fatal error: " . $e->getMessage() . "\n";
        exit(1);
    }
} else {
    echo "This script must be run from the command line.\n";
    exit(1);
}