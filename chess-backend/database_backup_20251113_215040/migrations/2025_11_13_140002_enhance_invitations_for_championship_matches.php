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
        if (Schema::hasTable('invitations')) {
            Schema::table('invitations', function (Blueprint $table) {
                // Add championship match specific fields
                if (!Schema::hasColumn('invitations', 'championship_match_id')) {
                    $table->foreignId('championship_match_id')->nullable()->after('game_id')->comment('Championship match ID (if this is a championship match invitation)');
                    $table->foreign('championship_match_id')->references('id')->on('championship_matches')->onDelete('cascade');
                }

                // Add invitation priority and metadata
                if (!Schema::hasColumn('invitations', 'priority')) {
                    $table->string('priority', 20)->default('normal')->after('type')->comment('Priority: normal, high, urgent');
                }

                // Add desired color field for response handling
                if (!Schema::hasColumn('invitations', 'desired_color')) {
                    $table->string('desired_color')->nullable()->after('inviter_preferred_color')->comment('Desired color for the invited player');
                }

                // Add championship specific invitation types
                if (!Schema::hasColumn('invitations', 'auto_generated')) {
                    $table->boolean('auto_generated')->default(false)->after('expires_at')->comment('Whether this invitation was auto-generated');
                }

                // Add metadata field for championship match context
                if (!Schema::hasColumn('invitations', 'metadata')) {
                    $table->json('metadata')->nullable()->after('auto_generated')->comment('Additional invitation metadata (round, board, etc.)');
                }

                // Add indexes for performance
                $table->index(['championship_match_id']);
                $table->index(['type', 'status', 'priority']);
                $table->index(['expires_at', 'status']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('invitations')) {
            Schema::table('invitations', function (Blueprint $table) {
                if (Schema::hasColumn('invitations', 'championship_match_id')) {
                    $table->dropForeign(['championship_match_id']);
                    $table->dropIndex(['championship_match_id']);
                    $table->dropColumn('championship_match_id');
                }

                if (Schema::hasColumn('invitations', 'priority')) {
                    $table->dropColumn('priority');
                }

                if (Schema::hasColumn('invitations', 'desired_color')) {
                    $table->dropColumn('desired_color');
                }

                if (Schema::hasColumn('invitations', 'auto_generated')) {
                    $table->dropColumn('auto_generated');
                }

                if (Schema::hasColumn('invitations', 'metadata')) {
                    $table->dropColumn('metadata');
                }

                $table->dropIndex(['type', 'status', 'priority']);
                $table->dropIndex(['expires_at', 'status']);
            });
        }
    }
};