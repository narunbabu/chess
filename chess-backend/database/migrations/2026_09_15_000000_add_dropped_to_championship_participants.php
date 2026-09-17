<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds the "dropped" state that CheckExpiredMatchesJob::dropPlayerFromChampionship
 * has always tried to write.
 *
 * Schema decision — why not a boolean `dropped`, and why not a
 * `registration_status` value:
 *
 *  - A timestamp carries strictly more than a flag (when it happened, for
 *    audits and for "dropped after round N" questions) and still answers the
 *    boolean question with `whereNull('dropped_at')`. The model exposes a
 *    `dropped` accessor/mutator so the caller's `['dropped' => true]` keeps
 *    working, the same alias style already used for `is_paid` /
 *    `registration_date`.
 *  - `registration_status` is the *registration* lifecycle and is driven by the
 *    payment state machine (payment_pending → registered → refunded, plus
 *    cancelled). Being dropped is orthogonal: it is a tournament-discipline
 *    fact about a fully registered, usually paid player, and it must not
 *    disturb refund handling or `scopeActive()` (which frees
 *    `active_unique_key` and lets a user re-register — exactly what a player
 *    dropped for forfeits must not be able to do).
 *  - `dropped_reason` is free-form on purpose: only 'forfeit_limit' is written
 *    today, and a lookup table for one value is not worth another join.
 *
 * A NULL `dropped_at` means the participant is still in the tournament, so all
 * existing rows are correct as-is and no back-fill is needed.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('championship_participants')) {
            return;
        }

        Schema::table('championship_participants', function (Blueprint $table) {
            if (!Schema::hasColumn('championship_participants', 'dropped_at')) {
                $table->dateTime('dropped_at')
                      ->nullable()
                      ->comment('When the player was dropped from the tournament; NULL = still in');
            }

            if (!Schema::hasColumn('championship_participants', 'dropped_reason')) {
                $table->string('dropped_reason', 64)
                      ->nullable()
                      ->comment('Why they were dropped, e.g. forfeit_limit');
            }
        });

        // Pairing reads "everyone in this championship who is not dropped".
        // Keep the migration safe if a partially-applied local schema is
        // repaired by running it again.
        if (!Schema::hasIndex('championship_participants', 'cp_championship_dropped_idx')) {
            Schema::table('championship_participants', function (Blueprint $table) {
                $table->index(['championship_id', 'dropped_at'], 'cp_championship_dropped_idx');
            });
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('championship_participants')) {
            return;
        }

        if (Schema::hasIndex('championship_participants', 'cp_championship_dropped_idx')) {
            Schema::table('championship_participants', function (Blueprint $table) {
                $table->dropIndex('cp_championship_dropped_idx');
            });
        }

        $columns = array_values(array_filter(
            ['dropped_at', 'dropped_reason'],
            fn (string $column): bool => Schema::hasColumn('championship_participants', $column)
        ));

        if ($columns !== []) {
            Schema::table('championship_participants', function (Blueprint $table) use ($columns) {
                $table->dropColumn($columns);
            });
        }
    }
};
