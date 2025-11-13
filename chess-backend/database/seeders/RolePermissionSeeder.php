<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Role;

class RolePermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * This seeder assigns the default 'player' role to all existing users
     * who don't already have roles assigned.
     *
     * Roles and permissions are already seeded via migrations.
     */
    public function run(): void
    {
        $playerRole = Role::where('name', 'player')->first();

        if (!$playerRole) {
            $this->command->error('Player role not found. Please run migrations first.');
            return;
        }

        // Get all users without any roles
        $usersWithoutRoles = User::whereDoesntHave('roles')->get();

        $count = 0;
        foreach ($usersWithoutRoles as $user) {
            $user->assignRole($playerRole);
            $count++;
        }

        $this->command->info("Assigned 'player' role to {$count} users.");

        // Optional: Create a test admin user if no admins exist
        $adminRole = Role::where('name', 'platform_admin')->first();
        $adminExists = User::whereHas('roles', function ($query) use ($adminRole) {
            $query->where('role_id', $adminRole->id);
        })->exists();

        if (!$adminExists) {
            $this->command->info('No platform admin found. You may want to manually assign the admin role to a user.');
            $this->command->info('Run: php artisan tinker');
            $this->command->info('Then: $user = User::find(1); $user->assignRole("platform_admin");');
        }
    }
}
