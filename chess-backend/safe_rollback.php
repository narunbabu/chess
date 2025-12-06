<?php

/**
 * Safe Migration Rollback Script
 *
 * Safely rollback all migrations by disabling foreign key constraints
 * Usage: php safe_rollback.php
 */

require_once __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

class SafeMigrationRollback
{
    public function execute(): void
    {
        try {
            require_once __DIR__ . '/timestamp_helper.php';
            echo "🔄 Starting Safe Migration Rollback\n";
            echo str_repeat("=", 50) . "\n";
            echo "Started at: " . LocalTimestamp::displayDateTime() . " (" . LocalTimestamp::getTimezone() . ")\n\n";

            // Disable foreign key constraints
            DB::statement('PRAGMA foreign_keys = OFF');
            echo "🔓 Foreign key constraints disabled\n";

            try {
                // Get all migrations in reverse order
                $migrations = DB::table('migrations')
                    ->orderBy('id', 'desc')
                    ->get();

                echo "\n📋 Rolling back " . $migrations->count() . " migrations...\n\n";

                foreach ($migrations as $migration) {
                    echo "⬇️  Rolling back: {$migration->migration}\n";

                    try {
                        // Get the migration class
                        $migrationPath = database_path("migrations/{$migration->migration}.php");

                        if (file_exists($migrationPath)) {
                            require_once $migrationPath;

                            // Extract class name from migration file
                            $className = $this->getMigrationClassName($migrationPath);

                            if (class_exists($className)) {
                                $instance = new $className();

                                // Check if down method exists
                                if (method_exists($instance, 'down')) {
                                    $instance->down();
                                    echo "✅ {$migration->migration} - ROLLED BACK\n";
                                } else {
                                    echo "⚠️  {$migration->migration} - No down method, skipping\n";
                                }
                            }
                        }

                        // Remove migration record
                        DB::table('migrations')
                            ->where('id', $migration->id)
                            ->delete();

                    } catch (Exception $e) {
                        echo "❌ Failed to rollback {$migration->migration}: " . $e->getMessage() . "\n";
                        // Continue with other migrations
                    }
                }

                // Drop remaining tables manually
                $this->dropAllTables();

                echo "\n✅ Migration rollback completed successfully!\n";

            } finally {
                // Re-enable foreign key constraints
                DB::statement('PRAGMA foreign_keys = ON');
                echo "🔒 Foreign key constraints re-enabled\n";
            }

        } catch (Exception $e) {
            echo "\n❌ Rollback failed: " . $e->getMessage() . "\n";

            // Always try to re-enable foreign keys
            try {
                DB::statement('PRAGMA foreign_keys = ON');
                echo "🔒 Foreign key constraints re-enabled\n";
            } catch (Exception $e) {
                // Ignore
            }

            exit(1);
        }
    }

    /**
     * Get migration class name from file
     */
    private function getMigrationClassName(string $path): string
    {
        $content = file_get_contents($path);

        if (preg_match('/class\s+(\w+)/', $content, $matches)) {
            return $matches[1];
        }

        return '';
    }

    /**
     * Drop all remaining tables
     */
    private function dropAllTables(): void
    {
        echo "\n🗑️  Dropping remaining tables...\n";

        $tables = DB::select("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");

        foreach ($tables as $table) {
            try {
                DB::statement("DROP TABLE IF EXISTS {$table->name}");
                echo "🗑️  Dropped table: {$table->name}\n";
            } catch (Exception $e) {
                echo "⚠️  Could not drop table {$table->name}: " . $e->getMessage() . "\n";
            }
        }
    }
}

// Command line interface
if (php_sapi_name() === 'cli') {
    try {
        $rollback = new SafeMigrationRollback();
        $rollback->execute();

        echo "\n🎯 Database is now clean and ready for fresh migrations!\n";
        echo "\n📚 Next steps:\n";
        echo "1. php artisan migrate                    (run fresh migrations)\n";
        echo "2. php database_backup.php               (create backup)\n";
        echo "3. php restore_from_json.php             (restore data if needed)\n";

    } catch (Exception $e) {
        echo "❌ Fatal error: " . $e->getMessage() . "\n";
        exit(1);
    }
} else {
    echo "This script must be run from the command line.\n";
    exit(1);
}