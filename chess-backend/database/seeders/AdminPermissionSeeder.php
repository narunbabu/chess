<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Role;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class AdminPermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Ensure we're starting fresh
        DB::table('user_roles')->delete();

        // Get roles (they're already created by migration)
        $platformAdminRole = Role::where('name', 'platform_admin')->first();
        $playerRole = Role::where('name', 'player')->first();

        if (!$platformAdminRole) {
            $this->command->error('❌ Platform admin role not found. Please run migrations first.');
            return;
        }

        if (!$playerRole) {
            $this->command->error('❌ Player role not found. Please run migrations first.');
            return;
        }

        // Get Tatva Nalamara (user ID 1) and assign admin role
        $adminUser = User::find(1);
        if ($adminUser) {
            // Remove any existing roles
            $adminUser->roles()->detach();

            // Assign platform admin role
            $adminUser->assignRole($platformAdminRole);

            $this->command->info('✅ Platform admin role assigned to Tatva Nalamara (User ID: 1)');
        } else {
            $this->command->error('❌ Admin user (ID: 1) not found. Please run UserSeeder first.');
        }

        // Assign player role to other users
        $otherUsers = User::where('id', '!=', 1)->get();
        foreach ($otherUsers as $user) {
            $user->assignRole($playerRole);
        }

        $this->command->info('✅ Player role assigned to all other users');
        $this->command->info('🎯 Permission setup complete!');
        $this->command->info('   - Tatva Nalamara: Platform Admin (can create championships)');
        $this->command->info('   - Other users: Player role');
    }
}