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
        Schema::table('championships', function (Blueprint $table) {
            if (!Schema::hasColumn('championships', 'end_date')) {
                $table->dateTime('end_date')->nullable()->after('start_date');
            }
            if (!Schema::hasColumn('championships', 'organizer_id')) {
                $table->foreignId('organizer_id')->nullable()->after('created_by')
                    ->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('championships', 'type')) {
                $table->string('type')->nullable()->after('format_id');
            }
            if (!Schema::hasColumn('championships', 'max_players')) {
                $table->integer('max_players')->nullable()->after('max_participants');
            }
            if (!Schema::hasColumn('championships', 'min_players')) {
                $table->integer('min_players')->nullable()->after('max_players');
            }
            if (!Schema::hasColumn('championships', 'auto_start')) {
                $table->boolean('auto_start')->default(false)->after('min_players');
            }
            if (!Schema::hasColumn('championships', 'auto_generate_rounds')) {
                $table->boolean('auto_generate_rounds')->default(false)->after('auto_start');
            }
            if (!Schema::hasColumn('championships', 'metadata')) {
                $table->json('metadata')->nullable()->after('auto_generate_rounds');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('championships', function (Blueprint $table) {
            $columns = ['end_date', 'type', 'max_players', 'min_players', 'auto_start', 'auto_generate_rounds', 'metadata'];
            foreach ($columns as $col) {
                if (Schema::hasColumn('championships', $col)) {
                    $table->dropColumn($col);
                }
            }
            if (Schema::hasColumn('championships', 'organizer_id')) {
                $table->dropForeign(['organizer_id']);
                $table->dropColumn('organizer_id');
            }
        });
    }
};
