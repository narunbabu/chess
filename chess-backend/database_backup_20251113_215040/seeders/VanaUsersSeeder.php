<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class VanaUsersSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * Example: Seed users table with sample data
     */
    public function run(): void
    {
        // Example: Insert sample users
        // Modify this according to your needs

        DB::table('users')->insert([
            [
                'name' => 'Admin User',
                'email' => 'admin@chess99.com',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Test Player',
                'email' => 'player@chess99.com',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $this->command->info('✅ VanaUsersSeeder: Sample users created');
    }
}
