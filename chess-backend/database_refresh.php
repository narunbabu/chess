<?php

/**
 * Database Refresh Script for Chess Web Application
 *
 * This script performs a complete database refresh:
 * 1. Creates backup of current database
 * 2. Rolls back all migrations
 * 3. Re-runs all migrations
 * 4. Optionally restores data from backup
 *
 * Usage: php database_refresh.php [--restore-data]
 */

require_once __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

class DatabaseRefresh
{
    private bool $restoreData;
    private ?string $backupFile;

    public function __construct(array $args = [])
    {
        $this->restoreData = in_array('--restore-data', $args);
        $this->backupFile = null;
    }

    /**
     * Execute complete database refresh
     */
    public function execute(): void
    {
        try {
            echo "🔄 Starting Database Refresh Process\n";
            echo str_repeat("=", 60) . "\n";

            // Step 1: Create backup
            $this->createBackup();

            // Step 2: Reset migrations
            $this->resetMigrations();

            // Step 3: Run migrations
            $this->runMigrations();

            // Step 4: Restore data if requested
            if ($this->restoreData && $this->backupFile) {
                $this->restoreData();
            }

            // Step 5: Verify database
            $this->verifyDatabase();

            echo "\n🎉 Database refresh completed successfully!\n";
            echo str_repeat("=", 60) . "\n";

        } catch (Exception $e) {
            echo "\n❌ Database refresh failed: " . $e->getMessage() . "\n";

            // Attempt to restore from backup if we have one
            if ($this->backupFile) {
                echo "🔄 Attempting to restore from backup...\n";
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

        // Use our backup script
        $backupScript = __DIR__ . '/database_backup.php';
        $output = [];
        $returnCode = 0;

        exec("php {$backupScript}", $output, $returnCode);

        if ($returnCode !== 0) {
            throw new Exception("Failed to create database backup");
        }

        // Extract backup file path from output
        foreach ($output as $line) {
            if (strpos($line, 'Backup location:') !== false) {
                $this->backupFile = trim(substr($line, strpos($line, ':') + 1));
                break;
            }
        }

        echo "✅ Backup created: " . basename($this->backupFile) . "\n";
    }

    /**
     * Reset all migrations
     */
    private function resetMigrations(): void
    {
        echo "\n🔄 Step 2: Resetting migrations...\n";

        // Try migrate:reset first
        $output = [];
        $returnCode = 0;
        exec("php artisan migrate:reset 2>&1", $output, $returnCode);

        if ($returnCode !== 0) {
            echo "⚠️  migrate:reset failed, trying manual rollback...\n";
            $this->manualRollback();
        } else {
            echo "✅ Migrations reset successfully\n";
        }
    }

    /**
     * Manual rollback for stubborn migrations
     */
    private function manualRollback(): void
    {
        echo "🔧 Performing manual rollback...\n";

        // Drop all tables except migration tracking
        $tables = DB::select("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'migrations'");

        foreach ($tables as $table) {
            $tableName = $table->name;
            echo "🗑️  Dropping table: {$tableName}\n";
            DB::statement("DROP TABLE IF EXISTS {$tableName}");
        }

        // Clear migrations table
        DB::table('migrations')->delete();

        echo "✅ Manual rollback completed\n";
    }

    /**
     * Run all migrations
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
     * Restore data from backup
     */
    private function restoreData(): void
    {
        echo "\n📥 Step 4: Restoring data from backup...\n";

        if (!$this->backupFile) {
            echo "⚠️  No backup file available for data restoration\n";
            return;
        }

        // Use our transfer script
        $transferScript = __DIR__ . '/database_transfer.php';
        $output = [];
        $returnCode = 0;

        $command = "php {$transferScript} " . escapeshellarg($this->backupFile);
        exec($command, $output, $returnCode);

        if ($returnCode !== 0) {
            echo "Transfer output:\n" . implode("\n", $output) . "\n";
            throw new Exception("Failed to restore data from backup");
        }

        echo "✅ Data restored successfully\n";
    }

    /**
     * Verify database integrity
     */
    private function verifyDatabase(): void
    {
        echo "\n🔍 Step 5: Verifying database integrity...\n";

        // Check critical tables exist
        $criticalTables = [
            'users', 'championships', 'games', 'championship_matches',
            'championship_participants', 'migrations'
        ];

        foreach ($criticalTables as $table) {
            if (!Schema::hasTable($table)) {
                throw new Exception("Critical table '{$table}' is missing");
            }
            $count = DB::table($table)->count();
            echo "📊 {$table}: {$count} records\n";
        }

        // Check migration status
        $output = [];
        exec("php artisan migrate:status", $output);

        $pendingMigrations = 0;
        foreach ($output as $line) {
            if (strpos($line, 'Pending') !== false) {
                $pendingMigrations++;
            }
        }

        if ($pendingMigrations > 0) {
            echo "⚠️  Found {$pendingMigrations} pending migrations\n";
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

        if (!copy($this->backupFile, $databasePath)) {
            echo "❌ Failed to restore backup\n";
            return;
        }

        echo "✅ Database restored from backup\n";
    }
}

// Command line interface
if (php_sapi_name() === 'cli') {
    try {
        $refresh = new DatabaseRefresh($argv);
        $refresh->execute();

        echo "\n🎯 Refresh completed! Your database is now fresh and ready.\n";
        echo "\n📚 Available commands:\n";
        echo "- php artisan migrate:status  (check migration status)\n";
        echo "- php artisan tinker         (test the database)\n";
        echo "- php artisan serve          (start the server)\n";

    } catch (Exception $e) {
        echo "❌ Fatal error: " . $e->getMessage() . "\n";
        exit(1);
    }
} else {
    echo "This script must be run from the command line.\n";
    exit(1);
}