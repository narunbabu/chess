<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('users')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'organization_id')) {
                $table->foreignId('organization_id')
                    ->nullable()
                    ->after('email')
                    ->constrained('organizations')
                    ->onDelete('set null')
                    ->comment('Organization this user belongs to');

                $table->index('organization_id');
            }

            if (!Schema::hasColumn('users', 'is_active')) {
                $table->boolean('is_active')
                    ->default(true)
                    ->after('organization_id')
                    ->comment('Account active status');

                $table->index('is_active');
            }

            if (!Schema::hasColumn('users', 'last_login_at')) {
                $table->timestamp('last_login_at')
                    ->nullable()
                    ->after('is_active')
                    ->comment('Last successful login');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (!Schema::hasTable('users')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'last_login_at')) {
                $table->dropColumn('last_login_at');
            }
            if (Schema::hasColumn('users', 'is_active')) {
                $table->dropIndex(['is_active']);
                $table->dropColumn('is_active');
            }
            if (Schema::hasColumn('users', 'organization_id')) {
                $table->dropForeign(['organization_id']);
                $table->dropIndex(['organization_id']);
                $table->dropColumn('organization_id');
            }
        });
    }
};
