<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Add the ambassador role if it doesn't exist
        $exists = DB::table('roles')->where('name', 'ambassador')->exists();

        if (!$exists) {
            DB::table('roles')->insert([
                'name' => 'ambassador',
                'display_name' => 'Ambassador',
                'description' => 'Chess99 Ambassador — promotes the platform and earns commission on referrals',
                'hierarchy_level' => 50,
                'is_system_role' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        $role = DB::table('roles')->where('name', 'ambassador')->first();
        if ($role) {
            DB::table('user_roles')->where('role_id', $role->id)->delete();
            DB::table('roles')->where('id', $role->id)->delete();
        }
    }
};
