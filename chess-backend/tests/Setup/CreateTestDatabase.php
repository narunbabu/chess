<?php

/**
 * Test Database Setup Script
 *
 * This script sets up the test database for tournament generation testing.
 * It creates necessary tables and seeds test data.
 */

require_once __DIR__ . '/../../vendor/autoload.php';

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Bootstrap\LoadEnvironmentVariables;

// Bootstrap Laravel
$app = require_once __DIR__ . '/../../bootstrap/app.php';
$app->bootstrapWith([
    LoadEnvironmentVariables::class,
]);

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Hash;

class TestDatabaseSetup
{
    private array $queries = [
        // Create championships table
        'CREATE TABLE IF NOT EXISTS championships (
            id BIGINT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(255) NOT NULL,
            type ENUM(\'round-robin\', \'swiss\', \'elimination\') DEFAULT \'round-robin\',
            status ENUM(\'registration\', \'active\', \'completed\', \'archived\') DEFAULT \'registration\',
            user_id BIGINT NOT NULL,
            tournament_config JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',

        // Create championship_matches table
        'CREATE TABLE IF NOT EXISTS championship_matches (
            id BIGINT PRIMARY KEY AUTO_INCREMENT,
            championship_id BIGINT NOT NULL,
            white_player_id BIGINT NOT NULL,
            black_player_id BIGINT NOT NULL,
            round_number INT NOT NULL DEFAULT 1,
            board_number INT NOT NULL DEFAULT 1,
            status ENUM(\'scheduled\', \'in-progress\', \'completed\', \'cancelled\') DEFAULT \'scheduled\',
            result ENUM(\'1-0\', \'0-1\', \'1/2-1/2\', \'*\') DEFAULT \'*\',
            pgn TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_championship_round (championship_id, round_number),
            INDEX idx_players (white_player_id, black_player_id),
            UNIQUE KEY unique_match (championship_id, white_player_id, black_player_id, round_number)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',

        // Create championship_registrations table
        'CREATE TABLE IF NOT EXISTS championship_registrations (
            id BIGINT PRIMARY KEY AUTO_INCREMENT,
            championship_id BIGINT NOT NULL,
            user_id BIGINT NOT NULL,
            registration_status ENUM(\'registered\', \'withdrawn\', \'confirmed\') DEFAULT \'registered\',
            registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_registration (championship_id, user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',

        // Create users table (if not exists)
        'CREATE TABLE IF NOT EXISTS users (
            id BIGINT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255),
            rating INT DEFAULT 1500,
            role ENUM(\'admin\', \'user\', \'organizer\') DEFAULT \'user\',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
    ];

    private function getTestData(): array
    {
        return [
            'users' => [
                ['name' => 'Admin User', 'email' => 'admin@test.com', 'password' => Hash::make('password'), 'rating' => 2000, 'role' => 'admin'],
                ['name' => 'Regular User', 'email' => 'user@test.com', 'password' => Hash::make('password'), 'rating' => 1500, 'role' => 'user'],
                ['name' => 'Magnus Carlsen', 'email' => 'magnus@test.com', 'password' => Hash::make('password'), 'rating' => 2863, 'role' => 'user'],
                ['name' => 'Fabiano Caruana', 'email' => 'fabiano@test.com', 'password' => Hash::make('password'), 'rating' => 2820, 'role' => 'user'],
                ['name' => 'Ding Liren', 'email' => 'ding@test.com', 'password' => Hash::make('password'), 'rating' => 2811, 'role' => 'user'],
                ['name' => 'Ian Nepomniachtchi', 'email' => 'ian@test.com', 'password' => Hash::make('password'), 'rating' => 2793, 'role' => 'user'],
                ['name' => 'Hikaru Nakamura', 'email' => 'hikaru@test.com', 'password' => Hash::make('password'), 'rating' => 2768, 'role' => 'user'],
                ['name' => 'Alireza Firouzja', 'email' => 'alireza@test.com', 'password' => Hash::make('password'), 'rating' => 2785, 'role' => 'user'],
                ['name' => 'Wesley So', 'email' => 'wesley@test.com', 'password' => Hash::make('password'), 'rating' => 2778, 'role' => 'user'],
                ['name' => 'Levon Aronian', 'email' => 'levon@test.com', 'password' => Hash::make('password'), 'rating' => 2785, 'role' => 'user'],
            ]
        ];
    }

    public function setup(): void
    {
        echo "Setting up test database...\n";

        try {
            $this->createTables();
            $this->seedTestData();
            $this->verifySetup();

            echo "✅ Test database setup completed successfully!\n";
        } catch (\Exception $e) {
            echo "❌ Error setting up test database: " . $e->getMessage() . "\n";
            throw $e;
        }
    }

    private function createTables(): void
    {
        echo "Creating tables...\n";

        foreach ($this->queries as $query) {
            try {
                DB::statement($query);
                echo "  ✅ Table created successfully\n";
            } catch (\Exception $e) {
                echo "  ⚠️  Warning: " . $e->getMessage() . "\n";
                // Continue even if table already exists
            }
        }
    }

    private function seedTestData(): void
    {
        echo "Seeding test data...\n";

        $testData = $this->getTestData();

        foreach ($testData['users'] as $userData) {
            try {
                $existingUser = DB::table('users')->where('email', $userData['email'])->first();
                if (!$existingUser) {
                    DB::table('users')->insert($userData);
                    echo "  ✅ User created: {$userData['name']}\n";
                } else {
                    echo "  ℹ️  User already exists: {$userData['name']}\n";
                }
            } catch (\Exception $e) {
                echo "  ❌ Error creating user {$userData['name']}: " . $e->getMessage() . "\n";
            }
        }

        // Create test championship
        try {
            $existingChampionship = DB::table('championships')->where('name', 'Test Tournament')->first();
            if (!$existingChampionship) {
                $adminUser = DB::table('users')->where('email', 'admin@test.com')->first();

                $championshipId = DB::table('championships')->insertGetId([
                    'name' => 'Test Tournament',
                    'type' => 'round-robin',
                    'status' => 'registration',
                    'user_id' => $adminUser->id,
                    'tournament_config' => json_encode([
                        'pairing_algorithm' => 'direct',
                        'participant_selection' => 'all',
                        'rounds' => 3
                    ]),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                echo "  ✅ Test championship created\n";

                // Register some test participants
                $participants = DB::table('users')
                    ->whereIn('email', [
                        'magnus@test.com',
                        'fabiano@test.com',
                        'ding@test.com',
                        'ian@test.com',
                        'hikaru@test.com',
                        'alireza@test.com',
                        'wesley@test.com',
                        'levon@test.com'
                    ])
                    ->get();

                foreach ($participants as $participant) {
                    DB::table('championship_registrations')->insert([
                        'championship_id' => $championshipId,
                        'user_id' => $participant->id,
                        'registration_status' => 'registered',
                        'registration_date' => now(),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
                echo "  ✅ Test participants registered\n";
            } else {
                echo "  ℹ️  Test championship already exists\n";
            }
        } catch (\Exception $e) {
            echo "  ❌ Error creating test championship: " . $e->getMessage() . "\n";
        }
    }

    private function verifySetup(): void
    {
        echo "Verifying setup...\n";

        $userCount = DB::table('users')->count();
        $championshipCount = DB::table('championships')->count();
        $registrationCount = DB::table('championship_registrations')->count();

        echo "  📊 Users: $userCount\n";
        echo "  📊 Championships: $championshipCount\n";
        echo "  📊 Registrations: $registrationCount\n";

        // Verify tables exist
        $tables = ['users', 'championships', 'championship_matches', 'championship_registrations'];
        foreach ($tables as $table) {
            if (Schema::hasTable($table)) {
                echo "  ✅ Table exists: $table\n";
            } else {
                throw new \Exception("Table not found: $table");
            }
        }

        // Test data integrity
        $testChampionship = DB::table('championships')->where('name', 'Test Tournament')->first();
        if ($testChampionship) {
            $registrationCount = DB::table('championship_registrations')
                ->where('championship_id', $testChampionship->id)
                ->count();
            echo "  ✅ Test championship has $registrationCount participants\n";
        }
    }

    public function cleanup(): void
    {
        echo "Cleaning up test database...\n";

        try {
            // Clean up in correct order to respect foreign keys
            DB::statement('SET FOREIGN_KEY_CHECKS=0');

            DB::table('championship_matches')->truncate();
            DB::table('championship_registrations')->truncate();
            DB::table('championships')->truncate();
            DB::table('users')->truncate();

            DB::statement('SET FOREIGN_KEY_CHECKS=1');

            echo "✅ Test database cleanup completed!\n";
        } catch (\Exception $e) {
            echo "❌ Error cleaning up test database: " . $e->getMessage() . "\n";
            throw $e;
        }
    }
}

// Main execution
if (php_sapi_name() === 'cli') {
    $action = $argv[1] ?? 'setup';

    $setup = new TestDatabaseSetup();

    switch ($action) {
        case 'setup':
            $setup->setup();
            break;
        case 'cleanup':
            $setup->cleanup();
            break;
        default:
            echo "Usage: php CreateTestDatabase.php [setup|cleanup]\n";
            exit(1);
    }
}