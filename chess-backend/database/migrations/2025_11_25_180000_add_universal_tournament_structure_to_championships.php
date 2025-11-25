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
        if (Schema::hasTable('championships') && !Schema::hasColumn('championships', 'tournament_config')) {
            Schema::table('championships', function (Blueprint $table) {
                // Full tournament generation support
                $table->json('tournament_config')->nullable()->after('tournament_settings')->comment('Complete tournament configuration including round structure and tiebreak policy');
                $table->boolean('tournament_generated')->default(false)->after('tournament_config')->comment('Whether tournament has been fully generated');
                $table->timestamp('tournament_generated_at')->nullable()->after('tournament_generated')->comment('When tournament was generated');

                // Universal structure support
                $table->string('structure_type', 20)->default('preset')->after('format')->comment('Tournament structure type: preset, universal, custom');
                $table->boolean('use_universal_structure')->default(false)->after('structure_type')->comment('Use universal tournament structure (3-100 participants)');
                $table->integer('k4_override')->nullable()->after('use_universal_structure')->comment('Override K4 value for selective rounds');

                // Tiebreak configuration
                $table->json('tiebreak_config')->nullable()->after('k4_override')->comment('Tiebreak policy configuration and options');

                // Indexes
                $table->index(['structure_type', 'use_universal_structure']);
                $table->index(['tournament_generated', 'status_id']);
            });

            // Set default values for existing championships
            DB::table('championships')->update([
                'structure_type' => 'preset',
                'use_universal_structure' => false,
                'tiebreak_config' => json_encode([
                    'version' => '1.0',
                    'order' => ['points', 'buchholz_score', 'sonneborn_berger', 'head_to_head', 'rating', 'random'],
                    'expand_band_for_ties' => false,
                    'playoff_for_first_place' => false
                ])
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('championships') && Schema::hasColumn('championships', 'tournament_config')) {
            Schema::table('championships', function (Blueprint $table) {
                $table->dropIndex(['structure_type', 'use_universal_structure']);
                $table->dropIndex(['tournament_generated', 'status_id']);

                $table->dropColumn([
                    'tournament_config',
                    'tournament_generated',
                    'tournament_generated_at',
                    'structure_type',
                    'use_universal_structure',
                    'k4_override',
                    'tiebreak_config'
                ]);
            });
        }
    }
};