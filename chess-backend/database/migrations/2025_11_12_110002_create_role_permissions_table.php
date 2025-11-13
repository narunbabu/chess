<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('role_permissions')) {
            return;
        }

        Schema::create('role_permissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('role_id')->constrained('roles')->onDelete('cascade');
            $table->foreignId('permission_id')->constrained('permissions')->onDelete('cascade');
            $table->timestamps();

            // Prevent duplicate assignments
            $table->unique(['role_id', 'permission_id']);

            // Indexes
            $table->index('role_id');
            $table->index('permission_id');
        });

        // Assign permissions to roles
        $this->assignPermissionsToRoles();
    }

    /**
     * Assign permissions to each role
     */
    private function assignPermissionsToRoles(): void
    {
        // Get role IDs
        $roles = DB::table('roles')->pluck('id', 'name');
        $permissions = DB::table('permissions')->pluck('id', 'name');

        // Platform Admin - ALL permissions
        $adminPermissions = $permissions->values()->toArray();
        foreach ($adminPermissions as $permissionId) {
            DB::table('role_permissions')->insert([
                'role_id' => $roles['platform_admin'],
                'permission_id' => $permissionId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // Organization Admin permissions
        $orgAdminPerms = [
            'manage_organization',
            'manage_organization_users',
            'create_championship',
            'edit_own_championship',
            'delete_own_championship',
            'manage_championship_participants',
            'set_match_results',
            'register_for_championship',
            'withdraw_from_championship',
            'view_own_matches',
            'play_games',
            'view_all_games',
            'view_analytics',
            'view_payment_reports',
            'view_public_championships',
            'view_leaderboards',
            'view_public_profiles',
        ];
        foreach ($orgAdminPerms as $permName) {
            if (isset($permissions[$permName])) {
                DB::table('role_permissions')->insert([
                    'role_id' => $roles['organization_admin'],
                    'permission_id' => $permissions[$permName],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        // Tournament Organizer permissions
        $organizerPerms = [
            'create_championship',
            'edit_own_championship',
            'delete_own_championship',
            'manage_championship_participants',
            'set_match_results',
            'register_for_championship',
            'withdraw_from_championship',
            'view_own_matches',
            'play_games',
            'view_all_games',
            'view_public_championships',
            'view_leaderboards',
            'view_public_profiles',
        ];
        foreach ($organizerPerms as $permName) {
            if (isset($permissions[$permName])) {
                DB::table('role_permissions')->insert([
                    'role_id' => $roles['tournament_organizer'],
                    'permission_id' => $permissions[$permName],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        // Monitor/Arbiter permissions
        $monitorPerms = [
            'view_all_games',
            'pause_games',
            'adjudicate_disputes',
            'set_match_results',
            'register_for_championship',
            'withdraw_from_championship',
            'view_own_matches',
            'play_games',
            'view_public_championships',
            'view_leaderboards',
            'view_public_profiles',
        ];
        foreach ($monitorPerms as $permName) {
            if (isset($permissions[$permName])) {
                DB::table('role_permissions')->insert([
                    'role_id' => $roles['monitor'],
                    'permission_id' => $permissions[$permName],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        // Player permissions
        $playerPerms = [
            'register_for_championship',
            'withdraw_from_championship',
            'view_own_matches',
            'play_games',
            'view_public_championships',
            'view_leaderboards',
            'view_public_profiles',
        ];
        foreach ($playerPerms as $permName) {
            if (isset($permissions[$permName])) {
                DB::table('role_permissions')->insert([
                    'role_id' => $roles['player'],
                    'permission_id' => $permissions[$permName],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        // Guest permissions (public access only)
        $guestPerms = [
            'view_public_championships',
            'view_leaderboards',
            'view_public_profiles',
        ];
        foreach ($guestPerms as $permName) {
            if (isset($permissions[$permName])) {
                DB::table('role_permissions')->insert([
                    'role_id' => $roles['guest'],
                    'permission_id' => $permissions[$permName],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('role_permissions');
    }
};
