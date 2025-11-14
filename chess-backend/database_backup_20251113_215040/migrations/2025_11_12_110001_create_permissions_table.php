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
        if (Schema::hasTable('permissions')) {
            return;
        }

        Schema::create('permissions', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100)->unique()->comment('Permission name (e.g., create_championship)');
            $table->string('display_name', 150)->comment('Human-readable permission name');
            $table->text('description')->nullable()->comment('Permission description');
            $table->string('category', 50)->comment('Permission category (users, championships, payments, etc.)');
            $table->timestamps();

            // Indexes
            $table->index('category');
        });

        // Seed default permissions
        $permissions = [
            // Platform Management (Admin only)
            ['name' => 'manage_platform', 'display_name' => 'Manage Platform', 'description' => 'Full platform administration', 'category' => 'platform'],
            ['name' => 'manage_users', 'display_name' => 'Manage Users', 'description' => 'Create, edit, delete users', 'category' => 'users'],
            ['name' => 'manage_roles', 'display_name' => 'Manage Roles', 'description' => 'Assign/revoke user roles', 'category' => 'users'],
            ['name' => 'view_analytics', 'display_name' => 'View Analytics', 'description' => 'Access platform analytics', 'category' => 'platform'],
            ['name' => 'manage_settings', 'display_name' => 'Manage Settings', 'description' => 'Configure platform settings', 'category' => 'platform'],

            // Organization Management
            ['name' => 'create_organization', 'display_name' => 'Create Organization', 'description' => 'Create new organizations', 'category' => 'organizations'],
            ['name' => 'manage_organization', 'display_name' => 'Manage Organization', 'description' => 'Edit organization details', 'category' => 'organizations'],
            ['name' => 'delete_organization', 'display_name' => 'Delete Organization', 'description' => 'Delete organizations', 'category' => 'organizations'],
            ['name' => 'manage_organization_users', 'display_name' => 'Manage Organization Users', 'description' => 'Add/remove organization members', 'category' => 'organizations'],

            // Championship Management
            ['name' => 'create_championship', 'display_name' => 'Create Championship', 'description' => 'Create new tournaments', 'category' => 'championships'],
            ['name' => 'edit_own_championship', 'display_name' => 'Edit Own Championship', 'description' => 'Edit championships you created', 'category' => 'championships'],
            ['name' => 'edit_any_championship', 'display_name' => 'Edit Any Championship', 'description' => 'Edit any championship', 'category' => 'championships'],
            ['name' => 'delete_own_championship', 'display_name' => 'Delete Own Championship', 'description' => 'Delete championships you created', 'category' => 'championships'],
            ['name' => 'delete_any_championship', 'display_name' => 'Delete Any Championship', 'description' => 'Delete any championship', 'category' => 'championships'],
            ['name' => 'manage_championship_participants', 'display_name' => 'Manage Championship Participants', 'description' => 'Approve/reject participants', 'category' => 'championships'],
            ['name' => 'set_match_results', 'display_name' => 'Set Match Results', 'description' => 'Record match outcomes', 'category' => 'championships'],

            // Participant Permissions
            ['name' => 'register_for_championship', 'display_name' => 'Register for Championship', 'description' => 'Join tournaments', 'category' => 'participation'],
            ['name' => 'withdraw_from_championship', 'display_name' => 'Withdraw from Championship', 'description' => 'Leave tournaments', 'category' => 'participation'],
            ['name' => 'view_own_matches', 'display_name' => 'View Own Matches', 'description' => 'See your match schedule', 'category' => 'participation'],

            // Game Management
            ['name' => 'play_games', 'display_name' => 'Play Games', 'description' => 'Play chess games', 'category' => 'games'],
            ['name' => 'view_all_games', 'display_name' => 'View All Games', 'description' => 'Watch any game in progress', 'category' => 'games'],
            ['name' => 'pause_games', 'display_name' => 'Pause Games', 'description' => 'Pause games (arbiter function)', 'category' => 'games'],
            ['name' => 'adjudicate_disputes', 'display_name' => 'Adjudicate Disputes', 'description' => 'Resolve game disputes', 'category' => 'games'],

            // Payment Management
            ['name' => 'process_payments', 'display_name' => 'Process Payments', 'description' => 'Handle payment transactions', 'category' => 'payments'],
            ['name' => 'view_payment_reports', 'display_name' => 'View Payment Reports', 'description' => 'Access payment analytics', 'category' => 'payments'],
            ['name' => 'issue_refunds', 'display_name' => 'Issue Refunds', 'description' => 'Process refund requests', 'category' => 'payments'],

            // Public Access
            ['name' => 'view_public_championships', 'display_name' => 'View Public Championships', 'description' => 'Browse public tournaments', 'category' => 'public'],
            ['name' => 'view_leaderboards', 'display_name' => 'View Leaderboards', 'description' => 'See rankings', 'category' => 'public'],
            ['name' => 'view_public_profiles', 'display_name' => 'View Public Profiles', 'description' => 'View player profiles', 'category' => 'public'],
        ];

        foreach ($permissions as $permission) {
            DB::table('permissions')->insert(array_merge($permission, [
                'created_at' => now(),
                'updated_at' => now(),
            ]));
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('permissions');
    }
};
