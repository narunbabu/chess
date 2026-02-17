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
            if (!Schema::hasColumn('users', 'birthday')) {
                $table->date('birthday')
                    ->nullable()
                    ->after('profile_completed')
                    ->comment('User date of birth');
            }

            if (!Schema::hasColumn('users', 'class_of_study')) {
                $table->tinyInteger('class_of_study')
                    ->nullable()
                    ->after('birthday')
                    ->comment('Class 1-12 for students');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'class_of_study')) {
                $table->dropColumn('class_of_study');
            }
            if (Schema::hasColumn('users', 'birthday')) {
                $table->dropColumn('birthday');
            }
        });
    }
};
