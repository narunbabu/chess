<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * H1 fix: Registration Status Inconsistency
 *
 * Adds a dedicated `registration_status` column that is kept in sync with
 * `payment_status_id` via the model's state-machine methods.
 *
 * Without this column the only way to derive a participant's state was to
 * read `payment_status_id`, but that field has no representation for the
 * `cancelled` state and was never updated atomically alongside the payment
 * transition, leaving room for stale reads between the two states.
 *
 * Valid values:
 *   payment_pending  — registered, awaiting payment confirmation
 *   registered       — fully confirmed (free entry or payment completed)
 *   payment_failed   — payment attempt failed; user may retry
 *   cancelled        — participant withdrew registration
 *   refunded         — payment was refunded by admin
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('championship_participants', function (Blueprint $table) {
            $table->string('registration_status', 32)
                  ->notNull()
                  ->default('payment_pending')
                  ->after('payment_status_id')
                  ->comment('Derived registration state kept in sync with payment_status_id');
        });

        // Back-fill existing rows from their current payment_status_id values.
        // payment_status IDs: 1=pending, 2=completed, 3=failed, 4=refunded
        DB::statement("
            UPDATE championship_participants
            SET registration_status = CASE payment_status_id
                WHEN 2 THEN 'registered'
                WHEN 3 THEN 'payment_failed'
                WHEN 4 THEN 'refunded'
                ELSE 'payment_pending'
            END
        ");
    }

    public function down(): void
    {
        Schema::table('championship_participants', function (Blueprint $table) {
            $table->dropColumn('registration_status');
        });
    }
};
