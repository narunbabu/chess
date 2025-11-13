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
        if (!Schema::hasTable('championships')) {
            return;
        }

        Schema::table('championships', function (Blueprint $table) {
            if (!Schema::hasColumn('championships', 'created_by')) {
                $table->foreignId('created_by')
                    ->nullable()
                    ->after('status_id')
                    ->constrained('users')
                    ->onDelete('set null')
                    ->comment('User who created this championship');

                $table->index('created_by');
            }

            if (!Schema::hasColumn('championships', 'organization_id')) {
                $table->foreignId('organization_id')
                    ->nullable()
                    ->after('created_by')
                    ->constrained('organizations')
                    ->onDelete('set null')
                    ->comment('Organization hosting this championship');

                $table->index('organization_id');
            }

            if (!Schema::hasColumn('championships', 'visibility')) {
                $table->enum('visibility', ['public', 'private', 'organization_only'])
                    ->default('public')
                    ->after('organization_id')
                    ->comment('Who can see this championship');

                $table->index('visibility');
            }

            if (!Schema::hasColumn('championships', 'allow_public_registration')) {
                $table->boolean('allow_public_registration')
                    ->default(true)
                    ->after('visibility')
                    ->comment('Allow anyone to register or require approval');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (!Schema::hasTable('championships')) {
            return;
        }

        Schema::table('championships', function (Blueprint $table) {
            if (Schema::hasColumn('championships', 'allow_public_registration')) {
                $table->dropColumn('allow_public_registration');
            }
            if (Schema::hasColumn('championships', 'visibility')) {
                $table->dropIndex(['visibility']);
                $table->dropColumn('visibility');
            }
            if (Schema::hasColumn('championships', 'organization_id')) {
                $table->dropForeign(['organization_id']);
                $table->dropIndex(['organization_id']);
                $table->dropColumn('organization_id');
            }
            if (Schema::hasColumn('championships', 'created_by')) {
                $table->dropForeign(['created_by']);
                $table->dropIndex(['created_by']);
                $table->dropColumn('created_by');
            }
        });
    }
};
