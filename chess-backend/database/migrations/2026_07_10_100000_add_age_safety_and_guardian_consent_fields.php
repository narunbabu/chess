<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * P0-3 (launch-readiness): age-gating + guardian consent.
 *
 * - users.guardian_email      — the parent/guardian a minor named at signup.
 * - users.guardian_consent_at — set when that guardian approves the consent request.
 * - guardian_child_relationships.initiated_by — 'guardian' (existing invite flow,
 *   child accepts) vs 'child' (minor named a guardian at signup, guardian approves).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'guardian_email')) {
                $table->string('guardian_email')
                    ->nullable()
                    ->after('class_of_study')
                    ->comment('Parent/guardian email named by a minor at signup');
            }
            if (!Schema::hasColumn('users', 'guardian_consent_at')) {
                $table->timestamp('guardian_consent_at')
                    ->nullable()
                    ->after('guardian_email')
                    ->comment('When the named guardian approved the minor account');
            }
        });

        Schema::table('guardian_child_relationships', function (Blueprint $table) {
            if (!Schema::hasColumn('guardian_child_relationships', 'initiated_by')) {
                $table->string('initiated_by', 16)
                    ->default('guardian')
                    ->after('status')
                    ->comment("'guardian' = invite (child accepts); 'child' = signup consent (guardian approves)");
            }
        });
    }

    public function down(): void
    {
        Schema::table('guardian_child_relationships', function (Blueprint $table) {
            if (Schema::hasColumn('guardian_child_relationships', 'initiated_by')) {
                $table->dropColumn('initiated_by');
            }
        });

        Schema::table('users', function (Blueprint $table) {
            foreach (['guardian_consent_at', 'guardian_email'] as $column) {
                if (Schema::hasColumn('users', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
