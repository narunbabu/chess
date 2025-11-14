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
        if (Schema::hasTable('championships') && !Schema::hasColumn('championships', 'color_assignment_method')) {
            Schema::table('championships', function (Blueprint $table) {
                // Color assignment configuration
                $table->string('color_assignment_method', 20)->default('balanced')->after('total_rounds')->comment('Default color assignment method: balanced, alternate, random');

                // Tournament control configuration
                $table->tinyInteger('max_concurrent_matches')->default(0)->after('color_assignment_method')->comment('Maximum concurrent matches (0 = unlimited)');
                $table->boolean('auto_progression')->default(false)->after('max_concurrent_matches')->comment('Auto-generate next round when current round completes');
                $table->boolean('pairing_optimization')->default(true)->after('auto_progression')->comment('Use optimized Swiss pairing algorithm');
                $table->boolean('auto_invitations')->default(true)->after('pairing_optimization')->comment('Automatically send match invitations');

                // Tournament timing configuration
                $table->integer('round_interval_minutes')->default(15)->after('auto_invitations')->comment('Minutes between rounds when auto-progression enabled');
                $table->integer('invitation_timeout_minutes')->default(60)->after('round_interval_minutes')->comment('Minutes before invitation expires');
                $table->integer('match_start_buffer_minutes')->default(5)->after('invitation_timeout_minutes')->comment('Buffer time before match deadline');

                // Tournament control settings (JSON field for flexible configuration)
                $table->json('tournament_settings')->nullable()->after('match_start_buffer_minutes')->comment('Additional tournament configuration');

                // Indexes for performance
                $table->index(['status_id', 'auto_progression']);
                $table->index(['auto_progression', 'start_date']);
            });

            // Set default values for existing championships
            DB::table('championships')->update([
                'color_assignment_method' => 'balanced',
                'max_concurrent_matches' => 0,
                'auto_progression' => false,
                'pairing_optimization' => true,
                'auto_invitations' => true,
                'round_interval_minutes' => 15,
                'invitation_timeout_minutes' => 60,
                'match_start_buffer_minutes' => 5,
                'tournament_settings' => json_encode([
                    'version' => '1.0',
                    'bye_points' => 1.0,
                    'forfeit_penalty' => 0.0,
                    'allow_color_preferences' => false,
                    'require_both_accept' => true
                ])
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('championships') && Schema::hasColumn('championships', 'color_assignment_method')) {
            Schema::table('championships', function (Blueprint $table) {
                $table->dropIndex(['status_id', 'auto_progression']);
                $table->dropIndex(['auto_progression', 'start_date']);

                $table->dropColumn([
                    'color_assignment_method',
                    'max_concurrent_matches',
                    'auto_progression',
                    'pairing_optimization',
                    'auto_invitations',
                    'round_interval_minutes',
                    'invitation_timeout_minutes',
                    'match_start_buffer_minutes',
                    'tournament_settings'
                ]);
            });
        }
    }
};