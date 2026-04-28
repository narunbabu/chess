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
        // Convert existing integer values (1-12) to 'Class X' format before changing column type
        // Handle values stored as plain integers from the original tinyInteger column
        for ($i = 1; $i <= 12; $i++) {
            DB::table('users')
                ->where('class_of_study', (string) $i)
                ->update(['class_of_study' => 'Class ' . $i]);
        }

        Schema::table('users', function (Blueprint $table) {
            $table->string('class_of_study', 40)
                ->nullable()
                ->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert 'Class X' format back to plain integer
        for ($i = 1; $i <= 12; $i++) {
            DB::table('users')
                ->where('class_of_study', 'Class ' . $i)
                ->update(['class_of_study' => (string) $i]);
        }

        Schema::table('users', function (Blueprint $table) {
            $table->tinyInteger('class_of_study')
                ->nullable()
                ->change();
        });
    }
};
