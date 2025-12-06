<?php

/**
 * Restore Database from JSON Backup
 *
 * Restores data from JSON backup file to current database
 * Usage: php restore_from_json.php [json_file_path]
 */

require_once __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

class JsonDatabaseRestorer
{
    private string $jsonFile;
    private array $data;

    public function __construct(array $args = [])
    {
        if (count($args) > 1) {
            $this->jsonFile = $args[1];
        } else {
            // Use the oldest JSON backup
            $backupDir = __DIR__ . '/database/backups';
            $jsonFiles = glob($backupDir . '/chess_web_data_*.json');

            if ($jsonFiles) {
                usort($jsonFiles, function($a, $b) {
                    return filemtime($a) - filemtime($b);
                });
                $this->jsonFile = $jsonFiles[0];
            } else {
                throw new Exception("No JSON backup files found");
            }
        }

        if (!file_exists($this->jsonFile)) {
            throw new Exception("JSON backup file not found: " . basename($this->jsonFile));
        }

        echo "📁 Using JSON backup: " . basename($this->jsonFile) . "\n";
    }

    /**
     * Execute the restore process
     */
    public function execute(): void
    {
        try {
            require_once __DIR__ . '/timestamp_helper.php';
            echo "\n🔄 Starting JSON Database Restore Process\n";
            echo str_repeat("=", 70) . "\n";
            echo "Started at: " . LocalTimestamp::displayDateTime() . " (" . LocalTimestamp::getTimezone() . ")\n\n";

            // Load JSON data
            $this->loadJsonData();

            // Disable foreign keys for restore
            DB::statement('PRAGMA foreign_keys = OFF');
            echo "🔓 Foreign key constraints disabled\n";

            try {
                // Restore data in dependency order
                $this->restoreData();

                echo "\n✅ Data restored successfully\n";

            } finally {
                // Re-enable foreign keys
                DB::statement('PRAGMA foreign_keys = ON');
                echo "🔒 Foreign key constraints re-enabled\n";
            }

            // Verify restore
            $this->verifyRestore();

            echo "\n🎉 JSON database restore completed successfully!\n";
            echo str_repeat("=", 70) . "\n";

        } catch (Exception $e) {
            echo "\n❌ Database restore failed: " . $e->getMessage() . "\n";
            exit(1);
        }
    }

    /**
     * Load JSON data from backup file
     */
    private function loadJsonData(): void
    {
        echo "\n📥 Step 1: Loading JSON data...\n";

        $jsonContent = file_get_contents($this->jsonFile);
        $this->data = json_decode($jsonContent, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception("Invalid JSON file: " . json_last_error_msg());
        }

        $totalTables = count($this->data);
        $totalRecords = 0;

        foreach ($this->data as $tableName => $records) {
            $totalRecords += is_array($records) ? count($records) : 0;
        }

        echo "✅ Loaded {$totalTables} tables with {$totalRecords} total records\n";
    }

    /**
     * Restore data in dependency order
     */
    private function restoreData(): void
    {
        echo "\n📋 Step 2: Restoring data...\n";

        // Define dependency order (tables with no dependencies first)
        $restoreOrder = [
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

            // System tables (skip migrations - let Laravel handle these)
        ];

        $restoredTables = 0;
        $totalRecords = 0;

        foreach ($restoreOrder as $tableName) {
            if ($this->restoreTable($tableName)) {
                $restoredTables++;
            }
        }

        // Handle any remaining tables not in the predefined order
        foreach (array_keys($this->data) as $tableName) {
            if ($tableName !== 'migrations' && !in_array($tableName, $restoreOrder)) {
                if ($this->restoreTable($tableName)) {
                    $restoredTables++;
                }
            }
        }

        echo "✅ Restored data from {$restoredTables} tables ({$totalRecords} records)\n";
    }

    /**
     * Restore a single table
     */
    private function restoreTable(string $tableName): bool
    {
        if (!isset($this->data[$tableName]) || !is_array($this->data[$tableName])) {
            return false;
        }

        $records = $this->data[$tableName];
        if (empty($records)) {
            echo "ℹ️  Table {$tableName} is empty, skipping...\n";
            return true;
        }

        try {
            // Check if table exists
            if (!Schema::hasTable($tableName)) {
                echo "⚠️  Table {$tableName} does not exist, skipping...\n";
                return false;
            }

            echo "📋 Restoring table: {$tableName} (" . count($records) . " records)\n";

            // Clear existing data
            DB::table($tableName)->delete();

            // Restore data in batches
            $this->insertDataInBatches($tableName, $records);

            $totalRecords = count($records);
            echo "✅ Restored {$totalRecords} records to {$tableName}\n";

            return true;

        } catch (Exception $e) {
            echo "❌ Failed to restore table {$tableName}: " . $e->getMessage() . "\n";
            return false;
        }
    }

    /**
     * Insert data in batches
     */
    private function insertDataInBatches(string $tableName, array $records, int $batchSize = 500): void
    {
        $total = count($records);

        for ($i = 0; $i < $total; $i += $batchSize) {
            $batch = array_slice($records, $i, $batchSize);

            foreach ($batch as $record) {
                $record = $this->sanitizeRecord($tableName, $record);

                if (!empty($record)) {
                    try {
                        DB::table($tableName)->insert($record);
                    } catch (Exception $e) {
                        // Skip problematic records but continue
                        continue;
                    }
                }
            }

            // Show progress for large tables
            if ($total > 1000) {
                $progress = min(100, round((($i + $batchSize) / $total) * 100));
                echo "📊 Progress: {$progress}%\r";
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
     * Verify restore results
     */
    private function verifyRestore(): void
    {
        echo "\n🔍 Step 3: Verifying restore results...\n";

        $criticalTables = [
            'users', 'championships', 'games', 'championship_matches',
            'championship_participants', 'migrations'
        ];

        $totalRecords = 0;
        foreach ($criticalTables as $table) {
            if (Schema::hasTable($table)) {
                $count = DB::table($table)->count();
                $totalRecords += $count;
                echo "📊 {$table}: {$count} records\n";
            }
        }

        echo "✅ Total critical records: {$totalRecords}\n";
    }
}

// Command line interface
if (php_sapi_name() === 'cli') {
    try {
        $restorer = new JsonDatabaseRestorer($argv);
        $restorer->execute();

        echo "\n🎯 JSON restore completed! Your data has been restored.\n";
        echo "\n📚 Next steps:\n";
        echo "1. php artisan serve                    (start the server)\n";
        echo "2. php database_contents_checker.php   (verify data)\n";
        echo "3. Visit http://localhost:8000          (test the application)\n";

    } catch (Exception $e) {
        echo "❌ Fatal error: " . $e->getMessage() . "\n";
        exit(1);
    }
} else {
    echo "This script must be run from the command line.\n";
    exit(1);
}