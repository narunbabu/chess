<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * C2 Fix: Replace the rigid unique(championship_id, user_id) constraint with
 * a nullable-column approach that allows re-registration after cancellation.
 *
 * MySQL ignores NULL values in unique indexes, so cancelled/refunded rows
 * (active_unique_key = NULL) won't conflict with a new active registration
 * (active_unique_key = user_id).
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1. Add the nullable tracking column
        Schema::table('championship_participants', function (Blueprint $table) {
            $table->unsignedBigInteger('active_unique_key')
                  ->nullable()
                  ->after('user_id');
        });

        // 2. Backfill: active rows get user_id, cancelled/refunded get NULL
        DB::table('championship_participants')
            ->where(function ($q) {
                $q->whereNull('registration_status')
                  ->orWhereNotIn('registration_status', ['cancelled', 'refunded']);
            })
            ->update(['active_unique_key' => DB::raw('`user_id`')]);

        DB::table('championship_participants')
            ->whereIn('registration_status', ['cancelled', 'refunded'])
            ->update(['active_unique_key' => null]);

        // 3. Drop old constraint, add new one
        Schema::table('championship_participants', function (Blueprint $table) {
            $table->dropUnique(['championship_id', 'user_id']);

            // New unique: only one active registration per user per championship
            $table->unique(
                ['championship_id', 'active_unique_key'],
                'cp_championship_active_user_unique'
            );

            // Keep a regular index for general queries on user_id
            $table->index(
                ['championship_id', 'user_id'],
                'cp_championship_user_idx'
            );
        });
    }

    public function down(): void
    {
        Schema::table('championship_participants', function (Blueprint $table) {
            $table->dropUnique('cp_championship_active_user_unique');
            $table->dropIndex('cp_championship_user_idx');
            $table->dropColumn('active_unique_key');
            $table->unique(['championship_id', 'user_id']);
        });
    }
};
