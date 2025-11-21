<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->command->info('🚀 Starting database seeding...');

        // Disable foreign key checks temporarily (database-specific)
        $this->disableForeignKeyChecks();

        try {
            // Clear existing data to ensure clean slate
            $this->command->info('🧹 Cleaning existing data...');
            DB::table('championship_participants')->truncate();
            DB::table('championship_matches')->truncate();
            DB::table('championships')->truncate();

            // Clear permission tables if they exist
            if (Schema::hasTable('user_roles')) {
                DB::table('user_roles')->truncate();
            }
            if (Schema::hasTable('role_permissions')) {
                DB::table('role_permissions')->truncate();
            }

            DB::table('users')->truncate();

            // Seed in correct order
            $this->command->info('👥 Seeding users...');
            $this->call(UserSeeder::class);

            $this->command->info('🏆 Seeding championships...');
            $this->call(ChampionshipSeeder::class);

            $this->command->info('📝 Seeding championship participants...');
            $this->call(ChampionshipParticipantSeeder::class);

            $this->command->info('🔐 Setting up admin permissions...');
            $this->call(AdminPermissionSeeder::class);

            $this->command->info('📊 Running role permission assignments...');
            $this->call(RolePermissionSeeder::class);

            $this->command->info('🎓 Seeding tutorial content...');
            $this->call(TutorialContentSeeder::class);

            $this->command->info('✅ Database seeding completed successfully!');

            // Display summary
            $this->displaySeedingSummary();

        } catch (\Exception $e) {
            $this->command->error('❌ Error during seeding: ' . $e->getMessage());
            throw $e;
        } finally {
            // Re-enable foreign key checks
            $this->enableForeignKeyChecks();
        }
    }

    /**
     * Disable foreign key checks in a database-agnostic way
     */
    private function disableForeignKeyChecks(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = OFF;');
        } elseif ($driver === 'mysql') {
            DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        } elseif ($driver === 'pgsql') {
            DB::statement('SET CONSTRAINTS ALL DEFERRED;');
        }
    }

    /**
     * Enable foreign key checks in a database-agnostic way
     */
    private function enableForeignKeyChecks(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'sqlite') {
            DB::statement('PRAGMA foreign_keys = ON;');
        } elseif ($driver === 'mysql') {
            DB::statement('SET FOREIGN_KEY_CHECKS=1;');
        } elseif ($driver === 'pgsql') {
            DB::statement('SET CONSTRAINTS ALL IMMEDIATE;');
        }
    }

    /**
     * Display a summary of what was seeded
     */
    private function displaySeedingSummary(): void
    {
        $userCount = DB::table('users')->count();
        $championshipCount = DB::table('championships')->count();
        $participantCount = DB::table('championship_participants')->count();

        $this->command->info('');
        $this->command->info('📈 SEEDING SUMMARY');
        $this->command->info('===================');
        $this->command->info("Users: {$userCount}");
        $this->command->info("Championships: {$championshipCount}");
        $this->command->info("Championship Participants: {$participantCount}");
        $this->command->info('');
        $this->command->info('🎯 KEY ACCOUNTS:');
        $this->command->info('   Admin: nalamara.arun@gmail.com (password: "password")');
        $this->command->info('   Test Users: All users have password "password"');
        $this->command->info('');
        $this->command->info('🏆 CHAMPIONSHIPS:');
        $this->command->info('   1. Organization Internal Tournament 8274 (Registration Open)');
        $this->command->info('   2. Organization Internal Tournament 7608 (In Progress - 3 participants)');
        $this->command->info('   3. Test 1 (Registration Open)');
        $this->command->info('');
        $this->command->info('🚀 Ready for testing! Use the admin account to create new championships.');
    }
}
