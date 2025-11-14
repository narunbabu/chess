<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Create users from database_objects.md
        $users = [
            [
                'id' => 1,
                'name' => 'Tatva Nalamara',
                'email' => 'nalamara.arun@gmail.com',
                'provider' => 'google',
                'provider_id' => '113424578044464968863',
                'rating' => 1200,
                'is_provisional' => true,
                'games_played' => 0,
                'peak_rating' => 1200,
                'is_active' => true,
                'email_verified_at' => now(),
                'avatar_url' => 'http://localhost:8000/storage/avatars/1_1763101954.jpg',
                'password' => Hash::make('password'), // Default password for testing
                'remember_token' => Str::random(10),
                'created_at' => '2025-11-14T06:32:34.000000Z',
                'updated_at' => '2025-11-14T06:32:36.000000Z',
            ],
            [
                'id' => 2,
                'name' => 'Vedansh Nalamara',
                'email' => 'narun.iitb@gmail.com',
                'provider' => 'google',
                'provider_id' => '106461582716916530527',
                'rating' => 1200,
                'is_provisional' => true,
                'games_played' => 0,
                'peak_rating' => 1200,
                'is_active' => true,
                'email_verified_at' => now(),
                'avatar_url' => 'http://localhost:8000/storage/avatars/2_1763101975.jpg',
                'password' => Hash::make('password'),
                'remember_token' => Str::random(10),
                'created_at' => '2025-11-14T06:32:55.000000Z',
                'updated_at' => '2025-11-14T06:32:55.000000Z',
            ],
            [
                'id' => 3,
                'name' => 'Sanatan Nalamara',
                'email' => 'sanatan.dharmam@gmail.com',
                'provider' => 'google',
                'provider_id' => '113477216881286710932',
                'rating' => 1200,
                'is_provisional' => true,
                'games_played' => 0,
                'peak_rating' => 1200,
                'is_active' => true,
                'email_verified_at' => now(),
                'avatar_url' => 'http://localhost:8000/storage/avatars/3_1763102020.jpg',
                'password' => Hash::make('password'),
                'remember_token' => Str::random(10),
                'created_at' => '2025-11-14T06:33:40.000000Z',
                'updated_at' => '2025-11-14T06:33:40.000000Z',
            ],
            [
                'id' => 4,
                'name' => 'Arun Nalamara',
                'email' => 'test@example.com',
                'rating' => 1200,
                'is_provisional' => true,
                'games_played' => 0,
                'peak_rating' => 1200,
                'is_active' => true,
                'email_verified_at' => now(),
                'avatar_url' => 'http://localhost:8000/storage/avatars/4_1763102100.jpg',
                'password' => Hash::make('password'),
                'remember_token' => Str::random(10),
                'created_at' => now(),
                'updated_at' => now(),
            ]
        ];

        foreach ($users as $userData) {
            $user = User::firstOrNew(
                ['email' => $userData['email']],
                array_merge($userData, ['id' => null]) // Don't force ID on creation
            );

            // If user exists, update their data
            if ($user->exists) {
                $user->update(array_diff_key($userData, ['id' => true, 'email' => true, 'created_at' => true]));
            } else {
                $user->save();
            }
        }

        $this->command->info('Users seeded successfully!');
        $this->command->info('Admin user (Tatva Nalamara): nalamara.arun@gmail.com');
        $this->command->info('Test users created with password: "password"');
    }
}