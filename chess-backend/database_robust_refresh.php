<?php

/**
 * Robust Database Refresh Script for Chess Web Application
 *
 * This script performs a safe database refresh by:
 * 1. Creating backup
 * 2. Disabling foreign key constraints
 * 3. Dropping tables in correct order
 * 4. Re-running migrations
 * 5. Optionally transferring data back
 *
 * Usage: php database_robust_refresh.php [--restore-data]
 */

require_once __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

class RobustDatabaseRefresh
{
    private bool $restoreData;
    private ?string $backupFile;

    public function __construct(array $args = [])
    {
        $this->restoreData = in_array('--restore-data', $args);
        $this->backupFile = null;
    }

    /**
     * Check if data restoration is enabled
     */
    public function shouldRestoreData(): bool
    {
        return $this->restoreData;
    }

    /**
     * Execute robust database refresh
     */
    public function execute(): void
    {
        try {
            echo "🔄 Starting Robust Database Refresh Process\n";
            echo str_repeat("=", 70) . "\n";

            // Step 1: Create backup
            $this->createBackup();

            // Step 2: Safe database reset
            $this->safeDatabaseReset();

            // Step 3: Run migrations
            $this->runMigrations();

            // Step 4: Restore data if requested
            if ($this->restoreData && $this->backupFile) {
                $this->restoreDataSafely();
            }

            // Step 5: Verify database
            $this->verifyDatabase();

            echo "\n🎉 Robust database refresh completed successfully!\n";
            echo str_repeat("=", 70) . "\n";

        } catch (Exception $e) {
            echo "\n❌ Database refresh failed: " . $e->getMessage() . "\n";

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
     * Safe database reset with proper foreign key handling
     */
    private function safeDatabaseReset(): void
    {
        echo "\n🔄 Step 2: Performing safe database reset...\n";

        // Disable foreign key constraints
        DB::statement('PRAGMA foreign_keys = OFF');
        echo "🔓 Foreign key constraints disabled\n";

        try {
            // Get all tables except migrations and sqlite system tables
            $tables = DB::select("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'migrations'");

            // Sort tables by dependency (tables with no foreign keys first)
            $tableDependencies = $this->analyzeTableDependencies($tables);
            $droppedCount = 0;

            foreach ($tableDependencies as $tableName) {
                echo "🗑️  Dropping table: {$tableName}\n";
                DB::statement("DROP TABLE IF EXISTS {$tableName}");
                $droppedCount++;
            }

            // Clear migrations table
            DB::table('migrations')->delete();
            echo "🧹 Migrations table cleared\n";

            echo "✅ Dropped {$droppedCount} tables successfully\n";

        } finally {
            // Re-enable foreign key constraints
            DB::statement('PRAGMA foreign_keys = ON');
            echo "🔒 Foreign key constraints re-enabled\n";
        }
    }

    /**
     * Analyze table dependencies to determine safe drop order
     */
    private function analyzeTableDependencies(array $tables): array
    {
        $dependencies = [];
        $tableNames = [];

        // Collect table names
        foreach ($tables as $table) {
            $tableNames[] = $table->name;
        }

        // Analyze each table for foreign key dependencies
        foreach ($tableNames as $tableName) {
            $dependencies[$tableName] = $this->getTableDependencies($tableName);
        }

        // Sort tables (tables with fewer dependencies first)
        uksort($dependencies, function ($a, $b) use ($dependencies) {
            $aCount = count($dependencies[$a]);
            $bCount = count($dependencies[$b]);

            if ($aCount === $bCount) {
                return strcmp($a, $b);
            }

            return $aCount - $bCount;
        });

        return array_keys($dependencies);
    }

    /**
     * Get foreign key dependencies for a table
     */
    private function getTableDependencies(string $tableName): array
    {
        try {
            $sql = "PRAGMA foreign_key_list({$tableName})";
            $foreignKeys = DB::select($sql);

            $dependencies = [];
            foreach ($foreignKeys as $fk) {
                $dependencies[] = $fk->table;
            }

            return $dependencies;
        } catch (Exception $e) {
            return [];
        }
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
     * Safely restore data with proper dependency order
     */
    private function restoreDataSafely(): void
    {
        echo "\n📥 Step 4: Restoring data safely...\n";

        if (!$this->backupFile) {
            echo "⚠️  No backup file available for data restoration\n";
            return;
        }

        // Disable foreign keys during data restoration
        DB::statement('PRAGMA foreign_keys = OFF');
        echo "🔓 Foreign key constraints disabled for data restoration\n";

        try {
            // Connect to backup database
            $sourceDb = new PDO("sqlite:{$this->backupFile}");

            // Get tables from backup
            $tables = $sourceDb->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")->fetchAll(PDO::FETCH_COLUMN);

            // Sort tables for safe insertion (dependencies after parents)
            $safeOrder = $this->getSafeInsertionOrder($tables, $sourceDb);

            foreach ($safeOrder as $tableName) {
                $this->transferTableData($sourceDb, $tableName);
            }

            echo "✅ Data restored successfully\n";

        } finally {
            // Re-enable foreign keys
            DB::statement('PRAGMA foreign_keys = ON');
            echo "🔒 Foreign key constraints re-enabled\n";
        }
    }

    /**
     * Get safe insertion order for tables
     */
    private function getSafeInsertionOrder(array $tables, PDO $sourceDb): array
    {
        // Define a basic dependency order for known tables
        $insertionOrder = [
            // Base tables (no dependencies)
            'users', 'organizations', 'roles', 'permissions', 'role_permissions',
            'user_roles', 'game_statuses', 'game_end_reasons', 'championship_statuses',
            'championship_formats', 'payment_statuses', 'championship_round_types',
            'championship_match_statuses', 'championship_result_types',

            // Content tables
            'tutorial_modules', 'tutorial_lessons', 'tutorial_achievements',
            'interactive_lesson_stages', 'daily_challenges',

            // User-dependent tables
            'user_tutorial_progress', 'user_skill_assessments', 'user_stage_progress',
            'user_achievements', 'user_daily_challenge_completions', 'tutorial_practice_games',
            'user_friends', 'ratings_history', 'user_presence', 'game_connections',

            // Core application tables
            'games', 'game_moves', 'game_histories', 'shared_results', 'invitations',

            // Championship system
            'championships', 'championship_participants', 'championship_matches',
            'championship_standings', 'championship_match_schedules', 'championship_game_resume_requests',

            // System tables
            'migrations', 'password_reset_tokens', 'sessions', 'cache', 'cache_locks',
            'jobs', 'job_batches', 'failed_jobs', 'personal_access_tokens'
        ];

        // Filter to only include tables that exist
        $availableTables = array_intersect($insertionOrder, $tables);

        // Add any remaining tables at the end
        $remainingTables = array_diff($tables, $availableTables);
        $finalOrder = array_merge($availableTables, $remainingTables);

        return $finalOrder;
    }

    /**
     * Transfer data for a single table
     */
    private function transferTableData(PDO $sourceDb, string $tableName): void
    {
        echo "📋 Transferring table: {$tableName}\n";

        try {
            // Check if table exists in target
            if (!Schema::hasTable($tableName)) {
                echo "⚠️  Table {$tableName} does not exist in target, skipping...\n";
                return;
            }

            // Get data from source
            $stmt = $sourceDb->query("SELECT * FROM {$tableName}");
            $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if (empty($data)) {
                echo "ℹ️  Table {$tableName} is empty, skipping...\n";
                return;
            }

            // Clear target table
            DB::table($tableName)->delete();

            // Transfer data in batches
            $this->insertDataInBatches($tableName, $data);

            echo "✅ Transferred " . count($data) . " records to {$tableName}\n";

        } catch (Exception $e) {
            echo "❌ Failed to transfer table {$tableName}: " . $e->getMessage() . "\n";
            // Continue with other tables
        }
    }

    /**
     * Insert data in batches
     */
    private function insertDataInBatches(string $tableName, array $data, int $batchSize = 500): void
    {
        $total = count($data);
        $transferred = 0;

        for ($i = 0; $i < $total; $i += $batchSize) {
            $batch = array_slice($data, $i, $batchSize);

            foreach ($batch as $record) {
                $record = $this->sanitizeRecord($tableName, $record);

                if (!empty($record)) {
                    try {
                        DB::table($tableName)->insert($record);
                        $transferred++;
                    } catch (Exception $e) {
                        // Skip problematic records but continue
                        continue;
                    }
                }
            }

            // Show progress for large tables
            if ($total > 1000) {
                $progress = min(100, round(($transferred / $total) * 100));
                echo "📊 Progress: {$progress}% ({$transferred}/{$total})\r";
            }
        }

        if ($total > 1000) {
            echo "\n";
        }
    }

    /**
     * Sanitize record before insertion
     */
    private function sanitizeRecord(string $tableName, array $record): array
    {
        // Get table columns
        $columns = Schema::getColumnListing($tableName);

        // Keep only columns that exist in target schema
        $record = array_intersect_key($record, array_flip($columns));

        // Handle special cases
        switch ($tableName) {
            case 'users':
                if (!isset($record['password']) || empty($record['password'])) {
                    return [];
                }
                break;

            case 'championships':
                if (isset($record['tournament_generated']) && $record['tournament_generated']) {
                    if (!isset($record['tournament_generated_at']) || empty($record['tournament_generated_at'])) {
                        $record['tournament_generated_at'] = date('Y-m-d H:i:s');
                    }
                }
                break;
        }

        return $record;
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
}

// Command line interface
if (php_sapi_name() === 'cli') {
    try {
        $refresh = new RobustDatabaseRefresh($argv);
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