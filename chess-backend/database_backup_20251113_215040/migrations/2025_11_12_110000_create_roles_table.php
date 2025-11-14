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
        if (Schema::hasTable('roles')) {
            return;
        }

        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name', 50)->unique()->comment('Role name (e.g., platform_admin, player)');
            $table->string('display_name', 100)->comment('Human-readable role name');
            $table->text('description')->nullable()->comment('Role description and responsibilities');
            $table->unsignedInteger('hierarchy_level')->default(0)->comment('Higher = more permissions (0=guest, 100=admin)');
            $table->boolean('is_system_role')->default(false)->comment('Cannot be deleted/modified');
            $table->timestamps();

            // Indexes
            $table->index('hierarchy_level');
        });

        // Seed default roles
        DB::table('roles')->insert([
            [
                'name' => 'platform_admin',
                'display_name' => 'Platform Administrator',
                'description' => 'Full system access - manages entire platform, users, and all championships',
                'hierarchy_level' => 100,
                'is_system_role' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'organization_admin',
                'display_name' => 'Organization Administrator',
                'description' => 'Manages organization, creates tournaments, views analytics, manages org users',
                'hierarchy_level' => 80,
                'is_system_role' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'tournament_organizer',
                'display_name' => 'Tournament Organizer',
                'description' => 'Creates and manages championships, controls participants and matches',
                'hierarchy_level' => 60,
                'is_system_role' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'monitor',
                'display_name' => 'Monitor/Arbiter',
                'description' => 'Game moderator - views all games, reports results, adjudicates disputes',
                'hierarchy_level' => 40,
                'is_system_role' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'player',
                'display_name' => 'Player',
                'description' => 'Regular chess player - can register for tournaments and play games',
                'hierarchy_level' => 20,
                'is_system_role' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'guest',
                'display_name' => 'Guest',
                'description' => 'Unauthenticated user - read-only access to public content',
                'hierarchy_level' => 0,
                'is_system_role' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('roles');
    }
};
