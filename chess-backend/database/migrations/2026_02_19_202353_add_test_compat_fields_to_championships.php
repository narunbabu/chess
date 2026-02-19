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
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('championships', function (Blueprint $table) {
            if (Schema::hasColumn('championships', 'end_date')) {
                $table->dropColumn('end_date');
            }
            if (Schema::hasColumn('championships', 'organizer_id')) {
                $table->dropForeign(['organizer_id']);
                $table->dropColumn('organizer_id');
            }
        });
    }
};
