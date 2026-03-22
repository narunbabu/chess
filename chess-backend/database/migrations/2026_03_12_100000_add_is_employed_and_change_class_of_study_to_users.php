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
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'is_employed')) {
                $table->boolean('is_employed')
                    ->default(false)
                    ->after('class_of_study')
                    ->comment('Whether the user is employed');
            }
        });

        // Change class_of_study from tinyInteger to string
        Schema::table('users', function (Blueprint $table) {
            $table->string('class_of_study', 50)
                ->nullable()
                ->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'is_employed')) {
                $table->dropColumn('is_employed');
            }
        });

        Schema::table('users', function (Blueprint $table) {
            $table->tinyInteger('class_of_study')
                ->nullable()
                ->change();
        });
    }
};
