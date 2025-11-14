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
        if (Schema::hasTable('user_roles')) {
            return;
        }

        Schema::create('user_roles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('role_id')->constrained('roles')->onDelete('cascade');
            $table->foreignId('assigned_by')->nullable()->constrained('users')->onDelete('set null')->comment('Admin who assigned the role');
            $table->timestamp('assigned_at')->useCurrent();
            $table->timestamps();

            // Prevent duplicate role assignments
            $table->unique(['user_id', 'role_id']);

            // Indexes
            $table->index('user_id');
            $table->index('role_id');
            $table->index('assigned_at');
        });

        // Assign 'player' role to all existing users
        $playerRoleId = DB::table('roles')->where('name', 'player')->value('id');
        $existingUsers = DB::table('users')->pluck('id');

        foreach ($existingUsers as $userId) {
            DB::table('user_roles')->insert([
                'user_id' => $userId,
                'role_id' => $playerRoleId,
                'assigned_by' => null,
                'assigned_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_roles');
    }
};
