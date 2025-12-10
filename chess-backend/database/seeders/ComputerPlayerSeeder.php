<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\ComputerPlayer;

class ComputerPlayerSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $computerPlayers = [
            [
                'name' => 'Computer Level 1',
                'level' => 1,
                'rating' => 800,
                'avatar' => '🤖',
                'is_active' => true
            ],
            [
                'name' => 'Computer Level 2',
                'level' => 2,
                'rating' => 900,
                'avatar' => '🤖',
                'is_active' => true
            ],
            [
                'name' => 'Computer Level 3',
                'level' => 3,
                'rating' => 1000,
                'avatar' => '🤖',
                'is_active' => true
            ],
            [
                'name' => 'Computer Level 4',
                'level' => 4,
                'rating' => 1100,
                'avatar' => '🤖',
                'is_active' => true
            ],
            [
                'name' => 'Computer Level 5',
                'level' => 5,
                'rating' => 1200,
                'avatar' => '🤖',
                'is_active' => true
            ],
            [
                'name' => 'Computer Level 6',
                'level' => 6,
                'rating' => 1300,
                'avatar' => '🤖',
                'is_active' => true
            ],
            [
                'name' => 'Computer Level 7',
                'level' => 7,
                'rating' => 1400,
                'avatar' => '🤖',
                'is_active' => true
            ],
            [
                'name' => 'Computer Level 8',
                'level' => 8,
                'rating' => 1500,
                'avatar' => '🤖',
                'is_active' => true
            ],
            [
                'name' => 'Computer Level 9',
                'level' => 9,
                'rating' => 1600,
                'avatar' => '🤖',
                'is_active' => true
            ],
            [
                'name' => 'Computer Level 10',
                'level' => 10,
                'rating' => 1700,
                'avatar' => '🤖',
                'is_active' => true
            ],
            [
                'name' => 'Computer Level 11',
                'level' => 11,
                'rating' => 1800,
                'avatar' => '🤖',
                'is_active' => true
            ],
            [
                'name' => 'Computer Level 12',
                'level' => 12,
                'rating' => 1900,
                'avatar' => '🤖',
                'is_active' => true
            ],
            [
                'name' => 'Computer Level 13',
                'level' => 13,
                'rating' => 2000,
                'avatar' => '🤖',
                'is_active' => true
            ],
            [
                'name' => 'Computer Level 14',
                'level' => 14,
                'rating' => 2100,
                'avatar' => '🤖',
                'is_active' => true
            ],
            [
                'name' => 'Computer Level 15',
                'level' => 15,
                'rating' => 2200,
                'avatar' => '🤖',
                'is_active' => true
            ],
            [
                'name' => 'Computer Level 16',
                'level' => 16,
                'rating' => 2300,
                'avatar' => '🤖',
                'is_active' => true
            ],
            [
                'name' => 'Computer Level 17',
                'level' => 17,
                'rating' => 2400,
                'avatar' => '🤖',
                'is_active' => true
            ],
            [
                'name' => 'Computer Level 18',
                'level' => 18,
                'rating' => 2500,
                'avatar' => '🤖',
                'is_active' => true
            ],
            [
                'name' => 'Computer Level 19',
                'level' => 19,
                'rating' => 2600,
                'avatar' => '🤖',
                'is_active' => true
            ],
            [
                'name' => 'Computer Level 20',
                'level' => 20,
                'rating' => 2700,
                'avatar' => '🤖',
                'is_active' => true
            ]
        ];

        foreach ($computerPlayers as $player) {
            ComputerPlayer::firstOrCreate(
                ['level' => $player['level']],
                $player
            );
        }

        $this->command->info('Computer players seeded successfully!');
    }
}
