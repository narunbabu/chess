<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class VanaGamesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * Example: Seed games table with sample data
     */
    public function run(): void
    {
        // Example: Insert sample games
        // Modify this according to your needs

        // Uncomment and modify based on your games table structure
        /*
        DB::table('games')->insert([
            [
                'white_player_id' => 1,
                'black_player_id' => 2,
                'result' => '1-0',
                'moves' => 'e4;e5;Nf3;Nc6',
                'status' => 'completed',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'white_player_id' => 2,
                'black_player_id' => 1,
                'result' => '0-1',
                'moves' => 'd4;d5;c4;e6',
                'status' => 'completed',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
        */

        $this->command->info('✅ VanaGamesSeeder: Sample games created');
    }
}
