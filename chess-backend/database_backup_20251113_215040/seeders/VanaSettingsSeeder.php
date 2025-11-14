<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class VanaSettingsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * Example: Seed settings or configuration table
     */
    public function run(): void
    {
        // Example: Insert system settings
        // Modify this according to your needs

        // Uncomment and modify based on your settings table structure
        /*
        DB::table('settings')->insert([
            [
                'key' => 'site_name',
                'value' => 'Chess99',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'key' => 'max_game_time',
                'value' => '600', // 10 minutes in seconds
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'key' => 'rating_enabled',
                'value' => 'true',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
        */

        $this->command->info('✅ VanaSettingsSeeder: Sample settings created');
    }
}
